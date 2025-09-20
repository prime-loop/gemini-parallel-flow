export interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface ResearchBrief {
  objective: string;
  constraints: string[];
  target_sources: string[];
  disallowed_sources: string[];
  timebox_minutes: number;
  expected_output_fields: string[];
  summary: string;
}

export class GeminiService {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateContent(messages: GeminiMessage[]): Promise<GeminiResponse> {
    const response = await fetch(`${this.baseUrl}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async streamGenerateContent(
    messages: GeminiMessage[],
    onChunk: (text: string) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}:streamGenerateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                onChunk(data.candidates[0].content.parts[0].text);
              }
            } catch (e) {
              // Skip invalid JSON chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async createResearchPlan(conversation: GeminiMessage[]): Promise<ResearchBrief> {
    const planningPrompt: GeminiMessage = {
      role: 'user',
      parts: [{
        text: `You are a research planner. Based on the conversation above, create a structured research brief. You must return a JSON object with exactly these fields:
        - objective: string (clear research goal)
        - constraints: string[] (any limitations or requirements)
        - target_sources: string[] (preferred types of sources)
        - disallowed_sources: string[] (sources to avoid)
        - timebox_minutes: number (estimated time needed, 5-30 minutes)
        - expected_output_fields: string[] (what fields should be in the result)
        - summary: string (one-sentence description)

        Return ONLY valid JSON, no other text.`
      }]
    };

    const messages = [...conversation, planningPrompt];
    const response = await this.generateContent(messages);
    
    const content = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('No response from Gemini');

    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON response: ${content}`);
    }
  }
}