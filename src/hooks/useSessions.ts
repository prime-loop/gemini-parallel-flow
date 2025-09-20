import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ChatSession {
  id: string;
  title: string;
  user_id: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  last_activity: string;
}

export function useSessions() {
  const { user, isTestMode } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  // ------- Test Mode helpers (localStorage-backed) -------
  const TEST_SESSIONS_KEY = 'research_copilot_test_sessions';

  const loadTestSessions = (): ChatSession[] => {
    try {
      const raw = localStorage.getItem(TEST_SESSIONS_KEY);
      const parsed = raw ? (JSON.parse(raw) as ChatSession[]) : [];
      return parsed;
    } catch {
      return [];
    }
  };

  const saveTestSessions = (list: ChatSession[]) => {
    localStorage.setItem(TEST_SESSIONS_KEY, JSON.stringify(list));
  };

  const createTestSession = (title: string): ChatSession => {
    const now = new Date().toISOString();
    return {
      id: crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      title,
      user_id: user?.id || '00000000-0000-4000-8000-000000000000',
      status: 'active',
      created_at: now,
      updated_at: now,
      last_activity: now,
    };
  };

  const fetchSessions = async () => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    // Test Mode: load from localStorage
    if (isTestMode) {
      const list = loadTestSessions()
        .filter(s => s.status === 'active')
        .sort((a, b) => (b.last_activity > a.last_activity ? 1 : -1));
      setSessions(list);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('status', 'active')
        .order('last_activity', { ascending: false });

      if (error) throw error;
      setSessions((data || []) as ChatSession[]);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [user, isTestMode]);

  const createSession = async (title: string = 'New Session') => {
    if (!user) throw new Error('User not authenticated');

    // Test Mode: create locally
    if (isTestMode) {
      const created = createTestSession(title);
      const list = [created, ...loadTestSessions()]
        .filter((s, idx, arr) => arr.findIndex(x => x.id === s.id) === idx);
      saveTestSessions(list);
      setSessions(list.filter(s => s.status === 'active'));
      return created;
    }

    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          title,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      await fetchSessions();
      return data;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  };

  const updateSessionTitle = async (sessionId: string, title: string) => {
    // Test Mode
    if (isTestMode) {
      const list = loadTestSessions();
      const next: ChatSession[] = list.map(s => (s.id === sessionId ? { ...s, title, updated_at: new Date().toISOString() } : s)) as ChatSession[];
      saveTestSessions(next);
      setSessions(prev => prev.map(s => (s.id === sessionId ? { ...s, title } : s)));
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ title })
        .eq('id', sessionId);

      if (error) throw error;
      
      setSessions(prev => 
        prev.map(session => 
          session.id === sessionId ? { ...session, title } : session
        )
      );
    } catch (error) {
      console.error('Error updating session title:', error);
      throw error;
    }
  };

  const updateLastActivity = async (sessionId: string) => {
    // Test Mode
    if (isTestMode) {
      const now = new Date().toISOString();
      const list = loadTestSessions();
      const next: ChatSession[] = list.map(s => (s.id === sessionId ? { ...s, last_activity: now, updated_at: now } : s)) as ChatSession[];
      saveTestSessions(next);
      setSessions(prev => prev.map(s => (s.id === sessionId ? { ...s, last_activity: now } : s)));
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating last activity:', error);
    }
  };

  const archiveSession = async (sessionId: string) => {
    // Test Mode
    if (isTestMode) {
      const list = loadTestSessions();
      const next: ChatSession[] = list.map(s => (s.id === sessionId ? { ...s, status: 'archived', updated_at: new Date().toISOString() } : s)) as ChatSession[];
      saveTestSessions(next);
      await fetchSessions();
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ status: 'archived' })
        .eq('id', sessionId);

      if (error) throw error;
      
      await fetchSessions();
    } catch (error) {
      console.error('Error archiving session:', error);
      throw error;
    }
  };

  return {
    sessions,
    loading,
    createSession,
    updateSessionTitle,
    updateLastActivity,
    archiveSession,
    refreshSessions: fetchSessions,
  };
}