# Grant Application Review — Complete Implementation Guide
*Every required goal traced explicitly, a build order, ready-to-paste AI prompts per step, two polish passes, and a pre-submission QA checklist.*

> **How to use this doc:** Work top to bottom. Don't paste a step's prompt until you've read and can explain the previous step's output — "the AI wrote it" is explicitly called out as the top failure mode. Commit after every step, not at the end.

---

## 0. Requirements traceability — check this against your build before you submit

Use this table as your source of truth. If a row's "Where it's built" column is empty when you're done, you have a gap — go back before you touch polish or stretch goals.

| # | Requirement (exact ask from brief) | Build step | Verify by |
|---|---|---|---|
| 1a | Email/password login, ≥2 roles (program officer, reviewer) | Step 2 | Log in as each role |
| 1b | Program officers create/edit/archive applications, assign reviewers, record decisions | Steps 3, 5, 6 | Try as program officer |
| 1c | Reviewers see only assigned applications, record reviews, declare COI; **cannot** create/edit/archive/assign | Steps 4, 6, 7 | Try as reviewer — including hitting a PO-only API route directly with curl, not just checking the UI hides the button |
| 2 | Applications: org name, contact email, round, exact decimal amount, submission date, owning PO; edit; archive/restore hides from default views without deleting review history | Step 3 | Archive one, confirm it vanishes from the default list but its reviews still show when you open it directly |
| 3a | Review: 1–5 on Impact/Feasibility/Budget Justification + comments; draft → completed; completed = immutable | Step 4 | Complete a review, then try to PATCH it again via API |
| 3b | Declare COI with a reason; COI blocks future assignment | Steps 4, 6 | Declare COI, then try assigning that reviewer |
| 3c | Opening an application shows every completed review with reviewer name, scores, comments | Step 4 | View an application with 2+ completed reviews |
| 4a | Status lifecycle Submitted → Assigned → Under Review → Decided | Step 5 | — |
| 4b | Cannot reach Decided without ≥3 completed reviews | Step 5 | Try early, confirm rejection message names the count |
| 4c | COI reviewer can never be assigned | Step 6 | — |
| 4d | Any illegal transition rejected server-side with an explanatory message | Step 5 | Try SUBMITTED → DECIDED directly via API |
| 5a | Assign any number of reviewers; reviewer capped at 5 *active* assignments (active = review not completed) | Step 6 | Assign a 6th, confirm rejection names the limit |
| 5b | Remove assignment only while review not completed | Step 6 | Try removing after completion |
| 5c | Due date, editable until review completed; overdue = past due, not completed | Step 6 | — |
| 5d | Reviewer sees one list of everything assigned to them | Step 6 | — |
| 6 | Server-side search (org name + email), filters (round, status, owner, overdue), sort (date/amount/status), pagination with total count | Step 7 | Confirm the Prisma query does `where`/`orderBy`/`skip`/`take` + a separate `count()` — not a full table load filtered in JS |
| 7a | Bulk-assign a round × reviewer set in one action, per-assignment succeeded/refused report | Step 8 | Bulk-assign into a round with an existing COI or a maxed-out reviewer, confirm the report shows the refusal reason |
| 7b | CSV export of completed reviews for a round, broken out by criterion | Step 8 | Open the CSV, confirm separate columns per criterion, not one blended score |
| 8 | Dashboard: open apps, overdue count, ready-for-decision count, amount requested this month, breakdown by status/round, decided-per-week chart (8 wks) | Step 9 | — |
| 9a | Timeline: creation, every status change (old/new/who), every assignment/removal, comments | Step 10 | — |
| 9b | Nothing in the timeline editable/deletable by anyone, ever | Step 10 | Grep the codebase for any UPDATE/DELETE on TimelineEvent — there should be none |
| 10a | Overdue assignment → alerts area + nav count badge | Step 11 | — |
| 10b | Dismiss an alert; alert returns if due date changes and passes again | Step 11 | Dismiss, push the due date back, let it pass again, confirm the alert reappears |

---

