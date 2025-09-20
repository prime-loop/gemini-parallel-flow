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

interface ChatRequest {
  sessionId: string;
  message: string;
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
    const { sessionId, message }: ChatRequest = await req.json();

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

    // Add the new user message
    geminiMessages.push({
      role: 'user',
      parts: [{ text: message }]
    });

    console.log('🚀 Sending request to Gemini API with', geminiMessages.length, 'messages');

    let geminiResponse;
    try {
      // Call Gemini API
      geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'x-goog-api-key': geminiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.9,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
          },
        }),
      });

      console.log('📡 Gemini API response received:', {
        status: geminiResponse.status,
        statusText: geminiResponse.statusText,
        ok: geminiResponse.ok
      });
      
    } catch (fetchError) {
      console.error('❌ Network error calling Gemini API:', fetchError);
      throw new Error(`Network error calling Gemini API: ${fetchError.message}`);
    }

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('❌ Gemini API error response:', {
        status: geminiResponse.status,
        statusText: geminiResponse.statusText,
        body: errorText
      });
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
    }

    let geminiData;
    try {
      geminiData = await geminiResponse.json();
      console.log('✅ Gemini API response parsed successfully');
    } catch (jsonError) {
      console.error('❌ Error parsing Gemini API response as JSON:', jsonError);
      throw new Error(`Error parsing Gemini API response: ${jsonError.message}`);
    }

    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const tokens = geminiData.usageMetadata?.totalTokenCount || 0;

    if (!content) {
      throw new Error('No response generated');
    }

    return new Response(JSON.stringify({ 
      content,
      tokens,
      model: 'gemini-2.5-flash'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 CRITICAL ERROR in chat-send function:', {
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