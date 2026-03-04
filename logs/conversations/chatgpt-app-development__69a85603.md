# ChatGPT Conversation Log

- Conversation ID: 69a85603-7dd0-8398-a3e1-1cb799a82afe
- Title: ChatGPT - App Development
- Captured: 2026-03-04T17:00:37.982Z
- URL: https://chatgpt.com/g/g-p-69a3c28d968c8191ac141b91a84da50a-app-development/c/69a85603-7dd0-8398-a3e1-1cb799a82afe

---

## User

- i'm about to design a PRODUCT.md file based on my AI Spec-driven App Development prompt to build an app.
- it  suggests me to fill up this prompt so it can generate better product.md information about the app:

# Product Definition

## 0) One-paragraph summary (required)
Write 3–6 sentences describing what the product is, who it’s for, and what success looks like.

---

## 1) App identity (required)
- **App Name:**
- **Tagline:**
- **Primary user value:**
- **Non-goals (explicitly out of scope):**

---

## 2) Personas & roles (required)
### Personas (human descriptions)
- Persona A:
- Persona B:
- Persona C:

### System roles (for RBAC)
List the exact roles the system must support:
- Role: viewer — permissions summary
- Role: user — permissions summary
- Role: moderator — permissions summary
- Role: admin — permissions summary

> Note: If you need per-entity permissions (e.g., “moderator can delete any entry”), write it here.

---

## 3) Core entities & relationships (required)
List your main data objects. For each entity, specify fields and relationships.

### Entity: User
- Fields: id, email, displayName, avatarUrl, status, createdAt
- Relationships: hasMany X, belongsTo Y

### Entity: <EntityName>
- Fields:
- Relationships:
- Constraints (uniques, indexes, required fields):

Repeat for all entities.

---

## 4) Primary workflows (required, step-by-step)
Write workflows as numbered steps. These become UI pages + API endpoints.

### Workflow A: <Name>
1) User does…
2) System validates…
3) System stores…
4) System responds…
5) Notifications/side effects…

### Workflow B: <Name>
1) …
2) …

---

## 5) Screens & navigation (recommended)
List the screens you expect (even if rough). This helps Next.js routing.

### Public screens
- /:
- /auth/login:
- /auth/callback:

### App screens (authenticated)
- /dashboard:
- /settings:
- /...:

### Admin screens (role-gated)
- /admin:
- /admin/users:
- /admin/...:

---

## 6) API expectations (recommended)
Describe any external API constraints or conventions.

- API base path: /api/v1
- Response envelope: { code, message, requestId, data, error } (or specify)
- Pagination style: cursor | offset
- Filtering/sorting style:
- Error handling expectations:

---

## 7) Authentication & authorization (required)
### Auth provider
- Keycloak realm name (if known):
- Required identity fields:
- Login method: email/password | social | SSO
- Token type: JWT

### JWT claims mapping (important)
- Where is userId stored?
- Where are roles stored? (claim name)
- If multi-tenant: where is tenantId stored? (claim name)

### RBAC rules
List rules clearly:
- Role X can do Y on entity Z
- Role Y cannot do…

---

## 8) Tenancy model (required)
Choose one:
- **Tenancy mode:** single | multi | undecided

If multi or undecided, specify likely future:
- Partitioning preference: row | schema | database
- Tenant boundary rules (what must be isolated?)
- Admin scope: global admin | tenant admin | both

---

## 9) Data sensitivity & governance (required)
- Contains PII? (yes/no)
- Data retention policy:
- Data export requirement (yes/no):
- Right-to-delete requirement (yes/no):
- Audit log required events (list them):
  - login
  - role change
  - delete operations
  - …

---

## 10) Storage & uploads (required if you upload anything)
- Upload types: images | video | docs | other
- Max file size:
- Allowed MIME types:
- Virus scanning required? (now/later)
- Public or private objects?
- Object lifecycle rules (expiry, deletion):
- Buckets needed (names or categories):

### Upload workflow (presigned S3)
1) Client requests presign
2) API validates size/type
3) API returns { uploadUrl, objectKey }
4) Client uploads to MinIO
5) Client notifies API to attach object (optional)

---

## 11) Realtime requirements (optional)
If you need realtime:
- Features needing realtime:
- Transport: WebSocket | SSE | polling
- Frequency and scale expectations:

---

## 12) Background jobs & async workflows (required if any)
List the jobs that should run in BullMQ.

### Job: <Name>
- Trigger:
- Inputs:
- Steps:
- Retries/backoff:
- Idempotency key:
- Failure handling:
- DLQ + replay needed? (yes/no)

Also specify:
- Scheduled jobs needed? (cron-like)

---

## 13) Notifications (optional)
- Email notifications (yes/no)
- In-app notifications (yes/no)
- Push notifications (later/now)
- Notification triggers:

---

## 14) Performance & scale (recommended)
Give rough scale targets (can be estimates):
- Expected DAU/MAU:
- Peak requests/sec:
- Upload volume/day:
- DB size expectations:

---

## 15) Environments & domains (required)
- Environments: dev / stage / prod
- Domain/base URL (if known):
  - dev:
  - stage:
  - prod:
- Local dev URLs:
  - web:
  - api:

---

