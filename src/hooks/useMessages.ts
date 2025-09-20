import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'research' | 'research_progress' | 'system' | 'webhook';
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

export function useMessages(sessionId: string | null) {
  const { user, isTestMode } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // ------- Test Mode helpers (localStorage-backed) -------
  const TEST_MESSAGES_KEY = 'research_copilot_test_messages';

  type MessageMap = Record<string, Message[]>;

  const loadTestMessages = (): MessageMap => {
    try {
      const raw = localStorage.getItem(TEST_MESSAGES_KEY);
      return raw ? (JSON.parse(raw) as MessageMap) : {};
    } catch {
      return {} as MessageMap;
    }
  };

  const saveTestMessages = (map: MessageMap) => {
    localStorage.setItem(TEST_MESSAGES_KEY, JSON.stringify(map));
  };

  const fetchMessages = async () => {
    if (!sessionId || !user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    // Test Mode: load from localStorage
    if (isTestMode) {
      const map = loadTestMessages();
      const list = (map[sessionId] || []).slice().sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
      setMessages(list);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [sessionId, user, isTestMode]);

  // Real-time subscription
  useEffect(() => {
    if (!sessionId || isTestMode) return;

    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('New message received:', payload);
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('Message updated:', payload);
          setMessages(prev => 
            prev.map(msg => 
              msg.id === payload.new.id ? payload.new as Message : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, isTestMode]);

  const addMessage = async (
    role: Message['role'],
    content: string,
    metadata: Record<string, any> = {}
  ) => {
    if (!sessionId || !user) throw new Error('Session or user not available');

    // Test Mode: store locally
    if (isTestMode) {
      const now = new Date().toISOString();
      const newMsg: Message = {
        id: crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        session_id: sessionId,
        role,
        content,
        metadata,
        created_at: now,
      };
      const map = loadTestMessages();
      const list = map[sessionId] || [];
      const next = [...list, newMsg];
      map[sessionId] = next;
      saveTestMessages(map);
      setMessages(next);
      return newMsg;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          session_id: sessionId,
          role,
          content,
          metadata,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  };

  const updateMessage = async (messageId: string, content: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content })
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating message:', error);
      throw error;
    }
  };

  return {
    messages,
    loading,
    addMessage,
    updateMessage,
    refreshMessages: fetchMessages,
  };
}