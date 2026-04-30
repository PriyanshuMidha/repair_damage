---
name: repair-goods-return-app
description: Guides work on the Repair / Goods Return Management App—read the project skill markdown first, update it before spec changes, and follow status lifecycle, APIs, and UI expectations. Use when editing the Repair App, repair entries, receipts, goods return flows, or files under this project related to repairs.
---

# Repair / Goods Return Management App

## Always-on rules (verbatim)

Before making any change in the Repair App, first read repair_app_project_skill.md.

Whenever we add a new feature, field, business rule, API, UI page, status, or edge case, update this markdown file first.

## Workflow

1. **Read first**: Open and follow `repair_app_project_skill.md` at the project root before planning or coding. It is the single source of truth for summary, flows, DB/API/UI expectations, pending decisions, and change log.
2. **Inspect code**: Prefer the codebase over asking the user when the answer is discoverable there.
3. **Business questions**: Use Grill Mode (grouped questions with why / recommendation / impact) from that file when business rules are unclear.
4. **Do not code blindly**: Align with status lifecycle, validations, and transition rules documented there.
5. **Update the doc first**: When adding or changing requirements, edit `repair_app_project_skill.md` before or alongside implementation, and append to the change log section.

## Quick pointers

- Primary statuses: Received → Sent To Repair / Repair In Progress → Received After Repair → Ready To Return → Returned To Customer.
- Full field lists, suggested tables, API routes, UI pages, edge cases, and phase plan live in the project markdown only—read it when scope touches those areas.

## Additional resources

- Full specification, diagrams, and pending decisions: [repair_app_project_skill.md](../../../repair_app_project_skill.md) (project root).
