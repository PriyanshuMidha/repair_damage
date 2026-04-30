# Repair / Goods Return Management App — Project Skill

## 1. Skill Purpose

Use this skill whenever working on the **Repair / Goods Return Management App**.

This file is the single source of truth for the project summary, business flow, implementation plan, pending decisions, and future changes.

Whenever a new feature, rule, field, API, UI change, or business decision is added, update this markdown file first so the project stays clear and consistent.

---

## 2. Project Summary

We are building a **Repair / Goods Return Management App** to manage damaged goods returned by a party/customer.

The system will allow staff to:

1. Receive damaged goods from a party/customer.
2. Create a repair entry.
3. Add party, product, billing, damage, and receiver details.
4. Upload product photos.
5. Generate a repair receipt.
6. Track the product through the repair process.
7. Receive the product back after repair.
8. Return the product to the customer/party.
9. Maintain full status and action history.

In simple words:

> This app tracks every damaged returned product from the moment it is received until it is repaired and returned to the customer.

---

## 3. Main Objective

The objective is to create a clean system where damaged goods are not tracked manually or lost in communication.

The app should provide:

- Proper repair entry creation
- Product and damage tracking
- Photo proof
- Staff accountability
- Status lifecycle tracking
- Receipt generation
- WhatsApp sharing
- Repair history
- Return-to-customer closure

---

## 4. Core Business Flow

```text
Goods received from party/customer
→ Staff creates repair entry
→ Party/product/damage/billing details added
→ Product photo uploaded
→ Receipt generated
→ Entry appears in repair list
→ Product sent to repair
→ Repair in progress
→ Product received after repair
→ Staff verifies repair
→ Product marked ready to return
→ Product returned to party/customer
→ Repair entry closed
```

---

## 5. Status Lifecycle

Primary status flow:

```text
Received
→ Repair In Progress
→ Received After Repair
→ Ready To Return
→ Returned To Customer
```

Optional future statuses:

```text
Repair Failed
Rework Required
Cancelled
Lost / Damaged Further
```

Optional statuses should only be added when the business flow is confirmed.

---

## 6. Initial Repair Entry Fields

### 6.1 Party / Customer Details

- Party name
- Party code/id, if available
- Contact number, if available
- Address, if available

### 6.2 Billing / GR Details

Question:

- Is this returned good billed or does it have a GR/bill reference?

Options:

- Yes
- No

If Yes:

- Bill number / GR number / reference number
- Mark that bill exists against the returned product

### 6.3 Receiver Details

- Receiver staff name
- Receiver staff id, if available
- Received date and time

Recommended:

- Auto-fill receiver from logged-in user if available.

### 6.4 Product Details

- Product code
- Product name
- Quantity
- Sale rate
- Purchase rate
- Color
- Size/variant, if available

Recommended:

- If product code exists in product master, auto-fetch product details.

### 6.5 Damage Details

- Damage category, if required
- Damage description
- Product condition
- Remarks

Recommended:

- Use damage category + free-text remarks.

### 6.6 Photo Upload

- Upload one or multiple photos
- Show preview before submit
- Validate file type and size
- Store uploaded file path/URL

Recommended:

- Photo should be strongly recommended.
- Make it mandatory only if business requires proof for every repair.

### 6.7 Date

- Entry date should be auto-filled with current date/time.
- Allow edit only if business requires it.

---

## 7. Receipt Requirement

After creating a repair entry, the system should generate a repair receipt.

Receipt should contain:

- Repair receipt number
- Date
- Party/customer details
- Product code/name
- Quantity
- Damage description
- Billing/GR reference, if any
- Receiver staff name
- Current status
- Company/store name, if available
- Terms/notes, if required

Receipt actions:

- View receipt
- Print receipt
- Download receipt
- Share receipt via WhatsApp

Recommended:

- Start with printable HTML receipt.
- Add PDF only if existing PDF generation already exists.
- Start with WhatsApp share link/message unless official WhatsApp API exists.

---

## 8. Repair List / Dashboard

Create a listing page for all repair records.

Columns:

