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

- Create repair
- Send to repair
- Receive from repair
- Send to customer
- View/download receipt
- Upload product photos

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
- `auditTimeline`

`auditTimeline` is stored directly on the repair document as an ordered array of:

- `action`
- `previousStatus`
- `newStatus`
- `roleLabel`
- `personName`
- `note`
- `createdAt`

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

## UI Rules

- List page actions: `Preview`, `Receipt`
- Remove WhatsApp share from every screen
- Remove intake fields: phone number, address, GR / bill reference
- Replace generic `Staff Name` labels with action-specific labels
- New repair automatically starts receipt PDF download and also shows a visible fallback download button
- Audit timeline renders oldest to newest, top to bottom
- Repair detail page must only show the currently valid next action; completed actions must disappear after submission
- Receipt page shows a single on-screen receipt, but print layout must render two identical copies on one page

## API Surface

```text
GET    /api/repairs
POST   /api/repairs
GET    /api/repairs/{id}
PATCH  /api/repairs/{id}
POST   /api/repairs/{id}/actions
POST   /api/repairs/{id}/photos
GET    /api/repairs/{id}/receipt
POST   /api/repairs/{id}/receipt
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
