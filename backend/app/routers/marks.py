from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, joinedload

from app.db import DBSession
from app.deps import HodUser, StudentUser, get_current_user, require_role
from app.models import Mark, User
from app.schemas import Exam, MarksUpsertRequest, StandardMarksOut

router = APIRouter(prefix="/marks", tags=["marks"], dependencies=[Depends(get_current_user)])

Standard = Annotated[int, Path(ge=1, le=12)]
EXAM_ORDER = {"unit1": 1, "unit2": 2, "midterm": 3, "final": 4}


def _get_student(db: Session, student_id: UUID) -> User:
    student = db.get(User, student_id)
    if student is None or student.role != "student":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return student


def _load_marks(db: Session, student_id: UUID) -> list[Mark]:
    statement = (
        select(Mark)
        .options(joinedload(Mark.subject))
        .where(Mark.student_id == student_id)
        .order_by(Mark.standard, Mark.exam, Mark.subject_id)
    )
    return list(db.scalars(statement).all())


def _group_marks(marks: list[Mark]) -> list[StandardMarksOut]:
    # TODO(you): turn the flat rows into one StandardMarksOut per (standard, exam).
    #
    # How:
    #   - `marks` arrives sorted by (standard, exam), so itertools.groupby with
    #     key=lambda m: (m.standard, m.exam) works. groupby only merges *adjacent* items,
    #     which is why _load_marks sorts in SQL. A dict of lists works too.
    #   - per group: subjects = [MarkOut.model_validate(m) for m in group]
    #     total / max_total = sums of score / max_score
    #     percentage = total / max_total * 100, rounded to 2 places
    #   - sort the result by (standard, EXAM_ORDER[exam]). SQL sorted exam alphabetically
    #     ("final" < "unit1"), which is fine for grouping but wrong for display.
    #
    # Why:
    #   - Keep the sums as Decimal and convert at the end: float addition drifts
    #     (0.1 + 0.2 != 0.3), and marks are exactly what people compare by hand.
    #   - You could SUM() ... GROUP BY in SQL, but this response needs the per-subject rows
    #     anyway, so one query + grouping in Python is simpler than two queries.
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Not implemented yet")


@router.get("/me", response_model=list[StandardMarksOut])
def my_marks(user: StudentUser, db: DBSession):
    return _group_marks(_load_marks(db, user.id))


@router.get(
    "/student/{student_id}",
    response_model=list[StandardMarksOut],
    dependencies=[Depends(require_role("faculty", "admin"))],
)
def student_marks(student_id: UUID, db: DBSession):
    _get_student(db, student_id)
    return _group_marks(_load_marks(db, student_id))


@router.put("/{student_id}/{standard}", status_code=status.HTTP_204_NO_CONTENT)
def save_marks(
    student_id: UUID, standard: Standard, body: MarksUpsertRequest, user: HodUser, db: DBSession
):
    """Insert or overwrite one student's marks for a standard/exam (idempotent)."""
    student = _get_student(db, student_id)
    if student.student_class is not None and standard > student.student_class.standard:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Student hasn't reached this standard yet"
        )

    rows = [
        {
            "student_id": student_id,
            "subject_id": entry.subject_id,
            "standard": standard,
            "exam": body.exam,
            "score": entry.score,
            "max_score": entry.max_score,
            "entered_by": user.id,  # RLS requires entered_by = current user
        }
        for entry in body.marks
    ]
    # INSERT ... ON CONFLICT DO UPDATE: one statement, no "select then insert or update" race.
    # `excluded` is the row that failed to insert.
    statement = insert(Mark).values(rows)
    statement = statement.on_conflict_do_update(
        constraint="marks_unique_entry_uq",
        set_={
            "score": statement.excluded.score,
            "max_score": statement.excluded.max_score,
            "entered_by": statement.excluded.entered_by,
        },
    )
    db.execute(statement)
    db.commit()


@router.delete("/{student_id}/{standard}", status_code=status.HTTP_204_NO_CONTENT)
def delete_marks(
    student_id: UUID, standard: Standard, user: HodUser, db: DBSession, exam: Exam = "final"
):
    result = db.execute(
        delete(Mark).where(
            Mark.student_id == student_id, Mark.standard == standard, Mark.exam == exam
        )
    )
    if result.rowcount == 0:  # nothing there, or RLS hid it
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No marks found")
    db.commit()