## 16) Observability requirements (recommended)
- Logs: JSON in prod, pretty in dev (yes/no)
- Metrics: Prometheus (yes/no)
- Tracing: OpenTelemetry (yes/no)
- Alerting priorities (later/now):
- Health endpoints required:
  - liveness
  - readiness

---

## 17) Security requirements (required)
- CORS policy:
- CSRF: needed? (yes/no)
- Rate limiting targets:
- Admin endpoints protections:
- Allowed origins:
- Secrets handling rule: env-only (yes/no)

---

## 18) Acceptance criteria (required)
List “done means done” checks.

- User can login/logout successfully
- User can perform Workflow A end-to-end
- Upload works via presigned URLs
- Background job runs and is observable
- CI passes
- Compose up brings infra online
- Health endpoints return OK
- Governance guard blocks unsynced changes

---

## 19) Open questions (optional)
List anything undecided that Copilot should ask you about.

## Assistant

Since you’re using a Spec-Driven AI Development workflow, the quality of PRODUCT.md directly determines how good your generated architecture, schema, API, and UI will be.

The prompt you showed is already excellent, but the key challenge is:

How do I fill this if the product idea is still vague?

Below is a structured way to answer each section so Copilot/AI agents can reason correctly when generating your system.

How to Fill the PRODUCT.md Prompt Properly
0) One-paragraph summary

Goal: Describe the product at a high level.

Write:

What the product is

Who it is for

What the main activity is

What success looks like

Example (for your Arena social app idea)
Markdown
Countdown Arena is a social media platform where users participate in time-based competitive challenges called Arenas. Each Arena has a theme, a countdown entry phase, and a voting phase where the community decides the winner. The platform is designed for creators and casual users who enjoy competitive content creation and discovery through a TikTok-style entertainment feed. Users can join Arenas, submit entries, vote on others, and browse past or ongoing competitions. Success means high user participation, engaging voting interactions, and a constantly refreshing feed of competitive content.

Think product pitch, not technical description.

1) App identity
App Name

Your product name.

Example:

Countdown Arena
Tagline

Short marketing line.

Examples:

"Compete. Create. Win."

or

"Where the internet battles."
Primary user value

What users gain from using the app.

Example:

Users can join themed creative competitions, showcase their content, and compete for community recognition through voting.
Non-goals

This section is very important for AI agents.

It tells the system what NOT to build.

Example:

- Not a traditional messaging platform
- Not a marketplace
- Not a professional portfolio platform
- Not a long-form content publishing platform

This prevents feature creep in generated code.

2) Personas & roles
Personas (human descriptions)

These are behavioral users, not technical roles.

Example:

Persona A — Casual Viewer
A user who scrolls the feed to watch competitions and vote but rarely participates.
Persona B — Creator Competitor
A user who frequently joins Arenas and uploads entries to compete and gain recognition.
Persona C — Community Moderator
A trusted user responsible for reviewing reported entries and enforcing platform rules.
System roles (RBAC)

These are technical permissions.

Example:

viewer — can browse public arenas and entries but cannot vote or submit

user — can create profile, join arenas, submit entries, vote, comment

moderator — can remove entries, ban users, resolve reports

admin — full platform control including user management and arena creation
3) Core entities & relationships

This section is CRITICAL because it becomes:

Prisma schema

Database tables

NestJS services

API endpoints

Entity: User

Example:

Fields:
id
email
displayName
avatarUrl
bio
status
role
createdAt
updatedAt

Relationships:

hasMany entries
hasMany votes
hasMany comments
hasMany notifications
Entity: Arena
Fields:
id
title
description
theme
status (entry_open | voting | closed)
entryDeadline
votingDeadline
createdBy
createdAt

Relationships:

hasMany entries
belongsTo creator (User)
Entity: Entry
Fields:
id
arenaId
userId
mediaUrl
caption
createdAt

Relationships:

belongsTo arena
belongsTo user
hasMany votes
Entity: Vote
Fields:
id
entryId
userId
createdAt

Constraints:

unique(userId, entryId)
Entity: Comment
Fields:
id
entryId
userId
text
createdAt

This section helps AI generate:

Prisma models

NestJS modules

validation schemas

4) Primary workflows

This becomes:

API endpoints

service logic

UI flows

Workflow A — Join Arena and Submit Entry
1) User opens Arena page
2) System checks arena status = entry_open
3) User uploads media
4) System validates file type and size
5) System stores entry record
6) Entry appears in arena feed
Workflow B — Vote on Entries
1) User opens voting feed
2) System loads entries for active arena
3) User votes on an entry
4) System validates user hasn't voted on that entry
5) Vote stored in database
6) Vote count updates
Workflow C — Discover Arenas
1) User opens home feed
2) System loads trending arenas and entries
3) User scrolls vertically
4) System loads more entries via cursor pagination
5) Screens & navigation

This becomes Next.js routes.

Public screens
/
Landing page

/auth/login

/auth/callback
App screens
/feed

/arena/[arenaId]

/entry/[entryId]

/profile/[username]

/submit-entry
Admin screens
/admin

/admin/arenas

/admin/users

/admin/reports
6) API expectations

Your stack suggests:

NestJS

REST

Versioned API

Example:

API base path: /api/v1

Response format:
{
  code,
  message,
  requestId,
  data,
  error
}

Pagination:
cursor-based
7) Authentication & authorization

Since you're using Keycloak, define:

Keycloak realm name: arena-platform
Login method
email/password
future: Google login
JWT claims mapping

