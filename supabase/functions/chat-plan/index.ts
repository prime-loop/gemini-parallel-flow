import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface ResearchBrief {
  objective: string;
  constraints: string[];
  target_sources: string[];
  disallowed_sources: string[];
  timebox_minutes: number;
  expected_output_fields: string[];
  summary: string;
}

interface PlanRequest {
  sessionId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { sessionId }: PlanRequest = await req.json();

    // Fetch conversation history
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    // Convert to Gemini format
    const geminiMessages: GeminiMessage[] = messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

    // Add planning prompt
    const planningPrompt: GeminiMessage = {
      role: 'user',
      parts: [{
        text: `You are a research planner. Based on the conversation above, create a structured research brief. You must return a JSON object with exactly these fields:
        - objective: string (clear research goal)
        - constraints: string[] (any limitations or requirements)
        - target_sources: string[] (preferred types of sources like "academic papers", "news articles", "official websites")
        - disallowed_sources: string[] (sources to avoid like "social media", "opinion blogs")
        - timebox_minutes: number (estimated time needed, 5-30 minutes)
        - expected_output_fields: string[] (what fields should be in the result like "summary", "key_facts", "sources")
        - summary: string (one-sentence description)

        Return ONLY valid JSON, no other text.`
      }]
    };

    const allMessages = [...geminiMessages, planningPrompt];

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'x-goog-api-key': geminiApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: allMessages,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const error = await geminiResponse.text();
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No response from Gemini');
    }

    // Parse JSON response
    let researchBrief: ResearchBrief;
    try {
      researchBrief = JSON.parse(content);
    } catch (error) {
      console.error('Invalid JSON from Gemini:', content);
      throw new Error(`Invalid JSON response: ${content}`);
    }

    // Validate required fields
    const requiredFields = ['objective', 'constraints', 'target_sources', 'disallowed_sources', 'timebox_minutes', 'expected_output_fields', 'summary'];
    for (const field of requiredFields) {
      if (!(field in researchBrief)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return new Response(JSON.stringify(researchBrief), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-plan function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});