- Repair number/id
- Party name
- Product code/name
- Date received
- Current status
- Receiver staff
- Last updated date
- Actions

Filters:

- Status
- Party name
- Product code
- Date range
- Staff name
- Repair number

Actions:

- View details
- Send to repair
- Receive after repair
- Mark ready to return
- Return to customer
- Print/download receipt

---

## 9. Send To Repair Flow

When product is sent to repair, capture:

- Repair id
- Staff who is sending the product
- Date sent to repair
- Repair center name
- Repair center contact/address, if available
- Remarks

Status update:

```text
Received → Repair In Progress
```

Recommended:

- Store “Sent To Repair” as an action/event.
- Set current status to “Repair In Progress” after confirmation.

---

## 10. Receive After Repair Flow

When repaired product comes back, capture:

- Repair id
- Staff who received the product
- Date received from repair
- Staff who checked the product
- Repair result
- Remarks
- After-repair photos, optional

Possible repair result:

- Repair done
- Repair not done
- Rework required

Recommended:

- If repair is done, status should become `Ready To Return`.
- If repair is not done, use `Rework Required` only if business confirms.

---

## 11. Return To Customer Flow

When product is returned to party/customer, capture:

- Repair id
- Date returned
- Staff who returned the product
- Party/customer receiver name
- Delivery mode
- Courier/transport details, if applicable
- Remarks

Delivery modes:

- By Hand
- Courier
- Transport
- Other

Final status:

```text
Returned To Customer
```

Recommended:

- After final return, core details should not be editable except by admin.

---

## 12. Audit / History Requirement

Every major action should create a history entry.

Actions to track:

- Repair entry created
- Receipt generated
- Receipt shared
- Product sent to repair
- Product received after repair
- Product marked ready to return
- Product returned to customer
- Record edited
- Record cancelled, if cancellation is added

History should capture:

- Repair id
- Action name
- Old status
- New status
- Staff/user
- Date/time
- Remarks

---

## 13. Suggested Database Design

Before creating new tables, inspect the existing project/database.

Check existing tables for:

- Product master
- Party/customer master
- Staff/user master
- Goods return
- Receipt/invoice
- File upload
- Audit/status history

Prefer reusing existing master data.

### 13.1 RepairRequest / RepairEntry

Stores main repair record.

Suggested columns:

- id
- repair_no
- party_id
- party_name
- product_id
- product_code
- product_name
- quantity
- sale_rate
- purchase_rate
- color
- damage_description
- product_condition
- is_billed
- bill_or_gr_reference
- received_by_staff_id
- received_by_staff_name
- received_date
- current_status
- created_by
- created_at
- updated_by
- updated_at

### 13.2 RepairPhotos

Stores uploaded photos.

Suggested columns:

- id
- repair_id
- photo_url
- photo_type
  - before_repair
  - after_repair
- uploaded_by
- uploaded_at

### 13.3 RepairStatusHistory

Stores status changes.

Suggested columns:

- id
- repair_id
- from_status
- to_status
- action_name
- remarks
- changed_by_staff_id
- changed_by_staff_name
- changed_at

### 13.4 RepairMovementDetails

Stores movement details.

Suggested columns:

- id
- repair_id
- movement_type
  - sent_to_repair
  - received_from_repair
  - returned_to_customer
- staff_id
- staff_name
- movement_date
- repair_center_name
- delivery_mode
- courier_tracking_number
- customer_receiver_name
- remarks
- created_at

---

## 14. Suggested APIs

Before creating APIs, inspect existing backend patterns.

Suggested routes:

```text
POST   /repairs
POST   /repairs/{repairId}/photos
GET    /repairs
GET    /repairs/{repairId}
POST   /repairs/{repairId}/send-to-repair
POST   /repairs/{repairId}/receive-after-repair
POST   /repairs/{repairId}/mark-ready-to-return
POST   /repairs/{repairId}/return-to-customer
GET    /repairs/{repairId}/receipt
POST   /repairs/{repairId}/share-whatsapp
```

Filters for list API:

- status
- party
- productCode
- dateFrom
- dateTo
- staff
- repairNo

---

## 15. Suggested UI Pages

