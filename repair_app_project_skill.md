# Repair / Goods Return Management App — Project Skill

## Summary

This app tracks a repair from intake through customer return with MongoDB-backed persistence, PDF receipt generation, photo upload, and a stage-by-stage audit timeline.

## Current Flow

The active repair lifecycle is:

```text
Received
-> Repair In Progress
-> Repair Received
-> Sent to Customer
```

The supported user actions are:

- Login before app access using the temporary admin credential gate
- Create repair
- View/download receipt
- Upload product photos
- Edit repair while still in `Received`
- Soft delete repair with confirmation
- Move status only from the Reports screen using the existing three actions:
  - Send to repair
  - Receive from repair
  - Send to customer

Legacy reject, GR bill, WhatsApp share, and extra status flows are removed from the active app.

## Required Data Model

Repair records are stored in the `data` collection. `party` remains optional master data only.

Each repair document stores:

- `repairNumber`
- `repairDateId`
- `partyName`
- `productName`
- `productDetails`
- `productColor`
- `sellingPrice`
- `status`
- `createdAt`
- `updatedAt`
- `receivedFromCustomerBy`
- `sentToRepairBy`
- `receivedFromRepairBy`
- `sentToCustomerBy`
- `initialRemark`
- `sentToRepairNote`
- `receivedFromRepairNote`
- `sentToCustomerNote`
- `productImageDriveLink`
- `productImageFileName`
- `isDeleted`
- `deletedAt`
- `deletedBy`
- `deleteReason`
- `auditTimeline`

`auditTimeline` is stored directly on the repair document as an ordered array of:

- `action`
- `previousStatus`
- `newStatus`
- `roleLabel`
- `personName`
- `note`
- `metadata`
- `createdAt`

For `SEND_TO_CUSTOMER`, `metadata` may store:

- `sendingMedium`
- `proofPhotoUrl`
- `proofPhotoFileName`

## Validation Rules

Create repair requires:

- `partyName`
- `productDetails`
- `initialRemark`
- `receivedFromCustomerBy`
- `sellingPrice`

Action rules:

- `send-to-repair` requires `sentToRepairBy`
- `receive-from-repair` requires `receivedFromRepairBy`
- `send-to-customer` requires `sentToCustomerBy`
- `send-to-customer` may also include optional `sendingMedium` and bill/proof photo metadata
- Deleted repairs are excluded from active list, preview, reports, and exports

## UI Rules

- Show a login page before protected app routes when no active session exists
- Keep the temporary login flow simple: username, password, error state, redirect to repairs after success, logout when requested
- List page actions: `Preview`, `Receipt`
- Remove WhatsApp share from every screen
- Remove intake fields: phone number, address, GR / bill reference
- Replace generic `Staff Name` labels with action-specific labels
- Record cards and list layouts should visually prioritize Party Name as the main title; Repair ID should be secondary
- New repair automatically starts receipt PDF download and also shows a visible fallback download button
- Audit timeline renders oldest to newest, top to bottom
- Repair detail page is view/edit/delete only and must not expose workflow status actions
- Edit stays available only while the repair status is `Received`
- Delete must always use a confirmation popup before soft delete
- Report page owns all workflow status movement actions
- Report page has two internal views:
  - summary view with clickable status cards
  - status record sub-view with Back, record count, multi-select, and workflow action only
- Report status record view must not show Preview or Receipt actions
- Every report status record sub-view includes a party-name search input above the record list
- Report party-name search filters only records within the currently selected status view
- Report selection and Select All apply only to the currently visible filtered records
- Report `Send to Customer` form includes:
  - required `Sent to customer by`
  - optional `Note`
  - optional `Medium of Sending`
  - optional `Upload Bill / Proof Photo`
- Receipt printing should use a dedicated print-only route that renders exactly two copies on one A4 page with a cut line and no app chrome
- Receipt page shows a single on-screen receipt, but print layout must render two identical copies on one page

## API Surface

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/repairs
POST   /api/repairs
GET    /api/repairs/{id}
PATCH  /api/repairs/{id}
DELETE /api/repairs/{id}
POST   /api/repairs/{id}/actions
POST   /api/repairs/{id}/photos
GET    /api/repairs/{id}/receipt
POST   /api/repairs/{id}/receipt
GET    /repairs/{id}/receipt/print
GET    /api/repairs/{id}/receipt/pdf
GET    /api/repairs/export
```

List filters:

- `party`
- `person`
- `status`
- `search`

## MongoDB Notes

- `MONGODB_URI`, `MONGODB_DB_NAME`, `MONGODB_REPAIRS_COLLECTION`, and `MONGODB_PARTIES_COLLECTION` must be present for live persistence
- Placeholder URIs are treated as configuration errors
- Repair APIs no longer silently fall back to the in-memory store when MongoDB is misconfigured

## Change Log

### 2026-05-06 — Preview cleanup, report workflow ownership, and soft delete

- Removed status-changing actions from the repair preview screen
- Kept preview focused on details, receipt access, edit, delete, photos, and audit timeline
- Added soft delete metadata to live repair documents and excluded deleted repairs from active views/reports/exports
- Added delete confirmation requirement before removing a repair from active operations
- Moved operational workflow actions to the Reports screen with status drilldown and multi-select handling
- Kept edit restricted to repairs still in `Received`

### 2026-05-06 — Report sub-view cleanup and login gate

- Refined report status clicks to open a focused internal status sub-view instead of a cluttered same-page expansion
- Added Back navigation from report status record view to report summary cards
- Removed Preview and Receipt actions from report status record view so it stays workflow-only
- Added a simple login/logout guard for protected app pages and APIs using the temporary admin credential flow

### 2026-05-06 — Send to customer metadata and dedicated print route

- Extended the report-side `Send to Customer` action to support optional sending medium and bill/proof photo
- Reused the existing photo upload API to attach a proof image while preserving the action submission flow
- Stored send-to-customer extras on audit timeline metadata so movement history captures the handoff context
- Updated timeline/history rendering to show send-to-customer metadata
- Moved browser printing onto a dedicated receipt print route with strict A4 layout and two identical copies only

### 2026-05-06 — Report status view party-name search

- Added reusable party-name search to every report status record sub-view
- Scoped report filtering to the selected status records only
- Kept multi-select and Select All aligned to the visible filtered records

### 2026-05-06 — Party name as primary record title

- Updated repair list and report record layouts so Party Name is the main visual title
- Demoted Repair ID to secondary metadata where record cards or headers previously led with it

### 2026-05-04 — Repair flow reset

- Reduced the app to one 4-stage repair lifecycle: `Received`, `Repair In Progress`, `Repair Received`, `Sent to Customer`
- Removed reject, GR bill, WhatsApp share, and older extra repair states from the active workflow
- Simplified create/edit forms to the required repair fields only
- Made selling price mandatory at create time
- Embedded `auditTimeline` directly on repair documents
- Reworked receipt content to include selling price, stage-specific person, and notes
- Changed repair search from generic staff search to person/action search
- Stopped silent in-memory fallback for repair APIs when MongoDB is misconfigured

### 2026-05-04 — Action visibility and duplicate print receipt

- Repair preview only exposes the next allowed action for the current status; once submitted, the prior action no longer appears
- Receipt page keeps one normal receipt for viewing/downloading, while browser print renders two identical receipt copies separated by a cut line