Example:

userId → sub
roles → realm_access.roles
tenantId → none (single tenant)
8) Tenancy model

Your app likely:

Tenancy mode: single

Future SaaS possibility:

future multi-tenant via row partition
9) Data sensitivity

For social apps:

Contains PII: yes
(email, username, profile info)

Example policies:

Retention: indefinite unless user deletes
Right-to-delete: yes
Data export: yes

Audit logs:

login
account deletion
role change
content deletion
10) Storage & uploads

Your app requires media.

Example:

Upload types: images, video
Max size: 50MB
MIME: image/jpeg, image/png, video/mp4

Objects:

Public objects: entries
Private objects: avatars (optional)

Buckets:

avatars
entries
thumbnails
11) Realtime requirements

Example:

Features:
live vote counts
arena countdown timers

Transport:

WebSockets
12) Background jobs

BullMQ examples:

Job: Close Arena Entry Phase

Trigger:

entryDeadline reached

Steps:

1) mark arena status = voting
2) notify participants
Job: Close Voting Phase
1) calculate winners
2) update leaderboard
3) notify participants
13) Notifications

Example:

Email: yes (welcome, password reset)
In-app: yes
Push: later

Triggers:

new arena
entry receives votes
arena results announced
14) Performance & scale

Even rough numbers help AI:

Example:

Expected DAU: 50k
Peak RPS: 500
Uploads/day: 10k
DB size: 1TB long-term
15) Environments

Example:

dev
stage
prod

Local:

web: http://localhost:3000
api: http://localhost:3001
16) Observability

Your stack already includes:

Logs: pino
Metrics: Prometheus
Tracing: OpenTelemetry (later)
17) Security

Example:

CORS: restricted
CSRF: yes
Rate limit: 100 req/min per user

Admin protection:

role = admin only
18) Acceptance criteria

These become system validation checks.

Example:

User can create account
User can join arena
User can submit entry
User can vote
Voting results computed correctly
Admin can moderate content
19) Open questions

Leave unresolved items:

Should arenas allow multiple entries?
Should voting be anonymous?
Should there be rewards?

These guide Copilot Discovery Phase.

Critical Tip for Your Spec-Driven Workflow

Your PRODUCT.md must avoid implementation details like:

❌ don't write:

use prisma
use redis
use nextjs

Because those are already defined in your architecture spec.

PRODUCT.md should describe:

product behavior

entities

workflows

rules

If you want, I can also generate a FULL completed PRODUCT.md for your Countdown Arena app that is perfectly optimized for your Spec-Driven AI development system (Next.js + NestJS + Prisma + Keycloak + BullMQ + MinIO).

That will save you hours of architecture iteration.

## User

- no, what I'm about to build is not for Countdown Arena.
- I'm want to build a Fisherfolk Management System
- Full fisherfolk profiling + operations
- Registration, livelihoods, vessels, permits, catch monitoring, reporting
- Registration data includes:
1. ID Number ( manual input, must be unique )
2. Full Name ( Last Name, First Name, Middle Name, must be unique, no multiple ID can be in one full name )
3. Date of Birth (MM/DD/YYYY)
4. Address (Calapan City, Oriental Mindoro ready selection of barangays)
5. Sex ( Selection of Male or Female)
6. Image ( Upload or via webcam/phone camera options with auto crop to 1x1 ratio)
7. Signature ( Upload or via stylus pen drawing options auto cropping to signed image area )
8. RSBSA Number ( manual input, must be unique )
9. Contact number ( Manual input, must be saved with +63 prefix then starts with number 9 to be filled )
10. Fisherfolk Category type Selection ( can multi-select ): 
a. Boat Owner/Operator
b. Capture Fishing
c. Gleaning
d. Vendor
e. Fish Processing
f. Aquaculture
11. Is President? ( Just a clickable check box, if clicked/checked means that the currently registering fisherfolk is a President in his barangay based on the address selected )

- this Fisherfolk Management System is just a module/app which will a part of a bigger system or an enterprise system
- I just want to start from this app because this is the foundation and first entry of data that will be used in the next app or module inside the enterprise system
- another module or app is Vessel registration, type, tonnage, licensing, Fishing Gears - Gear types, quantities, associations, Permits & Licenses
- Permits, renewal tracking, Programs / Interventions - Government programs, beneficiaries, distribution, Catch / Harvest records - Species, volume, landing sites, dates

## Assistant

Got it — you’re building a Fisherfolk Management System (FMS) module that becomes the master data foundation for a larger enterprise platform. Below is a ready-to-paste PRODUCT.md content (fill-in style but already concrete), optimized for spec-driven generation.

0) One-paragraph summary (required)

The Fisherfolk Management System (FMS) is a government operations module for managing complete fisherfolk profiles and field operations data in Calapan City, Oriental Mindoro. It supports registration and identity capture (photo + signature), categorization by livelihood types, and links each fisherfolk to vessels, gears, permits, programs, and catch/harvest monitoring. The system is intended for LGU/agency staff, field enumerators, and administrators who need reliable, searchable records, compliance tracking, and reporting. Success means high-quality unique profiles, fast lookup, minimal duplicates, traceable updates, and accurate operational reports usable by downstream enterprise modules.

1) App identity (required)

App Name: Fisherfolk Management System (FMS)

Tagline: “Unified fisherfolk profiling and operations tracking.”

