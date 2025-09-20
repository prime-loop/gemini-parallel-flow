export interface ParallelTaskRun {
  run_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface ParallelTaskResult {
  summary: string;
  key_facts: string[];
  sources: string[];
  [key: string]: any;
}

export interface ParallelEvent {
  event_id: string;
  event_type: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface CreateTaskRunRequest {
  task_spec: {
    output_schema: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
  input: string;
  processor: 'core';
  enable_events: boolean;
  metadata?: Record<string, any>;
  webhook?: {
    url: string;
    event_types: string[];
  };
}

export class ParallelService {
  private apiKey: string;
  private baseUrl = 'https://api.parallel.ai/v1';
  private betaUrl = 'https://api.parallel.ai/v1beta';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createTaskRun(request: CreateTaskRunRequest): Promise<ParallelTaskRun> {
    const response = await fetch(`${this.baseUrl}/tasks/runs`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Parallel API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  async getTaskRun(runId: string): Promise<ParallelTaskRun> {
    const response = await fetch(`${this.baseUrl}/tasks/runs/${runId}`, {
      headers: {
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Parallel API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  async getTaskResult(runId: string): Promise<ParallelTaskResult> {
    const response = await fetch(`${this.baseUrl}/tasks/runs/${runId}/result`, {
      headers: {
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Parallel API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  async *streamEvents(
    runId: string, 
    lastEventId?: string
  ): AsyncIterableIterator<ParallelEvent> {
    const url = new URL(`${this.betaUrl}/tasks/runs/${runId}/events`);
    if (lastEventId) {
      url.searchParams.set('last_event_id', lastEventId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'x-api-key': this.apiKey,
        'Accept': 'text/event-stream',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Parallel Events API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              yield event;
            } catch (e) {
              console.warn('Failed to parse SSE event:', line);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  createDefaultOutputSchema() {
    return {
      type: 'object' as const,
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
    };
  }
}