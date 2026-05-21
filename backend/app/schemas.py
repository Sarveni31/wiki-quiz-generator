from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator


class GenerateQuizRequest(BaseModel):
    url: HttpUrl


class KeyEntities(BaseModel):
    people: list[str] = Field(default_factory=list)
    organizations: list[str] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=list)


class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    answer: str
    difficulty: Literal["easy", "medium", "hard"]
    explanation: str
    section: str | None = None

    @field_validator("answer")
    @classmethod
    def answer_must_be_non_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("answer cannot be empty")
        return value

    @model_validator(mode="after")
    def answer_must_match_option(self) -> "QuizQuestion":
        if self.answer not in self.options:
            raise ValueError("answer must exactly match one of the options")
        return self


class GeneratedPayload(BaseModel):
    summary: str
    key_entities: KeyEntities = Field(default_factory=KeyEntities)
    quiz: list[QuizQuestion] = Field(min_length=5, max_length=10)
    related_topics: list[str] = Field(default_factory=list)


class QuizResponse(BaseModel):
    id: int
    url: str
    title: str
    summary: str
    key_entities: KeyEntities
    sections: list[str]
    quiz: list[QuizQuestion]
    related_topics: list[str]
    created_at: datetime
    cached: bool = False


class QuizListItem(BaseModel):
    id: int
    url: str
    title: str
    question_count: int
    created_at: datetime


class ArticlePreview(BaseModel):
    url: str
    title: str
    summary: str
    sections: list[str]