### 15.1 Repair Entry Wizard

Steps:

1. Party details
2. Billing/GR details
3. Product details
4. Damage details + photo upload
5. Review and submit
6. Receipt generated

### 15.2 Repair List Page

Includes:

- Table/grid
- Filters
- Status badges
- Action buttons

### 15.3 Repair Detail Page

Includes:

- Full repair information
- Uploaded photos
- Receipt actions
- Status timeline
- Movement history
- Action buttons

### 15.4 Action Modals / Pages

Needed for:

- Send to repair
- Receive after repair
- Return to customer

---

## 16. Validation Rules

Required validations:

- Party name required
- Product code required
- Damage description required
- Receiver staff required
- Received date required
- Sale rate numeric
- Purchase rate numeric
- Quantity numeric
- Billing reference required if `is_billed = Yes`
- Repair center required when sending to repair
- Delivery mode required when returning to customer
- Courier tracking required if delivery mode is Courier

---

## 17. Status Transition Rules

Allowed transitions:

```text
Received → Repair In Progress
Repair In Progress → Received After Repair
Received After Repair → Ready To Return
Ready To Return → Returned To Customer
```

Optional transition:

```text
Received After Repair → Rework Required
Rework Required → Repair In Progress
```

Not allowed:

```text
Returned To Customer → any previous status
Ready To Return → Repair In Progress
```

Exception:

- Allow reverse/rework only if explicit admin/business rule exists.

---

## 18. Permissions

Recommended:

- Check existing role/permission system.
- If roles exist, map actions to permissions.
- If roles do not exist, keep basic access in phase 1.

Possible permissions:

- Create repair entry
- Edit repair entry
- Send to repair
- Receive after repair
- Return to customer
- View receipt
- Admin correction

---

## 19. Edge Cases

Consider these cases:

1. Wrong party selected
2. Wrong product selected
3. Product photo missing
4. Bill reference entered incorrectly
5. Product sent to repair but never returned
6. Repair failed
7. Product returned partially
8. Multiple quantity returned
9. Customer refuses repaired product
10. Courier tracking missing
11. Duplicate repair entry created
12. Final returned record needs correction
13. Uploaded photo fails
14. Receipt generation fails
15. WhatsApp sharing fails

---

## 20. Phase-Wise Implementation Plan

### Phase 1 — Analysis

- Understand existing codebase
- Check DB structure
- Check auth/staff handling
- Check product/party master
- Check file upload
- Check receipt/PDF patterns
- Check WhatsApp/share patterns

### Phase 2 — Data Model

- Finalize tables
- Add migrations/scripts
- Add models/entities
- Add status constants/enums

### Phase 3 — Backend APIs

- Create repair entry API
- Create list/detail APIs
- Create photo upload API
- Create status action APIs
- Add validation
- Add history tracking

### Phase 4 — Frontend UI

- Create repair entry wizard
- Create repair list page
- Create repair detail page
- Add status timeline
- Add action modals
- Add image preview/upload

### Phase 5 — Receipt & Sharing

- Create printable receipt
- Add download/print option
- Add WhatsApp share message/link

### Phase 6 — Testing

Test:

- Create repair entry without bill
- Create repair entry with bill
- Upload photo
- Send product to repair
- Receive repaired product
- Mark ready to return
- Return by hand
- Return by courier
- Invalid status transition
- Filters
- Receipt generation

### Phase 7 — Review

- Check code style
- Check naming consistency
- Check DB constraints
- Check UI responsiveness
- Check error handling
- Check no existing module is broken

---

## 21. Grill Mode Instructions

Use Grill Mode before implementation.

Goal:

Stress-test the plan before coding.

Instructions:

- Ask questions in grouped batches.
- For every question, provide:
  - Why it matters
  - Recommended answer
  - Impact if changed
- Explore codebase wherever possible instead of asking codebase-related questions.
- Do not start coding until all major questions are resolved.

Question groups:

1. Business flow
2. Party/product/billing details
3. Repair lifecycle
4. Receipt and WhatsApp sharing
5. Database/API/UI design
6. Permissions, edge cases, and reporting

