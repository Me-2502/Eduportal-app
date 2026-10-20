-- =====================================================================
-- Eduportal - 001_init.sql
-- Initial schema: tables, constraints, indexes, validation triggers, RLS.
--
-- Requires PostgreSQL 13+ (gen_random_uuid() is built in).
--
-- How RLS works here
-- ------------------
-- * Run this migration as the DB owner (e.g. `postgres`). The owner bypasses
--   RLS, so seed scripts and admin maintenance also run as the owner.
-- * The FastAPI app must connect as a *different* login role that is a
--   member of `eduportal_app`, otherwise RLS is bypassed:
--       CREATE ROLE eduportal_api LOGIN PASSWORD '...' IN ROLE eduportal_app;
-- * At the start of every request transaction the backend sets the current user:
--       SELECT set_config('app.user_id', '<uuid from JWT>', true);
--   (`true` = transaction-local, so pooled connections don't leak identity.)
-- * Login happens before we know the user, so the backend calls
--   app_login_lookup(username), a SECURITY DEFINER function, to get the password hash.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- App role
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eduportal_app') THEN
        CREATE ROLE eduportal_app NOLOGIN;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

-- Current request user (set by the backend). NULL when running as owner/seed.
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- =====================================================================
-- TABLES
-- =====================================================================

-- ---------------------------------------------------------------------
-- classes: one row per standard/division per academic year
-- ---------------------------------------------------------------------
CREATE TABLE classes (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    standard         smallint NOT NULL CHECK (standard BETWEEN 1 AND 12),
    division         char(1)  NOT NULL CHECK (division ~ '^[A-Z]$'),
    room_no          smallint NOT NULL CHECK (room_no > 0),
    academic_year    smallint NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
    class_teacher_id uuid,  -- FK added after users table
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT classes_id_year_uq      UNIQUE (id, academic_year),  -- target of timetable composite FK
    CONSTRAINT classes_std_div_year_uq UNIQUE (standard, division, academic_year),
    CONSTRAINT classes_room_year_uq    UNIQUE (room_no, academic_year),
    CONSTRAINT classes_teacher_year_uq UNIQUE (class_teacher_id, academic_year)
);

-- ---------------------------------------------------------------------
-- users: students, faculty and admins in one table (1:1 merged).
-- Student-only columns: class_id, roll_no, admission_year
-- Faculty-only column:  is_hod
-- Users are never hard-deleted (history tables use RESTRICT); set is_active=false.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username             text NOT NULL CHECK (username ~ '^[A-Za-z0-9_.]{3,50}$'),
    password_hash        text NOT NULL CHECK (length(password_hash) >= 20),
    role                 text NOT NULL CHECK (role IN ('student', 'faculty', 'admin')),
    first_name           text NOT NULL CHECK (length(btrim(first_name)) BETWEEN 1 AND 50),
    last_name            text NOT NULL CHECK (length(btrim(last_name)) BETWEEN 1 AND 50),
    gender               char(1) CHECK (gender IN ('M', 'F', 'O')),
    email                text CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    is_active            boolean NOT NULL DEFAULT true,
    must_change_password boolean NOT NULL DEFAULT true,

    -- student only
    class_id             uuid REFERENCES classes (id) ON DELETE RESTRICT,
    roll_no              smallint CHECK (roll_no BETWEEN 1 AND 200),
    admission_year       smallint CHECK (admission_year BETWEEN 2000 AND 2100),

    -- faculty only
    is_hod               boolean NOT NULL DEFAULT false,

    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT users_student_fields_chk CHECK (
        (role = 'student' AND class_id IS NOT NULL AND roll_no IS NOT NULL)
        OR (role <> 'student' AND class_id IS NULL AND roll_no IS NULL AND admission_year IS NULL)
    ),
    CONSTRAINT users_hod_is_faculty_chk CHECK (NOT is_hod OR role = 'faculty'),
    CONSTRAINT users_class_roll_uq UNIQUE (class_id, roll_no)
);