Primary user value: Centralized, validated fisherfolk master records that connect to vessels, permits, programs, and catch monitoring for compliance and reporting.

Non-goals (explicitly out of scope):

Full accounting/financial management

Public-facing social/community features

E-commerce marketplace

GIS-grade vessel tracking (future module)

National registry synchronization (future; unless explicitly required)

2) Personas & roles (required)
Personas (human descriptions)

Persona A: Registration Clerk (City Hall staff)
Registers fisherfolk, verifies documents, edits records, prints/export lists.

Persona B: Field Enumerator (mobile-first user)
Captures registrations on-site (photo/signature), later syncs, needs fast search.

Persona C: Program Officer / Analyst
Generates reports, monitors beneficiaries, checks permit renewal status and catch summaries.

System roles (for RBAC)

Role: viewer — can search and view fisherfolk profiles and reports; no create/edit/delete

Role: user — can create profiles, edit allowed fields, attach media (photo/signature), create operational records (catch/program entries) based on permissions

Role: moderator — can resolve duplicates, approve merges, correct critical identity fields, manage barangay reference data (if allowed)

Role: admin — full access, manage users/roles, system configuration, audit logs, export controls

Per-entity rules (important):

user cannot delete fisherfolk profiles; only moderator/admin

Only moderator/admin can edit unique identity fields (ID Number, Full Name, RSBSA Number) after initial creation (or require approval workflow)

Only admin can perform bulk imports/exports (if enabled)

3) Core entities & relationships (required)
Entity: Barangay (reference)

Fields: id, city (fixed = Calapan City), name, code, isActive

Relationships: hasMany Fisherfolk

Constraints: unique(city, name)

Entity: Fisherfolk

Fields:

id (system UUID)

idNumber (manual input, unique)

lastName, firstName, middleName

fullNameNormalized (system-generated for uniqueness checking)

dateOfBirth

sex (Male|Female)

addressCity (fixed = Calapan City)

barangayId

contactNumberE164 (stored as +63...)

rsbsaNumber (manual input, unique)

isBarangayPresident (boolean)

status (active|inactive|deceased|moved) (optional but recommended)

createdAt, updatedAt

Relationships:

belongsTo Barangay

hasMany FisherfolkCategory (join table)

hasMany future modules: VesselOwnership, Permit, CatchRecord, ProgramBeneficiary (links)

hasOne FisherfolkPhoto

hasOne FisherfolkSignature

Constraints / rules:

unique(idNumber)

unique(rsbsaNumber)

unique(fullNameNormalized) AND rule: “no multiple IDs can exist for one full name”

contactNumberE164 must match +63 then 9 then 9 digits (PH mobile pattern)

barangayId required

Entity: Category (reference)

Fields: id, code, name, isActive

Seed values:

Boat Owner/Operator

Capture Fishing

Gleaning

Vendor

Fish Processing

Aquaculture

Entity: FisherfolkCategory (join)

Fields: id, fisherfolkId, categoryId, createdAt

Constraints: unique(fisherfolkId, categoryId)

Entity: MediaObject (generic upload record)

Fields: id, bucket, objectKey, mimeType, sizeBytes, checksum, createdAt, createdBy

Relationships: referenced by FisherfolkPhoto and FisherfolkSignature

Entity: FisherfolkPhoto

Fields: id, fisherfolkId, mediaObjectId, capturedVia (upload|camera), createdAt

Constraints: unique(fisherfolkId)

Entity: FisherfolkSignature

Fields: id, fisherfolkId, mediaObjectId, capturedVia (upload|draw), createdAt

Constraints: unique(fisherfolkId)

Entity: AuditLog

Fields: id, actorUserId, action, entityType, entityId, beforeJson, afterJson, createdAt, ip (optional)

Required events: create/update/delete, merge, role changes, exports

(Future module entities can be listed now as “planned” to influence architecture without implementing immediately.)

4) Primary workflows (required, step-by-step)
Workflow A: Register fisherfolk profile (clerk/enumerator)

User opens “New Registration”

System shows form + barangay selection list (Calapan City only)

User inputs ID Number, full name parts, DOB, sex, address barangay, RSBSA, contact number

User selects one or more fisherfolk categories

User checks “Is President?” if applicable

User captures photo (upload or camera) → system enforces 1:1 crop

User captures signature (upload or draw) → system crops to signed area

System validates uniqueness: idNumber, rsbsaNumber, fullNameNormalized

System stores Fisherfolk + joins + media objects

System responds with created profile + printable/view page

Workflow B: Search & view fisherfolk profile

User searches by ID Number / name / RSBSA / barangay

System returns paginated results with key identity fields and status

User opens profile view with linked operational records (empty if none)

Workflow C: Update fisherfolk profile

User opens profile → Edit

System enforces field-level permissions (unique identity fields gated)

System validates changes (including uniqueness if edited)

System saves update + writes AuditLog

Workflow D: Deactivate record (soft delete)

Moderator/Admin selects “Deactivate” with reason

System marks status + locks new operational entries if required

AuditLog recorded

Workflow E: Resolve duplicates (merge)

Moderator searches suspected duplicates

System compares identity fields + shows merge preview

Moderator chooses “primary record” and merges

System re-links all foreign keys to primary record

System archives secondary record + logs merge event

5) Screens & navigation (recommended)
Public screens

