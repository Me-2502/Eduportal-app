// Mirrors NewPassword in backend/app/schemas.py, so most mistakes are caught before a request.
export function validateNewPassword(password, confirm, oldPassword) {
  if (password.length < 8) return 'New password must be at least 8 characters.'
  if (new TextEncoder().encode(password).length > 72) return 'New password is too long.'
  if (password !== confirm) return "The two new passwords don't match."
  if (oldPassword !== undefined && password === oldPassword) {
    return 'New password must be different from the current one.'
  }
  return ''
}