## 1. Tech stack (optimized for one person, ~12h, zero-cost hosting)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14 (App Router) + TypeScript** | One repo, API routes double as your server — no separate backend deploy. |
| Auth | **NextAuth.js (Credentials) + bcrypt** | Session-based, role stored in the JWT, no paid auth SaaS needed. |
| Database | **PostgreSQL via Supabase (free tier)** | Managed, free, connection string in minutes. |
| ORM | **Prisma** | Schema-as-code + migrations make `docs/schema.md` nearly write itself. |
| UI | **Tailwind CSS + shadcn/ui** | Clean screens fast, no hand-rolled CSS. |
| Charts | **Recharts** | Dashboard bars + weekly line chart. |
| CSV | **`papaparse`** or manual string-build via API route | No extra service needed. |
| Hosting | **Vercel** (app + API) + **Supabase** (DB) | Two services instead of three — Next.js API routes remove the need for a separate Render deployment. |
| Testing | Manual adversarial testing per the traceability table above, rather than a full automated suite — call this trade-off out explicitly in `decisions.md`. |

If you're faster in Django/Rails/Laravel/MERN, use that — the brief explicitly rewards familiarity over novelty. The prompts below assume Next.js/Prisma; tell your AI tool your real stack and the same structure carries over.

---

## 2. Time-boxed plan (feed this into `docs/plan.md` as you go, with real hours — not backfilled at the end)

| Session | Hours | Covers |
|---|---|---|
| 1 | 2h | Scaffold, full Prisma schema, migrations, seed script skeleton |
| 2 | 2h | Auth, server-enforced RBAC, applications CRUD + archive/restore |
| 3 | 2h | Review lifecycle (draft/complete), conflict of interest |
| 4 | 2h | Status state machine, reviewer assignment + 5-cap + due dates |
| 5 | 2h | Search/filter/sort/paginate, bulk assignment + CSV export |
| 6 | 2h | Dashboard, immutable timeline, overdue alerts |
| Buffer | +1–2h if available | Polish pass (Step 13) + one stretch feature (Section 4) |

If you're short on time, cut in this order: stretch feature → polish pass → CSV/dashboard visual styling. **Never cut a rule from the traceability table** — those are graded by name.

---

## 3. Step-by-step build with prompts

### Step 1 — Scaffold + schema

```
I'm building a Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL app called
"Grant Application Review". Set up:
1. A new Next.js app with TypeScript, Tailwind, App Router, src/ directory.
2. Prisma initialized, pointed at a DATABASE_URL env var (Supabase Postgres).
3. A Prisma schema with these models and exact rules — do not add fields I haven't
   asked for:

- User: id, name, email (unique), passwordHash, role (enum: PROGRAM_OFFICER, REVIEWER), createdAt
- Application: id, orgName, contactEmail, fundingRound, amountRequested (Decimal, exact —
  not float), submissionDate, ownerId (FK to User), status (enum: SUBMITTED, ASSIGNED,
  UNDER_REVIEW, DECIDED), archived (boolean, default false), createdAt
- Assignment: id, applicationId, reviewerId, dueDate, removedAt (nullable — soft
  removal, keep history), createdAt. A reviewer-application pair can repeat over time,
  so don't hard-unique (applicationId, reviewerId) alone.
- Review: id, applicationId, reviewerId, assignmentId, impactScore (1-5, nullable
  until submitted), feasibilityScore (1-5, nullable), budgetScore (1-5, nullable),
  comments (text), status (enum: DRAFT, COMPLETED), completedAt (nullable), createdAt,
  updatedAt. Unique on (applicationId, reviewerId).
- ConflictOfInterest: id, applicationId, reviewerId, reason, createdAt
- TimelineEvent: id, applicationId, type (enum: CREATED, STATUS_CHANGED, ASSIGNED,
  ASSIGNMENT_REMOVED, COMMENT), oldValue, newValue, actorId (FK to User), note, createdAt
  — append-only, no update/delete anywhere in the app.
- AlertDismissal: id, assignmentId, dismissedByUserId, dismissedAt, dueDateAtDismissal
  — a dismissal only suppresses the alert for the due date active at dismissal time,
  so a later due-date change that passes again brings the alert back.

Add indexes for orgName, contactEmail, fundingRound, status, ownerId, submissionDate,
amountRequested — I'll filter/sort/search on all of these later.

Then give me prisma/seed.ts creating: 3 program officers, 8 reviewers (bcrypt-hashed,
print plaintext passwords to console), ~40 applications across 3 funding rounds and
varied statuses, assignments, some completed reviews, a couple of conflicts of
interest, a couple of overdue (past-due, incomplete) assignments — real demo data,
not an empty shell.

Explain any modeling choice you make that I didn't specify explicitly.
```

**Check:** Can you explain why `Assignment.removedAt` is a soft delete? Why `TimelineEvent` has no `updatedAt`? If not, ask before moving on.
**Log in `docs/schema.md`:** table list; one-to-many (Application→Review) vs. many-to-many (Application↔Reviewer via Assignment); what's denormalized (`oldValue`/`newValue` as strings instead of a full diff table) and why; what breaks first at 100x data (likely: unindexed timeline scans, or search without a trigram/GIN index).

