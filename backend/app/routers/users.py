from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import DBSession
from app.deps import StudentUser, get_current_user
from app.models import User
from app.schemas import FacultyOut, StudentBrief

router = APIRouter(tags=["users"], dependencies=[Depends(get_current_user)])


@router.get("/students/me/classmates", response_model=list[StudentBrief])
def my_classmates(user: StudentUser, db: DBSession):
    if user.classroom_id is None:
        return []
    statement = (
        select(User)
        .where(
            User.classroom_id == user.classroom_id,
            User.id != user.id,
            User.is_active,
        )
        .order_by(User.roll_no)
    )
    return db.scalars(statement).all()


@router.get("/faculty", response_model=list[FacultyOut])
def list_faculty(db: DBSession):
    statement = (
        select(User)
        # subjects is a collection -> selectinload (one extra "WHERE id IN (...)" query)
        .options(selectinload(User.subjects))
        .where(User.role == "faculty", User.is_active)
        .order_by(User.first_name, User.last_name)
    )
    return db.scalars(statement).all()
