import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, Settings, Database } from 'lucide-react';

interface LiveUpdate {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  data?: any;
}

interface LiveUpdatesPanelProps {
  updates: LiveUpdate[];
  isActive: boolean;
  height?: number;
}

export function LiveUpdatesPanel({ 
  updates, 
  isActive, 
  height = 220 
}: LiveUpdatesPanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new updates arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [updates]);

  const getUpdateIcon = (type: string) => {
    if (type.includes('plan')) return <Settings className="h-3 w-3" />;
    if (type.includes('tool')) return <Zap className="h-3 w-3" />;
    if (type.includes('stats')) return <Database className="h-3 w-3" />;
    return <Activity className="h-3 w-3" />;
  };

  const getUpdateVariant = (type: string): "default" | "secondary" | "outline" => {
    if (type.includes('plan')) return 'default';
    if (type.includes('tool')) return 'secondary';
    return 'outline';
  };

  const formatMessage = (update: LiveUpdate) => {
    try {
      // Try to extract meaningful information from the update
      if (update.data?.message) {
        return update.data.message;
      }
      
      if (update.data?.sources_considered) {
        return `Sources considered: ${update.data.sources_considered}`;
      }
      
      if (update.data?.sources_read) {
        return `Sources read: ${update.data.sources_read}`;
      }
      
      // Fall back to the raw message
      return update.message.length > 100 
        ? update.message.substring(0, 100) + '...' 
        : update.message;
    } catch {
      return 'Processing update...';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour12: false,
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '';
    }
  };

  if (updates.length === 0) {
    return (
      <div 
        className="flex items-center justify-center border border-border rounded-lg bg-muted/30"
        style={{ height: `${height}px` }}
      >
        <div className="text-center text-sm text-muted-foreground">
          {isActive ? (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Waiting for live updates...
            </motion.div>
          ) : (
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              No live updates available
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="border border-border rounded-lg bg-card"
      style={{ height: `${height}px` }}
    >
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Live Updates
          </h4>
          <Badge variant="outline" className="text-xs">
            {updates.length} updates
          </Badge>
        </div>
      </div>
      
      <ScrollArea ref={scrollAreaRef} className="h-full">
        <div className="p-3 space-y-2">
          <AnimatePresence initial={false}>
            {updates.map((update, index) => (
              <motion.div
                key={update.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ 
                  duration: 0.3,
                  delay: index * 0.05 
                }}
                className="flex items-start gap-3 p-2 rounded-lg bg-muted/30 border border-border/50"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getUpdateIcon(update.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getUpdateVariant(update.type)} className="text-xs">
                      {update.type.replace('task_run.progress_', '').replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(update.timestamp)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-foreground leading-relaxed">
                    {formatMessage(update)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}