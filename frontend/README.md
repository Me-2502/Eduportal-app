# Eduportal frontend

React 19 + Vite, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query, React Router.
Talks to the FastAPI backend in `../backend`.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
```

In dev, requests to `/api` are proxied to `http://localhost:8000`, so start the backend with
`uv run fastapi dev app/main.py` from `backend/`. For a deployed build, set `VITE_API_URL`
(see `.env.example`) to the backend's URL including `/api`.

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Production build | `npm run build` (output in `dist/`) |
| Add a shadcn component | `npx shadcn@latest add <name>` |

## Layout

```
src/
  main.jsx            providers: Query client, theme, auth, router, toasts
  router.jsx          all routes; pages are lazy-loaded
  index.css           Tailwind + colour tokens (light and dark)
  lib/                api client, query client, constants, formatting helpers
  components/         shared pieces (layout, states, dialogs) and ui/ from shadcn
  features/<area>/    one folder per area: api.js (query hooks) + its pages/components
```

Each `features/*/api.js` holds the TanStack Query hooks for that part of the API, so pages
never call axios directly. Server data lives in the query cache; component state is only for
form inputs and UI.

## Auth

- The JWT from `POST /auth/login` is kept in `localStorage`. On reload, `GET /auth/me`
  restores the session.
- Any 401 on an authenticated request logs the user out (`lib/api.js`).
- `must_change_password` users are sent to `/change-password` before anything else.
- Route guards in `features/auth/guards.jsx` only hide pages a role can't use. The backend
  still enforces every permission.

## Backend endpoints that return 501 for now

These are still TODO in the backend. The UI handles the 501 and shows "Coming soon"
(or hides the card) until they are implemented:

- `GET /marks/me`, `GET /marks/student/{id}`: report cards (HOD can still enter marks)
- `GET /attendance/me/summary`: the "By month" panel
- `GET /assignments/me`: the student assignment list and "Due soon"
- `PATCH /assignments/{id}`: editing an assignment

## Notes

- Submissions are links (Drive, OneDrive...) stored in `file_path`, because the backend has
  no file upload yet. Replace `SubmitWork.jsx`'s form when an upload endpoint exists.
- Events have no all-day flag. All-day events are saved as 00:00–23:59 local time and
  recognised that way (`isAllDay` in `lib/format.js`).
