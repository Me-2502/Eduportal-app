For migrations
uv add alembic

| Task | Command |
| Run dev server (auto reload) | uv run fastapi dev app/main.py |
| Run tests | uv run pytest |
| Lint / format | uv run ruff check . --fix / uv run ruff format . |
| Seed DB | uv run python -m scripts.seed |
| Add a package | uv add <pkg> |
| Fresh clone setup | uv sync |
## Database setup (PostgreSQL + RLS)

1. Create the database (as `postgres`): `CREATE DATABASE eduportal;`
2. Fill `DATABASE_OWNER_URL` in `.env` and run the migrations: `uv run python -m scripts.migrate`
3. Create the login role the app uses (it must NOT be the owner, or RLS is bypassed):
   ```sql
   CREATE ROLE eduportal_api LOGIN PASSWORD 'choose-one' IN ROLE eduportal_app;
   ```
   and put it in `DATABASE_URL`.
4. Seed data with the owner connection (RLS doesn't apply to it).

The app sets `app.user_id` at the start of every transaction (`app/db.py`), and RLS policies read it.
Login and password reset go through SECURITY DEFINER functions (`app_login_lookup`,
`app_request_password_reset`, `app_reset_password`) because no user is known yet at that point.
