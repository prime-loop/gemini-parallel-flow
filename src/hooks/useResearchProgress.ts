import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LiveUpdate {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  data?: any;
}

interface ResearchResult {
  output: {
    content: any;
    basis?: any;
  };
  status: string;
  run_id: string;
  created_at: string;
  completed_at?: string;
  processor: string;
  warnings?: any[];
  error?: any;
}

type ResearchStatus = 'idle' | 'running_filling' | 'running_full_waiting' | 'completed' | 'failed';

interface UseResearchProgressReturn {
  progress: number;
  status: ResearchStatus;
  liveUpdates: LiveUpdate[];
  result: ResearchResult | null;
  error: string | null;
  isComplete: boolean;
  hasSSE: boolean;
  startProgress: () => void;
  cancelProgress: () => void;
}

const FILL_DURATION_MS = 600000; // 10 minutes
const COMPLETION_SNAP_MS = 400;

export function useResearchProgress(runId: string): UseResearchProgressReturn {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<ResearchStatus>('idle');
  const [liveUpdates, setLiveUpdates] = useState<LiveUpdate[]>([]);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSSE, setHasSSE] = useState(false);
  
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const eventSource = useRef<EventSource | null>(null);
  const webhookSubscription = useRef<any>(null);
  const startTime = useRef<number>(Date.now());
  const isCompleteRef = useRef(false);

  const isComplete = status === 'completed' || status === 'failed';

  // Linear progress fill over 10 minutes
  const updateProgress = useCallback(() => {
    if (isCompleteRef.current) return;
    
    const elapsed = Date.now() - startTime.current;
    const newProgress = Math.min((elapsed / FILL_DURATION_MS) * 100, 100);
    
    setProgress(newProgress);
    
    if (newProgress >= 100 && status === 'running_filling') {
      setStatus('running_full_waiting');
    }
  }, [status]);

  // Snap to 100% when completed
  const snapToComplete = useCallback((finalStatus: 'completed' | 'failed') => {
    isCompleteRef.current = true;
    
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    
    // Smooth snap to 100%
    const startProgress = progress;
    const snapStartTime = Date.now();
    
    const snapInterval = setInterval(() => {
      const elapsed = Date.now() - snapStartTime;
      const snapProgress = Math.min(elapsed / COMPLETION_SNAP_MS, 1);
      const currentProgress = startProgress + (100 - startProgress) * snapProgress;
      
      setProgress(currentProgress);
      
      if (snapProgress >= 1) {
        clearInterval(snapInterval);
        setProgress(100);
        setStatus(finalStatus);
      }
    }, 16); // ~60fps
  }, [progress]);

  // Fetch final result
  const fetchResult = useCallback(async () => {
    try {
      const response = await fetch(`https://api.parallel.ai/v1/tasks/runs/${runId}/result`, {
        headers: {
          'x-api-key': import.meta.env.VITE_PARALLEL_API_KEY || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch result: ${response.status}`);
      }

      const resultData = await response.json();
      setResult(resultData);
      snapToComplete('completed');
      
      // Analytics
      console.log('research_ui_completed', { run_id: runId });
      
    } catch (err) {
      console.error('Error fetching result:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch result');
      snapToComplete('failed');
      
      // Analytics  
      console.log('research_ui_failed', { run_id: runId, error_code: 'fetch_failed' });
    }
  }, [runId, snapToComplete]);

  // Setup SSE connection
  const setupSSE = useCallback(() => {
    if (eventSource.current) return;

    const sseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-stream/${runId}`;
    
    try {
      eventSource.current = new EventSource(sseUrl);
      setHasSSE(true);
      
      eventSource.current.onopen = () => {
        console.log('SSE connection opened');
      };
      
      eventSource.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different event types
          if (data.type === 'task_run.state') {
            if (data.run?.status === 'completed' || data.run?.status === 'failed') {
              fetchResult();
            }
          } else if (data.type?.startsWith('task_run.progress_')) {
            // Add to live updates
            const update: LiveUpdate = {
              id: `${Date.now()}-${Math.random()}`,
              timestamp: new Date().toISOString(),
              type: data.type,
              message: data.message || JSON.stringify(data),
              data: data
            };
            
            setLiveUpdates(prev => [...prev, update]);
            
            // Analytics
            console.log('research_stream_event', { type: data.type });
          }
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };
      
      eventSource.current.onerror = (err) => {
        console.error('SSE error:', err);
        if (eventSource.current) {
          eventSource.current.close();
          eventSource.current = null;
        }
        
        // Try to reconnect after delay
        setTimeout(() => {
          if (!isCompleteRef.current) {
            setupSSE();
          }
        }, 5000);
      };
      
    } catch (err) {
      console.error('Failed to setup SSE:', err);
      setHasSSE(false);
    }
  }, [runId, fetchResult]);

  // Setup webhook subscription
  const setupWebhookSubscription = useCallback(() => {
    if (webhookSubscription.current) return;
    
    // Subscribe to task_runs table changes for this run_id
    webhookSubscription.current = supabase
      .channel(`task_run_${runId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'task_runs',
          filter: `run_id=eq.${runId}`
        },
        (payload) => {
          console.log('Webhook received:', payload);
          
          const newData = payload.new as any;
          if (newData.status === 'completed' || newData.status === 'failed') {
            if (newData.result) {
              // Parse result if it's a string
              let parsedResult = newData.result;
              if (typeof parsedResult === 'string') {
                try {
                  parsedResult = JSON.parse(parsedResult);
                } catch (e) {
                  console.warn('Failed to parse result JSON:', e);
                }
              }
              
              setResult(parsedResult);
              snapToComplete(newData.status === 'completed' ? 'completed' : 'failed');
            } else {
              // Fetch result from API
              fetchResult();
            }
          }
        }
      )
      .subscribe();
  }, [runId, snapToComplete, fetchResult]);

  // Start progress tracking
  const startProgress = useCallback(() => {
    if (progressInterval.current) return;
    
    setStatus('running_filling');
    setProgress(0);
    setError(null);
    setResult(null);
    setLiveUpdates([]);
    isCompleteRef.current = false;
    startTime.current = Date.now();
    
    // Start progress interval
    progressInterval.current = setInterval(updateProgress, 100);
    
    // Setup SSE and webhook
    setupSSE();
    setupWebhookSubscription();
    
    // Analytics
    console.log('research_ui_started', { run_id: runId });
    
  }, [runId, updateProgress, setupSSE, setupWebhookSubscription]);

  // Cancel progress
  const cancelProgress = useCallback(() => {
    isCompleteRef.current = true;
    
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    
    if (eventSource.current) {
      eventSource.current.close();
      eventSource.current = null;
    }
    
    if (webhookSubscription.current) {
      webhookSubscription.current.unsubscribe();
      webhookSubscription.current = null;
    }
    
    setStatus('idle');
    setProgress(0);
    
    // Analytics
    console.log('research_ui_canceled', { run_id: runId });
  }, [runId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelProgress();
    };
  }, [cancelProgress]);

  // Progress tick analytics
  useEffect(() => {
    if (progress > 0 && progress % 10 === 0) {
      console.log('research_progress_tick', { percent: progress });
    }
  }, [progress]);

  return {
    progress,
    status,
    liveUpdates,
    result,
    error,
    isComplete,
    hasSSE,
    startProgress,
    cancelProgress,
  };
}