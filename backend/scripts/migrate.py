"""Apply migrations/*.sql in order, as the DB owner (bypasses RLS).

Usage (from backend/):  uv run python -m scripts.migrate
Applied files are recorded in `schema_migrations`, so it is safe to re-run.
Each .sql file manages its own BEGIN/COMMIT.
"""

import sys

import psycopg

from app.config import BASE_DIR, settings

MIGRATIONS_DIR = BASE_DIR / "migrations"


def main() -> None:
    if not settings.database_owner_url:
        sys.exit("DATABASE_OWNER_URL is not set in .env")
    # psycopg wants a plain libpq URL, not the SQLAlchemy "+psycopg" form
    url = settings.database_owner_url.replace("postgresql+psycopg://", "postgresql://", 1)

    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            " name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        applied = {name for (name,) in conn.execute("SELECT name FROM schema_migrations")}

        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.name in applied:
                continue
            print(f"Applying {path.name} ...")
            try:
                conn.execute(path.read_text(encoding="utf-8"))
            except psycopg.Error as exc:
                conn.execute("ROLLBACK")  # the file's own transaction is left aborted
                sys.exit(f"Failed on {path.name}: {exc}")
            conn.execute("INSERT INTO schema_migrations (name) VALUES (%s)", (path.name,))

    print("Database is up to date.")


if __name__ == "__main__":
    main()
