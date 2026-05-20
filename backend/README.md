# Backend

FastAPI backend for the Wiki Quiz Generator.

## Run

From the repository root:

```powershell
python -m uvicorn backend.app.main:app --reload
```

## Environment

Use `.env` at the repository root:

```text
DATABASE_URL=postgresql+psycopg://wikiquiz:wikiquiz@localhost:5432/wikiquiz
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
MOCK_LLM=false
```

Set `MOCK_LLM=true` if you want to test the UI without calling Gemini.

