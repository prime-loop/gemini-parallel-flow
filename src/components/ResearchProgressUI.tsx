import { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useResearchProgress } from '@/hooks/useResearchProgress';
import { ParticleAnimation } from './ParticleAnimation';
import { LiveUpdatesPanel } from './LiveUpdatesPanel';
import { Copy, FileText, CheckCircle, XCircle, RotateCcw, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface ResearchProgressUIProps {
  runId: string;
  query: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

export function ResearchProgressUI({ 
  runId, 
  query, 
  onComplete, 
  onError, 
  onCancel 
}: ResearchProgressUIProps) {
  const { toast } = useToast();
  const {
    progress,
    status,
    liveUpdates,
    result,
    error,
    isComplete,
    hasSSE,
    startProgress,
    cancelProgress
  } = useResearchProgress(runId);

  const [showParticles, setShowParticles] = useState(true);
  const [completionAnimation, setCompletionAnimation] = useState(false);

  useEffect(() => {
    startProgress();
  }, [runId, startProgress]);

  useEffect(() => {
    if (isComplete) {
      setShowParticles(false);
      setCompletionAnimation(true);
      
      const timer = setTimeout(() => {
        setCompletionAnimation(false);
        if (result && onComplete) {
          onComplete(result);
        } else if (error && onError) {
          onError(error);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isComplete, result, error, onComplete, onError]);

  const handleCopyJSON = async () => {
    if (result?.output?.content) {
      try {
        await navigator.clipboard.writeText(JSON.stringify(result.output.content, null, 2));
        toast({
          title: 'Copied to clipboard',
          description: 'Research JSON data copied successfully',
        });
      } catch (err) {
        toast({
          title: 'Copy failed',
          description: 'Failed to copy data to clipboard',
          variant: 'destructive',
        });
      }
    }
  };

  const handleRetry = () => {
    setShowParticles(true);
    setCompletionAnimation(false);
    startProgress();
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'idle':
        return 'Initializing research...';
      case 'running_filling':
        return 'Spinning up research...';
      case 'running_full_waiting':
        return hasSSE ? 'Still processing. Results will land here.' : 'Crunching sources...';
      case 'completed':
        return 'Research complete.';
      case 'failed':
        return 'Research hit an error. Try again.';
      default:
        return 'Processing...';
    }
  };

  const getProgressColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-primary';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              {status === 'completed' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : status === 'failed' ? (
                <XCircle className="h-5 w-5 text-red-500" />
              ) : (
                <Clock className="h-5 w-5 text-primary animate-pulse" />
              )}
              Research Task
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {query}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status === 'completed' ? 'default' : status === 'failed' ? 'destructive' : 'secondary'}>
              {status.replace('_', ' ')}
            </Badge>
            {status !== 'completed' && status !== 'failed' && onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar with Particles */}
        <div className="relative">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{getStatusMessage()}</span>
              <span className="text-muted-foreground">
                {Math.round(progress)}%
              </span>
            </div>
            
            <div className="relative">
              <Progress 
                value={progress} 
                className="h-3 transition-all duration-300"
              />
              
              {/* Custom progress bar styling */}
              <div 
                className={`absolute inset-0 h-3 rounded-full transition-all duration-300 ${getProgressColor()}`}
                style={{ width: `${progress}%` }}
              />
              
              {/* Completion pulse animation */}
              <AnimatePresence>
                {completionAnimation && (
                  <motion.div
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 1.05, opacity: 0 }}
                    exit={{ scale: 1, opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`absolute inset-0 h-3 rounded-full ${
                      status === 'completed' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
          
          {/* Particle Animation */}
          {showParticles && (status === 'running_filling' || status === 'running_full_waiting') && (
            <ParticleAnimation 
              isActive={true}
              targetElement="progress-bar"
              particleCount={24}
              spawnInterval={800}
            />
          )}
        </div>

        {/* Live Updates Panel */}
        {hasSSE && liveUpdates.length > 0 && (
          <>
            <Separator />
            <LiveUpdatesPanel 
              updates={liveUpdates}
              isActive={status === 'running_filling' || status === 'running_full_waiting'}
              height={220}
            />
          </>
        )}

        {/* Completion Actions */}
        {status === 'completed' && result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="space-y-4"
          >
            <Separator />
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Research Complete</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyJSON}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </Button>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  View Full Report
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {status === 'failed' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <Separator />
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-red-600">Research Failed</h3>
                {error && (
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </motion.div>
        )}

        {/* No SSE Placeholder */}
        {!hasSSE && (status === 'running_filling' || status === 'running_full_waiting') && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              Still processing. Results will land here.
            </motion.div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}