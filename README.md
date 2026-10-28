# Vibely

Vibely is a content-planning and AI-assisted social media writing application.
The repository contains a Next.js frontend and a FastAPI backend backed by the
existing PostgreSQL database.

## Run locally

### Backend

In `backend/.env`, configure `DATABASE_URL`, `JWT_SECRET_KEY`, and
`OLLAMA_MODEL=gemma3:4b`. Ollama must be running locally at
`http://127.0.0.1:11434`.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

FastAPI documentation is available at `http://127.0.0.1:8000/docs`.

### Frontend

Copy `.env.example` to `.env.local` and set
`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`.

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Local CORS allows `localhost:3000` and
`127.0.0.1:3000`.

## Application behavior

- Registration and sign-in use FastAPI. The access token is stored in browser
  storage only; business data is loaded from the backend.
- The board displays the statuses and posts returned by PostgreSQL. Post
  creation, editing, movement, and deletion are persisted by the API.
- The profile edits the active brand, its tone of voice, topics, and AI
  templates. Templates can be created, updated, and deleted; the generator can
  use a selected template.
- The AI page displays persisted generation history and can create posts and
  social-network adaptations through FastAPI and the configured local Ollama
  model. It is an AI request history, not a multi-turn conversation store.
- File upload and company avatar storage are not implemented by the backend;
  the frontend does not persist file data locally.

Run frontend checks with `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
