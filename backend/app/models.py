from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class QuizRecord(Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    url: Mapped[str] = mapped_column(String(800), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_entities: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    sections: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    quiz: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    related_topics: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    raw_html: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