/: redirect to login or app (depending on auth)

/auth/login

/auth/callback

App screens (authenticated)

/dashboard: summary counts (registered today, by barangay, by category)

/fisherfolk: list + filters (barangay, category, status)

/fisherfolk/new: registration form + photo/signature capture

/fisherfolk/[id]: profile view (tabs: Profile, Vessels, Permits, Programs, Catch, Audit)

/fisherfolk/[id]/edit

/reports: predefined reports exportable

/settings/profile: user profile

Admin screens (role-gated)

/admin

/admin/users

/admin/roles

/admin/reference/barangays

/admin/reference/categories

/admin/audit-logs

/admin/import-export (if enabled)

6) API expectations (recommended)

API base path: /api/v1

Response envelope: { code, message, requestId, data, error }

Pagination: cursor-based for lists

Filtering/sorting:

?q= for search

?barangayId=

?categoryId=

?status=

?sort=createdAt:desc

Error handling:

409 Conflict for uniqueness violations (idNumber/fullName/rsbsa)

422 for validation errors (DOB format, contact format, required fields)

7) Authentication & authorization (required)
Auth provider

Keycloak realm name: enterprise (or fms if isolated)

Required identity fields: sub (userId), email, name

Login method: email/password (SSO later)

Token type: JWT

JWT claims mapping

userId: sub

roles: realm_access.roles (or specify exact claim)

tenantId: none (single tenant for now)

RBAC rules

viewer: read-only

user: create/edit non-critical fields, add operational records

moderator: merge, deactivate, edit critical fields, resolve reports

admin: everything + user/role management + exports + reference data

8) Tenancy model (required)

Tenancy mode: single (module within a larger enterprise system)

Future-ready note: if multi-tenant later, prefer row partition (tenantId column) with strict isolation on fisherfolk and operational records.

9) Data sensitivity & governance (required)

Contains PII? yes (name, DOB, address, contact, photo, signature)

Data retention policy: retain while active + per LGU policy; soft-delete only

Data export requirement: yes (CSV/PDF reports)

Right-to-delete requirement: likely yes (but may be constrained by government record policies)

Audit log required events:

login (optional)

create/update fisherfolk

critical field changes (ID/name/RSBSA)

merges

deactivation/reactivation

exports

role changes

10) Storage & uploads (required)

Upload types: images

Max file size: (recommend) 5–10MB per image

Allowed MIME types: image/jpeg, image/png, image/webp

Virus scanning required? later (recommended)

Public or private objects? private

Object lifecycle rules: delete objects only when record is permanently removed (if allowed)

Buckets needed:

fisherfolk-photos

fisherfolk-signatures

Upload workflow (presigned S3)

Client requests presign (type=photo|signature, fisherfolkId optional)

API validates size/type and returns { uploadUrl, objectKey }

Client uploads to MinIO

Client calls API to attach object to fisherfolk record

API generates derived versions if needed (thumbnail, normalized crop)

11) Realtime requirements (optional)

Not required for v1. (Optional later: live “registration count today”, but can be polling.)

12) Background jobs & async workflows (required if any)
Job: Generate report exports

Trigger: user requests export

Inputs: filters, format

Steps: query DB → generate file → store in object storage → notify user

Retries/backoff: yes

Idempotency key: exportRequestId

Failure handling: mark failed + allow retry

DLQ + replay: yes

Job: Permit renewal reminders (future module)

Trigger: daily scheduled

Inputs: permits expiring in X days

Steps: create notifications

Scheduled: yes (daily)

13) Notifications (optional)

Email: no (v1), later optional

In-app: yes (exports ready, permit renewals later)

Push: later

14) Performance & scale (recommended)

Expected DAU/MAU: 20–200 staff users (typical LGU) + growth for enterprise usage

Peak requests/sec: low (<50 rps) but must be reliable

Upload volume/day: 50–500 images/day (depends on registrations)

DB size: grows steadily; must support years of historical operational data

15) Environments & domains (required)

Environments: dev / stage / prod

Domain/base URL:

dev: TBD

stage: TBD

prod: TBD

Local dev URLs:

web: http://localhost:3000

api: http://localhost:3001

16) Observability requirements (recommended)

Logs: JSON in prod, pretty in dev: yes

Metrics: Prometheus: yes (optional in v1)

Tracing: OpenTelemetry: later

Health endpoints:

liveness

readiness

17) Security requirements (required)

CORS policy: allow only approved web origins

CSRF: yes (if cookie-based session); if pure JWT header auth, document approach

Rate limiting: e.g. 60 req/min/user; stricter on auth + upload presign endpoints

Admin endpoint protections: admin role only + audit logs

Allowed origins: stage/prod domains + localhost dev

Secrets handling: env-only yes

18) Acceptance criteria (required)

User can login/logout successfully via Keycloak

User can register fisherfolk profile end-to-end (including photo + signature)

Uniqueness enforcement works (ID Number, full name, RSBSA)

Contact number stored as +63 format and validated

Barangay selection list is available and restricted to Calapan City

Fisherfolk category multi-select is saved correctly

Search works (ID/name/RSBSA/barangay) with pagination

Audit logs record create/update/merge/deactivate actions

Upload works via presigned URLs and objects are private

CI passes and compose brings infra online

Health endpoints return OK

Governance guard blocks unsynced spec changes

19) Open questions (optional)

