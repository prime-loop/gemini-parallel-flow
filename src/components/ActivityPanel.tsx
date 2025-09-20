import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Play,
  RefreshCw 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'session_created' | 'plan_drafted' | 'research_started' | 'research_completed' | 'sse_connected' | 'webhook_received';
  message: string;
  timestamp: string;
  status: 'completed' | 'in_progress' | 'failed';
  metadata?: Record<string, any>;
}

interface ResearchTask {
  id: string;
  runId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled';
  progress: string[];
  startedAt: string;
  completedAt?: string;
}

interface ActivityPanelProps {
  sessionId: string | null;
}

export function ActivityPanel({ sessionId }: ActivityPanelProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [researchTasks, setResearchTasks] = useState<ResearchTask[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(null);

  // Fetch system status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/status');
        if (response.ok) {
          const status = await response.json();
          setSystemStatus(status);
        }
      } catch (error) {
        console.error('Failed to fetch system status:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Mock activities for now - in real implementation, these would come from the database
  useEffect(() => {
    if (sessionId) {
      setActivities([
        {
          id: '1',
          type: 'session_created',
          message: 'Research session created',
          timestamp: new Date().toISOString(),
          status: 'completed'
        }
      ]);
    }
  }, [sessionId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-warning animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success';
      case 'running':
        return 'bg-warning';
      case 'failed':
        return 'bg-destructive';
      case 'canceled':
        return 'bg-muted';
      default:
        return 'bg-primary';
    }
  };

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Activity className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold">Activity</h2>
          </div>
          <Button variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* System Status */}
          {systemStatus && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Gemini API</span>
                  <Badge variant="secondary">Connected</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Parallel API</span>
                  <Badge variant="secondary">Connected</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Database</span>
                  <Badge variant="secondary">Connected</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Research Tasks */}
          {researchTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Research Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {researchTasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Task {task.id}</span>
                      <Badge 
                        variant="outline"
                        className={`${getTaskStatusColor(task.status)} text-white`}
                      >
                        {task.status}
                      </Badge>
                    </div>
                    
                    {task.status === 'running' && task.progress.length > 0 && (
                      <div className="space-y-1">
                        {task.progress.slice(-3).map((progress, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground">
                            {progress}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground mt-2">
                      Started {formatDistanceToNow(new Date(task.startedAt), { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Activity Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">What's Done</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activities.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No activities yet. Start a conversation to see progress.
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    {getStatusIcon(activity.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Play className="h-4 w-4 mr-2" />
                Start Research
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Status
              </Button>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}