CREATE UNIQUE INDEX users_username_lower_uq ON users (lower(username));
CREATE UNIQUE INDEX users_email_lower_uq    ON users (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX        users_role_active_idx   ON users (role) WHERE is_active;

ALTER TABLE classes
    ADD CONSTRAINT classes_class_teacher_fk
    FOREIGN KEY (class_teacher_id) REFERENCES users (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------
CREATE TABLE subjects (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code       text NOT NULL UNIQUE CHECK (code ~ '^[A-Z]{2,10}$'),  -- MATHS, SCI, ENG, SS, HIN, GUJ, PE, EXTRA
    name       text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 50),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- faculty_subjects: which subjects a faculty member can teach
-- ---------------------------------------------------------------------
CREATE TABLE faculty_subjects (
    faculty_id uuid NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
    subject_id uuid NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
    PRIMARY KEY (faculty_id, subject_id)
);
CREATE INDEX faculty_subjects_subject_idx ON faculty_subjects (subject_id);

-- ---------------------------------------------------------------------
-- timetable_slots: single source of truth for student AND faculty timetables.
-- Keeps every academic year (history). academic_year is copied from the class
-- (filled by trigger if omitted, and kept consistent by the composite FK) so
-- the teacher-clash rule only applies within the same year.
-- ---------------------------------------------------------------------
CREATE TABLE timetable_slots (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id      uuid     NOT NULL,
    academic_year smallint NOT NULL,
    day_of_week   smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),  -- 1=Mon .. 6=Sat
    period        smallint NOT NULL CHECK (period BETWEEN 1 AND 8),
    subject_id    uuid     NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
    faculty_id    uuid     NOT NULL REFERENCES users (id)    ON DELETE RESTRICT,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT timetable_class_fk FOREIGN KEY (class_id, academic_year)
        REFERENCES classes (id, academic_year) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT timetable_class_slot_uq   UNIQUE (class_id, day_of_week, period),                 -- no double lecture
    CONSTRAINT timetable_faculty_slot_uq UNIQUE (faculty_id, academic_year, day_of_week, period) -- no teacher clash (per year)
);
CREATE INDEX timetable_slots_subject_idx ON timetable_slots (subject_id);
CREATE INDEX timetable_slots_year_idx    ON timetable_slots (academic_year);

-- ---------------------------------------------------------------------
-- marks: one row per student / subject / standard / exam
-- ---------------------------------------------------------------------
CREATE TABLE marks (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES users (id)    ON DELETE RESTRICT,
    subject_id uuid NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
    standard   smallint NOT NULL CHECK (standard BETWEEN 1 AND 12),
    exam       text NOT NULL DEFAULT 'final'
               CHECK (exam IN ('unit1', 'unit2', 'midterm', 'final')),
    score      numeric(5, 2) NOT NULL CHECK (score >= 0),
    max_score  numeric(5, 2) NOT NULL DEFAULT 100 CHECK (max_score > 0),
    entered_by uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT marks_score_le_max_chk CHECK (score <= max_score),
    CONSTRAINT marks_unique_entry_uq UNIQUE (student_id, subject_id, standard, exam)
);
CREATE INDEX marks_subject_idx ON marks (subject_id);

-- ---------------------------------------------------------------------
-- events: school calendar
-- ---------------------------------------------------------------------
CREATE TABLE events (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title       text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 100),
    description text CHECK (length(description) <= 2000),
    type        text NOT NULL DEFAULT 'event'
                CHECK (type IN ('event', 'holiday', 'exam', 'meeting', 'other')),
    starts_at   timestamptz NOT NULL,
    ends_at     timestamptz,
    created_by  uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT events_time_order_chk CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX events_starts_at_idx  ON events (starts_at);
CREATE INDEX events_created_by_idx ON events (created_by);

-- ---------------------------------------------------------------------
-- attendance: one row per ABSENT day per user (students and faculty).
-- Present = no row. History is kept forever (RESTRICT on user delete).
-- class_id = the student's class at the time (NULL for faculty), so records
-- stay tied to the right class after a student is promoted.
-- Edit rights: class teacher -> their class's students, HOD -> faculty.
-- ---------------------------------------------------------------------
CREATE TABLE attendance (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users (id)   ON DELETE RESTRICT,
    class_id   uuid          REFERENCES classes (id) ON DELETE RESTRICT,
    absent_on  date NOT NULL CHECK (absent_on >= DATE '2000-01-01'),
    reason     text CHECK (length(reason) <= 255),
    is_excused boolean NOT NULL DEFAULT false,
    marked_by  uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT attendance_user_day_uq UNIQUE (user_id, absent_on)
);
CREATE INDEX attendance_class_day_idx ON attendance (class_id, absent_on) WHERE class_id IS NOT NULL;
CREATE INDEX attendance_day_idx       ON attendance (absent_on);

-- ---------------------------------------------------------------------
-- assignments: created by a faculty member for a class + subject they teach
-- ---------------------------------------------------------------------
CREATE TABLE assignments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id    uuid NOT NULL REFERENCES classes (id)  ON DELETE RESTRICT,
    subject_id  uuid NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
    created_by  uuid NOT NULL REFERENCES users (id)    ON DELETE RESTRICT,
    title       text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 150),
    description text CHECK (length(description) <= 5000),
    due_at      timestamptz NOT NULL,
    max_score   numeric(5, 2) CHECK (max_score > 0),  -- NULL = ungraded
    allow_late  boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT assignments_due_after_create_chk CHECK (due_at > created_at)
);
CREATE INDEX assignments_class_due_idx  ON assignments (class_id, due_at);
CREATE INDEX assignments_created_by_idx ON assignments (created_by);
CREATE INDEX assignments_subject_idx    ON assignments (subject_id);

