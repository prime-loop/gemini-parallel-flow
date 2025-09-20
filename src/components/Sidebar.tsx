import { useState } from 'react';
import { useSessions, ChatSession } from '@/hooks/useSessions';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  MessageSquare, 
  Clock, 
  User, 
  LogOut,
  Brain,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SidebarProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export function Sidebar({ currentSessionId, onSelectSession, onNewSession }: SidebarProps) {
  const { sessions, loading } = useSessions();
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  return (
    <div className="w-80 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Brain className="h-6 w-6 text-sidebar-primary mr-2" />
            <h1 className="text-lg font-semibold text-sidebar-foreground">Research Copilot</h1>
          </div>
        </div>
        
        <Button 
          onClick={onNewSession} 
          className="w-full"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Session
        </Button>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-sidebar-foreground/80 mb-3">
            Active Sessions ({sessions.length}/3)
          </h2>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-sidebar-foreground/50" />
            </div>
          ) : sessions.length === 0 ? (
            <Card className="bg-sidebar-accent/50 border-sidebar-border">
              <CardContent className="p-4 text-center">
                <MessageSquare className="h-8 w-8 text-sidebar-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-sidebar-foreground/70">
                  No active sessions. Create your first research session!
                </p>
              </CardContent>
            </Card>
          ) : (
            sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
                onClick={() => onSelectSession(session.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <User className="h-4 w-4 text-sidebar-foreground/70 mr-2" />
            <span className="text-sm text-sidebar-foreground/70 truncate max-w-32">
              {user?.email}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SessionCard({ 
  session, 
  isActive, 
  onClick 
}: { 
  session: ChatSession; 
  isActive: boolean; 
  onClick: () => void; 
}) {
  return (
    <Card 
      className={`cursor-pointer transition-colors hover:bg-sidebar-accent/80 ${
        isActive ? 'bg-sidebar-accent border-sidebar-primary' : 'bg-sidebar-accent/30'
      }`}
      onClick={onClick}
    >
      <CardHeader className="p-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium text-sidebar-foreground truncate">
            {session.title}
          </CardTitle>
          <Badge variant="secondary" className="text-xs ml-2">
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="flex items-center text-xs text-sidebar-foreground/60">
          <Clock className="h-3 w-3 mr-1" />
          {formatDistanceToNow(new Date(session.last_activity), { addSuffix: true })}
        </div>
      </CardContent>
    </Card>
  );
}