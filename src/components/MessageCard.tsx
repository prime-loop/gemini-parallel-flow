import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Bot, Search, Webhook, AlertTriangle, Copy, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface MessageCardProps {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'research' | 'system' | 'webhook';
    content: string;
    metadata: Record<string, any>;
    created_at: string;
  };
  onRetry?: (messageId: string) => void;
}

export function MessageCard({ message, onRetry }: MessageCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'assistant':
        return <Bot className="h-4 w-4" />;
      case 'research':
        return <Search className="h-4 w-4" />;
      case 'webhook':
        return <Webhook className="h-4 w-4" />;
      case 'system':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'user':
        return 'default';
      case 'assistant':
        return 'secondary';
      case 'research':
        return 'outline';
      case 'system':
        return message.metadata?.error ? 'destructive' : 'secondary';
      default:
        return 'secondary';
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Message content copied successfully",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy message content",
        variant: "destructive",
      });
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry(message.id);
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getRoleIcon(message.role)}
            <Badge variant={getRoleBadgeVariant(message.role)} className="capitalize">
              {message.role}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={copied}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
            
            {message.metadata?.retryable && onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetry}
                className="h-6 w-6 p-0"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            components={{
              code(props) {
                const { children, className, node, ...rest } = props;
                const match = /language-(\w+)/.exec(className || '');
                return match ? (
                  <div className="bg-muted rounded p-2 overflow-auto">
                    <code className="text-sm">{String(children)}</code>
                  </div>
                ) : (
                  <code className={className} {...rest}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        
        {message.metadata?.tokens && (
          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-4">
            <span>Tokens: {message.metadata.tokens}</span>
            {message.metadata?.model && (
              <span>Model: {message.metadata.model}</span>
            )}
            {message.metadata?.run_id && (
              <span>Task ID: {message.metadata.run_id}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}