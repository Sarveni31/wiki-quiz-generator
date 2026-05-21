# Assignment Screenshots

Add three PNG screenshots after running the app locally:

1. `tab1-generate.png` — Generate Quiz tab with preview, section-grouped cards, and Take Quiz.
2. `tab2-history.png` — Past Quizzes table with at least one row.
3. `details-modal.png` — Details modal showing the full quiz layout.

## How to capture

```powershell
docker compose up -d
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.app.main:app --reload
```

Open http://127.0.0.1:8000, generate a quiz (use `MOCK_LLM=true` in `.env` if you have no Gemini key), then capture the three views.
