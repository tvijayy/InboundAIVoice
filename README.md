# Inbound AI Voice (n8n + Ultravox)

This project has been migrated from a local Python LiveKit architecture to a cloud-native **n8n + Ultravox** architecture. You no longer need to install Python or run any local servers!

## 🚀 Architecture Overview
The system bridges **Vobiz SIP Telephony** with **Ultravox AI** using **n8n** as the orchestrator.

1. **Vobiz** receives an inbound phone call.
2. Vobiz sends a webhook to **n8n**.
3. **n8n** calls the **Ultravox API** to create a new AI Voice Agent assigned to this specific call.
4. **n8n** replies directly to Vobiz with the `joinUrl` in VAML (Vobiz Application Markup Language).
5. Vobiz connects the caller's audio stream directly to the Ultravox AI agent via WebSocket.
6. When the call ends, Ultravox sends an event webhook to **n8n**.
7. **n8n** fetches the call transcript, analyzes sentiment via OpenAI, and records everything in **Supabase**.

## 📂 Migration
All local Python scripts (`agent.py`, `webhook_server.py`, `ui_server.py`) are **deprecated**. Your system does not need them.

Please refer to the newly created `N8N_MIGRATION_GUIDE.md` for step-by-step instructions on setting up the n8n workflows.

## 🛠 Prerequisites for n8n
You will need API keys for:
- [Ultravox](https://app.ultravox.ai)
- [Vobiz](https://console.vobiz.ai)
- [Supabase](https://supabase.com)
- [OpenAI](https://platform.openai.com)

Provide these keys within your n8n instance credentials, and import the target workflows to go live immediately.
