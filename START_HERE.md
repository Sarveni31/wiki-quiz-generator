# Start Here

This project is ready to publish with GitHub Desktop.

## 1. Publish to GitHub

1. Open GitHub Desktop.
2. Choose **File > Add local repository**.
3. Select this folder:

   ```text
   C:\Users\venka\OneDrive\Documents\deepKlarity
   ```

4. Commit all files.
5. Click **Publish repository**.
6. Use a public repo name such as:

   ```text
   wiki-quiz-generator
   ```

## 2. Enable GitHub Pages

1. Open the repo on GitHub.
2. Go to **Settings > Pages**.
3. Under **Build and deployment**, select **GitHub Actions**.
4. Push to `main` or manually run the workflow named **Deploy GitHub Pages Demo**.

The Pages site is a static demo. The real app runs locally with FastAPI, Gemini, and PostgreSQL.

## 3. Run Locally

1. Install Docker Desktop and Python 3.11+.
2. Copy `.env.example` to `.env`.
3. Add your Gemini API key in `.env`.
4. Run:

   ```powershell
   docker compose up -d
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r backend\requirements.txt
   python -m uvicorn backend.app.main:app --reload
   ```

5. Open:

   ```text
   http://127.0.0.1:8000
   ```

