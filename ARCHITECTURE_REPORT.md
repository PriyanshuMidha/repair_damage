# Repair Control Room Architecture Report

Date: 2026-09-05

## Executive Summary

Repair Control Room is a full-stack Next.js application for damaged-goods repair intake, workflow tracking, receipt generation, photo upload, CSV export, and Android packaging through Capacitor.

The app has a practical and cost-saving architecture for a small team because it uses one Next.js codebase for frontend and backend APIs, MongoDB for persistence, Cloudflare R2, Cloudinary, or Google Drive for image storage, and Capacitor as a thin Android shell over the hosted web app. This avoids maintaining a separate mobile backend, separate Android business logic, and custom file storage infrastructure.

However, the project is not fully production ready yet. The main blockers are hard-coded authentication, mixed persistence architecture signals, weak production data modeling around users/master data, no automated test suite, no formal migration/backup process, and limited operational monitoring beyond recent API timing logs.

## Current Architecture

### Frontend

- Framework: Next.js App Router with React.
- Pages live under `app/`.
- Main user screens:
  - `/login`
  - `/repairs`
  - `/repairs/new`
  - `/repairs/reports`
  - `/repairs/[id]`
  - `/repairs/[id]/edit`
  - `/repairs/[id]/receipt`
  - `/repairs/[id]/receipt/print`
- Shared UI components live under `components/`.
- Styling is centralized in `app/globals.css`.

### Backend

