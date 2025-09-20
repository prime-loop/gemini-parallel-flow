import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parallelApiKey = Deno.env.get('PARALLEL_API_KEY')!;
    
    if (!parallelApiKey) {
      throw new Error('PARALLEL_API_KEY not configured');
    }

    // Extract run_id from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const runId = pathParts[pathParts.length - 1];

    if (!runId || runId === 'research-stream') {
      throw new Error('Run ID not provided in path');
    }

    console.log('Streaming events for run ID:', runId);

    // Create SSE stream to Parallel API
    const parallelResponse = await fetch(`https://api.parallel.ai/v1/tasks/runs/${runId}/events`, {
      headers: {
        'x-api-key': parallelApiKey,
        'Accept': 'text/event-stream',
        'parallel-beta': 'events-sse-2025-07-24',
      },
    });

    if (!parallelResponse.ok) {
      const errorText = await parallelResponse.text();
      console.error('Error from Parallel API:', errorText);
      throw new Error(`Parallel API error: ${parallelResponse.status} - ${errorText}`);
    }

    // Create a readable stream that forwards Parallel's SSE events
    const stream = new ReadableStream({
      async start(controller) {
        const reader = parallelResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Forward the chunk to the client
            controller.enqueue(value);
          }
        } catch (error) {
          console.error('Error reading from Parallel stream:', error);
          controller.error(error);
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in research-stream function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});