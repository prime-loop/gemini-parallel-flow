import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  PanelLeft, 
  PanelRight, 
  Settings, 
  Brain,
  Monitor
} from 'lucide-react';

interface FixedViewportLayoutProps {
  leftSidebar: React.ReactNode;
  rightSidebar: React.ReactNode;
  children: React.ReactNode;
  onTransportConsoleToggle?: () => void;
  showTransportConsole?: boolean;
}

const STORAGE_KEYS = {
  leftSidebarOpen: 'research-ui-left-sidebar-open',
  rightSidebarOpen: 'research-ui-right-sidebar-open',
};

export function FixedViewportLayout({
  leftSidebar,
  rightSidebar,
  children,
  onTransportConsoleToggle,
  showTransportConsole = false
}: FixedViewportLayoutProps) {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.leftSidebarOpen);
    return stored !== null ? JSON.parse(stored) : true;
  });

  const [rightSidebarOpen, setRightSidebarOpen] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.rightSidebarOpen);
    return stored !== null ? JSON.parse(stored) : true;
  });

  // Persist sidebar states
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.leftSidebarOpen, JSON.stringify(leftSidebarOpen));
  }, [leftSidebarOpen]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.rightSidebarOpen, JSON.stringify(rightSidebarOpen));
  }, [rightSidebarOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '[':
            e.preventDefault();
            setLeftSidebarOpen(prev => !prev);
            break;
          case ']':
            e.preventDefault();
            setRightSidebarOpen(prev => !prev);
            break;
          case '`':
            if (onTransportConsoleToggle) {
              e.preventDefault();
              onTransportConsoleToggle();
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTransportConsoleToggle]);

  return (
    <div className="viewport-layout">
      {/* Fixed Header */}
      <header className="viewport-header bg-surface border-b border-border-strong px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold">Research Copilot</h1>
          </div>
          
          <div className="flex items-center gap-1 ml-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                  className="h-8 w-8 p-0"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Toggle Sessions Sidebar (⌘[)
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                  className="h-8 w-8 p-0"
                >
                  <PanelRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Toggle Activity Sidebar (⌘])
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onTransportConsoleToggle && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onTransportConsoleToggle}
                  className={`h-8 w-8 p-0 ${showTransportConsole ? 'bg-accent text-accent-foreground' : ''}`}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Transport Console (⌘`)
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Settings
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Body with sidebars */}
      <div className="viewport-body">
        {/* Left Sidebar */}
        <aside 
          className={`sidebar-transition bg-sidebar border-r border-sidebar-border flex-shrink-0 ${
            leftSidebarOpen ? 'w-sidebar' : 'w-sidebar-collapsed'
          }`}
        >
          {leftSidebar}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>

        {/* Right Sidebar */}
        <aside 
          className={`sidebar-transition bg-sidebar border-l border-sidebar-border flex-shrink-0 ${
            rightSidebarOpen ? 'w-sidebar' : 'w-sidebar-collapsed'
          }`}
        >
          {rightSidebar}
        </aside>
      </div>
    </div>
  );
}