import { describe, expect, it } from "vitest";
import { allowedActions, assertValidAction, nextStatusForAction } from "./workflow";
import type { Repair } from "./types";

function makeRepair(overrides: Partial<Repair> = {}): Repair {
  return {
    id: "repair-1",
    repairNumber: "AABB01",
    repairDateId: "20260101",
    partyName: "Test Party",
    productName: "Test Product",
    productDetails: "Test product details",
    sellingPrice: 100,
    status: "Received",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    receivedFromCustomerBy: "Staff A",
    initialRemark: "note",
    auditTimeline: [],
    ...overrides,
  };
}

describe("allowedActions", () => {
  it("allows send-to-repair only from Received", () => {
    expect(allowedActions(makeRepair({ status: "Received" }), "staff")).toEqual(["send-to-repair"]);
  });

  it("allows receive-from-repair only from Repair In Progress", () => {
    expect(allowedActions(makeRepair({ status: "Repair In Progress" }), "staff")).toEqual(["receive-from-repair"]);
  });

  it("allows send-to-customer and mark-as-gr from Repair Received", () => {
    expect(allowedActions(makeRepair({ status: "Repair Received" }), "staff")).toEqual(["send-to-customer", "mark-as-gr"]);
  });

  it("allows nothing from terminal statuses", () => {
    expect(allowedActions(makeRepair({ status: "GR" }), "staff")).toEqual([]);
    expect(allowedActions(makeRepair({ status: "Sent to Customer" }), "staff")).toEqual([]);
  });
});

describe("assertValidAction", () => {
  it("rejects an action not allowed from the current status", () => {
    const repair = makeRepair({ status: "Received" });
    expect(() => assertValidAction(repair, { action: "mark-as-gr", grBy: "A" }, "staff")).toThrow(/not allowed/);
  });

  it("rejects send-to-repair without sentToRepairBy", () => {
    const repair = makeRepair({ status: "Received" });
    expect(() => assertValidAction(repair, { action: "send-to-repair", sentToRepairBy: "" }, "staff")).toThrow(/required/);
  });

  it("accepts a valid send-to-repair action", () => {
    const repair = makeRepair({ status: "Received" });
    expect(() => assertValidAction(repair, { action: "send-to-repair", sentToRepairBy: "Vendor A" }, "staff")).not.toThrow();
  });

  it("rejects receive-from-repair without receivedFromRepairBy", () => {
    const repair = makeRepair({ status: "Repair In Progress" });
    expect(() => assertValidAction(repair, { action: "receive-from-repair", receivedFromRepairBy: "" }, "staff")).toThrow(/required/);
  });

  it("rejects mark-as-gr without grBy", () => {
    const repair = makeRepair({ status: "Repair Received" });
    expect(() => assertValidAction(repair, { action: "mark-as-gr", grBy: "" }, "staff")).toThrow(/required/);
  });
});

describe("nextStatusForAction", () => {
  it("maps each action to its resulting status", () => {
    expect(nextStatusForAction("send-to-repair")).toBe("Repair In Progress");
    expect(nextStatusForAction("receive-from-repair")).toBe("Repair Received");
    expect(nextStatusForAction("send-to-customer")).toBe("Sent to Customer");
    expect(nextStatusForAction("mark-as-gr")).toBe("GR");
  });
});
