# CoverMyPharma

CoverMyPharma is a document-driven insurance coverage assistant for pharmacy and medical policy review. It lets a signed-in user upload payer PDFs, sends them through a FastAPI parsing service backed by Gemini, turns the extracted response into plan cards in the React UI, and optionally stores upload metadata in Supabase.

## What It Does

- Authenticates users with Auth0.
- Uploads PDF medical or pharmacy policy documents from the frontend.
- Verifies the Auth0 access token in a FastAPI backend.
- Extracts PDF text with `PyPDF2`.
- Uses Gemini to summarize the document into structured fields such as medication, diagnosis, insurance provider, prior auth requirement, missing information, and recommended next steps.
- Displays uploaded analyses alongside mock comparison data in the UI.
- Optionally persists users and uploaded document metadata to Supabase.
- Optionally generates speech summaries through an ElevenLabs proxy server.

## Stack

- Frontend: React 19, TypeScript, Vite
- Auth: Auth0 React SDK
- Backend API: FastAPI, Uvicorn
- AI parsing: Google Gemini
- Storage: Supabase
- TTS proxy: Node HTTP server + ElevenLabs

## Project Structure

```text
.
├── app/
│   ├── main.py
│   ├── routes/parse_pdf.py
│   └── services/
├── server/tts-server.mjs
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── components/
│   ├── hooks/useSupabaseUser.ts
│   └── lib/supabase.ts
├── requirements.txt
└── package.json
```

## Requirements

- Node.js 18+
- Python 3.10+
- An Auth0 application configured for SPA login
- A Gemini API key
- Optional: a Supabase project
- Optional: ElevenLabs API credentials for text-to-speech

## Environment Variables

Create a `.env` file in the project root.

```env
# Frontend + backend shared Auth0 settings
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your_auth0_spa_client_id
VITE_AUTH0_AUDIENCE=https://your-tenant.us.auth0.com/api/v2/

# Frontend upload target
VITE_API_BASE_URL=http://127.0.0.1:8000

# Gemini
VITE_GEMINI_API_KEY=your_gemini_api_key

# Optional Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional ElevenLabs server-side settings
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_default_voice_id
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128

# Optional override for the frontend TTS target
VITE_TTS_API_BASE_URL=http://localhost:3001
```

Notes:

- The FastAPI backend currently falls back to `VITE_AUTH0_*` and `VITE_GEMINI_API_KEY`, so a single `.env` file works in local development.
- Restart Vite after changing any `VITE_*` variable.

## Installation

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Create a Python virtual environment

```bash
python3 -m venv .venv
```

### 3. Install backend dependencies

```bash
.venv/bin/pip install -r requirements.txt
```

## Running Locally

You will usually run up to three processes.

### Frontend

```bash
npm run dev
```

Starts the Vite app, typically at `http://127.0.0.1:5173`.

### FastAPI backend

```bash
npm run backend
```

This runs:

```bash
.venv/bin/python -m uvicorn app.main:app --reload
```

The backend runs at `http://127.0.0.1:8000`.

### Optional ElevenLabs TTS proxy

```bash
npm run tts:server
```

The proxy runs at `http://localhost:3001`.

## Auth0 Setup

Configure your Auth0 SPA app with:

- Allowed Callback URLs:
  `http://localhost:5173`, `http://127.0.0.1:5173`
- Allowed Logout URLs:
  `http://localhost:5173`, `http://127.0.0.1:5173`
- Allowed Web Origins:
  `http://localhost:5173`, `http://127.0.0.1:5173`

The frontend requests an access token and sends it as a Bearer token to `POST /api/parse-pdf`. The backend validates that token against Auth0 JWKS before parsing the PDF.

## Supabase Setup

Supabase is optional in the current app. If configured, the frontend syncs the signed-in Auth0 user into a `users` table and stores uploaded document metadata in `medical_documents`.

Create the tables in Supabase SQL Editor:

```sql
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth0_id text unique not null,
  email text not null,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medical_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  filename text not null,
  file_size integer not null,
  uploaded_at timestamptz not null default now(),
  drug_name text,
  conditions text,
  prior_auth_required text,
  clinical_criteria text,
  diagnosis_codes text,
  effective_date text,
  policy_changes jsonb default '[]'::jsonb,
  raw_extracted_data jsonb
);

-- If you already created medical_documents without policy_changes, run once:
-- alter table public.medical_documents
--   add column policy_changes jsonb default '[]'::jsonb;

create index if not exists idx_users_auth0_id
  on public.users(auth0_id);

create index if not exists idx_medical_documents_user_id
  on public.medical_documents(user_id);

create index if not exists idx_medical_documents_uploaded_at
  on public.medical_documents(uploaded_at);
```

Important:

- The current demo writes to Supabase directly from the frontend using the anon key.
- If you enable strict RLS, browser inserts will fail unless you redesign the write path around Supabase Auth or a backend service-role flow.
- For the current local demo, keep `users` and `medical_documents` unrestricted or disable RLS on those tables.

## API Endpoints

### `GET /`

Returns a simple backend health message.

### `GET /api/test-gemini`

Runs a sample prompt through Gemini and returns the parsed analysis payload.

### `POST /api/parse-pdf`

Protected endpoint that:

1. Verifies the incoming Auth0 Bearer token.
2. Accepts a PDF upload.
3. Extracts text.
4. Sends the text to Gemini.
5. Returns structured JSON used by the frontend to create a plan card.

Expected request:

- `Content-Type`: `multipart/form-data`
- `Authorization`: `Bearer <access_token>`
- `file`: PDF upload

## Common Commands

```bash
# Frontend
npm run dev

# Backend
npm run backend

# TTS proxy
npm run tts:server

# Lint
npm run lint

# Production build
npm run build
```

## Troubleshooting

### `ModuleNotFoundError: No module named 'jose'`

You are probably running the system `uvicorn` instead of the project virtualenv. Use:

```bash
npm run backend
```

or:

```bash
.venv/bin/python -m uvicorn app.main:app --reload
```

### Frontend uploads fail with connection errors

Make sure:

- the backend is running on `127.0.0.1:8000`
- `VITE_API_BASE_URL=http://127.0.0.1:8000`
- you restarted the Vite dev server after editing `.env`

### Supabase tables stay empty

Check:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- the tables exist
- RLS is not blocking browser inserts

### TTS requests fail

Check:

- `npm run tts:server` is running
- `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set
- the frontend is pointing to the correct TTS base URL

## Current Notes

- The backend currently uses `google.generativeai`, which emits a deprecation warning but still works.
- Python 3.10 also emits a future support warning from a Google dependency; upgrading to Python 3.11+ is a good next step.
- The UI falls back to mock plan data when no uploaded analyses are present.