---

### Step 2 — Auth + server-enforced roles

```
Add NextAuth.js (Credentials provider) to this app, backed by the User model
(email + bcrypt passwordHash). Store role in the JWT/session.

Build server-side role enforcement, not UI hiding:
- `requireRole(session, allowedRoles[])` used at the top of every API route/server
  action, throwing 403 on mismatch.
- Reviewers must never reach create/edit/archive-application or assign-reviewer
  endpoints, even via a direct curl call bypassing the UI. Give me curl commands to
  verify this myself.
- Role-appropriate post-login redirect (reviewers → "My Assigned Applications",
  program officers → dashboard).

Give me a clean Tailwind login page too.
```

**Check:** Actually run the curl commands as a reviewer session. Confirm 403.

---

### Step 3 — Applications CRUD + archive/restore

```
Build Application CRUD for program officers:
- Create: orgName, contactEmail, fundingRound, amountRequested (exact decimal,
  positive, up to 2 decimal places), submissionDate, owner (default = logged-in PO,
  reassignable).
- Edit (same fields).
- Archive/restore: sets archived=true/false, doesn't touch status or review history;
  archived applications excluded from default list views unless a filter explicitly
  includes them.
- Write a TimelineEvent (CREATED) on creation.
- Simple table list for now — I'll add search/filter/sort/pagination in Step 7.

Enforce PROGRAM_OFFICER-only on every route here.
```

---

### Step 4 — Review lifecycle + conflict of interest

```
Build the reviewer-side review flow:
- Reviewers see only applications they're currently assigned to (Assignment where
  removedAt is null).
- Start a review: score Impact/Feasibility/Budget Justification 1-5 + comments.
  Save DRAFT (partial allowed) or COMPLETED (require all three scores + comments).
  Once COMPLETED, reject any further edit server-side, even a crafted request.
- Declare a conflict of interest with a required short reason; store it (I'll wire
  the assignment-blocking check in Step 6).
- On any application detail view, show every COMPLETED review with reviewer name,
  scores, comments. Draft reviews are visible only to the reviewer who owns them.

One review per reviewer per application — enforce via a DB unique constraint with a
friendly error on violation, not just an app-level check.
```

---

### Step 5 — Status lifecycle state machine

```
Implement Application status transitions as an explicit server-side state machine:

SUBMITTED -> ASSIGNED: when a program officer assigns >=1 reviewer.
ASSIGNED -> UNDER_REVIEW: manual PO action once reviewing is underway.
UNDER_REVIEW -> DECIDED: only if >=3 COMPLETED reviews exist; otherwise reject with a
  message stating the current count vs. 3 required.

Any other transition (e.g. DECIDED -> SUBMITTED, SUBMITTED -> DECIDED directly) is
rejected server-side with a message explaining why — never silently ignored.

Every successful transition writes a TimelineEvent (STATUS_CHANGED, old, new, actor)
— append-only.

Give me a single `transitionApplicationStatus(applicationId, targetStatus, actorId)`
that every UI action calls, so this logic lives in exactly one place.
```

**Deliberately test this wrong** (try SUBMITTED → DECIDED via API). If the first draft doesn't hard-block it, that's your "produced something wrong" entry for `docs/ai-prompts.md`.

---

### Step 6 — Reviewer assignment rules

```
Build reviewer assignment for program officers:
- Reject assigning a reviewer with a ConflictOfInterest against this application.
- Cap a reviewer at 5 *active* assignments (active = removedAt null AND review not
  COMPLETED). Reject a 6th, message states the current count.
- Assigning sets/updates a required due date.
- Removing an assignment only allowed while its review is not COMPLETED; on removal
  set removedAt (not a hard delete) + write a TimelineEvent (ASSIGNMENT_REMOVED).
- Due date editable any time before COMPLETED.
- Build the reviewer's "all applications assigned to me" list page.

Write this as one function reusable from bulk-assign in Step 8 — don't duplicate the
rule checks.
```

---

### Step 7 — Search/filter/sort/paginate

```
Build the main applications list entirely server-side:
- Text search over orgName + contactEmail (case-insensitive, partial).
- Filters: fundingRound, status, ownerId, "overdue reviews only".
- Sort: submissionDate, amountRequested, status — asc/desc.
- Pagination with server-computed total count, shown as "Showing 21-40 of 214".
- Reviewers reuse this component scoped to their own assigned applications.

Show me the Prisma query (`where`, `orderBy`, `skip`/`take`) plus a separate
`count()` — explain why a second count query beats loading everything into JS.
```

