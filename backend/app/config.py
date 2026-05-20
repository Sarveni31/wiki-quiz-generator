from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Wiki Quiz Generator"
    database_url: str = "postgresql+psycopg://wikiquiz:wikiquiz@localhost:5432/wikiquiz"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
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