Should “Full Name uniqueness” be strict exact match, or normalized (case/spacing)?

Do we support suffixes (Jr., Sr.) and multiple middle names?

Should DOB be required or optional (some registrations may not know exact DOB)?

Should photo/signature be mandatory for registration, or optional with “pending” status?

Should offline-first mobile capture be required for field enumeration?

Are exports allowed for all roles, or admin-only?

If you want, I can also rewrite this into an even more “agent-friendly” format by:

defining exact validation regex for PH contact numbers,

specifying merge conflict rules for duplicates,

and listing future module entity stubs (Vessel, Gear, Permit, Catch, Program) so your downstream modules plug in cleanly without schema refactors.

## User

add an output view display Profile of fisherfolk's Data record if name or ID is selected or opened in searching or list view of fisherfolks

## Assistant

Good addition 👍 — this should be reflected in two places in your PRODUCT.md so the AI agents correctly generate:

a profile page UI

a GET profile API endpoint

the data aggregation logic

Below is the exact section you should add/update.

1️⃣ Update Section 4 — Primary Workflows

Add this workflow.

Workflow F: View fisherfolk profile record (output display)
Markdown
### Workflow F: View fisherfolk profile record (output display)

1) User searches fisherfolk by ID Number, Name, RSBSA Number, or Barangay
2) System displays list results with key summary fields
3) User selects a record (clicks name or ID)
4) System retrieves full fisherfolk profile and related data
5) System displays a detailed profile view page

Profile output view includes:

IDENTITY
- Photo (1x1 image)
- ID Number
- Full Name (Last, First, Middle)
- Date of Birth
- Sex
- RSBSA Number
- Contact Number

ADDRESS
- City (Calapan City)
- Barangay

CATEGORIES
- Fisherfolk Category Types (multi-select display)
  - Boat Owner/Operator
  - Capture Fishing
  - Gleaning
  - Vendor
  - Fish Processing
  - Aquaculture

ROLE INDICATOR
- Is Barangay President? (Yes/No)

MEDIA
- Signature Image

SYSTEM INFO
- Record Created Date
- Last Updated Date

Future linked sections (if modules exist):
- Vessels
- Fishing Gears
- Permits & Licenses
- Programs / Interventions
- Catch / Harvest Records
2️⃣ Update Section 5 — Screens & Navigation

Add a profile page route.

App screens (authenticated)
Markdown
/dashboard
Overview statistics

/fisherfolk
Searchable list of fisherfolk with filters

/fisherfolk/new
Registration form

/fisherfolk/[fisherfolkId]
Fisherfolk profile display page (detailed record output)

/fisherfolk/[fisherfolkId]/edit
Edit fisherfolk information
3️⃣ Optional but Recommended: Profile Layout Definition

This helps AI generate clean UI sections.

Add under Screens section:

Fisherfolk Profile Page Layout
Markdown
Profile Header
- Photo
- Full Name
- ID Number
- Barangay
- Fisherfolk Categories
- President Badge (if applicable)

Profile Tabs or Sections

1. Personal Information
   - Full Name
   - Date of Birth
   - Sex
   - Contact Number

2. Identification
   - ID Number
   - RSBSA Number

3. Address
   - City
   - Barangay

4. Fisherfolk Categories
   - Multi-category display badges

5. Signature
   - Signature image preview

6. System Information
   - Record Created
   - Last Updated

Future expandable sections:
- Vessels
- Fishing Gears
- Permits & Licenses
- Programs / Interventions
- Catch / Harvest Records
4️⃣ Optional API Endpoint (helps NestJS generation)

Add this under API expectations:

Markdown
GET /api/v1/fisherfolk/{id}

Returns full fisherfolk profile including:
- identity fields
- barangay reference
- categories
- media (photo, signature)

Response example:
{
  code: "OK",
  data: {
    fisherfolk: {...},
    barangay: {...},
    categories: [...],
    photoUrl: "...",
    signatureUrl: "..."
  }
}
5️⃣ Result

After adding this, your AI system will automatically generate:

✅ Next.js page

/fisherfolk/[id]

✅ NestJS endpoint

GET /api/v1/fisherfolk/:id

✅ Prisma query with joins

fisherfolk
barangay
categories
media

✅ UI profile layout

photo

identity

categories

signature

future module sections

💡 Pro tip for your enterprise plan

Add a Profile Sidebar Summary Card that always stays visible:

Photo
Name
ID Number
Barangay
Categories
President Badge

Then the rest of the profile becomes scrollable operational sections (vessels, permits, catch etc.).

This pattern works extremely well for government registry systems.

If you want, I can also show you 3 extremely important database design improvements for this fisherfolk system that will prevent duplicate identity records and corruption later (this is a common problem in LGU registry systems).

## User

yes please do

## Assistant

Here are 3 database design improvements that will save you from the most common LGU registry problems: duplicate people, corrupted identity, and “can’t merge later” records. These are practical, and they fit your stack (Prisma + Postgres).

1) Use a normalized “Identity Fingerprint” to enforce real name uniqueness

Your rule is: no multiple ID can be in one full name (i.e., one person record per full name).
But “full name” comparisons break easily because of:

casing (juan dela cruz vs JUAN DELA CRUZ)

extra spaces (DELA CRUZ)

punctuation (Dela-Cruz)

missing middle name / “N/A”

diacritics (rare, but happens)

What to do