---

### Step 8 — Bulk assignment + CSV export

```
Bulk-assign for program officers: pick a funding round + a set of reviewers, one
action assigns every reviewer to every application in that round, reusing Step 6's
rule-checking function exactly (no separate/looser bulk path). Return a
per-assignment report: [{ applicationId, reviewerId, result: "succeeded" |
"refused", reason?: "conflict of interest" | "reviewer at assignment limit" }],
rendered as a results table. Run assignment attempts in independent transactions
(one bad row shouldn't roll back the others).

CSV export: given a funding round, export every COMPLETED review for its
applications — one row per review, columns: applicant org, application id, reviewer
name, impact score, feasibility score, budget score, comments, completed date.
Confirm criterion scores are separate columns, not a combined score.
```

---

### Step 9 — Dashboard

```
Dashboard for program officers:
- Cards: open applications (not archived, not DECIDED), overdue-for-review count,
  ready-for-decision count (UNDER_REVIEW with >=3 completed reviews, not yet
  DECIDED), amount requested this month (sum where submissionDate is in the current
  calendar month).
- Bar breakdowns: by status, by funding round.
- Line/bar chart: applications DECIDED per week, last 8 weeks — pull the DECIDED
  transition date from TimelineEvent, not from Application.status alone, since
  status only holds the current value.

Use Prisma groupBy/aggregate, not full-table loads counted in JS.
```

---

### Step 10 — Immutable timeline

```
Build the per-application timeline: creation, every status change (old→new, who),
every assignment/removal (reviewer name), comments — chronological.

Add a "leave a comment" action for both roles (on applications they can already see)
that writes a TimelineEvent (COMMENT) — the only way comments enter the system.

Grep the codebase for any UPDATE or DELETE touching TimelineEvent and show me the
results — there should be none. I need this table genuinely append-only.
```

---

### Step 11 — Overdue alerts

```
Overdue-alerts for program officers:
- Overdue = active assignment (not removed, review not completed) with dueDate in
  the past.
- Alerts area lists all currently-overdue assignments + a nav count badge.
- Dismiss an alert -> write AlertDismissal with dueDateAtDismissal = the
  assignment's dueDate at that moment.
- An overdue assignment is suppressed from alerts only if a matching
  AlertDismissal exists where dueDateAtDismissal equals the assignment's CURRENT
  dueDate. If the due date later changes and passes again, the old dismissal no
  longer matches, so the alert reappears automatically.

Walk me through why this design satisfies "if the due date changes and passes again,
the alert returns" before I accept it — then show me how to test it (push a due date
back, let it pass, confirm reappearance).
```

---

## 4. Good functionality worth adding (pick 1–2 if you have buffer time — never at the cost of Section 0)

These are the brief's own stretch list, ranked by effort-to-payoff for a solo 12-hour build. Pick based on what's left in your buffer, not all of them.

### 4a. Reviewer calibration report *(recommended — high signal, low effort, reuses data you already have)*
Shows whether each reviewer scores harshly or leniently relative to the panel average — genuinely useful to a program officer, and it's just an aggregate query over data your Review model already has.

```
Add a "Reviewer Calibration" report for program officers: for each reviewer with at
least 3 completed reviews, show their average score per criterion (Impact,
Feasibility, Budget) vs. the overall panel average for the same applications, and
the delta. Sort by largest absolute delta first, so outlier reviewers surface at the
top. One Prisma aggregate query per reviewer, or a single groupBy if you can do it
in one — whichever is cleaner, explain the trade-off.
```

### 4b. Budget tracking against a funding pool per round *(recommended — small addition to the dashboard you already built)*
```
Add an optional totalPool (Decimal) field to a new FundingRound concept (or, simpler,
a config table keyed by round name) that a program officer can set. On the dashboard
and the round-filtered list, show amount requested by DECIDED applications in that
round against the pool, as a progress bar. If no pool is set for a round, just hide
the bar rather than showing a broken 0/0 — don't force this everywhere.
```

### 4c. Email notification on assignment *(only if time remains — nice UX polish, not core-graded)*
```
Add a notification hook (log-only is fine if I don't want to wire a real email
provider under time pressure — say so explicitly if you take that shortcut) that
fires when a reviewer is newly assigned or a decision is recorded. If I do want real
email, use Resend's free tier (100/day) since it needs zero domain setup for a
sandboxed dev sender.
```

