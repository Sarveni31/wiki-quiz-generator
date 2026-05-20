# Wiki Quiz Generator

Full-stack assignment app that accepts a Wikipedia article URL, scrapes the article HTML, generates a grounded quiz with Gemini through LangChain, stores the result in PostgreSQL, and displays current plus historical quizzes in a simple frontend.

The GitHub Pages site is a static demo using saved JSON from `sample_data/`. Run the FastAPI app locally for real scraping, LLM generation, and database storage.

## Features

- FastAPI backend with Wikipedia URL validation.
- BeautifulSoup scraping from Wikipedia HTML only.
- Gemini quiz generation through LangChain.
- PostgreSQL persistence with duplicate URL caching.
- Simple HTML/CSS/JS frontend with two tabs.
- History table and details modal.
- Bonus Take Quiz mode with scoring.
- Static GitHub Pages demo from saved JSON outputs.

## Project Structure

```text
backend/                 FastAPI app, scraper, database, Gemini prompt code
frontend/                Local frontend served by FastAPI
docs/                    GitHub Pages static demo
sample_data/             Example URLs and API JSON outputs
screenshots/             Add required assignment screenshots here
.github/workflows/       GitHub Pages deployment workflow
docker-compose.yml       Local PostgreSQL
.env.example             Environment variable template
```

## Local Setup

Install prerequisites:

- Python 3.11+
- Docker Desktop
- GitHub Desktop, for version control and publishing

Create your environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set:

```text
GEMINI_API_KEY=your_real_key
```

For UI testing without Gemini, set:

```text
MOCK_LLM=true
```

Start PostgreSQL:

```powershell
docker compose up -d
```

Create and activate a virtual environment:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

If `py` is not available, install Python from python.org and reopen PowerShell.

Run the app from the repository root:

```powershell
python -m uvicorn backend.app.main:app --reload
```

Open:

```text
http://127.0.0.1:8000
```

## API Endpoints

```text
GET  /api/health
GET  /api/articles/preview?url=https://en.wikipedia.org/wiki/Alan_Turing
POST /api/quizzes/generate
GET  /api/quizzes
GET  /api/quizzes/{id}
```

Example generate request:

```json
{
  "url": "https://en.wikipedia.org/wiki/Alan_Turing"
}
```

## Prompt Template

The LangChain prompt is defined in `backend/app/llm.py` as `QUIZ_PROMPT_TEMPLATE`. It instructs Gemini to:

- Use only the supplied article text.
- Return strict JSON.
- Generate 5 to 10 questions.
- Include four options, one exact answer, difficulty, and explanation.
- Suggest related Wikipedia topics.
- Avoid unsupported facts.

## GitHub Version Control

Use GitHub Desktop because `git` is not currently available in this terminal session.

1. Open GitHub Desktop.
2. Choose **File > Add local repository**.
3. Select `C:\Users\venka\OneDrive\Documents\deepKlarity`.
4. If prompted, create the repository.
5. Publish it to GitHub as a public repo, suggested name: `wiki-quiz-generator`.
6. Commit in clear chunks:
   - `Initial project scaffold`
   - `Add FastAPI quiz generation backend`
   - `Add static frontend and history UI`
   - `Add sample data and README`
   - `Add GitHub Pages demo workflow`

Never commit `.env`.

## GitHub Pages Demo

The Pages workflow deploys the static app in `docs/` and copies `sample_data/` into the Pages artifact.

After publishing the repo:

1. Push to `main`.
2. Go to **Settings > Pages**.
3. Set source to **GitHub Actions**.
4. Run or wait for **Deploy GitHub Pages Demo**.
5. Open the Pages URL shown by the workflow.

The Pages demo does not call Gemini, FastAPI, or PostgreSQL. It is only a reviewer-friendly UI preview using saved JSON outputs.

## Testing Checklist

- Generate quizzes for at least:
  - `https://en.wikipedia.org/wiki/Alan_Turing`
  - `https://en.wikipedia.org/wiki/Ada_Lovelace`
  - `https://en.wikipedia.org/wiki/Marie_Curie`
- Confirm the generation tab displays summary, entities, quiz, related topics, and Take Quiz scoring.
- Confirm the history tab lists previous URLs.
- Confirm Details opens a modal with the full quiz.
- Save JSON responses into `sample_data/`.
- Add screenshots to `screenshots/`:
  - generation page
  - history view
  - details modal

