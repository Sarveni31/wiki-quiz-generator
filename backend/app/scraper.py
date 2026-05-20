from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from fastapi import HTTPException

from .config import get_settings


@dataclass
class ScrapedArticle:
    url: str
    title: str
    summary: str
    sections: list[str]
    text: str
    raw_html: str
    key_entities: dict[str, list[str]]


def normalize_wikipedia_url(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if parsed.scheme != "https" or not host.endswith(".wikipedia.org"):
        raise HTTPException(status_code=400, detail="Please enter a valid HTTPS Wikipedia article URL.")
    if not parsed.path.startswith("/wiki/") or ":" in parsed.path:
        raise HTTPException(status_code=400, detail="Please use a normal Wikipedia article URL, not a special page.")
    return urlunparse((parsed.scheme, host, parsed.path, "", "", ""))


def scrape_article(url: str) -> ScrapedArticle:
    normalized_url = normalize_wikipedia_url(url)
    settings = get_settings()
    headers = {"User-Agent": "wiki-quiz-generator/1.0 educational assignment"}

    try:
        response = requests.get(normalized_url, headers=headers, timeout=settings.request_timeout_seconds)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch Wikipedia article: {exc}") from exc

    soup = BeautifulSoup(response.text, "html.parser")
    content = soup.select_one("#mw-content-text")
    if content is None:
        raise HTTPException(status_code=422, detail="Could not find the main article content.")

    for tag in content.select(
        "script, style, table, sup.reference, .mw-editsection, .navbox, .metadata, .reflist, .hatnote"
    ):
        tag.decompose()

    title_tag = soup.select_one("#firstHeading")
    title = title_tag.get_text(" ", strip=True) if title_tag else "Untitled Wikipedia Article"

    paragraphs = [p.get_text(" ", strip=True) for p in content.select("p")]
    paragraphs = [p for p in paragraphs if len(p.split()) >= 12]
    if not paragraphs:
        raise HTTPException(status_code=422, detail="The article does not contain enough readable text.")

    headings = [h.get_text(" ", strip=True) for h in content.select("h2 .mw-headline")]
    headings = [h for h in headings if h.lower() not in {"references", "external links", "see also", "notes"}]

    text_parts = paragraphs[:18]
    article_text = "\n\n".join(text_parts)
    summary = paragraphs[0]
    entities = extract_key_entities(content)

    return ScrapedArticle(
        url=normalized_url,
        title=title,
        summary=summary,
        sections=headings[:12],
        text=article_text[:12000],
        raw_html=response.text,
        key_entities=entities,
    )


def extract_key_entities(content: BeautifulSoup) -> dict[str, list[str]]:
    links = []
    for link in content.select("p a[href^='/wiki/']"):
        label = link.get_text(" ", strip=True)
        href = link.get("href", "")
        if label and ":" not in href and len(label) > 2:
            links.append(label)

    unique = []
    seen = set()
    for label in links:
        key = label.lower()
        if key not in seen:
            seen.add(key)
            unique.append(label)

    people = [x for x in unique if len(x.split()) >= 2][:8]
    organizations = [x for x in unique if any(word in x for word in ["University", "Institute", "Company", "Society"])][:8]
    locations = [x for x in unique if any(word in x for word in ["United", "India", "England", "London", "Europe"])][:8]

    return {
        "people": people,
        "organizations": organizations,
        "locations": locations,
    }

