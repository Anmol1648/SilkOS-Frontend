# FundOS Frontend

React (Vite) frontend for the FundOS backend — Stages 1–3 of the guided fundraising
programme (Investor Readiness → Fundraising Strategy → Deal Creation & Investor Materials),
built against the delivered Django backend (`fundos-backend`, 6 Jul build, base path `/api/v1`).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173, proxying /api → http://localhost:8000
```

The dev server proxies `/api` to the Django backend, so no CORS configuration is needed.
Point the proxy elsewhere with `VITE_PROXY_TARGET`, or set `VITE_API_BASE` to an absolute
API URL for a non-proxied deployment (see `.env.example`). Production build: `npm run build`.

Backend side: run `fundos-backend` on port 8000 (dev settings run Celery eagerly, so
generation jobs usually finish inside the 202 response and the first poll succeeds).

## The flow the UI implements

```
Sign in (email OTP)  →  Pick / create company & deal  →  Deal home (masterplan 0–9)
   Stage 1 wizard: AI Research → Your Information → Existing Materials → Readiness & Gaps
   Stage 2 wizard: Objectives → Peers → Ideal Raise → Valuation → Instrument & Dilution → Approve
                                                        (approval creates the Strategy Profile
                                                         and opens the Stage-3 hard gate)
   Stage 3 flow:   Workspace hub → Story → Teaser → Deck (outline → approve → slides)
                   → Financial Model → IM → AI Review → Approve Investor Package
```

Every stage is a step-by-step wizard (progress spine at the top, Back/Continue at the
bottom); steps are guidance, not walls — the backend’s soft/hard gating is respected
(423 renders a gate panel that links to the blocking step; stage override asks for
confirmation and is audited server-side).

## Look & feel

- **Identity**: deep forest ink + emerald on warm paper, with a restrained *capital gold*
  accent; Fraunces (display serif) carries headings and money figures, Inter carries the UI.
- **Signature motif**: a contour-line "journey map" on dark panels (login brand panel, deal
  hero) — the fundraise as terrain, with a gold flag at the summit.
- **Illustrations**: a hand-drawn-feel inline-SVG library (`src/components/illos.jsx`) —
  telescope (research), summit (readiness), constellation (peers), rocket (raise), scales
  (valuation), blueprint, pen/envelope/easel/ledger/memo/magnifier/vault (Stage-3 documents) —
  used in empty states, generate panels, gates, stage cards and the dropzone. No external
  image dependencies, crisp at any size, consistent in both light and dark contexts.
- **Feel**: soft card elevation with hover lift, pill buttons with gold focus rings, a sticky
  glass topbar, shimmer skeletons, fade-up entrances — all disabled under
  `prefers-reduced-motion`; responsive down to mobile.

## Design decisions worth knowing

- **Async generation pattern** (`src/lib/artifact.js`): every `…/generate` POST returns
  `202 {status:"queued"}`; the UI then polls the matching resource GET (a 404 while
  generating is a normal state, never an error). Progress messaging is shown; nothing blocks.
- **Idempotency**: every generate/approve/simulate POST carries a fresh `Idempotency-Key`
  (`src/api/client.js`), so retries are safe.
- **Auth**: OTP verify uses the field name `code` (verified against the backend). Tokens are
  stored locally; a 401 triggers one silent `POST /auth/refresh` before routing to login.
- **Guardrails in the UI**: valuation and dilution are only ever rendered as ranges with an
  inseparable advisory disclaimer; instruments are “options, not advice” with no recommended
  flag; every AI narrative carries the “AI Generated Insights” badge (+ needs-review where
  representational).
- **Gap G5/G7 handling**: valuation generation with no financials shows an “add financials”
  panel (never a zero range); strategy approval is blocked in the UI while the valuation
  range is zero.
- **Dilution simulator** posts the backend’s verified body `{raiseUsd, valuationLowUsd,
  valuationHighUsd, instrument}` — prefilled from the recommended raise and current
  valuation range.
- **CKB** is one reusable editor (`CkbEditor`) used by both the Knowledge Base screen and
  Stage-1 Pillar 2: field-level autosave (~800 ms debounce), provenance/confidence/verified
  chips, parked AI suggestions with accept/reject, and soft consistency warnings surfaced
  inline (advisory, never blocking).
- **Uploads**: ≤50 MB go direct multipart; larger files use the chunked, resumable session
  endpoints (`init → PUT chunks → complete`), with scan-status polling on the materials list.
- **Deck is two-step by design**: outline → approve-outline → slides; calling slides early
  returns 423 and the UI explains why.
- **Exports**: teaser/deck/model/IM exports and readiness/strategy/review PDF reports call
  the backend export endpoints and open the returned signed `downloadUrl`.

## Where things live

```
src/api/client.js        fetch wrapper: bearer, refresh, idempotency, error envelope
src/api/endpoints.js     one binding per backend route (verified against fundos/urls.py)
src/lib/artifact.js      generate → poll hook (the async-generation wrapper)
src/lib/format.js        money ({value, ccy, usdValue}) & misc formatting (INR L/Cr aware)
src/context/             auth session, toasts, deal masterplan context
src/components/ui.jsx    AI badge, money range, gate panel, banners, pills, ring, step flow…
src/pages/               Login, Picker/onboarding, DealLayout (rail+topbar), Home, Ckb, Members
src/pages/stage1/        Stage-1 wizard (research, founder info, materials, readiness)
src/pages/stage2/        Stage-2 wizard (objectives … approve → Strategy Profile)
src/pages/stage3/        Stage-3 hub + document flows (story, teaser, deck, model, IM, review)
```

## Not wired (backend not delivered yet)

Per the gap analysis: teaser/IM section-level editing, deck slide editing/reordering,
readiness numeric-score config surfacing beyond the response flag, and admin console
screens (LLM registry, scoring config, alerts) — the founder app treats these as
view + regenerate + export, matching the delivered API surface exactly.
