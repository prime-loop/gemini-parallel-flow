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
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('status', 'active')
        .order('last_activity', { ascending: false })
        .limit(3);

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
  }, [user]);

  const createSession = async (title: string = 'New Session') => {
    if (!user) throw new Error('User not authenticated');

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
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating last activity:', error);
    }
  };

  const archiveSession = async (sessionId: string) => {
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