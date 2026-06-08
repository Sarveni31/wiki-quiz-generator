import logging
import threading
import time
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .database import get_db, init_db
from .llm import generate_article_payload
from .models import QuizRecord
from .schemas import ArticlePreview, GenerateQuizRequest, QuizListItem, QuizResponse
from .scraper import normalize_wikipedia_url, scrape_article

logger = logging.getLogger("uvicorn.error")


def _resolve_frontend_dir() -> Path | None:
    start = Path(__file__).resolve().parent
    candidates = [
        start.parent.parent,  # repo root when layout is backend/app/main.py
        start.parent,  # backend/ when frontend is copied here
        Path.cwd(),
        Path.cwd().parent,
    ]
    for root in candidates:
        frontend = root / "frontend"
        if frontend.is_dir():
            return frontend
    return None


FRONTEND_DIR = _resolve_frontend_dir()

app = FastAPI(title="Wiki Quiz Generator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _init_db_with_retries() -> None:
    for attempt in range(1, 11):
        try:
            init_db()
            logger.info("Database tables ready.")
            return
        except SQLAlchemyError as exc:
            logger.warning("Database init attempt %s/10 failed: %s", attempt, exc)
            if attempt == 10:
                logger.error(
                    "Database unavailable after retries. "
                    "Check DATABASE_URL on Railway and that Postgres is linked."
                )
                return
            time.sleep(3)


@app.on_event("startup")
def on_startup() -> None:
    threading.Thread(target=_init_db_with_retries, daemon=True).start()


def to_response(record: QuizRecord, *, cached: bool = False) -> QuizResponse:
    return QuizResponse(
        id=record.id,
        url=record.url,
        title=record.title,
        summary=record.summary,
        key_entities=record.key_entities,
        sections=record.sections,
        quiz=record.quiz,
        related_topics=record.related_topics,
        created_at=record.created_at,
        cached=cached,
    )


@app.get("/api/health")
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/articles/preview", response_model=ArticlePreview)
def preview_article(url: str) -> ArticlePreview:
    article = scrape_article(url)
    return ArticlePreview(
        url=article.url,
        title=article.title,
        summary=article.summary,
        sections=article.sections,
    )


@app.post("/api/quizzes/generate", response_model=QuizResponse)
def generate_quiz(payload: GenerateQuizRequest, db: Session = Depends(get_db)) -> QuizResponse:
    normalized_url = normalize_wikipedia_url(str(payload.url))
    try:
        existing = db.scalar(select(QuizRecord).where(QuizRecord.url == normalized_url))
        if existing:
            return to_response(existing, cached=True)

        article = scrape_article(str(payload.url))
        generated = generate_article_payload(article)
        record = QuizRecord(
            url=article.url,
            title=article.title,
            summary=generated.summary or article.summary,
            key_entities=generated.key_entities.model_dump(),
            sections=article.sections,
            quiz=[item.model_dump() for item in generated.quiz],
            related_topics=generated.related_topics,
            raw_html=article.raw_html,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return to_response(record, cached=False)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Database error. Verify DATABASE_URL is set and PostgreSQL is running.",
        ) from exc


@app.get("/api/quizzes", response_model=list[QuizListItem])
def list_quizzes(db: Session = Depends(get_db)) -> list[QuizListItem]:
    try:
        records = db.scalars(select(QuizRecord).order_by(QuizRecord.created_at.desc())).all()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database error. Verify DATABASE_URL is set and PostgreSQL is running.",
        ) from exc
    return [
        QuizListItem(
            id=record.id,
            url=record.url,
            title=record.title,
            question_count=len(record.quiz),
            created_at=record.created_at,
        )
        for record in records
    ]


@app.get("/api/quizzes/{quiz_id}", response_model=QuizResponse)
def get_quiz(quiz_id: int, db: Session = Depends(get_db)) -> QuizResponse:
    try:
        record = db.get(QuizRecord, quiz_id)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database error. Verify DATABASE_URL is set and PostgreSQL is running.",
        ) from exc
    if record is None:
        raise HTTPException(status_code=404, detail="Quiz not found.")
    return to_response(record)


if FRONTEND_DIR is not None:
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
