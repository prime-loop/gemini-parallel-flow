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

    // Create Parallel Task Run
    const parallelRequest = {
      task_spec: {
        output_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            key_facts: { 
              type: 'array',
              items: { type: 'string' }
            },
            sources: {
              type: 'array', 
              items: { type: 'string' }
            }
          },
          required: ['summary', 'sources']
        }
      },
      input: JSON.stringify(brief),
      processor: 'core',
      enable_events: true,
      metadata: { session_id: sessionId },
      webhook: {
        url: `${supabaseUrl}/functions/v1/parallel-webhook`,
        event_types: ['task_run.status']
      }
    };

    const parallelResponse = await fetch('https://api.parallel.ai/v1/tasks/runs', {
      method: 'POST',
      headers: {
        'x-api-key': parallelApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parallelRequest),
    });

    if (!parallelResponse.ok) {
      const error = await parallelResponse.text();
      console.error('Parallel API error:', error);
      throw new Error(`Parallel API error: ${parallelResponse.status}`);
    }

    const parallelData = await parallelResponse.json();
    const runId = parallelData.run_id;

    // Store task run in database
    const { error: dbError } = await supabase
      .from('task_runs')
      .insert({
        session_id: sessionId,
        parallel_run_id: runId,
        status: 'queued'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    // Add research message to session
    await supabase
      .from('messages')
      .insert({
        session_id: sessionId,
        role: 'research',
        content: `🔍 **Research Started**\n\n**Objective:** ${brief.objective}\n\n**Estimated Time:** ${brief.timebox_minutes} minutes\n\n*Task ID: ${runId}*`,
        metadata: { run_id: runId, status: 'started' }
      });

    return new Response(JSON.stringify({ 
      run_id: runId,
      sse_url: `${supabaseUrl}/functions/v1/research-stream/${runId}`,
      status: 'started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in research-start function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});