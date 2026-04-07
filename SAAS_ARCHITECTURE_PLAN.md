# Full-Stack SaaS Architecture

This outlines the structure for the comprehensive SaaS platform using your exact chosen tech stack, optimized for Easypanel VPS deployment.

## Tech Stack
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui components.
- **State & Data**: Zustand (client state) + TanStack Query (async data/caching).
- **Backend API**: Node.js with Express.
- **Database + Auth**: Supabase (PostgreSQL).
- **Telephony & AI**: Twilio Webhooks + Ultravox WebSocket streaming.
- **Background Jobs**: BullMQ backed by Redis (perfect for processing call logs post-hangup).
- **Email & Analytics**: Resend + PostHog.

## File Structure Plan
We will use a clean, separated repository structure so Easypanel can host them on standard Docker configurations.

```text
/inbound-voice-saas
│
├── /frontend             # React (Vite) Single Page Application
│   ├── /src
│   │   ├── /components   # shadcn/ui reusable blocks
│   │   ├── /pages        # Dashboard, Login, Analytics, Prompts
│   │   ├── /lib          # Supabase client, PostHog config
│   │   └── /store        # Zustand state stores
│   ├── package.json
│   ├── tailwind.config.js
│   └── Dockerfile        # Deploys as a static nginx container
│
├── /backend              # Node.js (Express) API Server
│   ├── /src
│   │   ├── /routes       # Twilio webhooks, API endpoints
│   │   ├── /services     # Ultravox API wrapper, BullMQ worker
│   │   └── /config       # Redis, Supabase admin client
│   ├── package.json
│   └── Dockerfile        # Deploys as a Node runtime container
│
└── docker-compose.yml    # Allows you to test everything in one click if you install Docker later!
```

## How It Works
1. **Frontend**: Your users log into the React dashboard via Supabase Auth. They can navigate to an "AI Prompts" page to type what their AI should say. It saves to the Supabase database.
2. **Backend**: Someone calls a Twilio phone number. Twilio immediately sends an HTTP request to your Express server.
3. **The Magic**: Express looks up the user's custom prompt in Supabase, calls the Ultravox API, and replies to Twilio with the exact XML (`<Connect><Stream>`) to instantly bridge the audio.
4. **Post-Call Processing**: When the call ends, Ultravox pings your Express server. Express pushes the transcription data into BullMQ (Redis), running heavy tasks asynchronously so your server never slows down.

Everything will be fully functioning, production-ready, and deployable.
