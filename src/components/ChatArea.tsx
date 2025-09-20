import { useState, useRef, useEffect } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useSessions } from '@/hooks/useSessions';
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
    const response = await fetch(`https://ebxnfsnpfdhfyyrajvli.supabase.co/functions/v1/chat-send`, {
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
    // Add research starting message
    await addMessage('research', `🔍 **Starting Research**\n\nAnalyzing your query and dispatching to Parallel.ai for comprehensive research...\n\n*This may take several minutes for thorough results.*`, {
      status: 'started'
    });

    // Create research brief (simplified for now)
    const brief = {
      objective: messageContent,
      constraints: [],
      target_sources: ['academic', 'news', 'web'],
      disallowed_sources: [],
      timebox_minutes: 5,
      expected_output_fields: ['summary', 'key_facts', 'sources'],
      summary: `Research request: ${messageContent}`
    };

    const response = await fetch(`https://ebxnfsnpfdhfyyrajvli.supabase.co/functions/v1/research-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        brief
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to start research task');
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }

    // Update research message with task ID
    await addMessage('research', `🔍 **Research Dispatched**\n\n**Task ID:** ${result.run_id}\n**Status:** ${result.status}\n\n*Research is now running in the background. Results will appear when ready.*\n\n[Monitor progress in Activity Panel →]`, {
      run_id: result.run_id,
      status: result.status,
      sse_url: result.sse_url
    });
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