import { useState } from 'react';
import { useSessions, ChatSession } from '@/hooks/useSessions';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  MessageSquare, 
  Clock, 
  User, 
  LogOut,
  Loader2,
  Search,
  Trash2,
  PlayCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SessionsSidebarProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession?: (sessionId: string) => void;
  collapsed?: boolean;
}

export function SessionsSidebar({ 
  currentSessionId, 
  onSelectSession, 
  onNewSession,
  onDeleteSession,
  collapsed = false 
}: SessionsSidebarProps) {
  const { sessions, loading } = useSessions();
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (onDeleteSession) {
      await onDeleteSession(sessionId);
    }
    setDeleteTarget(null);
  };

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedSessions = filteredSessions.sort((a, b) => 
    new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
  );

  if (collapsed) {
    return (
      <div className="h-full flex flex-col items-center py-4 gap-4">
        <Button
          onClick={onNewSession}
          size="sm"
          className="h-10 w-10 p-0"
          title="New Session"
        >
          <Plus className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 flex flex-col gap-2 w-full px-2">
          {sortedSessions.slice(0, 3).map((session) => (
            <Button
              key={session.id}
              variant={session.id === currentSessionId ? "default" : "ghost"}
              size="sm"
              onClick={() => onSelectSession(session.id)}
              className="h-10 w-10 p-0"
              title={session.title}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          ))}
          
          {sortedSessions.length > 3 && (
            <div className="text-xs text-muted-foreground text-center py-1">
              +{sortedSessions.length - 3}
            </div>
          )}
        </div>

        <div className="border-t border-sidebar-border pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
            className="h-10 w-10 p-0"
            title="Sign Out"
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <Button 
          onClick={onNewSession} 
          className="w-full mb-4"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Session
        </Button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full custom-scrollbar">
          <div className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-sidebar-foreground/80">
                  Sessions
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {filteredSessions.length}
                </Badge>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-sidebar-foreground/50" />
                </div>
              ) : sortedSessions.length === 0 ? (
                <Card className="bg-sidebar-accent/50 border-sidebar-border">
                  <CardContent className="p-4 text-center">
                    <MessageSquare className="h-8 w-8 text-sidebar-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-sidebar-foreground/70">
                      {searchQuery ? 'No sessions match your search' : 'No sessions yet. Create your first one!'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                sortedSessions.map((session, index) => (
                  <div key={session.id} className="group">
                    <SessionCard
                      session={session}
                      isActive={session.id === currentSessionId}
                      onClick={() => onSelectSession(session.id)}
                      onDelete={() => setDeleteTarget(session.id)}
                    />
                    {index < sortedSessions.length - 1 && (
                      <Separator className="my-2" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <User className="h-4 w-4 text-sidebar-foreground/70 mr-2 flex-shrink-0" />
            <span className="text-sm text-sidebar-foreground/70 truncate">
              {user?.email}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
            className="ml-2"
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the session and all its messages, research tasks, and related data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteTarget && handleDeleteSession(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SessionCard({ 
  session, 
  isActive, 
  onClick,
  onDelete
}: { 
  session: ChatSession; 
  isActive: boolean; 
  onClick: () => void;
  onDelete: () => void;
}) {
  const getStatusIcon = (session: ChatSession) => {
    // This would be determined by checking task runs in the session
    return <PlayCircle className="h-3 w-3 text-muted-foreground" />;
  };

  const getStatusBadge = (session: ChatSession) => {
    return (
      <Badge variant="secondary" className="text-xs">
        Active
      </Badge>
    );
  };

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:bg-sidebar-accent/80 hover:shadow-sm group ${
        isActive 
          ? 'bg-sidebar-accent border-sidebar-primary shadow-sm' 
          : 'bg-sidebar-accent/30 hover:border-sidebar-border'
      }`}
      onClick={onClick}
    >
      <CardHeader className="p-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium text-sidebar-foreground truncate pr-2">
            {session.title}
          </CardTitle>
          <div className="flex items-center gap-1 flex-shrink-0">
            {getStatusBadge(session)}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
              title="Delete session"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-xs text-sidebar-foreground/60">
            <Clock className="h-3 w-3 mr-1" />
            {formatDistanceToNow(new Date(session.last_activity), { addSuffix: true })}
          </div>
          <div className="flex items-center gap-1">
            {getStatusIcon(session)}
            <span className="text-xs text-sidebar-foreground/60">
              0 runs
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}