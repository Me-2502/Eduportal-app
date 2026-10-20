import axios from 'axios'

const TOKEN_KEY = 'eduportal.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let onUnauthorized = () => {}

/** Called by the auth provider so an expired token logs the user out everywhere. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 on a request that carried a token means the session is over.
    // A 401 from the login form itself is just a wrong password.
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      tokenStore.clear()
      onUnauthorized()
    }
    return Promise.reject(error)
  },
)

export function isNotImplemented(error) {
  return error?.response?.status === 501
}

const FIELD_LABELS = {
  new_password: 'New password',
  old_password: 'Current password',
  starts_at: 'Start',
  ends_at: 'End',
  due_at: 'Due date',
  max_score: 'Max score',
  file_path: 'Link',
}

function humanizeField(field) {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  const text = String(field).replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Turns any error from the API into one sentence that is safe to show. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  if (!error.response) {
    return error.code === 'ECONNABORTED'
      ? 'The server took too long to respond.'
      : "Can't reach the server. Check your connection."
  }

  const { status, data } = error.response
  if (status === 501) return "This part of the portal isn't ready yet."
  if (status === 429) return 'Too many attempts. Wait a minute and try again.'

  // slowapi uses {"error": ...}, FastAPI uses {"detail": ...}
  const detail = data?.detail ?? data?.error
  if (typeof detail === 'string') return detail

  // Pydantic validation errors: [{loc: ['body', 'field'], msg: '...'}]
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    const msg = String(first.msg ?? '').replace(/^Value error, /, '')
    const field = [...(first.loc ?? [])].reverse().find((part) => typeof part === 'string' && part !== 'body')
    return field ? `${humanizeField(field)}: ${msg}` : msg
  }

  return fallback
}
