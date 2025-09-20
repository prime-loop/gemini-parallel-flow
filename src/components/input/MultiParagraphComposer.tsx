import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  Paperclip, 
  FileText, 
  Code,
  X,
  Settings,
  CornerDownLeft,
  Command
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MultiParagraphComposerProps {
  onSend: (content: string, attachments?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

interface Attachment {
  id: string;
  file: File;
  type: 'json' | 'text' | 'code';
}

export function MultiParagraphComposer({
  onSend,
  disabled = false,
  placeholder = "Describe your research query..."
}: MultiParagraphComposerProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sendOnEnter, setSendOnEnter] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      
      // Calculate number of lines
      const lineHeight = 24; // Approximate line height in pixels
      const maxHeight = lineHeight * 8; // 8 lines max
      const scrollHeight = textarea.scrollHeight;
      
      if (scrollHeight <= maxHeight) {
        textarea.style.height = `${Math.max(scrollHeight, lineHeight * 2)}px`;
        textarea.style.overflowY = 'hidden';
      } else {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      }
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [content, adjustTextareaHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (sendOnEnter && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      } else if (!sendOnEnter && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
      // Shift+Enter always inserts newline (default behavior)
    }
  };

  const handleSend = () => {
    if (content.trim() && !disabled) {
      const files = attachments.map(att => att.file);
      onSend(content.trim(), files.length > 0 ? files : undefined);
      setContent('');
      setAttachments([]);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          handleFileAttachment(file);
        }
      } else if (item.kind === 'string' && item.type === 'text/plain') {
        // Let default paste behavior handle text
        return;
      }
    }
  };

  const handleFileAttachment = (file: File) => {
    const attachment: Attachment = {
      id: Date.now().toString(),
      file,
      type: getFileType(file)
    };
    
    setAttachments(prev => [...prev, attachment]);
  };

  const getFileType = (file: File): 'json' | 'text' | 'code' => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'json') return 'json';
    if (['js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css', 'md'].includes(ext || '')) return 'code';
    return 'text';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const getAttachmentIcon = (type: string) => {
    switch (type) {
      case 'json':
        return <Code className="h-3 w-3" />;
      case 'code':
        return <Code className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const canSend = content.trim().length > 0 && !disabled;

  return (
    <Card className="border-border-strong bg-surface">
      {/* Attachments */}
      {attachments.length > 0 && (
        <>
          <div className="p-3 pb-0">
            <div className="flex items-center gap-2 flex-wrap">
              {attachments.map((attachment) => (
                <Badge
                  key={attachment.id}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  {getAttachmentIcon(attachment.type)}
                  <span className="text-xs truncate max-w-24">
                    {attachment.file.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(attachment.id)}
                    className="h-4 w-4 p-0 hover:bg-destructive/20 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
          <Separator className="mx-3" />
        </>
      )}

      {/* Input Area */}
      <div className="p-3">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-12 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
          style={{ height: '48px' }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 pb-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              files.forEach(handleFileAttachment);
              e.target.value = '';
            }}
          />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="h-8 w-8 p-0"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Attach files
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSendOnEnter(!sendOnEnter)}
                className="h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {sendOnEnter ? 'Enter to send, Shift+Enter for newline' : 'Cmd+Enter to send, Enter for newline'}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
            {sendOnEnter ? (
              <>
                <CornerDownLeft className="h-3 w-3" />
                <span>Send</span>
              </>
            ) : (
              <>
                <Command className="h-3 w-3" />
                <CornerDownLeft className="h-3 w-3" />
                <span>Send</span>
              </>
            )}
          </div>
          
          <Button
            onClick={handleSend}
            disabled={!canSend}
            size="sm"
            className="h-8"
          >
            <Send className="h-4 w-4 mr-1" />
            Send
          </Button>
        </div>
      </div>
    </Card>
  );
}