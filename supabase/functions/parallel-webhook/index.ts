import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { createHmac } from "https://deno.land/std@0.190.0/crypto/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature',
};

async function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  webhookId: string,
  secret: string
): Promise<boolean> {
  const signedPayload = `${webhookId}.${timestamp}.${payload}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  
  // Check against all provided signatures (space-separated)
  const signatures = signature.split(' ');
  return signatures.some(sig => sig === `v1=${expectedSignature}`);
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

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get webhook headers
    const webhookId = req.headers.get('webhook-id');
    const webhookTimestamp = req.headers.get('webhook-timestamp');
    const webhookSignature = req.headers.get('webhook-signature');

    const payload = await req.text();

    // Verify signature if secret is configured
    if (webhookSecret && webhookId && webhookTimestamp && webhookSignature) {
      const isValid = await verifyWebhookSignature(
        payload,
        webhookSignature,
        webhookTimestamp,
        webhookId,
        webhookSecret
      );

      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 400 });
      }
    }

    const webhookData = JSON.parse(payload);
    console.log('Received webhook:', webhookData);

    const { run_id, status } = webhookData;

    if (!run_id) {
      console.error('No run_id in webhook data');
      return new Response('Missing run_id', { status: 400 });
    }

    // Update task run status
    const { data: taskRun, error: taskError } = await supabase
      .from('task_runs')
      .update({ status })
      .eq('parallel_run_id', run_id)
      .select('session_id')
      .single();

    if (taskError) {
      console.error('Error updating task run:', taskError);
      throw taskError;
    }

    if (!taskRun) {
      console.error('Task run not found:', run_id);
      return new Response('Task run not found', { status: 404 });
    }

    // If completed, fetch the result
    if (status === 'completed') {
      try {
        const resultResponse = await fetch(`https://api.parallel.ai/v1/tasks/runs/${run_id}/result`, {
          headers: {
            'x-api-key': parallelApiKey,
          },
        });

        if (resultResponse.ok) {
          const result = await resultResponse.json();
          
          // Format result message
          const resultMessage = `✅ **Research Completed**

**Summary:**
${result.summary}

**Key Facts:**
${result.key_facts?.map((fact: string, i: number) => `${i + 1}. ${fact}`).join('\n') || 'No key facts provided'}

**Sources:**
${result.sources?.map((source: string, i: number) => `${i + 1}. ${source}`).join('\n') || 'No sources provided'}

*Task ID: ${run_id}*`;

          // Add result message to session
          await supabase
            .from('messages')
            .insert({
              session_id: taskRun.session_id,
              role: 'research',
              content: resultMessage,
              metadata: { 
                run_id, 
                status: 'completed',
                result 
              }
            });
        } else {
          console.error('Failed to fetch result:', resultResponse.status);
          // Add error message
          await supabase
            .from('messages')
            .insert({
              session_id: taskRun.session_id,
              role: 'system',
              content: `❌ Research task completed but failed to retrieve results. Task ID: ${run_id}`,
              metadata: { run_id, status: 'error' }
            });
        }
      } catch (error) {
        console.error('Error fetching result:', error);
        // Add error message
        await supabase
          .from('messages')
          .insert({
            session_id: taskRun.session_id,
            role: 'system',
            content: `❌ Research task completed but encountered an error retrieving results. Task ID: ${run_id}`,
            metadata: { run_id, status: 'error' }
          });
      }
    } else if (status === 'failed' || status === 'canceled') {
      // Add failure message
      await supabase
        .from('messages')
        .insert({
          session_id: taskRun.session_id,
          role: 'system',
          content: `❌ Research task ${status}. Task ID: ${run_id}`,
          metadata: { run_id, status }
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in parallel-webhook function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});