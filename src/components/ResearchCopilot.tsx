import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessions } from '@/hooks/useSessions';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { ActivityPanel } from './ActivityPanel';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AuthPage from './AuthPage';

export default function ResearchCopilot() {
  const { user, loading: authLoading } = useAuth();
  const { sessions, createSession, loading: sessionsLoading } = useSessions();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { toast } = useToast();

  // Auto-select first session or create new one
  useEffect(() => {
    if (!sessionsLoading && user && !currentSessionId) {
      if (sessions.length > 0) {
        setCurrentSessionId(sessions[0].id);
      }
    }
  }, [sessions, sessionsLoading, user, currentSessionId]);

  const handleNewSession = async () => {
    try {
      if (sessions.length >= 3) {
        toast({
          title: 'Session Limit Reached',
          description: 'You can have up to 3 active sessions. Archive an existing session first.',
          variant: 'destructive',
        });
        return;
      }

      const newSession = await createSession();
      setCurrentSessionId(newSession.id);
      
      toast({
        title: 'New Session Created',
        description: 'Ready to start your research!',
      });
    } catch (error) {
      console.error('Error creating session:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new session. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="h-screen flex bg-background text-foreground">
      <Sidebar
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
      />
      
      <ChatArea sessionId={currentSessionId} />
      
      <ActivityPanel sessionId={currentSessionId} />
    </div>
  );
}