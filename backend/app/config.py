from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# Google retired some v1beta model IDs; map old env values to current names.
DEPRECATED_GEMINI_MODEL_ALIASES: dict[str, str] = {
    "gemini-1.5-flash": "gemini-2.0-flash",
    "gemini-1.5-flash-latest": "gemini-2.0-flash",
    "gemini-1.5-pro": "gemini-2.0-flash",
    "gemini-1.5-pro-latest": "gemini-2.0-flash",
}

GEMINI_MODEL_FALLBACKS: tuple[str, ...] = (
    "gemini-2.0-flash",
    "gemini-2.5-flash-preview-05-20",
)


class Settings(BaseSettings):
    app_name: str = "Wiki Quiz Generator"
    database_url: str = "postgresql+psycopg://wikiquiz:wikiquiz@localhost:5432/wikiquiz"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    mock_llm: bool = False
    request_timeout_seconds: int = 20

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def gemini_models_to_try(configured_model: str) -> list[str]:
    primary = DEPRECATED_GEMINI_MODEL_ALIASES.get(configured_model, configured_model)
    models: list[str] = []
    for name in (primary, *GEMINI_MODEL_FALLBACKS):
        if name and name not in models:
            models.append(name)
    return models

