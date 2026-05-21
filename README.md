# Wiki Quiz Generator

Full-stack app that turns a Wikipedia article URL into a grounded multiple-choice quiz using Gemini (LangChain), stores results in PostgreSQL, and shows history in a two-tab web UI.

**Repository:** https://github.com/Sarveni31/wiki-quiz-generator

| Deployment | URL | What it does |
|------------|-----|----------------|
| **Railway (recommended)** | Your `*.up.railway.app` domain | Full app: scrape, Gemini, database, UI |
| **GitHub Pages** | `https://sarveni31.github.io/wiki-quiz-generator/` | Static demo only (`sample_data` JSON) |
| **Local** | `http://127.0.0.1:8000` | Full app on your machine |

## Features

- FastAPI + BeautifulSoup (Wikipedia HTML only, no Wikipedia API)
- Gemini quiz generation via LangChain (`backend/app/llm.py`)
- PostgreSQL history and URL caching
- Two tabs: Generate Quiz, Past Quizzes (+ Details modal)
- Bonus: Take Quiz scoring, auto-preview, section-grouped questions, raw HTML stored in DB

## Project structure

```text
backend/app/          API, scraper, LLM, database models
frontend/             UI served by FastAPI at /
docs/                 Static GitHub Pages demo
sample_data/          Example URLs and JSON outputs
screenshots/          Assignment screenshots (see screenshots/README.md)
railway.toml          Railway deploy config
requirements.txt      Python dependencies (repo root)
docker-compose.yml    Local PostgreSQL
.env.example          Environment template (copy to .env)
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes (production) | PostgreSQL connection string |
| `GEMINI_API_KEY` | Yes* | From [Google AI Studio](https://aistudio.google.com/apikey) — use **Create project** for fresh quota |
| `GEMINI_MODEL` | No | Default `gemini-2.0-flash-lite` |
| `MOCK_LLM` | No | `true` = mock quizzes without calling Gemini |
| `REQUEST_TIMEOUT_SECONDS` | No | Default `20` |

\*Not required if `MOCK_LLM=true`.

Never commit `.env`.

## Deploy on Railway (production)

1. **New project** → Deploy from GitHub → `Sarveni31/wiki-quiz-generator`.
2. **+ New → Database → PostgreSQL** → wait until running.
3. Open the **web service** (not Postgres) → **Variables**:
   - **Reference** Postgres `DATABASE_URL` onto the web service.
   - `GEMINI_API_KEY` = your new API key (new Google project recommended).
   - `GEMINI_MODEL` = `gemini-2.0-flash-lite`
   - `MOCK_LLM` = `false`
4. **Settings → Networking** → **Generate domain**.
5. **Deploy settings:** leave **Root directory** empty; `railway.toml` sets:
   - Start: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - Health: `/health`
6. Test:
   - `https://YOUR-DOMAIN.up.railway.app/health` → `{"status":"ok"}`
   - Generate quiz for `https://en.wikipedia.org/wiki/Alan_Turing`

**Gemini quota (429):** Wait, use a new key in a **new** project, or set `MOCK_LLM=true` for a UI-only demo.

`backend/app/database.py` accepts Railway `postgresql://` URLs and converts them for psycopg.

## Local development

**Prerequisites:** Python 3.11+, Docker Desktop.

```powershell
Copy-Item .env.example .env
# Edit .env: GEMINI_API_KEY, MOCK_LLM=false

docker compose up -d
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload
```

Open http://127.0.0.1:8000

## API endpoints

```text
GET  /health
GET  /api/health
GET  /api/articles/preview?url=<wikipedia-url>
POST /api/quizzes/generate
GET  /api/quizzes
GET  /api/quizzes/{id}
```

Example:

```json
{ "url": "https://en.wikipedia.org/wiki/Alan_Turing" }
```

## Prompt template

Defined in `backend/app/llm.py` as `QUIZ_PROMPT_TEMPLATE`:

- Ground answers in article text only
- Strict JSON: 5–10 questions, 4 options, matching answer, difficulty, explanation, section
- Related Wikipedia topics

## Bonus features

| Feature | Where |
|---------|--------|
| Take Quiz + scoring | `frontend/app.js` |
| URL validation + auto-preview | `backend/app/scraper.py`, `frontend/app.js` |
| Raw HTML in DB | `QuizRecord.raw_html` |
| URL caching | `POST /api/quizzes/generate` + `cached: true` in response |
| Section-wise UI | `section` on each question + grouped cards |

## GitHub Pages (static demo)

1. Push to `main`.
2. Repo **Settings → Pages → Source:** GitHub Actions.
3. Workflow **Deploy GitHub Pages Demo** publishes `docs/` + `sample_data/`.

No backend on Pages — use Railway for the live app.

## Submission checklist

- [x] Backend, frontend, `sample_data/`, README, prompt in `llm.py`
- [x] Railway deployment documented
- [ ] Three screenshots in `screenshots/` (see `screenshots/README.md`)

## Test URLs

- https://en.wikipedia.org/wiki/Alan_Turing
- https://en.wikipedia.org/wiki/Ada_Lovelace
- https://en.wikipedia.org/wiki/Marie_Curie
