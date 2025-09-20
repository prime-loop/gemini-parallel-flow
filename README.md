# Gemini Parallel Flow - Research Copilot

A research copilot application integrating Gemini AI for chat and Parallel.ai for asynchronous research tasks.

## Project info

**URL**: https://lovable.dev/projects/d356989c-263f-4a6b-a2c6-b60e7bd4c634

## Required Environment Variables

### Supabase Edge Functions Secrets

These must be configured as Supabase function secrets (not frontend .env variables):

- `PARALLEL_API_KEY` - Your Parallel.ai API key
- `PARALLEL_WEBHOOK_SECRET` - Secret for webhook signature verification (optional but recommended)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key for database access
- `GEMINI_API_KEY` - Google Gemini API key for chat functionality

### Frontend Environment Variables

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key for frontend

## Architecture

### Supabase Edge Functions

- **research-start** - Creates Parallel.ai task runs for research requests
- **parallel-webhook** - Handles status updates from Parallel.ai
- **chat-send** - Handles regular Gemini chat interactions

### Key Features

- Automatic detection of research vs chat queries
- Asynchronous research workflow with progress tracking
- Webhook-based status updates
- Session management with unlimited sessions

## Testing the Integration

### 1. Verify Environment Variables
Ensure all required Supabase secrets are configured:
```bash
# Check in Supabase dashboard > Settings > Functions
PARALLEL_API_KEY=your_parallel_api_key
PARALLEL_WEBHOOK_SECRET=your_webhook_secret (optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key
```

### 2. Test Research Flow
1. Send a research query (e.g., "research the latest AI trends in 2025")
2. Check Supabase function logs for:
   - "Sending Parallel API request"
   - "Parallel API response status: 200" or "201"
   - "Parallel API success" with run_id

### 3. Verify Webhook Delivery
- Parallel.ai will send status updates to `/functions/v1/parallel-webhook`
- Check webhook function logs for "Received webhook" messages
- Research completion should add result message to chat

### 4. Manual API Testing
```bash
# Test Parallel API directly
curl -X POST https://api.parallel.ai/v1/tasks/runs \
  -H "x-api-key: YOUR_PARALLEL_API_KEY" \
  -H "Content-Type: application/json" \
  -H "parallel-beta: events-sse-2025-07-24, webhook-2025-08-12" \
  -d '{"input": "test", "processor": "core"}'
```

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/d356989c-263f-4a6b-a2c6-b60e7bd4c634) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/d356989c-263f-4a6b-a2c6-b60e7bd4c634) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