-- ---------------------------------------------------------------------
-- submissions: one per student per assignment (resubmit = update the row).
-- file_path points to object storage (implemented later).
-- ---------------------------------------------------------------------
CREATE TABLE submissions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   uuid NOT NULL REFERENCES assignments (id) ON DELETE RESTRICT,
    student_id      uuid NOT NULL REFERENCES users (id)       ON DELETE RESTRICT,
    file_path       text NOT NULL CHECK (length(file_path) BETWEEN 1 AND 500),
    file_name       text CHECK (length(file_name) <= 255),
    content_type    text CHECK (length(content_type) <= 100),
    file_size_bytes bigint CHECK (file_size_bytes > 0 AND file_size_bytes <= 26214400),  -- 25 MB
    submitted_at    timestamptz NOT NULL DEFAULT now(),
    is_late         boolean NOT NULL DEFAULT false,
    score           numeric(5, 2) CHECK (score >= 0),
    feedback        text CHECK (length(feedback) <= 2000),
    graded_by       uuid REFERENCES users (id) ON DELETE SET NULL,
    graded_at       timestamptz,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT submissions_one_per_student_uq UNIQUE (assignment_id, student_id),
    -- graded_by may become NULL later (SET NULL), but never graded_by without graded_at
    CONSTRAINT submissions_graded_chk CHECK (graded_by IS NULL OR graded_at IS NOT NULL)
);
CREATE INDEX submissions_student_idx ON submissions (student_id);

-- =====================================================================
-- RLS HELPER FUNCTIONS
-- SECURITY DEFINER = run as owner, so they can read `users` without
-- recursing into users' own RLS policies.
-- =====================================================================

CREATE OR REPLACE FUNCTION app_user_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role FROM users WHERE id = app_user_id() AND is_active
$$;

CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT coalesce(app_user_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION app_is_hod() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT coalesce((SELECT is_hod FROM users WHERE id = app_user_id() AND is_active), false)
$$;

-- Current student's class (NULL for non-students)
CREATE OR REPLACE FUNCTION app_user_class_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT class_id FROM users WHERE id = app_user_id() AND is_active
$$;

CREATE OR REPLACE FUNCTION app_is_class_teacher(p_class_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT app_user_role() = 'faculty'
       AND EXISTS (SELECT 1 FROM classes WHERE id = p_class_id AND class_teacher_id = app_user_id())
$$;

-- Does the current faculty teach this subject in this class (per timetable)?
CREATE OR REPLACE FUNCTION app_teaches(p_class_id uuid, p_subject_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT app_user_role() = 'faculty'
       AND EXISTS (SELECT 1 FROM timetable_slots
                   WHERE class_id = p_class_id AND subject_id = p_subject_id
                     AND faculty_id = app_user_id())
$$;

CREATE OR REPLACE FUNCTION app_owns_assignment(p_assignment_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM assignments WHERE id = p_assignment_id AND created_by = app_user_id())
$$;

CREATE OR REPLACE FUNCTION app_assignment_in_my_class(p_assignment_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM assignments
                   WHERE id = p_assignment_id AND class_id = app_user_class_id())
$$;

-- Who may write an attendance row
CREATE OR REPLACE FUNCTION app_can_edit_attendance(p_user_id uuid, p_class_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT app_is_admin()
        OR (p_class_id IS NOT NULL AND app_is_class_teacher(p_class_id))           -- class teacher -> students
        OR (p_class_id IS NULL AND app_is_hod() AND p_user_id <> app_user_id())     -- HOD -> other faculty
$$;

-- Login lookup (called before app.user_id is known). Returns the hash: backend only!
CREATE OR REPLACE FUNCTION app_login_lookup(p_username text)
RETURNS TABLE (id uuid, password_hash text, role text, is_active boolean, must_change_password boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT u.id, u.password_hash, u.role, u.is_active, u.must_change_password
    FROM users u
    WHERE lower(u.username) = lower(p_username)
$$;

-- =====================================================================
-- VALIDATION TRIGGERS
-- Errors use SQLSTATE 23514 (check_violation) or 42501 (insufficient_privilege)
-- so the backend can map them to 422 / 403.
-- =====================================================================

-- Generic: column TG_ARGV[0] must reference a user with role TG_ARGV[1]
CREATE OR REPLACE FUNCTION check_user_role() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id   uuid := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
    v_role text;
BEGIN
    IF v_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT role INTO v_role FROM users WHERE id = v_id;
    IF v_role IS DISTINCT FROM TG_ARGV[1] THEN
        RAISE EXCEPTION '%.% must reference a % user', TG_TABLE_NAME, TG_ARGV[0], TG_ARGV[1]
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

-- users: non-admins may only change their own password / email
CREATE OR REPLACE FUNCTION users_guard_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    allowed text[] := ARRAY['password_hash', 'must_change_password', 'email', 'updated_at'];
BEGIN
    IF app_user_id() IS NOT NULL AND NOT app_is_admin()
       AND (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
        RAISE EXCEPTION 'Only password and email can be changed'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
END $$;

-- timetable: copy academic_year from the class, faculty must be qualified for the subject
CREATE OR REPLACE FUNCTION timetable_validate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.academic_year IS NULL THEN
        SELECT academic_year INTO NEW.academic_year FROM classes WHERE id = NEW.class_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM faculty_subjects
                   WHERE faculty_id = NEW.faculty_id AND subject_id = NEW.subject_id) THEN
        RAISE EXCEPTION 'Faculty is not assigned to this subject'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

-- attendance: fill/validate class_id, no future dates, set marked_by
CREATE OR REPLACE FUNCTION attendance_validate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_role  text;
    v_class uuid;
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.user_id <> OLD.user_id
                             OR NEW.class_id IS DISTINCT FROM OLD.class_id) THEN
        RAISE EXCEPTION 'user_id / class_id of an attendance record cannot be changed'
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT role, class_id INTO v_role, v_class FROM users WHERE id = NEW.user_id;

    IF v_role = 'student' THEN
        IF TG_OP = 'INSERT' THEN
            NEW.class_id := coalesce(NEW.class_id, v_class);
            -- through the API, new records must be for the student's current class
            -- (owner/seed scripts may backfill older classes)
            IF app_user_id() IS NOT NULL AND NEW.class_id IS DISTINCT FROM v_class THEN
                RAISE EXCEPTION 'class_id must be the student''s current class'
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;
    ELSIF v_role = 'faculty' THEN
        IF NEW.class_id IS NOT NULL THEN
            RAISE EXCEPTION 'class_id must be empty for faculty attendance'
                USING ERRCODE = 'check_violation';
        END IF;
    ELSE
        RAISE EXCEPTION 'Attendance can only be recorded for students and faculty'
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.absent_on > current_date THEN
        RAISE EXCEPTION 'absent_on cannot be in the future' USING ERRCODE = 'check_violation';
    END IF;

    NEW.marked_by := coalesce(app_user_id(), NEW.marked_by);
    RETURN NEW;
END $$;

-- assignments: due date must be in the future when created
CREATE OR REPLACE FUNCTION assignments_validate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.due_at <= now() THEN
        RAISE EXCEPTION 'due_at must be in the future' USING ERRCODE = 'check_violation';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.class_id <> OLD.class_id OR NEW.created_by <> OLD.created_by) THEN
        RAISE EXCEPTION 'class_id / created_by of an assignment cannot be changed'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

-- submissions: class match, deadline, late flag, who can change which columns
CREATE OR REPLACE FUNCTION submissions_validate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    a          assignments%ROWTYPE;
    v_actor    uuid := app_user_id();
    v_class    uuid;
    file_cols  text[] := ARRAY['file_path', 'file_name', 'content_type', 'file_size_bytes',
                               'submitted_at', 'is_late', 'updated_at'];
    grade_cols text[] := ARRAY['score', 'feedback', 'graded_by', 'graded_at', 'updated_at'];
BEGIN
    SELECT * INTO a FROM assignments WHERE id = NEW.assignment_id;

    IF TG_OP = 'INSERT' THEN
        SELECT class_id INTO v_class FROM users WHERE id = NEW.student_id AND role = 'student';
        IF v_class IS DISTINCT FROM a.class_id THEN
            RAISE EXCEPTION 'Student is not in this assignment''s class'
                USING ERRCODE = 'check_violation';
        END IF;
        IF v_actor IS NOT NULL THEN
            NEW.submitted_at := now();
            NEW.score := NULL; NEW.feedback := NULL; NEW.graded_by := NULL; NEW.graded_at := NULL;
        END IF;
        IF NEW.submitted_at > a.due_at AND NOT a.allow_late THEN
            RAISE EXCEPTION 'Submission deadline has passed' USING ERRCODE = 'check_violation';
        END IF;

    ELSE -- UPDATE
        IF NEW.assignment_id <> OLD.assignment_id OR NEW.student_id <> OLD.student_id THEN
            RAISE EXCEPTION 'assignment_id / student_id cannot be changed'
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_actor IS NOT NULL AND v_actor = OLD.student_id THEN
            -- student re-submitting
            IF (to_jsonb(NEW) - file_cols) IS DISTINCT FROM (to_jsonb(OLD) - file_cols) THEN
                RAISE EXCEPTION 'Students can only replace the submitted file'
                    USING ERRCODE = 'insufficient_privilege';
            END IF;
            IF OLD.graded_at IS NOT NULL THEN
                RAISE EXCEPTION 'Submission is already graded' USING ERRCODE = 'check_violation';
            END IF;
            NEW.submitted_at := now();
            IF NEW.submitted_at > a.due_at AND NOT a.allow_late THEN
                RAISE EXCEPTION 'Submission deadline has passed' USING ERRCODE = 'check_violation';
            END IF;

        ELSIF v_actor IS NOT NULL THEN
            -- faculty grading
            IF (to_jsonb(NEW) - grade_cols) IS DISTINCT FROM (to_jsonb(OLD) - grade_cols) THEN
                RAISE EXCEPTION 'Graders can only change score and feedback'
                    USING ERRCODE = 'insufficient_privilege';
            END IF;
            IF NEW.score IS DISTINCT FROM OLD.score OR NEW.feedback IS DISTINCT FROM OLD.feedback THEN
                NEW.graded_by := v_actor;
                NEW.graded_at := now();
            END IF;
        END IF;
    END IF;

    IF NEW.score IS NOT NULL AND a.max_score IS NULL THEN
        RAISE EXCEPTION 'This assignment is not graded' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.score > a.max_score THEN
        RAISE EXCEPTION 'score cannot exceed max_score (%)', a.max_score
            USING ERRCODE = 'check_violation';
    END IF;

    NEW.is_late := NEW.submitted_at > a.due_at;
    RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- Attach triggers
-- ---------------------------------------------------------------------
-- updated_at
CREATE TRIGGER classes_updated_at     BEFORE UPDATE ON classes     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_updated_at       BEFORE UPDATE ON users       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER marks_updated_at       BEFORE UPDATE ON marks       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER events_updated_at      BEFORE UPDATE ON events      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER attendance_updated_at  BEFORE UPDATE ON attendance  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER submissions_updated_at BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- role checks on FK columns
CREATE TRIGGER classes_teacher_role BEFORE INSERT OR UPDATE OF class_teacher_id ON classes
    FOR EACH ROW EXECUTE FUNCTION check_user_role('class_teacher_id', 'faculty');
CREATE TRIGGER faculty_subjects_role BEFORE INSERT OR UPDATE ON faculty_subjects
    FOR EACH ROW EXECUTE FUNCTION check_user_role('faculty_id', 'faculty');
CREATE TRIGGER timetable_faculty_role BEFORE INSERT OR UPDATE ON timetable_slots
    FOR EACH ROW EXECUTE FUNCTION check_user_role('faculty_id', 'faculty');
CREATE TRIGGER marks_student_role BEFORE INSERT OR UPDATE ON marks
    FOR EACH ROW EXECUTE FUNCTION check_user_role('student_id', 'student');
CREATE TRIGGER assignments_creator_role BEFORE INSERT OR UPDATE ON assignments
    FOR EACH ROW EXECUTE FUNCTION check_user_role('created_by', 'faculty');
CREATE TRIGGER submissions_student_role BEFORE INSERT OR UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION check_user_role('student_id', 'student');

-- business rules
CREATE TRIGGER users_guard            BEFORE UPDATE ON users                     FOR EACH ROW EXECUTE FUNCTION users_guard_update();
CREATE TRIGGER timetable_validate     BEFORE INSERT OR UPDATE ON timetable_slots FOR EACH ROW EXECUTE FUNCTION timetable_validate();
CREATE TRIGGER attendance_validate    BEFORE INSERT OR UPDATE ON attendance      FOR EACH ROW EXECUTE FUNCTION attendance_validate();
CREATE TRIGGER assignments_validate   BEFORE INSERT OR UPDATE ON assignments     FOR EACH ROW EXECUTE FUNCTION assignments_validate();
CREATE TRIGGER submissions_validate   BEFORE INSERT OR UPDATE ON submissions     FOR EACH ROW EXECUTE FUNCTION submissions_validate();

-- =====================================================================
-- ROW LEVEL SECURITY
-- Helpers are wrapped in (SELECT ...) so Postgres evaluates them once per
-- query instead of once per row.
-- =====================================================================
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance       ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions      ENABLE ROW LEVEL SECURITY;

-- ---------- users ----------
-- self; faculty/admin see everyone; students see classmates + faculty
CREATE POLICY users_select ON users FOR SELECT TO eduportal_app USING (
    id = (SELECT app_user_id())
    OR (SELECT app_user_role()) IN ('faculty', 'admin')
    OR ((SELECT app_user_role()) = 'student'
        AND is_active
        AND (role = 'faculty' OR class_id = (SELECT app_user_class_id())))
);
CREATE POLICY users_insert ON users FOR INSERT TO eduportal_app
    WITH CHECK ((SELECT app_is_admin()));
CREATE POLICY users_update ON users FOR UPDATE TO eduportal_app   -- column limits enforced by users_guard trigger
    USING      (id = (SELECT app_user_id()) OR (SELECT app_is_admin()))
    WITH CHECK (id = (SELECT app_user_id()) OR (SELECT app_is_admin()));
CREATE POLICY users_delete ON users FOR DELETE TO eduportal_app
    USING ((SELECT app_is_admin()));

-- ---------- reference data: readable by any logged-in user, writable by admin ----------
CREATE POLICY classes_select ON classes FOR SELECT TO eduportal_app
    USING ((SELECT app_user_role()) IS NOT NULL);
CREATE POLICY classes_admin ON classes FOR ALL TO eduportal_app
    USING ((SELECT app_is_admin())) WITH CHECK ((SELECT app_is_admin()));

CREATE POLICY subjects_select ON subjects FOR SELECT TO eduportal_app
    USING ((SELECT app_user_role()) IS NOT NULL);
CREATE POLICY subjects_admin ON subjects FOR ALL TO eduportal_app
    USING ((SELECT app_is_admin())) WITH CHECK ((SELECT app_is_admin()));

CREATE POLICY faculty_subjects_select ON faculty_subjects FOR SELECT TO eduportal_app
    USING ((SELECT app_user_role()) IS NOT NULL);
CREATE POLICY faculty_subjects_admin ON faculty_subjects FOR ALL TO eduportal_app
    USING ((SELECT app_is_admin())) WITH CHECK ((SELECT app_is_admin()));

CREATE POLICY timetable_select ON timetable_slots FOR SELECT TO eduportal_app
    USING ((SELECT app_user_role()) IS NOT NULL);
CREATE POLICY timetable_admin ON timetable_slots FOR ALL TO eduportal_app
    USING ((SELECT app_is_admin())) WITH CHECK ((SELECT app_is_admin()));

-- ---------- marks: student sees own, faculty sees all, HOD writes ----------
CREATE POLICY marks_select ON marks FOR SELECT TO eduportal_app USING (
    student_id = (SELECT app_user_id())
    OR (SELECT app_user_role()) IN ('faculty', 'admin')
);
CREATE POLICY marks_insert ON marks FOR INSERT TO eduportal_app WITH CHECK (
    (SELECT app_is_admin())
    OR ((SELECT app_is_hod()) AND entered_by = (SELECT app_user_id()))
);
CREATE POLICY marks_update ON marks FOR UPDATE TO eduportal_app
    USING ((SELECT app_is_admin()) OR (SELECT app_is_hod()))
    WITH CHECK ((SELECT app_is_admin())
                OR ((SELECT app_is_hod()) AND entered_by = (SELECT app_user_id())));
CREATE POLICY marks_delete ON marks FOR DELETE TO eduportal_app
    USING ((SELECT app_is_admin()) OR (SELECT app_is_hod()));

-- ---------- events: all read, faculty create, creator/HOD/admin modify ----------
CREATE POLICY events_select ON events FOR SELECT TO eduportal_app
    USING ((SELECT app_user_role()) IS NOT NULL);
CREATE POLICY events_insert ON events FOR INSERT TO eduportal_app WITH CHECK (
    (SELECT app_user_role()) IN ('faculty', 'admin') AND created_by = (SELECT app_user_id())
);
CREATE POLICY events_update ON events FOR UPDATE TO eduportal_app
    USING      (created_by = (SELECT app_user_id()) OR (SELECT app_is_hod()) OR (SELECT app_is_admin()))
    WITH CHECK (created_by = (SELECT app_user_id()) OR (SELECT app_is_hod()) OR (SELECT app_is_admin()));
CREATE POLICY events_delete ON events FOR DELETE TO eduportal_app
    USING (created_by = (SELECT app_user_id()) OR (SELECT app_is_hod()) OR (SELECT app_is_admin()));

-- ---------- attendance ----------
-- read: self, admin, HOD (everyone), class teacher (their class's records)
CREATE POLICY attendance_select ON attendance FOR SELECT TO eduportal_app USING (
    user_id = (SELECT app_user_id())
    OR (SELECT app_is_admin())
    OR (SELECT app_is_hod())
    OR (class_id IS NOT NULL AND app_is_class_teacher(class_id))
);
CREATE POLICY attendance_insert ON attendance FOR INSERT TO eduportal_app
    WITH CHECK (app_can_edit_attendance(user_id, class_id));
CREATE POLICY attendance_update ON attendance FOR UPDATE TO eduportal_app
    USING      (app_can_edit_attendance(user_id, class_id))
    WITH CHECK (app_can_edit_attendance(user_id, class_id));
CREATE POLICY attendance_delete ON attendance FOR DELETE TO eduportal_app
    USING (app_can_edit_attendance(user_id, class_id));

-- ---------- assignments ----------
CREATE POLICY assignments_select ON assignments FOR SELECT TO eduportal_app USING (
    (SELECT app_user_role()) IN ('faculty', 'admin')
    OR class_id = (SELECT app_user_class_id())
);
CREATE POLICY assignments_insert ON assignments FOR INSERT TO eduportal_app WITH CHECK (
    (SELECT app_is_admin())
    OR (created_by = (SELECT app_user_id()) AND app_teaches(class_id, subject_id))
);
CREATE POLICY assignments_update ON assignments FOR UPDATE TO eduportal_app
    USING (created_by = (SELECT app_user_id()) OR (SELECT app_is_hod()) OR (SELECT app_is_admin()))
    WITH CHECK ((SELECT app_is_admin()) OR (SELECT app_is_hod())
                OR (created_by = (SELECT app_user_id()) AND app_teaches(class_id, subject_id)));
CREATE POLICY assignments_delete ON assignments FOR DELETE TO eduportal_app
    USING (created_by = (SELECT app_user_id()) OR (SELECT app_is_hod()) OR (SELECT app_is_admin()));

-- ---------- submissions ----------
-- read: own; assignment creator; HOD; admin
CREATE POLICY submissions_select ON submissions FOR SELECT TO eduportal_app USING (
    student_id = (SELECT app_user_id())
    OR app_owns_assignment(assignment_id)
    OR (SELECT app_is_hod())
    OR (SELECT app_is_admin())
);
-- create: a student, for themselves, for an assignment of their class
CREATE POLICY submissions_insert ON submissions FOR INSERT TO eduportal_app WITH CHECK (
    student_id = (SELECT app_user_id())
    AND (SELECT app_user_role()) = 'student'
    AND app_assignment_in_my_class(assignment_id)
);
-- update: student (resubmit) or grader; which columns is enforced by the trigger
CREATE POLICY submissions_update ON submissions FOR UPDATE TO eduportal_app
    USING (student_id = (SELECT app_user_id()) OR app_owns_assignment(assignment_id)
           OR (SELECT app_is_hod()) OR (SELECT app_is_admin()))
    WITH CHECK (student_id = (SELECT app_user_id()) OR app_owns_assignment(assignment_id)
                OR (SELECT app_is_hod()) OR (SELECT app_is_admin()));
-- delete: student withdraws an ungraded submission, or admin
CREATE POLICY submissions_delete ON submissions FOR DELETE TO eduportal_app
    USING ((student_id = (SELECT app_user_id()) AND graded_at IS NULL) OR (SELECT app_is_admin()));

-- =====================================================================
-- GRANTS
-- =====================================================================
GRANT USAGE ON SCHEMA public TO eduportal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    users, classes, subjects, faculty_subjects, timetable_slots,
    marks, events, attendance, assignments, submissions
TO eduportal_app;

-- The login lookup returns password hashes: only the app role may call it
-- (on Supabase this also keeps it away from the anon/authenticated roles).
REVOKE ALL ON FUNCTION app_login_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_login_lookup(text) TO eduportal_app;

COMMIT;
