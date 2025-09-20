import { useState, useRef, useEffect } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useSessions } from '@/hooks/useSessions';
import { useLog } from '@/contexts/LogContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCard } from '@/components/MessageCard';
import { Send, Loader2, Bot, Search } from 'lucide-react';

interface ChatAreaProps {
  sessionId: string | null;
}

export function ChatArea({ sessionId }: ChatAreaProps) {
  const { messages, loading: messagesLoading, addMessage } = useMessages(sessionId);
  const { updateLastActivity } = useSessions();
  const { addLog } = useLog();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [researching, setResearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-focus input after AI response
  useEffect(() => {
    if (!sending && !researching && inputRef.current) {
      inputRef.current.focus();
    }
  }, [sending, researching]);

  const isResearchQuery = (message: string): boolean => {
    const researchKeywords = [
      'research', 'analyze', 'investigate', 'study', 'explore', 'examine',
      'find information', 'gather data', 'look into', 'comprehensive',
      'detailed analysis', 'in-depth', 'thorough', 'compare', 'contrast'
    ];
    
    const lowerMessage = message.toLowerCase();
    return researchKeywords.some(keyword => lowerMessage.includes(keyword)) ||
           message.length > 100; // Long queries likely need research
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !sessionId || sending || researching) return;

    const messageContent = input.trim();
    setInput('');
    
    const shouldResearch = isResearchQuery(messageContent);
    
    if (shouldResearch) {
      setResearching(true);
    } else {
      setSending(true);
    }

    try {
      // Add user message
      await addMessage('user', messageContent);
      
      // Update session activity
      await updateLastActivity(sessionId);

      if (shouldResearch) {
        // Trigger Parallel.ai research
        await handleResearchQuery(messageContent, sessionId);
      } else {
        // Regular chat with Gemini
        await handleChatQuery(messageContent, sessionId);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      addLog('error', 'Error processing message', 'frontend', { 
        error: error.message,
        messageType: shouldResearch ? 'research' : 'chat'
      });
      await addMessage('system', `❌ **Error Processing Message**\n\nSorry, there was an error: ${error.message}\n\n*Click retry or try rephrasing your question.*`, {
        error: true,
        retryable: true
      });
    } finally {
      setSending(false);
      setResearching(false);
    }
  };

  const handleChatQuery = async (messageContent: string, sessionId: string) => {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message: messageContent,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get AI response');
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }

    if (!result.content || result.content === 'No response generated') {
      throw new Error('AI returned no response. This could be due to API limits or content policy. Please try rephrasing your question.');
    }
    
    // Add assistant message  
    await addMessage('assistant', result.content, {
      tokens: result.tokens,
      model: result.model || 'gemini-2.5-flash'
    });
  };

  const handleResearchQuery = async (messageContent: string, sessionId: string) => {
    addLog('info', 'Starting research query processing', 'frontend', { query: messageContent, sessionId });
    
    // Add research starting message with animation
    const researchingMessageId = await addMessage('research', `🔍 **Researching...**\n\n📋 **Query:** ${messageContent}\n\n🚀 **Status:** Dispatching to Parallel.ai\n⏱️ **Expected Duration:** 3-5 minutes\n\n*Please wait while we gather comprehensive information from multiple sources...*`, {
      status: 'researching',
      animated: true
    });

    addLog('info', 'Research message added to chat', 'frontend');

    // Create research brief
    const brief = {
      objective: messageContent,
      constraints: [],
      target_sources: ['academic', 'news', 'web', 'technical_docs'],
      disallowed_sources: ['social_media', 'forums'],
      timebox_minutes: 5,
      expected_output_fields: ['summary', 'key_facts', 'sources', 'recommendations'],
      summary: `Research request: ${messageContent}`
    };

    addLog('info', 'Research brief created', 'frontend', { brief });

    addLog('info', 'Sending request to research-start API', 'api', { 
      url: 'https://ebxnfsnpfdhfyyrajvli.supabase.co/functions/v1/research-start',
      sessionId 
    });

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        brief
      }),
    });

    addLog('info', 'Received response from research-start API', 'api', { 
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      addLog('error', 'Research start API error', 'api', { 
        status: response.status,
        error: errorText 
      });
      console.error('Research start error:', errorText);
      throw new Error('Failed to start research task - check Parallel API configuration');
    }

    const result = await response.json();
    
    addLog('info', 'Parsed response from research-start API', 'api', { result });
    
    if (result.error) {
      addLog('error', 'Error in research-start response', 'api', { error: result.error });
      throw new Error(result.error);
    }

    addLog('success', 'Research task successfully created', 'api', { 
      runId: result.run_id,
      status: result.status 
    });

    // Update research message with success status
    await addMessage('research', `✅ **Research Task Launched**\n\n📋 **Query:** ${messageContent}\n🆔 **Task ID:** ${result.run_id}\n🔄 **Status:** ${result.status}\n\n🔍 **Research is now running asynchronously...**\n*Results will stream in when ready. You can continue chatting while research completes.*`, {
      run_id: result.run_id,
      status: result.status,
      sse_url: result.sse_url,
      task_launched: true
    });

    addLog('success', 'Research task launched successfully', 'frontend', { runId: result.run_id });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!sessionId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to Research Copilot</h2>
          <p className="text-muted-foreground">Start a new session to begin your research journey</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Start the conversation by asking a research question</p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageCard key={message.id} message={message} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={researching ? "Research in progress..." : "Ask a question or request research..."}
            disabled={sending || researching}
            className="flex-1"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={sending || researching || !input.trim()}
            variant={isResearchQuery(input) ? "default" : "secondary"}
          >
            {sending || researching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isResearchQuery(input) ? (
              <Search className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}