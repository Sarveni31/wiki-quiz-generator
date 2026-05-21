import json
import re

from fastapi import HTTPException
from langchain_core.prompts import ChatPromptTemplate
from pydantic import ValidationError

from .config import gemini_models_to_try, get_settings
from .schemas import GeneratedPayload
from .scraper import ScrapedArticle


QUIZ_PROMPT_TEMPLATE = """
You are generating a quiz from a Wikipedia article for an educational app.

Rules:
- Use only the article text provided below.
- Return strict JSON only. Do not wrap it in markdown.
- Generate 5 to 10 multiple-choice questions.
- Each question must have exactly four options.
- The answer must exactly match one option string in options.
- Each question must include a section field using one of the Article sections above, or "General" if none fits.
- Do not invent section names beyond the provided headings and "General".
- Difficulty must be one of: easy, medium, hard.
- Explanations must cite where the answer appears in the article in plain language.
- Include related Wikipedia topics for further reading.
- Avoid obscure trivia and avoid facts not supported by the article text.

Article title: {title}
Article sections: {sections}
Article text:
{article_text}

Return this JSON shape:
{{
  "summary": "short grounded summary",
  "key_entities": {{
    "people": [],
    "organizations": [],
    "locations": []
  }},
  "quiz": [
    {{
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "answer": "one exact option",
      "difficulty": "easy",
      "explanation": "short explanation",
      "section": "section heading from article"
    }}
  ],
  "related_topics": []
}}
"""


def generate_article_payload(article: ScrapedArticle) -> GeneratedPayload:
    settings = get_settings()
    if settings.mock_llm:
        return mock_payload(article)
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is missing. Add it to .env or set MOCK_LLM=true for local UI testing.",
        )

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="LangChain Gemini dependency is not installed.") from exc

    prompt = ChatPromptTemplate.from_template(QUIZ_PROMPT_TEMPLATE)
    invoke_input = {
        "title": article.title,
        "sections": ", ".join(article.sections[:10]),
        "article_text": article.text,
    }

    models_to_try = gemini_models_to_try(settings.gemini_model)
    response = None
    errors: list[str] = []

    for model_name in models_to_try:
        model = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=settings.gemini_api_key,
            temperature=0.2,
        )
        try:
            response = (prompt | model).invoke(invoke_input)
            break
        except Exception as exc:
            errors.append(f"{model_name}: {exc}")

    if response is None:
        combined = " | ".join(errors)
        if "429" in combined or "quota" in combined.lower():
            raise HTTPException(
                status_code=429,
                detail=(
                    "Gemini free-tier quota exceeded for this API key. Wait a few minutes and retry, "
                    "create a new key at https://aistudio.google.com/apikey, check usage at "
                    "https://ai.dev/rate-limit, or set MOCK_LLM=true on Railway to demo without Gemini. "
                    f"Tried: {', '.join(models_to_try)}."
                ),
            )
        raise HTTPException(
            status_code=502,
            detail=(
                f"Gemini API call failed for all tried models ({', '.join(models_to_try)}). "
                f"Set GEMINI_MODEL=gemini-2.0-flash-lite on Railway. Errors: {combined}"
            ),
        )

    raw = getattr(response, "content", str(response))
    data = parse_json_response(raw)
    try:
        payload = GeneratedPayload.model_validate(data)
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail=f"LLM response did not match the required schema: {exc}") from exc

    if not payload.key_entities.people and not payload.key_entities.organizations and not payload.key_entities.locations:
        payload.key_entities.people = article.key_entities.get("people", [])
        payload.key_entities.organizations = article.key_entities.get("organizations", [])
        payload.key_entities.locations = article.key_entities.get("locations", [])

    return payload


def parse_json_response(raw: str) -> dict:
    cleaned = raw.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", cleaned, flags=re.DOTALL)
    if fenced:
        cleaned = fenced.group(1).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="LLM returned invalid JSON.") from exc


def mock_payload(article: ScrapedArticle) -> GeneratedPayload:
    options = [
        article.title,
        "A fictional topic",
        "An unrelated invention",
        "A random location",
    ]
    section_names = article.sections or ["General"]
    quiz = [
        {
            "question": f"What is the main topic of the article '{article.title}'?",
            "options": options,
            "answer": article.title,
            "difficulty": "easy",
            "explanation": "The article title and opening summary identify the main topic.",
            "section": section_names[index % len(section_names)],
        }
        for index in range(5)
    ]
    return GeneratedPayload.model_validate(
        {
            "summary": article.summary,
            "key_entities": article.key_entities,
            "quiz": quiz,
            "related_topics": article.sections[:5] or [article.title],
        }
    )