Store both:

raw name fields (what user typed)

a generated normalized field used for uniqueness + search

Add fields

fullNameDisplay (computed or stored)

fullNameNormalized (stored, indexed, unique)

Normalization rules (recommended)

uppercase

trim

collapse multiple spaces to one

remove punctuation (.,-')

middle name: treat empty / “N/A” consistently

DB rule

unique(fullNameNormalized)

✅ Result: you enforce your “one person per name” rule reliably.

2) Separate “Citizen Identity” from “Operational Person Record” (future-proofing)

Since this module is the foundation for a bigger enterprise system, you want to avoid this trap:

Future modules create duplicates because each module saves identity fields again.

What to do

Create a stable core entity (person identity) and let modules reference it.

Option A (simple now): keep Fisherfolk as the core person record
and ensure every future module references fisherfolkId only.

Option B (best for enterprise): create a Person table now, and FisherfolkProfile extends it.

Person: name, DOB, sex, contact, address, photo/signature

FisherfolkProfile: fisherfolk categories, RSBSA, president flag, domain-specific fields

✅ Result: if later you add “Farmer”, “Vendor”, “Beneficiary”, etc., it’s the same person with multiple profiles, not duplicates.

If you don’t want complexity yet, do Option A but name your Fisherfolk fields as “person-ish” and keep it clean.

3) Build duplicate handling into the model: soft-delete + merge lineage + immutable IDs

In real deployments, duplicates are inevitable:

someone registers twice

spelling differs slightly

clerk makes a new record instead of searching

If you don’t design for merges early, your database gets stuck.

What to do (minimum)

Soft-delete + merge metadata

Add fields to Fisherfolk:

status (active|inactive|merged|deceased|moved)

mergedIntoId (nullable FK → Fisherfolk.id)

mergeReason (text)

mergedAt (datetime)

Merge rule

If record is merged, it becomes read-only

All future references should resolve to the “primary” record:

when fetching a record, if mergedIntoId exists, redirect to that profile

✅ Result: you can safely merge records later without breaking foreign keys.

Bonus: Immutable identity keys

Never allow normal users to edit:

idNumber

rsbsaNumber

fullNameNormalized

Only moderator/admin (and log it in AuditLog).

Suggested Prisma/DB constraints summary (copy into PRODUCT.md)

Put this under Entity: Fisherfolk → Constraints

idNumber unique

rsbsaNumber unique

fullNameNormalized unique (generated from name parts)

contactNumberE164 validated to +63 + 9xxxxxxxxx

mergedIntoId nullable FK; when not null, status must be merged

indexes:

barangayId

status

fullNameNormalized

idNumber, rsbsaNumber

One more extremely practical tip (PH LGU reality)

Many people share the same exact full name. Your strict rule “one full name = one person” will eventually block valid registrations.

A safer rule is:

Unique: idNumber and/or rsbsaNumber

Name uniqueness becomes “warn + review”, not hard-block

If your policy truly requires name uniqueness, keep it — but expect false positives.

If you want, I can give you a merge workflow spec (UI + API + DB steps) that’s safe and audit-able, and works even after you add the Vessel/Permit/Catch modules.

## User

- ok that's a good offer, please save that.
- before we do that i also want to add another app or a module that is dependent to FMS
- i want this to be an independent module thou is relies on FMO app as boat owner because they tend to manage vessels information too.
- Register vessels, link to owner, renewal cycle, Permit application workflow - Apply, review, approve, print permits, Catch reporting / fish landing - Log catches per landing site/trip with species & volume, Program enrollment & distribution - Create programs, enroll beneficiaries, track distribution, Reporting & analytics dashboard
- please gather pertinent data needed for this for i dont have specifics of the data needed but the idea is there already
- for now we have 2 modules or apps already as part of the enterprise ecosystem
- every app or modules we build must in a modern left side menu following it sub menus to offer per apps or modules
- our main dashboard will be latest charts of possible reports that you can imagine that is related to this project

## Assistant

Saved. ✅ (The 3 DB improvements + merge/lineage approach are now in memory for this project.)

Now, for your 2nd module/app (dependent on FMS but independently deployable), here’s a pertinent data blueprint you can drop into a new PRODUCT.md later, even if you don’t know every detail yet.

Module 2: Vessel, Permits, Catch, Programs, Reporting
Suggested module name

Fisherfolk Operations Module (FOM)
(Depends on FMS for “owner” identity, but can run as its own app/module.)

Dependency rule

A Vessel Owner must reference an existing FMS Fisherfolk record.

If an owner isn’t found, user is redirected to FMS registration (or shown “create new fisherfolk” link if integrated).

A) Core Entities You’ll Need
1) Vessel

Purpose: Register boats and link to owner(s).

Fields (recommended):

id

registrationNumber (unique; may be LGU-issued)

name (optional)

ownerFisherfolkId (FK → FMS Fisherfolk)

barangayId (redundant copy for reporting speed; still source-of-truth is owner address)

vesselType (motorized | non-motorized | outrigger | etc.)

hullMaterial (wood | fiberglass | aluminum | other)

lengthM, widthM, grossTonnage (optional but useful)

engineType (inboard/outboard/none), engineHp (optional)

homePort / landingSiteDefaultId (optional)

status (active | inactive | sold | scrapped)

createdAt, updatedAt

Constraints/Indexes:

