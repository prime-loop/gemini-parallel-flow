import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  X, 
  Search, 
  Download, 
  Trash2, 
  Play, 
  Pause, 
  Copy,
  Eye,
  EyeOff,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Database,
  Webhook
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TransportConsoleProps {
  onClose: () => void;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'request' | 'response' | 'webhook' | 'sse' | 'decision' | 'error';
  method?: string;
  url?: string;
  status?: number;
  duration?: number;
  runId?: string;
  data?: any;
  error?: string;
  masked?: boolean;
}

const MAX_ENTRIES = 10000;

export function TransportConsole({ onClose }: TransportConsoleProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [showMasked, setShowMasked] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Mock data for demonstration
  useEffect(() => {
    const mockLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: 'request',
        method: 'POST',
        url: '/functions/v1/research-start',
        runId: 'run_123',
        data: { query: 'Research query...', sessionId: 'session_456' },
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 299000).toISOString(),
        type: 'response',
        method: 'POST',
        url: '/functions/v1/research-start',
        status: 200,
        duration: 1250,
        runId: 'run_123',
        data: { run_id: 'run_123', status: 'queued' },
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 240000).toISOString(),
        type: 'sse',
        url: '/v1beta/tasks/runs/run_123/events',
        runId: 'run_123',
        data: { type: 'task_run.progress_plan', message: 'Planning research approach' },
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        type: 'webhook',
        url: '/functions/v1/parallel-webhook',
        runId: 'run_123',
        data: { type: 'task_run.status', data: { status: 'completed' } },
      }
    ];

    setLogs(mockLogs);
  }, []);

  // Filter logs
  useEffect(() => {
    let filtered = logs;

    if (searchQuery) {
      filtered = filtered.filter(log => 
        log.url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.runId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        JSON.stringify(log.data).toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedRunId) {
      filtered = filtered.filter(log => log.runId === selectedRunId);
    }

    setFilteredLogs([...filtered].reverse()); // Most recent first
  }, [logs, searchQuery, selectedRunId]);

  // Auto-scroll to bottom when playing
  useEffect(() => {
    if (isPlaying && scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [filteredLogs, isPlaying]);

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'request':
        return <Zap className="h-4 w-4 text-primary" />;
      case 'response':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'webhook':
        return <Webhook className="h-4 w-4 text-accent" />;
      case 'sse':
        return <Database className="h-4 w-4 text-accent" />;
      case 'decision':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (log: LogEntry) => {
    if (log.status) {
      const variant = log.status >= 400 ? 'destructive' 
        : log.status >= 300 ? 'secondary' 
        : 'default';
      return <Badge variant={variant} className="text-xs">{log.status}</Badge>;
    }
    return null;
  };

  const formatData = (data: any) => {
    if (!data) return '';
    return JSON.stringify(data, null, 2);
  };

  const handleCopyLog = async (log: LogEntry) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    } catch (err) {
      console.error('Failed to copy log:', err);
    }
  };

  const handleExportLogs = () => {
    const exportData = filteredLogs.map(log => JSON.stringify(log)).join('\n');
    const blob = new Blob([exportData], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transport-logs-${new Date().toISOString().split('T')[0]}.ndjson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    setLogs([]);
    setSelectedLog(null);
  };

  const uniqueRunIds = Array.from(new Set(logs.map(log => log.runId).filter(Boolean)));

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end">
      <Card className="w-full h-2/3 mx-4 mb-4 border-border-strong shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">Transport Console</CardTitle>
              <Badge variant="outline" className="text-xs">
                {filteredLogs.length} entries
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-8 w-8 p-0"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportLogs}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={clearLogs}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="px-3 py-2 border border-border rounded-md bg-background text-sm"
            >
              <option value="">All runs</option>
              {uniqueRunIds.map(runId => (
                <option key={runId} value={runId}>
                  {runId}
                </option>
              ))}
            </select>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMasked(!showMasked)}
              className="whitespace-nowrap"
            >
              {showMasked ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showMasked ? 'Hide' : 'Show'} Secrets
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            {/* Logs List */}
            <div className="lg:col-span-2 flex flex-col h-full">
              <ScrollArea ref={scrollAreaRef} className="flex-1 custom-scrollbar">
                <div className="space-y-2">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No logs match your filters
                    </div>
                  ) : (
                    filteredLogs.map((log, index) => (
                      <div key={log.id}>
                        <div 
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedLog?.id === log.id 
                              ? 'bg-accent/20 border-accent' 
                              : 'bg-muted/20 hover:bg-muted/40 border-border'
                          }`}
                          onClick={() => setSelectedLog(log)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              {getLogIcon(log.type)}
                              <span className="text-sm font-medium capitalize">{log.type}</span>
                              {log.method && (
                                <Badge variant="outline" className="text-xs">
                                  {log.method}
                                </Badge>
                              )}
                              {getStatusBadge(log)}
                              {log.duration && (
                                <span className="text-xs text-muted-foreground">
                                  {log.duration}ms
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyLog(log);
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="mt-2">
                            <p className="text-sm text-foreground font-mono truncate">
                              {log.url}
                            </p>
                            {log.runId && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Run: {log.runId}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {index < filteredLogs.length - 1 && (
                          <Separator className="my-2" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Log Detail */}
            <div className="lg:col-span-1 border-l border-border pl-4">
              {selectedLog ? (
                <div className="h-full flex flex-col">
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2">Log Details</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <span className="ml-2 capitalize">{selectedLog.type}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Time:</span>
                        <span className="ml-2">
                          {new Date(selectedLog.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {selectedLog.runId && (
                        <div>
                          <span className="text-muted-foreground">Run ID:</span>
                          <span className="ml-2 font-mono text-xs">{selectedLog.runId}</span>
                        </div>
                      )}
                      {selectedLog.duration && (
                        <div>
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="ml-2">{selectedLog.duration}ms</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator className="mb-4" />

                  <div className="flex-1 overflow-hidden">
                    <h4 className="text-sm font-medium mb-2">Payload</h4>
                    <ScrollArea className="h-full">
                      <pre className="text-xs font-mono bg-muted/30 p-3 rounded-md whitespace-pre-wrap">
                        {formatData(selectedLog.data)}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-center">
                  <div>
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Select a log entry to view details
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}