import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessions } from '@/hooks/useSessions';
import { FixedViewportLayout } from './layout/FixedViewportLayout';
import { SessionsSidebar } from './sidebars/SessionsSidebar';
import { ActivitySidebar } from './sidebars/ActivitySidebar';
import { ChatArea } from './ChatArea';
import AuthPage from './AuthPage';
import { TransportConsole } from './transport/TransportConsole';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function ResearchCopilot() {
  const { user, loading: authLoading } = useAuth();
  const { sessions, createSession } = useSessions();
  const { toast } = useToast();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showTransportConsole, setShowTransportConsole] = useState(false);

  // Auto-select first session when available
  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [sessions, currentSessionId]);

  const handleNewSession = async () => {
    try {
      // Unlimited sessions now supported
      const session = await createSession();
      setCurrentSessionId(session.id);
      
      toast({
        title: "New session created",
        description: "Ready to start your research conversation!",
      });
    } catch (error) {
      console.error('Failed to create session:', error);
      toast({
        title: "Failed to create session",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      // TODO: Implement actual session deletion API call
      await new Promise(resolve => setTimeout(resolve, 500)); // Mock delay
      
      toast({
        title: "Session deleted",
        description: "The session and all its data have been permanently deleted.",
      });
      
      // If deleting current session, switch to another session or null
      if (sessionId === currentSessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        setCurrentSessionId(remainingSessions.length > 0 ? remainingSessions[0].id : null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast({
        title: "Failed to delete session",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <>
      <FixedViewportLayout
        leftSidebar={
          <SessionsSidebar
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
          />
        }
        rightSidebar={<ActivitySidebar />}
        onTransportConsoleToggle={() => setShowTransportConsole(!showTransportConsole)}
        showTransportConsole={showTransportConsole}
      >
        <ChatArea sessionId={currentSessionId} />
      </FixedViewportLayout>
      
      {showTransportConsole && (
        <TransportConsole
          onClose={() => setShowTransportConsole(false)}
        />
      )}
    </>
  );
}