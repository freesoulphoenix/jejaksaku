# Jejak Dana

Jejak Dana is a daily expense logging app built with React, Vite, vanilla CSS, Node.js, Express, and Supabase.

This repository currently includes the Jejak Dana frontend shell, Supabase Auth foundation, database schema, and an Express API starter.

## Project Structure

```text
jejakdana/
  package.json
  client/
    .env
    public/
    vite.config.js
    src/
      assets/
      components/
      pages/
      services/
      styles/
  server/
    .env.example
    controllers/
    database/
    middleware/
    routes/
    services/
    uploads/
```

## Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project

## Environment Setup

Client environment file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Create `server/.env`:

```env
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

Keep the service role key on the server only. Do not expose it in the React client.

## Run Locally

Install and run the frontend:

```bash
cd client
npm install
npm run dev
```

Install and run the backend:

```bash
cd server
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`

Backend default URL: `http://localhost:5000`

Health check: `http://localhost:5000/api/health`

You can also run scripts from the project root after installing dependencies in each package:

```bash
npm run dev:client
npm run dev:server
```

## PWA Testing

Build and preview the production app:

```bash
cd client
npm run build
npm run preview
```

Then verify:

- Chrome DevTools -> Application -> Manifest shows Jejak Dana metadata and icons.
- Chrome DevTools -> Application -> Service Workers shows the generated service worker.
- Android Chrome offers Install app from the browser menu or install prompt.
- iPhone Safari can use Share -> Add to Home Screen.
- After opening once online, reload the preview while offline and confirm the app shell stays available with the offline message.
