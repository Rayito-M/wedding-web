## Phase Q — The stale bundle problem (hub ADR-0037, accepted)

> **Why this phase exists.** `v1.0.0` shipped on 2026-08-28 and guests are using the app. This repo
> writes no stored data, so hub ADR-0037's migration rules mostly do not apply here — **one half
> does.** The SPA is a static bundle on CloudFront and is **not** redeployed with the API. A guest
> who loaded it an hour ago keeps executing it until they reload, which on a phone with the tab open
> may be tomorrow. `contracts/README.md`'s three-repo dance is a build-time protocol; it says nothing
> about the client already running in someone's hand.

### T294 — Recognise the too-old-client error and offer a reload
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** `wedding-api` T227 (which defines the error), and agreeing its exact code with that
  task **before** either ships
- **Acceptance:**
  - When the API returns the distinguishable **too-old-client** error (hub ADR-0037 §7 — its own
    status/code, never a generic 400 and never a 500), the app surfaces a **reload prompt**, not a
    broken screen and not the generic error state. The user-facing message says, in substance, that
    a newer version is available and they should reload; it never shows a status code or a stack.
  - **Handled centrally**, in the existing HTTP error interceptor — not per-feature. Any call from
    any screen can be the one that hits it, and a per-screen approach guarantees the miss.
  - **ES/EN/FR**, per hard rule 8. Reuse the existing error/toast surface if it fits; a new DS
    component should not be needed, and if it is, that is a question for the user before building it.
  - Reloading actually fixes it — i.e. the prompt triggers a real reload that fetches the current
    bundle, not an in-app route change that keeps the stale JavaScript alive.
  - Do **not** build version-polling, a heartbeat, or a background "check for updates" timer. The
    trigger is the API's error on a call the user already made. Anything more is a new decision.
  - **There is nothing to reproduce today** — no breaking contract change is in flight, and hub
    ADR-0037 §7 exists so the first one is not also the first attempt at handling it. Test against a
    mocked error response.
  - Full pre-merge gate green.
- **Refs:** hub ADR-0037 §7; hub `SPEC.md` Constants → *Old-client tolerance window* (24 h, a floor
  and not a guarantee — a week-old tab is outside it, which is exactly why the prompt exists); hub
  `ARCHITECTURE.md` → Failure modes (stale bundle row); `wedding-api` T227

### Deliberately out of scope for Phase Q
- **Version polling, heartbeats, or a service-worker update flow.** The prompt is reactive, driven by
  an error on a call the user already made. Nothing checks for updates in the background.
- **Client-side API versioning or a `/v2` client.** Hub ADR-0037 §8 rejects `/v2` outright; `/v1` is a
  path prefix and carries no compatibility promise.
- **Anything about stored data.** This repo is not a writer of it; the migration process in hub
  ADR-0037 §4/§5 belongs entirely to `wedding-api`.

---
