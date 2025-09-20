import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResearchRequest {
  sessionId: string;
  brief: {
    objective: string;
    constraints: string[];
    target_sources: string[];
    disallowed_sources: string[];
    timebox_minutes: number;
    expected_output_fields: string[];
    summary: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const parallelApiKey = Deno.env.get('PARALLEL_API_KEY')!;

    if (!parallelApiKey) {
      throw new Error('PARALLEL_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { sessionId, brief }: ResearchRequest = await req.json();

    console.log('🔍 Validating session and inputs:', { 
      sessionId, 
      briefObjective: brief?.objective?.substring(0, 100) + '...' 
    });

    // Verify session exists before proceeding
    const { data: sessionData, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, title')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      console.error('❌ Session validation failed:', {
        sessionId,
        error: sessionError,
        data: sessionData
      });
      
      // Create the session if it doesn't exist
      console.log('🆕 Creating missing session...');
      const { data: newSession, error: createError } = await supabase
        .from('chat_sessions')
        .insert({
          id: sessionId,
          title: 'Research Session',
          user_id: null // For demo mode
        })
        .select()
        .single();
        
      if (createError) {
        console.error('❌ Failed to create session:', createError);
        throw new Error(`Failed to create session: ${createError.message}`);
      }
      
      console.log('✅ Created new session:', newSession);
    } else {
      console.log('✅ Session validated:', sessionData);
    }

    // Create Parallel Task Run with correct payload structure
    const parallelRequest = {
      input: brief.objective,
      processor: 'core', // Use 'core' processor for research tasks
      enable_events: true, // Enable SSE events
      webhook: {
        url: `${supabaseUrl}/functions/v1/parallel-webhook`,
        event_types: ['task_run.status']
      },
      output_schema: {
        type: 'object',
        properties: {
          company: { type: 'string' },
          HQ_region: { type: 'string' },
          EU_risk_drivers: { type: 'array', items: { type: 'string' } },
          use_cases: { type: 'array', items: { type: 'string' } },
          current_tools: { type: 'array', items: { type: 'string' } },
          buyer_roles: { type: 'array', items: { type: 'object' } },
          sources: { type: 'array', items: { type: 'string' } }
        }
      }
    };

    console.log('🚀 Sending Parallel API request:', JSON.stringify(parallelRequest, null, 2));

    let parallelResponse;
    let parallelData;
    
    try {
      parallelResponse = await fetch('https://api.parallel.ai/v1/tasks/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': parallelApiKey,
          'parallel-beta': 'webhook-2025-08-12,events-sse-2025-07-24', // Enable webhooks and SSE
        },
        body: JSON.stringify(parallelRequest),
      });

      console.log('📡 Parallel API response received:', {
        status: parallelResponse.status,
        statusText: parallelResponse.statusText,
        ok: parallelResponse.ok,
        headers: Object.fromEntries(parallelResponse.headers.entries())
      });
      
    } catch (fetchError) {
      console.error('❌ Network error calling Parallel API:', fetchError);
      throw new Error(`Network error calling Parallel API: ${fetchError.message}`);
    }
    
    let responseText;
    try {
      responseText = await parallelResponse.text();
      console.log('📄 Parallel API raw response:', responseText);
    } catch (textError) {
      console.error('❌ Error reading Parallel API response text:', textError);
      throw new Error(`Error reading Parallel API response: ${textError.message}`);
    }

    if (!parallelResponse.ok) {
      console.error('❌ Parallel API error response:', {
        status: parallelResponse.status,
        statusText: parallelResponse.statusText,
        body: responseText
      });

      // Try to parse error details
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseText);
        console.error('💥 Parsed error details:', errorDetails);
      } catch (parseError) {
        console.error('💥 Could not parse error response as JSON');
        errorDetails = { raw_error: responseText };
      }

      throw new Error(`Parallel API error (${parallelResponse.status}): ${responseText}`);
    }

    try {
      parallelData = JSON.parse(responseText);
      console.log('✅ Parallel API success response parsed:', parallelData);
    } catch (jsonError) {
      console.error('❌ Error parsing successful Parallel API response as JSON:', jsonError);
      throw new Error(`Error parsing Parallel API response: ${jsonError.message}`);
    }

    const runId = parallelData.run_id;
    
    if (!runId) {
      console.error('❌ No run_id in Parallel API response:', parallelData);
      throw new Error('Parallel API did not return a run_id');
    }
    
    console.log('🎉 Research task created successfully:', {
      runId,
      sessionId,
      objective: brief.objective,
      response: parallelData
    });

    // Store task run in database
    console.log('💾 Storing task run in database:', { sessionId, runId });
    
    const { error: dbError } = await supabase
      .from('task_runs')
      .insert({
        session_id: sessionId,
        run_id: runId,
        parallel_run_id: runId,
        brief_text: brief.summary,
        status: 'queued'
      });

    if (dbError) {
      console.error('❌ Database error storing task run:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }
    
    console.log('✅ Task run stored in database successfully');

    // Add research message to session
    console.log('💬 Adding research started message to chat');
    
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        session_id: sessionId,
        role: 'research',
        content: `🔍 **Research Started**\n\n**Objective:** ${brief.objective}\n\n**Estimated Time:** ${brief.timebox_minutes} minutes\n\n*Task ID: ${runId}*`,
        metadata: { run_id: runId, status: 'started' }
      });
      
    if (messageError) {
      console.error('❌ Error adding research message:', messageError);
      // Don't throw here, task is already created
    } else {
      console.log('✅ Research started message added to chat');
    }

    return new Response(JSON.stringify({ 
      run_id: runId,
      sse_url: `${supabaseUrl}/functions/v1/research-stream/${runId}`,
      status: 'started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 CRITICAL ERROR in research-start function:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      sessionId: req.url ? new URL(req.url).searchParams.get('sessionId') : 'unknown'
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