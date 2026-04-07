# N8n Migration Guide for Inbound AI Voice

Since you cannot run Python locally, we are migrating the entire Vobiz + Ultravox bridge to **n8n**. n8n will handle the webhooks from Vobiz, create the AI call via Ultravox, and process the call data to Supabase.

This guide replaces the local Python scripts (`webhook_server.py`, `agent.py`, etc.).

## 1. Setup n8n

Ensure your n8n instance is running and publicly accessible via an HTTPS URL. We will need this URL for Vobiz and Ultravox.

### Add Credentials to n8n
Inside n8n, create the following credentials:
1. **Header Auth (Ultravox)**: Name it "Ultravox API". Add Header `X-API-Key` with your Ultravox API key.
2. **Supabase API**: Use your Supabase URL and Anon/Service Key.
3. **OpenAI API**: Add your OpenAI key for sentiment analysis.

## 2. Workflow 1: Vobiz Inbound Call Handler

This workflow intercepts a call from Vobiz, tells Ultravox to create an agent, and gives the connection URL back to Vobiz so the audio stream begins.

### Steps to build in n8n:
1. **Webhook Node** 
   - Method: POST
   - Path: `vobiz/inbound`
   - Respond: "Using Respond to Webhook Node"
2. **HTTP Request Node (Create Ultravox Call)**
   - Method: POST
   - URL: `https://api.ultravox.ai/api/calls`
   - Authentication: Header Auth (Ultravox API)
   - Body Parameters (JSON):
   ```json
   {
     "systemPrompt": "You are a helpful assistant. Keep answers brief.",
     "voice": "Mark",
     "languageHint": "en-IN",
     "temperature": 0.4
   }
   ```
3. **Supabase Node** (Optional)
   - Action: Upsert
   - Table: `active_calls`
   - Map `callId` from Ultravox and `From` number from the Webhook.
4. **Respond to Webhook Node**
   - Provide the specific **VAML** response required by Vobiz for WebSocket streaming.
   - Body:
   ```json
   {
     "action": "connect",
     "url": "{{ $json['joinUrl'] }}"
   }
   ```

## 3. Workflow 2: Ultravox Events & Post-Call Processing

This workflow listens for when the call ends, fetches the transcript, determines the sentiment, and saves everything to Supabase.

1. **Webhook Node**
   - Method: POST
   - Path: `ultravox/events`
   - Respond: immediately with `{"received": true}`
2. **Switch Node**
   - Condition: Route 1 if `type` equals `call.ended`.
3. **HTTP Request Node (Get Transcript)**
   - Method: GET
   - URL: `https://api.ultravox.ai/api/calls/{{ $node["Webhook"].json["callId"] }}/messages`
   - Authentication: Header Auth (Ultravox API)
4. **Item Lists Node / Code Node**
   - Combine the transcript messages into a single text block.
5. **OpenAI Node (Sentiment Analysis)**
   - Resource: Chat
   - Text: `Classify the sentiment of this call segment: {{ [Combined Transcript] }}`
6. **Supabase Node**
   - Action: Insert/Update
   - Table: `call_logs`
   - Save the transcript, sentiment, and caller details.

## Next Steps
Please provide:
1. Do you want me to write full **JSON n8n workflow export files** that you can directly copy-paste into your n8n interface?
2. Paste the **Ultravox, Vobiz, and Supabase API Keys** when you're ready to proceed with actual setups and I will bake them into the workflows or give you instructions on where to securely inject them.
