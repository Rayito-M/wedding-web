# TASKS.md — wedding-web

> Atomic, agent-sized tasks. One task = one PR. Tasks numbered T2xx to avoid collision with `wedding-api` (T1xx).
> Status: `todo` | `in-progress` | `blocked` | `done`.
>
> Note: task numbers T260–T263 referenced by (now superseded) hub ADR-0011 were never
> created and are void — messaging was cut from scope by hub ADR-0014.

---

## Phase A — App-managed auth (hub ADR-0013)

### T200 — Sign-in integration (app-managed auth)
- **Status:** todo
- **Owner:** agent (implementer)
- **Acceptance:**
  - Phone + SMS OTP flow: two-step form (enter E.164 phone → enter code) calling `POST /v1/auth/otp/request` and `POST /v1/auth/otp/verify` (`wedding-api` T152)
  - Google sign-in via Google Identity Services and Apple via Sign in with Apple JS; the obtained ID token is sent to `POST /v1/auth/social`
  - The returned app JWT is held in a signals-based auth store; an HTTP interceptor attaches `Authorization: Bearer <token>` to every API call
  - Session survives a page reload within the token's validity (storage strategy = implementer's call; document it)
  - Sign-out clears state and returns to the login screen
- **Refs:** hub ADR-0013

### T201 — Sign-in UX + unmatched-identity page
- **Status:** todo
- **Owner:** agent (implementer)
- **Acceptance:**
  - Unauthenticated visitors to any route land on a minimal localized welcome/sign-in screen (es/en/fr per hub ADR-0009)
  - A 403 from the API (identity matched no guest record) routes to a localized "contact the couple" page with no further navigation
  - Post-login, the guest lands on the invitation page (SPEC.md J1)
- **Refs:** hub ADR-0013, SPEC.md J1

### T202 — Admin gate via `role` claim
- **Status:** todo
- **Owner:** agent (implementer)
- **Acceptance:**
  - Route guard for `/admin/**` requires `role: admin` in the app session token
  - Non-admin signed-in users never see admin navigation entries
  - The old password login form (superseded hub ADR-0008) is not built
- **Refs:** hub ADR-0013

### T203 — Admin guest form: identity fields
- **Status:** todo
- **Owner:** agent (implementer)
- **Acceptance:**
  - Admin guest create/edit form captures `phoneNumber` (E.164, validated) and `email` — the data identity matching depends on
  - Guest list shows whether a guest has signed in yet (has a linked provider sub or a completed OTP sign-in)
- **Refs:** hub ADR-0013

## Phase B — AWS hosting (hub ADR-0012)

### T204 — S3 + CloudFront deploy pipeline
- **Status:** todo
- **Owner:** agent (implementer)
- **Acceptance:**
  - Production build synced to the private S3 bucket; CloudFront invalidation issued on deploy; site serves at `comolatruchaaltrucho.eu`
  - SPA fallback: CloudFront error responses 403/404 → `/index.html` (200)
  - Production environment config points at `api.comolatruchaaltrucho.eu`
  - CI credentials via GitHub OIDC role (no long-lived AWS keys), if CI deploys are used
  - Rollback documented: re-sync previous build (S3 object versions) + invalidate
- **Refs:** hub ADR-0012

## Scope cuts (hub ADR-0014) — do not build

- No gallery/photo-upload feature, no admin photo moderation views.
- No reminder-schedule or send-log admin views.
- Feature folders are exactly: invitation, rsvp, admin.
