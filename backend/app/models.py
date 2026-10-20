"""ORM models.

The schema itself lives in migrations/*.sql (constraints, triggers, RLS), so these
models only mirror the columns. Never call Base.metadata.create_all().
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CHAR,
    BigInteger,
    Column,
    DateTime,
    FetchedValue,
    ForeignKey,
    ForeignKeyConstraint,
    Numeric,
    SmallInteger,
    Table,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    type_annotation_map = {datetime: DateTime(timezone=True)}


faculty_subjects = Table(
    "faculty_subjects",
    Base.metadata,
    Column("faculty_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("subject_id", ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True),
)


class Classroom(Base):
    __tablename__ = "classes"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    standard: Mapped[int] = mapped_column(SmallInteger)
    division: Mapped[str] = mapped_column(CHAR(1))
    room_no: Mapped[int] = mapped_column(SmallInteger)
    academic_year: Mapped[int] = mapped_column(SmallInteger)
    class_teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", use_alter=True)
    )

    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), server_onupdate=FetchedValue()
    )

    class_teacher: Mapped["User | None"] = relationship(
        foreign_keys=[class_teacher_id], back_populates="teacher_room", post_update=True
    )
    students: Mapped[list["User"]] = relationship(
        foreign_keys="User.classroom_id",
        back_populates="student_class",
        order_by="User.roll_no",
        passive_deletes="all",
    )
    timetable_slots: Mapped[list["TimetableSlot"]] = relationship(
        back_populates="classroom",
        order_by="(TimetableSlot.day_of_week, TimetableSlot.period)",
        passive_deletes=True,
    )
    assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="classroom", passive_deletes="all"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    username: Mapped[str]
    password_hash: Mapped[str]
    role: Mapped[str]  # 'student' | 'faculty' | 'admin'
    first_name: Mapped[str]
    last_name: Mapped[str]
    gender: Mapped[str | None] = mapped_column(CHAR(1))
    email: Mapped[str | None]
    is_active: Mapped[bool] = mapped_column(server_default=text("true"))
    must_change_password: Mapped[bool] = mapped_column(server_default=text("true"))

    classroom_id: Mapped[uuid.UUID | None] = mapped_column("class_id", ForeignKey("classes.id"))
    roll_no: Mapped[int | None] = mapped_column(SmallInteger)
    admission_year: Mapped[int | None] = mapped_column(SmallInteger)

    is_hod: Mapped[bool] = mapped_column(server_default=text("false"))

    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), server_onupdate=FetchedValue()
    )

    student_class: Mapped["Classroom | None"] = relationship(
        foreign_keys=[classroom_id], back_populates="students"
    )
    teacher_room: Mapped[list["Classroom"]] = relationship(
        foreign_keys="Classroom.class_teacher_id", back_populates="class_teacher"
    )
    subjects: Mapped[set["Subject"]] = relationship(
        secondary=faculty_subjects, back_populates="faculty"
    )
    timetable_slots: Mapped[list["TimetableSlot"]] = relationship(
        back_populates="faculty",
        order_by="(TimetableSlot.day_of_week, TimetableSlot.period)",
        passive_deletes="all",
    )
    marks: Mapped[list["Mark"]] = relationship(
        foreign_keys="Mark.student_id", back_populates="student", passive_deletes="all"
    )
    absences: Mapped[list["Attendance"]] = relationship(
        foreign_keys="Attendance.user_id",
        back_populates="user",
        order_by="Attendance.absent_on.desc()",
        passive_deletes="all",
    )
    submissions: Mapped[list["Submission"]] = relationship(
        foreign_keys="Submission.student_id", back_populates="student", passive_deletes="all"
    )


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    code: Mapped[str]
    name: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    faculty: Mapped[set["User"]] = relationship(
        secondary=faculty_subjects, back_populates="subjects"
    )


class TimetableSlot(Base):
    __tablename__ = "timetable_slots"
    __table_args__ = (
        ForeignKeyConstraint(
            ["class_id", "academic_year"], ["classes.id", "classes.academic_year"]
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    classroom_id: Mapped[uuid.UUID] = mapped_column("class_id")
    academic_year: Mapped[int] = mapped_column(SmallInteger)
    day_of_week: Mapped[int] = mapped_column(SmallInteger)  # 1=Mon .. 6=Sat
    period: Mapped[int] = mapped_column(SmallInteger)
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"))
    faculty_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    classroom: Mapped["Classroom"] = relationship(back_populates="timetable_slots")
    subject: Mapped["Subject"] = relationship()
    faculty: Mapped["User"] = relationship(back_populates="timetable_slots")


class Mark(Base):
    __tablename__ = "marks"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"))
    standard: Mapped[int] = mapped_column(SmallInteger)
    exam: Mapped[str] = mapped_column(server_default=text("'final'"))
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    max_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default=text("100"))
    entered_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), server_onupdate=FetchedValue()
    )

    student: Mapped["User"] = relationship(foreign_keys=[student_id], back_populates="marks")
    subject: Mapped["Subject"] = relationship()
    entered_by_user: Mapped["User | None"] = relationship(foreign_keys=[entered_by])


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    title: Mapped[str]
    description: Mapped[str | None]
    type: Mapped[str] = mapped_column(server_default=text("'event'"))
    starts_at: Mapped[datetime]
    ends_at: Mapped[datetime | None]
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), server_onupdate=FetchedValue()
    )

    creator: Mapped["User | None"] = relationship()


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    classroom_id: Mapped[uuid.UUID | None] = mapped_column("class_id", ForeignKey("classes.id"))
    absent_on: Mapped[date]
    reason: Mapped[str | None]
    is_excused: Mapped[bool] = mapped_column(server_default=text("false"))
    marked_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), server_onupdate=FetchedValue()
    )

    user: Mapped["User"] = relationship(foreign_keys=[user_id], back_populates="absences")
    classroom: Mapped["Classroom | None"] = relationship()
    marked_by_user: Mapped["User"] = relationship(foreign_keys=[marked_by])


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    classroom_id: Mapped[uuid.UUID] = mapped_column("class_id", ForeignKey("classes.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str]
    description: Mapped[str | None]
    due_at: Mapped[datetime]
    max_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    allow_late: Mapped[bool] = mapped_column(server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), server_onupdate=FetchedValue()
    )

    classroom: Mapped["Classroom"] = relationship(back_populates="assignments")
    subject: Mapped["Subject"] = relationship()
    creator: Mapped["User"] = relationship()
    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="assignment", passive_deletes="all"
    )


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    assignment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assignments.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    file_path: Mapped[str]
    file_name: Mapped[str | None]
    content_type: Mapped[str | None]
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    submitted_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), server_onupdate=FetchedValue()
    )
    is_late: Mapped[bool] = mapped_column(
        server_default=text("false"), server_onupdate=FetchedValue()
    )
    score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    feedback: Mapped[str | None]
    graded_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), server_onupdate=FetchedValue()
    )
    graded_at: Mapped[datetime | None] = mapped_column(server_onupdate=FetchedValue())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), server_onupdate=FetchedValue()
    )

    assignment: Mapped["Assignment"] = relationship(back_populates="submissions")
    student: Mapped["User"] = relationship(foreign_keys=[student_id], back_populates="submissions")
    grader: Mapped["User | None"] = relationship(foreign_keys=[graded_by])
