import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Activity, 
  Zap, 
  Database, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivitySidebarProps {
  collapsed?: boolean;
}

interface ActivityEvent {
  id: string;
  timestamp: string;
  type: 'research_started' | 'research_completed' | 'research_failed' | 'webhook_received' | 'sse_event' | 'error';
  title: string;
  message?: string;
  metadata?: any;
  runId?: string;
}

interface SystemStatus {
  sseConnected: boolean;
  webhookHealthy: boolean;
  lastActivity: string | null;
  activeRuns: number;
}

export function ActivitySidebar({ collapsed = false }: ActivitySidebarProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    sseConnected: false,
    webhookHealthy: true,
    lastActivity: null,
    activeRuns: 0
  });

  // Mock data for demonstration
  useEffect(() => {
    const mockEvents: ActivityEvent[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: 'research_started',
        title: 'Research Started',
        message: 'Deep research task initiated',
        runId: 'run_123'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        type: 'sse_event',
        title: 'Live Update',
        message: 'Sources considered: 15',
        runId: 'run_123'
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        type: 'webhook_received',
        title: 'Webhook Received',
        message: 'Task completion notification',
        runId: 'run_123'
      }
    ];
    
    setEvents(mockEvents);
    setSystemStatus({
      sseConnected: true,
      webhookHealthy: true,
      lastActivity: mockEvents[0]?.timestamp || null,
      activeRuns: 1
    });
  }, []);

  if (collapsed) {
    return (
      <div className="h-full flex flex-col items-center py-4 gap-4">
        <div className="relative">
          <Activity className="h-5 w-5 text-sidebar-foreground" />
          {systemStatus.activeRuns > 0 && (
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full flex items-center justify-center">
              <span className="text-xs text-primary-foreground font-medium">
                {systemStatus.activeRuns}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          <div className={`h-2 w-2 rounded-full ${systemStatus.sseConnected ? 'bg-success' : 'bg-destructive'}`} />
          <div className={`h-2 w-2 rounded-full ${systemStatus.webhookHealthy ? 'bg-success' : 'bg-warning'}`} />
        </div>
      </div>
    );
  }

  const getEventIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'research_started':
        return <Zap className="h-4 w-4 text-primary" />;
      case 'research_completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'research_failed':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'webhook_received':
        return <Database className="h-4 w-4 text-accent" />;
      case 'sse_event':
        return <Wifi className="h-4 w-4 text-accent" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getEventBadgeVariant = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'research_completed':
        return 'default';
      case 'research_failed':
      case 'error':
        return 'destructive';
      case 'webhook_received':
      case 'sse_event':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-sidebar-foreground">Activity</h2>
          <Badge variant="outline" className="text-xs">
            Live
          </Badge>
        </div>

        {/* System Status */}
        <Card className="bg-sidebar-accent/50 border-sidebar-border">
          <CardContent className="p-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-sidebar-foreground/70">Active Runs</span>
                <Badge variant="outline" className="text-xs">
                  {systemStatus.activeRuns}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-sidebar-foreground/70">SSE Status</span>
                <div className="flex items-center gap-1">
                  {systemStatus.sseConnected ? (
                    <Wifi className="h-3 w-3 text-success" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-destructive" />
                  )}
                  <span className="text-xs text-sidebar-foreground/70">
                    {systemStatus.sseConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-sidebar-foreground/70">Webhooks</span>
                <div className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${
                    systemStatus.webhookHealthy ? 'bg-success' : 'bg-warning'
                  }`} />
                  <span className="text-xs text-sidebar-foreground/70">
                    {systemStatus.webhookHealthy ? 'Healthy' : 'Warning'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="activity" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-4 grid w-auto grid-cols-2">
            <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
            <TabsTrigger value="logs" className="text-xs">Logs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="activity" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-full custom-scrollbar px-4">
              <div className="space-y-3 pb-4">
                {events.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="h-8 w-8 text-sidebar-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-sidebar-foreground/70">
                      No activity yet
                    </p>
                  </div>
                ) : (
                  events.map((event, index) => (
                    <div key={event.id}>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-sidebar-accent/30 border border-sidebar-border/50">
                        <div className="flex-shrink-0 mt-0.5">
                          {getEventIcon(event.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant={getEventBadgeVariant(event.type)} 
                              className="text-xs"
                            >
                              {event.title}
                            </Badge>
                            <span className="text-xs text-sidebar-foreground/60">
                              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                          
                          {event.message && (
                            <p className="text-sm text-sidebar-foreground leading-relaxed">
                              {event.message}
                            </p>
                          )}
                          
                          {event.runId && (
                            <p className="text-xs text-sidebar-foreground/50 mt-1 font-mono">
                              {event.runId}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {index < events.length - 1 && (
                        <Separator className="my-3" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="logs" className="flex-1 overflow-hidden mt-4">
            <div className="px-4 pb-4 h-full">
              <div className="text-center py-8">
                <Database className="h-8 w-8 text-sidebar-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-sidebar-foreground/70 mb-3">
                  Detailed logs available in Transport Console
                </p>
                <Button variant="outline" size="sm">
                  Open Console
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}