import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  webhookId: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signedPayload = `${webhookId}.${timestamp}.${payload}`;
  const expectedBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(expectedBytes)));

  // Signature header may contain multiple space-separated values
  const signatures = signature.split(' ');
  return signatures.some(sig => sig === expectedSignature);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const parallelApiKey = Deno.env.get('PARALLEL_API_KEY')!;
    const webhookSecret = Deno.env.get('PARALLEL_WEBHOOK_SECRET');

    console.log('🔧 Environment check:', {
      supabaseUrl: supabaseUrl ? '✅ Set' : '❌ Missing',
      supabaseKey: supabaseKey ? '✅ Set' : '❌ Missing',
      parallelApiKey: parallelApiKey ? '✅ Set' : '❌ Missing',
      webhookSecret: webhookSecret ? '✅ Set' : '⚠️ Not set (optional)'
    });

    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.text();
    console.log('📨 Received webhook payload:', payload);
    
    let webhookData;
    try {
      webhookData = JSON.parse(payload);
      console.log('✅ Parsed webhook data:', JSON.stringify(webhookData, null, 2));
    } catch (parseError) {
      console.error('❌ Error parsing webhook payload as JSON:', parseError);
      throw new Error(`Invalid JSON payload: ${parseError.message}`);
    }

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      console.log('🔐 Verifying webhook signature...');
      const signature = req.headers.get('webhook-signature') || '';
      const timestamp = req.headers.get('webhook-timestamp') || '';
      const webhookId = req.headers.get('webhook-id') || '';

      console.log('🔍 Signature verification data:', {
        signature: signature ? '✅ Present' : '❌ Missing',
        timestamp: timestamp ? '✅ Present' : '❌ Missing',
        webhookId: webhookId ? '✅ Present' : '❌ Missing'
      });

      const isValid = await verifyWebhookSignature(payload, signature, timestamp, webhookId, webhookSecret);
      if (!isValid) {
        console.error('❌ Invalid webhook signature verification failed');
        return new Response('Invalid signature', { status: 401 });
      }
      console.log('✅ Webhook signature verified successfully');
    } else {
      console.log('⚠️ Webhook signature verification skipped (no secret configured)');
    }

    const { status, run_id } = webhookData;
    
    console.log('📊 Processing webhook:', {
      status,
      run_id,
      timestamp: new Date().toISOString()
    });

    if (!run_id) {
      console.error('❌ No run_id in webhook data:', webhookData);
      throw new Error('Missing run_id in webhook payload');
    }

    // Update task status in database
    console.log('💾 Updating task status in database...');
    const { error: updateError } = await supabase
      .from('task_runs')
      .update({ 
        status: status,
        completed_at: status === 'completed' ? new Date().toISOString() : null
      })
      .eq('parallel_run_id', run_id);

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    console.log(`✅ Updated task ${run_id} to status: ${status}`);

    // If completed, fetch results and add to messages
    if (status === 'completed') {
      console.log('Task completed, fetching results from Parallel API');

      const parallelResponse = await fetch(`https://api.parallel.ai/v1/tasks/runs/${run_id}`, {
        headers: {
          'x-api-key': parallelApiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!parallelResponse.ok) {
        const errorText = await parallelResponse.text();
        console.error('Error fetching Parallel results:', errorText);
        throw new Error(`Failed to fetch results: ${parallelResponse.status}`);
      }

      const resultData = await parallelResponse.json();
      console.log('Parallel results:', JSON.stringify(resultData, null, 2));

      // Get session_id from task_runs table
      const { data: taskData, error: taskError } = await supabase
        .from('task_runs')
        .select('session_id')
        .eq('parallel_run_id', run_id)
        .single();

      if (taskError || !taskData) {
        console.error('Error finding task:', taskError);
        throw new Error('Task not found');
      }

      // Store results in task_runs table
      await supabase
        .from('task_runs')
        .update({ 
          result: JSON.stringify(resultData.output),
          metadata: { completed_at: new Date().toISOString() }
        })
        .eq('parallel_run_id', run_id);

      // Format results for chat display
      const output = resultData.output;
      let formattedContent = '✅ **Research Complete**\n\n';

      if (output?.summary) {
        formattedContent += `## Summary\n${output.summary}\n\n`;
      }

      if (output?.key_facts && Array.isArray(output.key_facts)) {
        formattedContent += '## Key Facts\n';
        output.key_facts.forEach((fact: string, index: number) => {
          formattedContent += `${index + 1}. ${fact}\n`;
        });
        formattedContent += '\n';
      }

      if (output?.sources && Array.isArray(output.sources)) {
        formattedContent += '## Sources\n';
        output.sources.forEach((source: string, index: number) => {
          formattedContent += `${index + 1}. ${source}\n`;
        });
        formattedContent += '\n';
      }

      formattedContent += `*Task ID: ${run_id}*`;

      // Add results message to chat
      await supabase
        .from('messages')
        .insert({
          session_id: taskData.session_id,
          role: 'research',
          content: formattedContent,
          metadata: { 
            run_id: run_id, 
            status: 'completed',
            results: output
          }
        });

      console.log('Research results added to chat');
    } else if (status === 'failed' || status === 'canceled') {
      console.log(`Task ${status}, adding failure message`);

      // Get session_id from task_runs table
      const { data: taskData, error: taskError } = await supabase
        .from('task_runs')
        .select('session_id')
        .eq('parallel_run_id', run_id)
        .single();

      if (taskError || !taskData) {
        console.error('Error finding task:', taskError);
        throw new Error('Task not found');
      }

      // Add failure message to chat
      await supabase
        .from('messages')
        .insert({
          session_id: taskData.session_id,
          role: 'system',
          content: `❌ **Research ${status.charAt(0).toUpperCase() + status.slice(1)}**\n\nThe research task encountered an issue and could not be completed.\n\n*Task ID: ${run_id}*\n\nPlease try again with a different query or check the Parallel.ai service status.`,
          metadata: { 
            run_id: run_id, 
            status: status,
            error: true
          }
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 CRITICAL ERROR in parallel-webhook function:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      headers: Object.fromEntries(req.headers.entries()),
      url: req.url,
      method: req.method
    });
    
    return new Response(JSON.stringify({ 
      error: error.message,
      type: error.name,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});