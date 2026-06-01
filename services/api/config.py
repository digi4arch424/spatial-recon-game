from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────────────────────
    # Online:  postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
    # Local:   postgresql://postgres:postgres@localhost:5432/spatialrecon
    database_url: str

    # ── Redis ─────────────────────────────────────────────────────────────────
    # Online:  rediss://default:[password]@[host].upstash.io:6379
    # Local:   redis://localhost:6379
    redis_url: str

    # ── Object storage (S3 / Cloudflare R2 / MinIO) ───────────────────────────
    s3_endpoint:   str
    s3_bucket:     str = "spatialrecon"
    s3_access_key: str
    s3_secret_key: str
    s3_region:     str = "auto"

    # ── App ───────────────────────────────────────────────────────────────────
    environment:   str = "development"
    api_port:      int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
