-- Add missing columns to chat_sessions table
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS last_activity timestamp with time zone NOT NULL DEFAULT now();

-- Create index for better performance on status queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON public.chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity ON public.chat_sessions(last_activity);

-- Update existing sessions to have proper last_activity
UPDATE public.chat_sessions 
SET last_activity = updated_at 
WHERE last_activity IS NULL;

-- Create trigger to automatically update last_activity when updated_at changes
CREATE OR REPLACE FUNCTION public.update_chat_session_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = NEW.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_session_last_activity_trigger
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chat_session_last_activity();

-- Add missing column to task_runs table to match edge function expectations
ALTER TABLE public.task_runs 
ADD COLUMN IF NOT EXISTS parallel_run_id text;

-- Update existing task_runs to use run_id as parallel_run_id if null
UPDATE public.task_runs 
SET parallel_run_id = run_id 
WHERE parallel_run_id IS NULL;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger to task_runs
CREATE TRIGGER handle_task_runs_updated_at
  BEFORE UPDATE ON public.task_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();