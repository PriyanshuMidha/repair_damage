import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB_NAME = "test_db";
  process.env.ADMIN_PASSWORD = "admin123";
  process.env.STAFF_PASSWORD = "staff123";
});

afterAll(async () => {
  await mongod.stop();
});

beforeEach(async () => {
  const { mongoDb } = await import("./mongodb");
  const db = await mongoDb();
  await db.dropDatabase();
  vi.resetModules();
});

async function freshStore() {
  const mongoStore = await import("./mongoStore");
  return mongoStore;
}

describe("createRepair / performAction / softDeleteRepair", () => {
  it("creates a repair in Received status with an audit entry", async () => {
    const store = await freshStore();
    const repair = await store.createRepair({
      partyName: "Aarav Traders",
      productDetails: "Cracked screen",
      sellingPrice: 500,
      initialRemark: "Received with visible crack",
      receivedFromCustomerBy: "Priya",
    });

    expect(repair.status).toBe("Received");
    expect(repair.repairNumber).toMatch(/^[A-Z0-9]{6}$/);
    expect(repair.auditTimeline).toHaveLength(1);
    expect(repair.auditTimeline[0].action).toBe("CREATE");
  });

  it("transitions status through the workflow via performAction", async () => {
    const store = await freshStore();
    const created = await store.createRepair({
      partyName: "Meera Customer",
      productDetails: "Broken hinge",
      sellingPrice: 300,
      initialRemark: "Hinge broken",
      receivedFromCustomerBy: "Priya",
    });

    const sent = await store.performAction(created.id, { action: "send-to-repair", sentToRepairBy: "Vendor A" }, "staff");
    expect(sent.status).toBe("Repair In Progress");

    const received = await store.performAction(created.id, { action: "receive-from-repair", receivedFromRepairBy: "Vendor A" }, "staff");
    expect(received.status).toBe("Repair Received");

    const gr = await store.performAction(created.id, { action: "mark-as-gr", grBy: "Priya" }, "admin");
    expect(gr.status).toBe("GR");
    expect(gr.auditTimeline.map((entry) => entry.action)).toEqual(["CREATE", "SEND_TO_REPAIR", "RECEIVE_FROM_REPAIR", "MARK_AS_GR"]);
  });

  it("rejects an action that is not allowed from the current status", async () => {
    const store = await freshStore();
    const created = await store.createRepair({
      partyName: "Kiran Electronics",
      productDetails: "Dead battery",
      sellingPrice: 200,
      initialRemark: "Battery dead on arrival",
      receivedFromCustomerBy: "Priya",
    });

    await expect(store.performAction(created.id, { action: "mark-as-gr", grBy: "Priya" }, "admin")).rejects.toThrow(/not allowed/);
  });

  it("soft-deletes a repair so it no longer appears in listRepairs", async () => {
    const store = await freshStore();
    const created = await store.createRepair({
      partyName: "Aarav Traders",
      productDetails: "Loose screw",
      sellingPrice: 100,
      initialRemark: "Screw missing",
      receivedFromCustomerBy: "Priya",
    });

    await store.softDeleteRepair(created.id, "Duplicate entry");
    const list = await store.listRepairs();
    expect(list.find((repair) => repair.id === created.id)).toBeUndefined();
  });
});

describe("repairNumber uniqueness", () => {
  it("enforces a unique index on repairNumber for repair documents", async () => {
    const store = await freshStore();
    await store.createRepair({
      partyName: "Aarav Traders",
      productDetails: "Item A",
      sellingPrice: 100,
      initialRemark: "note",
      receivedFromCustomerBy: "Priya",
    });

    const { dataCollection } = await import("./mongodb");
    const data = await dataCollection<{ _id: string; [key: string]: unknown }>();
    await expect(
      data.insertOne({ _id: "repair:dup-test", kind: "repair", id: "dup-test", repairNumber: "AABB01" }),
    ).resolves.toBeDefined();
    await expect(
      data.insertOne({ _id: "repair:dup-test-2", kind: "repair", id: "dup-test-2", repairNumber: "AABB01" }),
    ).rejects.toThrow(/duplicate key|E11000/);
  });
});

describe("auth", () => {
  it("seeds admin/staff users with hashed passwords and verifies login", async () => {
    const store = await freshStore();
    const { verifyLogin } = await import("./auth");
    await store.listMasters();

    const validAdmin = await verifyLogin("admin", "admin123");
    expect(validAdmin?.role).toBe("admin");

    const invalid = await verifyLogin("admin", "wrong-password");
    expect(invalid).toBeNull();
  });

  it("never exposes passwordHash through listMasters", async () => {
    const store = await freshStore();
    const masters = await store.listMasters();
    for (const user of masters.users) {
      expect(user).not.toHaveProperty("passwordHash");
      expect(user).not.toHaveProperty("password");
      expect(user).not.toHaveProperty("username");
    }
  });
});
