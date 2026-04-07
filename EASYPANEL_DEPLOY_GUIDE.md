# Easypanel SaaS Deployment Guide

This guide explains how to instantly deploy your new Full-Stack Inbound/Outbound AI Voice SaaS. 

Since your local computer blocked Node.js and Python, **Easypanel** handles everything for you natively in the cloud via Docker.

### Step 1: Upload to GitHub
1. Create a new repository on [GitHub](https://github.com/). It can be private.
2. Upload this entire project folder exactly as it is (it contains the `/backend` and `/frontend` folders).

---

### Step 2: Deploy the Backend API
1. Log into your **Easypanel Dashboard**.
2. Click **Create New Project** and name it `voice-saas`.
3. Inside the project, click **Create New Service** -> choose **App** (GitHub/Docker).
4. **Connect GitHub**: Select the repository you just uploaded.
5. **Configuration Settings**:
   - **Name**: `voice-backend`
   - **Build Method**: Dockerfile
   - **Source Directory**: `backend` (Important! This tells Easypanel to use the Node/Express backend)
6. **Environment Variables**: Go to the Environment tab and add exactly these keys from your setup:
   - `TWILIO_ACCOUNT_SID=your_sid`
   - `TWILIO_AUTH_TOKEN=your_token`
   - `TWILIO_PHONE_NUMBER=+1234567890`
   - `ULTRAVOX_API_KEY=your_ultravox_key`
7. Click **Deploy**. Easypanel will build and spin up the Express server, generating a live public domain URL.

---

### Step 3: Deploy the Frontend Dashboard
1. Inside the exact same Easypanel project, click **Create New Service** -> **App**.
2. **Connect GitHub**: Select the exact same repository again.
3. **Configuration Settings**:
   - **Name**: `voice-dashboard`
   - **Build Method**: Dockerfile
   - **Source Directory**: `frontend` (Important! This tells Easypanel to build the React application)
4. Click **Deploy**. Easypanel will compile Tailwind CSS and launch your UI.

---

### Step 4: The Final Hookup (Twilio)
Once your Backend (`voice-backend`) is successfully deployed on Easypanel, it will give you a public URL (for example: `https://api.yourdomain.com`).

1. Log into your [Twilio Console](https://console.twilio.com/).
2. Navigate to your purchased **Phone Number** configuration.
3. Scroll down to **Voice Configuration**.
4. In the box that says "A CALL COMES IN -> Webhook", paste your backend URL followed by the route we wrote:
   `https://[YOUR_EASYPANEL_BACKEND_URL]/api/twilio/inbound`
5. Click **Save** and dial your Twilio number! You are completely live.