unique(registrationNumber)

index(ownerFisherfolkId), index(status)

2) VesselOwnershipHistory (optional but very useful)

id

vesselId

fisherfolkId

fromDate, toDate

notes

This prevents “who owned it during this permit/catch period?” confusion later.

3) PermitType (reference)

id, code, name, validityMonths, fee (optional), isActive

Examples:

Vessel registration permit

Fishing permit

Gear permit

Mayor’s permit (if applicable to your process)

4) PermitApplication (workflow entity)

Tracks Apply → Review → Approve → Print.

Fields:

id

permitTypeId

applicantFisherfolkId (FK → FMS)

vesselId (nullable depending on permit type)

applicationNumber (unique human-readable)

status (draft | submitted | under_review | approved | rejected | printed | cancelled | expired)

submittedAt, reviewedAt, approvedAt, printedAt

reviewerUserId, approverUserId

validFrom, validTo

remarks, rejectionReason

createdAt, updatedAt

5) PermitDocument (printable artifact)

id

permitApplicationId

documentNo (unique)

pdfObjectKey (MinIO)

printedByUserId

printedAt

reprintCount

6) LandingSite (reference)

id, name, barangayId, isActive

7) Species (reference)

id, localName, commonName, scientificName (optional), isActive

8) CatchReport (trip / landing record)

Purpose: Log catches per landing site/trip with species & volume.

Fields:

id

reportDateTime (actual landing datetime)

fisherfolkId (who reported) OR reportedByUserId (staff)

vesselId (nullable if shore/gleaning)

landingSiteId

gearTypeId (optional if you add gears)

tripStart, tripEnd (optional)

totalWeightKg (optional derived)

notes

createdAt

CatchReportItem

id

catchReportId

speciesId

weightKg

pricePerKg (optional)

valueAmount (optional derived)

unique(catchReportId, speciesId) (optional)

9) Program (government intervention)

id

name

description

programType (training | cash | equipment | subsidy | inputs | other)

startDate, endDate

budget (optional)

status (planned | ongoing | closed)

createdAt

10) ProgramEnrollment (beneficiaries)

id

programId

fisherfolkId (FK → FMS)

enrolledAt

status (enrolled | removed | completed)

unique(programId, fisherfolkId)

11) Distribution (what was given)

id

programId

distributionDate

location (or barangay/site)

createdByUserId

DistributionItem

id

distributionId

fisherfolkId

itemName

quantity

unit

notes

B) Primary Workflows (for spec-driven generation)
Workflow 1: Register vessel + link owner

User opens Vessels → New

System searches/selects owner from FMS (by ID/Name)

User encodes vessel details

System validates unique registrationNumber

System saves vessel and shows vessel profile page

Workflow 2: Permit application (apply → review → approve → print)

Staff creates application (select permit type + applicant + vessel if required)

Submit for review

Reviewer checks requirements, sets under_review → approved/rejected

On approval, system generates validFrom/validTo based on permitType validity

Print permit: generate PDF, store in MinIO, mark printed, assign documentNo

Permit becomes visible in vessel/profile history

Workflow 3: Renewal tracking

System lists permits expiring in N days

Staff triggers renewal (clone application + update dates)

Notifications or dashboard cards show due renewals

Workflow 4: Catch reporting / fish landing

User selects fisherfolk and vessel (optional)

Select landing site + date/time

Add multiple species items and weights

Save report

Dashboard aggregates totals by date/site/species/barangay

Workflow 5: Program enrollment & distribution

Admin creates program

Staff enrolls beneficiaries (from FMS)

Staff records distributions with item + qty per beneficiary

Reports show coverage, totals distributed, beneficiaries per barangay/category

C) Left-side Menu Requirement (Modern Admin UI)

You said: every module/app must have a modern left-side menu with submenus.

Enterprise Shell (top-level)

Dashboard

FMS

Fisherfolk List

New Registration

Reports

FOM (Operations)

Vessels

Permits

Applications

Expiring / Renewals

Printed Permits

Catch / Landings

Programs

Programs List

Enrollments

Distributions

Analytics / Reports

Admin

Users & Roles

Reference Data (Barangays, Species, Landing Sites, Permit Types)

Audit Logs

This structure also maps cleanly to Next.js routes.

D) Main Dashboard: “Latest charts you can imagine”

Here are high-value charts/cards that fit your data and feel “modern”:

Quick KPI cards

Total registered fisherfolk

New registrations this month

Active vessels

Permits expiring in 30 days

Total catch (kg) last 7 days

Programs ongoing + total beneficiaries

Charts

Catch volume trend (daily/weekly kg)

Top species by volume (bar chart)

Catch by landing site (bar chart)

Permits status funnel (draft → submitted → approved → printed)

Expiring permits timeline (next 7/30/60 days)

Beneficiaries by program (bar chart)

Registrations by barangay (bar chart)

Tables

Latest catch reports (most recent)

Permits due for renewal (sorted by soonest expiry)

Recent registrations / edits (audit-driven)

Next step (no waiting): I can “save” this module blueprint too

If you want me to store it as well (like we did earlier), tell me and I’ll save:

module name + dependency rule

entity list (Vessel/Permit/Catch/Program)

left-menu IA

dashboard chart set

Also: when you’re ready, I can convert this into a clean PRODUCT.md for Module 2 that matches your spec-driven pipeline exactly.

