-- =====================================================================
-- Eduportal - 002_password_resets.sql
-- OTP based "forgot password" flow.
--
-- * The OTP is never stored in plain text: the backend sends
--   HMAC-SHA256(secret, otp) as a 64-char hex string.
-- * The table has RLS enabled and NO policies/grants for the app role, so it
--   can only be touched through the two SECURITY DEFINER functions below.
-- * Both functions work without app.user_id (the user isn't logged in).
-- =====================================================================

BEGIN;

CREATE TABLE password_resets (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    otp_hash       text NOT NULL CHECK (otp_hash ~ '^[0-9a-f]{64}$'),
    expires_at     timestamptz NOT NULL,
    attempts       smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    used_at        timestamptz,
    invalidated_at timestamptz,  -- superseded by a newer request
    requested_ip   inet,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT password_resets_expiry_chk CHECK (expires_at > created_at)
);

CREATE INDEX password_resets_user_created_idx ON password_resets (user_id, created_at DESC);
-- at most one open reset per user
CREATE UNIQUE INDEX password_resets_one_open_uq ON password_resets (user_id)
    WHERE used_at IS NULL AND invalidated_at IS NULL;

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON password_resets FROM PUBLIC;

-- ---------------------------------------------------------------------
-- Request a reset. Returns (email, first_name) to send the OTP to, or no row
-- if the user is unknown / inactive / has no email / is throttled.
-- The API must respond the same way in every case.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_request_password_reset(
    p_username    text,
    p_otp_hash    text,
    p_ttl_minutes int  DEFAULT 10,
    p_ip          inet DEFAULT NULL
)
RETURNS TABLE (email text, first_name text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user users%ROWTYPE;
BEGIN
    IF p_ttl_minutes NOT BETWEEN 1 AND 60 THEN
        RAISE EXCEPTION 'p_ttl_minutes must be between 1 and 60' USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO v_user FROM users u WHERE lower(u.username) = lower(p_username) AND u.is_active;
    IF NOT FOUND OR v_user.email IS NULL THEN
        RETURN;
    END IF;

    -- throttle: max 3 requests per user per 15 minutes
    IF (SELECT count(*) FROM password_resets pr
        WHERE pr.user_id = v_user.id AND pr.created_at > now() - interval '15 minutes') >= 3 THEN
        RETURN;
    END IF;

    UPDATE password_resets pr SET invalidated_at = now()
    WHERE pr.user_id = v_user.id AND pr.used_at IS NULL AND pr.invalidated_at IS NULL;

    INSERT INTO password_resets (user_id, otp_hash, expires_at, requested_ip)
    VALUES (v_user.id, p_otp_hash, now() + make_interval(mins => p_ttl_minutes), p_ip);

    email := v_user.email;
    first_name := v_user.first_name;
    RETURN NEXT;
END $$;

-- ---------------------------------------------------------------------
-- Verify the OTP and set the new password.
-- Returns 'ok' | 'invalid' | 'expired' | 'too_many_attempts'.
-- A wrong OTP increments attempts, so the caller must COMMIT even on failure.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_reset_password(
    p_username          text,
    p_otp_hash          text,
    p_new_password_hash text,
    p_max_attempts      int DEFAULT 5
)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_id uuid;
    r         password_resets%ROWTYPE;
BEGIN
    SELECT u.id INTO v_user_id FROM users u WHERE lower(u.username) = lower(p_username) AND u.is_active;
    IF v_user_id IS NULL THEN
        RETURN 'invalid';
    END IF;

    SELECT * INTO r FROM password_resets pr
    WHERE pr.user_id = v_user_id AND pr.used_at IS NULL AND pr.invalidated_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
        RETURN 'invalid';
    END IF;

    IF r.expires_at < now() THEN
        RETURN 'expired';
    END IF;
    IF r.attempts >= p_max_attempts THEN
        RETURN 'too_many_attempts';
    END IF;
    IF r.otp_hash <> p_otp_hash THEN
        UPDATE password_resets SET attempts = attempts + 1 WHERE id = r.id;
        RETURN 'invalid';
    END IF;

    UPDATE password_resets SET used_at = now() WHERE id = r.id;
    UPDATE users SET password_hash = p_new_password_hash, must_change_password = false
    WHERE id = v_user_id;
    RETURN 'ok';
END $$;

REVOKE ALL ON FUNCTION app_request_password_reset(text, text, int, inet) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_reset_password(text, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_request_password_reset(text, text, int, inet) TO eduportal_app;
GRANT EXECUTE ON FUNCTION app_reset_password(text, text, text, int) TO eduportal_app;

COMMIT;
