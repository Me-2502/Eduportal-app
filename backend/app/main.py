import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.exc import DBAPIError

from app.config import settings
from app.ratelimit import limiter
from app.routers import assignments, attendance, auth, classes, events, marks, timetable, users

logger = logging.getLogger(__name__)

app = FastAPI(title="Eduportal API", docs_url="/docs" if settings.app_env == "dev" else None)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, users, classes, timetable, marks, events, attendance, assignments):
    app.include_router(module.router, prefix="/api")


@app.exception_handler(DBAPIError)
async def db_error_handler(request: Request, exc: DBAPIError):
    sqlstate = getattr(exc.orig, "sqlstate", None)
    diag = getattr(exc.orig, "diag", None)
    message = getattr(diag, "message_primary", None) or "Invalid data"

    if sqlstate == "23505":
        # unique_violation
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT, content={"detail": "Already exists"}
        )
    if sqlstate == "23503":
        # foreign_key_violation
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "Related record is missing or still in use"},
        )
    if sqlstate in ("23514", "23502", "22P02", "22001", "22003"):
        # check / not null / bad value
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": message}
        )
    if sqlstate == "42501":
        # insufficient_privilege, incl. RLS "new row violates row-level security policy"
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN, content={"detail": "Not allowed"}
        )

    logger.exception("Database error", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "message": "Health check successful."}