- Backend code is implemented as Next.js route handlers under `app/api/`.
- Main API routes:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/masters`
  - `GET /api/repairs`
  - `POST /api/repairs`
  - `GET /api/repairs/[id]`
  - `PATCH /api/repairs/[id]`
  - `DELETE /api/repairs/[id]`
  - `POST /api/repairs/[id]/actions`
  - `POST /api/repairs/[id]/photos`
  - `GET /api/repairs/[id]/receipt`
  - `POST /api/repairs/[id]/receipt`
  - `GET /api/repairs/[id]/receipt/pdf`
  - `GET /api/repairs/export`
  - `GET /api/debug/drive`

### Domain Logic

- Repair statuses are defined in `lib/types.ts`.
- Workflow transitions are controlled in `lib/workflow.ts`.
- Current flow:
  - `Received`
  - `Repair In Progress`
  - `Repair Received`
  - `Sent to Customer` or `GR`
- Audit history is stored inside each repair as `auditTimeline`.

### Persistence

- Main production persistence path is MongoDB through:
  - `lib/mongodb.ts`
  - `lib/mongoStore.ts`
- Local development can fall back to the in-memory store when `MONGODB_URI` is missing.
- Demo/in-memory data lives in `lib/store.ts`.
- There is also a Prisma/PostgreSQL schema under `prisma/schema.prisma`, but it is currently a blueprint and does not match the live MongoDB implementation.

### File Storage

- Photo upload supports multiple modes through `STORAGE_MODE`.
- Current storage modes:
  - `r2`
  - `cloudinary`
  - `drive`
  - `local`
  - `auto`
- Cloudflare R2 upload code is in `lib/r2Server.ts`.
- Cloudinary upload code is in `lib/cloudinaryServer.ts`.
- Google Drive upload code is in `lib/driveServer.ts`.
- Local upload writes to `public/uploads`.
- R2 uploads are blocked when app photo storage reaches `R2_UPLOAD_LIMIT_GB`, defaulting to `9.5`.
- R2 photos uploaded by the app can be deleted from the repair edit screen after entering `PHOTO_DELETE_PASSWORD`, which removes both the R2 object and the app photo record.

### Android Architecture

- Android is handled by Capacitor.
- The APK is intended to open the deployed HTTPS Next.js app.
- Capacitor config lives in `capacitor.config.ts`.
- Native app package: `com.plazergarments.repairapp`.
- This is cost-saving because Android does not duplicate the business logic.

## Cost-Saving Benefits

- One full-stack Next.js app means one team can maintain frontend and backend together.
- Next.js API routes remove the need for a separate Express/Nest server.
- Capacitor avoids building a separate native Android app from scratch.
- Cloudflare R2 Free can reduce storage/CDN setup cost for repair photos during early usage.
- Cloudinary Free can still be useful when image transformations are more important than raw storage allowance.
- MongoDB keeps the schema flexible while workflow requirements are still changing.
- Server-side receipt generation avoids needing a paid PDF service.
- CSV export is built in, so no separate reporting tool is required for basic operations.

## Time-Saving Benefits

- Staff can create repair records, upload photos, generate receipts, and move workflow status from one app.
- Reports screen gives status counts and bulk workflow actions.
- Receipt download/share flow reduces manual receipt creation.
- R2/Cloudinary/Drive upload removes manual image organization work.
- API timing logs now make slow endpoints visible during testing.
- Local in-memory fallback lets developers open and test the frontend quickly without database setup.

## Production Readiness Score

Current estimate: 55/100.

The app can work as an internal prototype or controlled pilot, but it needs hardening before being used as a production system with real customer data.

## Critical Gaps

### 1. Authentication Is Not Production Ready

Severity: Critical

Current issue:
- `lib/auth.ts` contains hard-coded username and password.
- Session cookie only stores a static authenticated value.
- There is no user table-backed login.
- There is no password hashing.
- There is no per-user audit identity.
- There is no password reset or staff/admin management.

What can fail:
- Anyone with source access knows the login password.
- All users effectively act as the same account.
- Audit logs cannot reliably prove who performed an action.
- A leaked cookie value has no strong server-side session validation.

Production fix:
- Store users in MongoDB.
- Hash passwords with a proven password hashing library.
- Use signed/encrypted sessions or server-side session storage.
- Attach user ID and role to every write action.
- Remove hard-coded credentials from source.

### 2. Persistence Architecture Is Mixed

Severity: Critical

Current issue:
- MongoDB is the active data layer.
- `lib/store.ts` is still used for local fallback/demo data.
- `prisma/schema.prisma` describes a PostgreSQL model that does not match the actual MongoDB shape.

What can fail:
- Developers may update the Prisma schema thinking it affects production, but it does not.
- Data fields can drift between TypeScript types, Mongo documents, and Prisma blueprint.
- Future migration work becomes risky because there is no single source of truth.

Production fix:
- Choose one production data architecture.
- If staying on MongoDB, remove or clearly archive Prisma.
- Add a Mongo schema/spec document matching `lib/types.ts`.
- Add explicit migration scripts or seed scripts.

### 3. Master Data Is Not Fully Modeled

Severity: High

Current issue:
- Parties, products, and users exist as types and seed data.
- Create/edit flows mostly accept free-text party/product values.
- Missing party/product relations are silently replaced with generated fallback objects.

What can fail:
- Duplicate customer names and product codes.
- Inconsistent reports.
- Poor searching and filtering when spellings vary.
- Harder reconciliation with billing/accounting systems later.

Production fix:
- Add master management screens for parties, products, and users.
- Use selected IDs in repair records.
- Keep free-text fallback only when intentionally allowed.
- Add unique rules where needed, such as product code or phone.

### 4. No Automated App Test Suite

Severity: High

Current issue:
- `npm run typecheck` and `npm run build` pass.
- There are no meaningful app tests for API workflows.
- Android has default placeholder tests only.

What can fail:
- Workflow transitions can regress silently.
- Receipt generation can break without detection.
- Photo upload behavior can break across storage modes.
- Bulk actions can partially fail without coverage.

Production fix:
- Add API tests for create, edit, delete, actions, export, receipt, and upload.
- Add workflow unit tests for valid and invalid status transitions.
- Add at least one browser smoke test for login to create repair to receipt.

### 5. File Storage Privacy Needs a Decision

Severity: High

Current issue:
- R2 and Cloudinary return public URLs when configured with public delivery.
- Google Drive upload makes files readable by anyone with the link.
- Photos may include customer/product evidence.

What can fail:
- Uploaded repair photos can be shared outside the organization.
- Sensitive customer/product data can leak if URLs are forwarded.

Production fix:
- Decide whether repair photos are public-link acceptable.
- If not, use authenticated delivery/private assets.
- Add retention rules for old photos.
- Avoid exposing raw storage URLs unless needed.

## High-Risk Failure Points

### MongoDB Connection and Cold Starts

Risk:
- First request after cold start can be slower because MongoDB connects and seed/index checks run.

Current mitigation:
- Mongo client promise is cached globally.
- API timing logs were added.

Missing:
- Connection timeout settings.
- Health endpoint.
- Production monitoring/alerting.

### Runtime Index Creation

Risk:
- `ensureSeeded()` creates indexes during app runtime.
- This can slow first requests or behave unexpectedly on production cold starts.

Recommended fix:
- Move index creation to a setup/migration script.
- Keep runtime checks lightweight.

### Repair Number Generation

Risk:
- Repair numbers are randomly generated with up to 100 attempts.
- Under higher concurrency, collisions are possible.

Recommended fix:
- Use a sequence/counter collection or deterministic ID strategy.
- Enforce unique index on repair number.

### Receipt PDF Generation

Risk:
- PDF is generated manually as raw PDF text.
- Special characters and long values can still cause layout or encoding issues.

Recommended fix:
- Use a tested PDF library if receipt formatting becomes important.
- Add visual/pdf tests for long party names, product names, and remarks.

### Bulk Workflow Actions

Risk:
- Bulk updates run per selected repair.
- Partial failure is possible.
- No transaction/rollback behavior exists.

Recommended fix:
- Return detailed per-record success/failure results.
- Consider bulk write operations.
- Add idempotency for repeated submit clicks.

### Local Upload Storage

Risk:
- Local upload writes to `public/uploads`.
- On many hosting platforms, local filesystem storage is temporary.

Recommended fix:
- Use Cloudflare R2 or another durable object store in production.
- Treat local storage as development-only.

## Performance Review

Recent improvements:
- `/api/repairs` no longer hydrates photos and receipts for every list row.
- List page de-duplicates identical in-flight repair-list fetches.
- Master data is cached in memory after first read.
- Creating a repair no longer re-fetches the same repair just to generate receipt metadata.
- All API routes now log timings through a shared helper.

Expected result:
- Repair list and report API calls should be much faster than the earlier ~1.9 seconds when MongoDB is reachable and warm.
- Local development calls now return quickly even without MongoDB.

Remaining performance risks:
- Filtering still happens in application memory after loading all active repairs.
- Large repair collections will eventually slow down list/report/export.
- CSV export loads all matching records into memory.
- Reports calculate counts client-side after fetching all repairs.

Recommended next performance work:
- Push filters into MongoDB queries.
- Add pagination to `/api/repairs`.
- Add server-side status counts endpoint for reports.
- Add indexes for `kind + status`, `kind + createdAt`, `kind + repairNumber`, and soft-delete fields.

## Security Review

Current strengths:
- API routes are protected by cookie middleware.
- Upload type and size are checked.
- R2 upload limit is enforced before accepting new photos.
- Secrets are documented as server-side environment variables.
- Cloudinary and Drive credentials are not intended to go inside the APK.

Security gaps:
- Hard-coded login credentials.
- Static session cookie value.
- No CSRF protection for mutation routes.
- No rate limiting on login or write APIs.
- No real role enforcement because `allowedActions()` ignores role.
- Public image URLs may expose repair photos.
- No audit identity tied to authenticated user.
- No input schema validation library.

Recommended security work:
- Replace auth before production.
- Add CSRF protection or same-origin mutation checks.
- Add login rate limiting.
- Add structured request validation.
- Enforce staff/admin permissions in workflow actions.

## Reliability Review

Current strengths:
- TypeScript strict mode is enabled.
- `npm run typecheck` passes.
- `npm run build` passes.
- API routes return JSON errors.
- Local dev fallback prevents total frontend blockage without MongoDB.

Reliability gaps:
- No automated tests.
- No backups documented.
- No database migration or index deployment procedure.
- No observability beyond console logs.
- No retry strategy for Cloudinary/Drive upload failures.
- No dead-letter or recovery path for failed bulk actions.

Recommended reliability work:
- Add test suite.
- Add deployment checklist.
- Add database backup policy.
- Add health endpoint.
- Add structured logs with request IDs.

## Android Production Readiness

Current approach:
- Capacitor shell opens the deployed HTTPS app.
- This is efficient and cost-saving.

Benefits:
- Business logic stays on the server.
- APK updates are needed less often.
- Bug fixes can ship through web deployment.

Risks:
- App depends on internet connectivity.
- If the hosted app is down, the APK is effectively down.
- Offline repair intake is not supported.
- Native file/share behavior must be tested on real devices.

Recommended Android work:
- Add user-friendly offline/down screen.
- Test photo upload and receipt sharing on physical Android devices.
- Confirm Play Store signing, app icons, package name, and HTTPS config.

## Production-Ready Checklist

Must do before real production:
- Replace hard-coded auth.
- Finalize MongoDB as the actual source of truth, or migrate fully to Prisma/PostgreSQL.
- Add `.env.local` or deployment env with real MongoDB and Cloudinary values.
- Add production database indexes outside request runtime.
- Add automated tests for workflow and APIs.
- Decide private vs public photo access.
- Add backup/restore process.
- Add login/write rate limiting.
- Add CSRF or same-origin mutation protection.

Should do soon:
- Add pagination and server-side filters.
- Add master-data CRUD screens.
- Add health endpoint.
- Add structured request logging.
- Improve receipt PDF generation with a library.
- Add detailed bulk-action results.

Nice to have:
- Dashboard charts.
- Export filters by date/status.
- User activity reports.
- Offline Android queue.
- Notifications for pending repair stages.

## Recommended Next Architecture

For the fastest production path, keep the current stack but harden it:

- Next.js for frontend and backend APIs.
- MongoDB as the only production database.
- Cloudflare R2 as the preferred production image store when free storage and low cost are the priority.
- Cloudinary only if image transformations become more important than storage allowance.
- Capacitor as a thin Android shell.
- Remove or archive Prisma until a real migration is planned.
- Replace hard-coded auth with MongoDB-backed users.
- Add tests and operational checks.

This path is the most cost-saving and time-saving because it improves what already exists instead of rebuilding the app.

## Final Assessment

The app has a strong practical foundation for a small repair-management workflow. It already covers intake, status movement, reports, receipts, photo upload, CSV export, and Android packaging.

The architecture is not broken, but it is unfinished. The biggest issue is not the UI or Cloudinary; it is production hardening. Authentication, data ownership, tests, privacy, and deployment operations need to be made explicit before this should hold real business-critical data.