Grill Mode is complete only when:

- Final business flow is confirmed
- DB design is confirmed
- API design is confirmed
- UI pages are confirmed
- Status lifecycle is confirmed
- Edge cases are confirmed
- Implementation phase is approved

---

## 22. Cursor / AI Usage Rule

When using Cursor/Codex/AI on this project, always start with this instruction:

```text
Read the Repair / Goods Return Management App project skill markdown file first.

Do not start coding immediately.

First understand the project summary, current decisions, status lifecycle, database expectations, API expectations, UI expectations, and pending decisions.

If the answer can be found in the codebase, inspect the codebase instead of asking me.

If the answer is business-specific, ask me in Grill Mode.

Whenever we add a new feature, field, rule, API, page, or business decision, update this markdown file first.
```

---

## 23. Change Log

Use this section whenever a new requirement is added.

### 2026-04-30 — Realign implementation with handwritten repair flow

- Align current status lifecycle with the project skill and handwritten notes:
  - `Received`
  - `Repair In Progress`
  - `Received After Repair`
  - `Ready To Return`
  - `Returned To Customer`
  - Exception statuses: `Rework Required`, `Repair Failed`, `Cancelled`
- Treat "sent to repair" as an action/event that moves current status to `Repair In Progress`.
- Treat receiving the repaired goods back as an action/event that moves current status to `Received After Repair`.
- Add explicit manually entered staff accountability fields:
  - `receiverStaffName` when goods are initially received.
  - `sentToRepairByStaffName` when goods are sent to repair center.
  - `receivedAfterRepairByStaffName` when goods come back from repair.
  - `checkedByStaffName` when staff checks repaired goods and marks ready/rework/failed.
  - `returnedByStaffName` when goods are returned to party/customer.
- Add explicit `productCondition` field during repair entry creation.
- Repair entry UI should behave as a step-by-step wizard:
  1. Party + receiver
  2. Billing/GR
  3. Product details
  4. Damage + photo
  5. Review + submit
  6. Receipt generated
- Keep receipt generation, WhatsApp share message, photo upload, audit history, and MongoDB persistence behavior.

### 2026-04-30 — MongoDB Atlas persistence

- Added requirement to persist Repair App data in MongoDB Atlas instead of only the in-memory demo store.
- Preferred database name: `Damaged_goods_tracked_cleanly`.
- Preferred collection names:
  - `data` for repair records, photos, status history, receipts, and sequence counters.
  - `party` for party/customer master data.
- MongoDB credentials must not be hardcoded in source files; use environment variables in `.env.local`.
- The app should use `MONGODB_URI`, `MONGODB_DB_NAME`, `MONGODB_REPAIRS_COLLECTION`, and `MONGODB_PARTIES_COLLECTION`.
- Atlas cluster host/full connection string is required before live database writes can work.
- If MongoDB is not configured, the app may fall back to the current in-memory demo store for local development.

### 2026-04-30

Initial project skill created.

### 2026-04-30 — Cursor skill

- Renamed project markdown from `repair_app_project_skil.md` to `repair_app_project_skill.md`.
- Added Cursor Agent Skill: `.cursor/skills/repair-goods-return-app/SKILL.md` (always read this doc before Repair App changes; update this doc first when requirements change).

Added:

- Project summary
- Business flow
- Status lifecycle
- Repair entry fields
- Receipt requirement
- Dashboard requirement
- Send to repair flow
- Receive after repair flow
- Return to customer flow
- Audit/history requirement
- Suggested DB design
- Suggested API design
- Suggested UI pages
- Validation rules
- Status transition rules
- Permissions
- Edge cases
- Phase-wise implementation plan
- Grill Mode instructions

---

## 24. Pending Decisions

Update this list as decisions are made.

- Should one repair entry support multiple products or only one product?
- Should photo upload be mandatory?
- Should receipt be HTML only or PDF also?
- Is WhatsApp sharing only a link/message or official API integration?
- Should repair center be free text or master data?
- Should Repair Failed / Rework Required be added in phase 1?
- Should final returned records be editable by admin?
- Which roles can perform which repair actions?