**Log the choice in `docs/decisions.md`** either way — "chose to log notifications instead of wiring real email, because it demonstrates the hook without spending buffer time on provider setup" is exactly the kind of trade-off the brief wants to see recorded.

---

## 5. Polish pass (Step 13 — do this only after Section 0 is fully green)

```
Do a pass over the whole app for these specific things, and tell me what you changed:
1. Every server action/API route that can fail (validation, a rejected transition, a
   rule violation) returns a message a non-technical user could read — not a raw
   stack trace or a generic "Error".
2. Every list/table has an empty state (e.g. "No applications match these filters")
   instead of a blank white area.
3. Every destructive or hard-to-reverse action (archive, remove assignment) has a
   confirm step.
4. Loading states on anything that hits the DB from a button click — no dead-looking
   UI while a mutation is in flight.
5. Consistent date formatting and decimal/currency formatting for amountRequested
   throughout (I don't want $50000 in one place and $50,000.00 in another).
6. Mobile-usable layout for at least the dashboard and the applications list — not
   full responsive design, just "doesn't break on a laptop-narrow window."

Don't touch business logic in this pass — UI/UX and error-message quality only.
```

---

## 6. Deploy

```
I'm deploying this Next.js + Prisma app with Supabase Postgres, on Vercel. Walk me
through in order:
1. Creating the Supabase project, getting both the pooled (pgbouncer) connection
   string and the direct one.
2. Setting DATABASE_URL / DIRECT_URL correctly in the Prisma schema for this split.
3. Running `prisma migrate deploy` against it, then my seed script.
4. Vercel env vars (DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL), build
   command, and any Prisma-specific step I need (e.g. `prisma generate` in
   postinstall) so the build doesn't fail on Vercel's fresh install.
5. What to check first if the deployed app can't reach the DB but local dev can (or
   vice versa) — connection pooling differs between serverless and local.
```

Then, by hand (not AI-generated, since this is your own accounting):
- `SUBMISSION.md`: live URL, repo URL, one program-officer + one reviewer demo login (from your seed script's printed passwords), tech stack, honest self-assessment against all 10 goals using Section 0's table (mark anything partial honestly), note if the free tier sleeps and the first load is slow.
- `docs/architecture.md`, `docs/plan.md` (real hours, not reconstructed), `docs/decisions.md` (5+ real decisions, mined from the "Check"/"Log" callouts above — include at least one you reversed, e.g. if Assignment was first hard-uniqued and you had to relax it in Step 6), `docs/ai-prompts.md` (your actual prompts, in order, plus the Step 5 or Step 11 "wrong on first try" example and what you changed).

---

## 7. Pre-submission QA checklist

Run through this once, end to end, before sending the links:

- [ ] Every row in Section 0's table has a "Where it's built" answer and passes its "Verify by" check
- [ ] Logged in as reviewer, confirmed 403 on a program-officer-only route via direct API call
- [ ] Archived an application, confirmed it's hidden from default list but review history is intact
- [ ] Completed a review, confirmed a further edit attempt is rejected server-side
- [ ] Assigned a 6th active reviewer, confirmed rejection names the limit
- [ ] Attempted SUBMITTED → DECIDED directly, confirmed rejection with explanation
- [ ] Bulk-assigned into a round with a known conflict of interest, confirmed the per-row report shows the refusal reason
- [ ] Downloaded the CSV export, confirmed separate columns per criterion
- [ ] Dismissed an overdue alert, changed the due date, let it pass again, confirmed the alert returned
- [ ] Grepped for any UPDATE/DELETE on TimelineEvent — found none
- [ ] Live URL loads (note if free-tier cold start is slow) and demo logins work for both roles
- [ ] All five `docs/` files filled in with real content, not templates
- [ ] Git history shows incremental commits across the build, not one final commit
- [ ] `SUBMISSION.md` self-assessment is honest — partial goals marked partial, not rounded up

---

## 8. Guardrails throughout

- **Commit after every step**, not at the end — this is graded by name in the brief.
- **Read every diff before accepting it.** If you can't explain a chunk in one sentence, ask the AI to explain it before moving on — that's what the callback interview will probe.
- **Test adversarially, not just the happy path** — every "Verify by" cell in Section 0 is an adversarial test, not a demo click-through.
- **If time runs short, cut stretch (Section 4) and polish (Section 5) first.** Never cut anything in Section 0 — "8 goals done solidly beats 10 done badly" is the brief's own stated bar.
