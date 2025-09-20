import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
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

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    // Format messages for Gemini
    const geminiMessages: GeminiMessage[] = (messages || [])
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

    // Add system prompt for research brief generation
    geminiMessages.push({
      role: 'user',
      parts: [{
        text: `Based on our conversation history, create a comprehensive research brief. Return your response as a JSON object with the following structure:

{
  "objective": "Clear research objective based on the conversation",
  "constraints": ["Any limitations or constraints mentioned"],
  "target_sources": ["academic", "news", "web", "technical_docs"],
  "disallowed_sources": ["social_media", "forums"],
  "timebox_minutes": 5,
  "expected_output_fields": ["summary", "key_facts", "sources", "recommendations"],
  "summary": "Brief summary of what research is needed"
}

Focus on the user's most recent questions and interests. Make the objective specific and actionable.`
      }]
    });

    console.log('Generating research brief with Gemini');

    // Call Gemini API
    const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'x-goog-api-key': geminiApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          temperature: 0.3,
          topK: 1,
          topP: 1,
          maxOutputTokens: 1024,
        },
      }),
    });

    console.log('Gemini API response status:', geminiResponse.status);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No response generated');
    }

    // Parse JSON response
    let brief: ResearchBrief;
    try {
      brief = JSON.parse(content);
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      console.error('Raw content:', content);
      throw new Error('Failed to parse research brief JSON');
    }

    // Validate required fields
    const requiredFields = ['objective', 'constraints', 'target_sources', 'disallowed_sources', 'timebox_minutes', 'expected_output_fields', 'summary'];
    for (const field of requiredFields) {
      if (!(field in brief)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return new Response(JSON.stringify(brief), {
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