from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db, init_db
from .llm import generate_article_payload
from .models import QuizRecord
from .schemas import ArticlePreview, GenerateQuizRequest, QuizListItem, QuizResponse
from .scraper import scrape_article

ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT_DIR / "frontend"

app = FastAPI(title="Wiki Quiz Generator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def to_response(record: QuizRecord) -> QuizResponse:
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
    )


@app.get("/api/health")
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
    url = str(payload.url)
    article = scrape_article(url)

    existing = db.scalar(select(QuizRecord).where(QuizRecord.url == article.url))
    if existing:
        return to_response(existing)

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
    return to_response(record)


@app.get("/api/quizzes", response_model=list[QuizListItem])
def list_quizzes(db: Session = Depends(get_db)) -> list[QuizListItem]:
    records = db.scalars(select(QuizRecord).order_by(QuizRecord.created_at.desc())).all()
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
    record = db.get(QuizRecord, quiz_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Quiz not found.")
    return to_response(record)


if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

