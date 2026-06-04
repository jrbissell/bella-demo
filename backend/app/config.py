from pathlib import Path

from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).parent.parent


class Settings(BaseSettings):
    icloud_username: str = ""
    icloud_password: str = ""
    sync_interval_minutes: int = 5
    database_url: str = f"sqlite:///{_BACKEND_DIR / 'bella.db'}"
    gemini_api_key: str = ""
    anthropic_api_key: str = ""
    zip_code: str = "75407"

    class Config:
        env_file = str(_BACKEND_DIR / ".env")


settings = Settings()

# Resolve relative sqlite paths to absolute so the DB is always found
# regardless of which directory the server process is started from.
_sqlite_prefix = "sqlite:///"
if settings.database_url.startswith(_sqlite_prefix):
    _path_part = settings.database_url[len(_sqlite_prefix):]
    if not Path(_path_part).is_absolute():
        settings.database_url = f"{_sqlite_prefix}{(_BACKEND_DIR / _path_part).resolve()}"
