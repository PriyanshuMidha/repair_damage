import { MongoClient, type Collection, type Db, type Document } from "mongodb";

const globalForMongo = globalThis as unknown as {
  mongoClientPromise?: Promise<MongoClient>;
  mongoLogState?: { configLogged?: boolean; connectedLogged?: boolean };
};

function uriState() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return { ok: false as const, reason: "MONGODB_URI is missing." };
  if (uri.includes("<cluster-host>")) return { ok: false as const, reason: "MONGODB_URI still contains <cluster-host>." };
  if (uri.includes("<username>") || uri.includes("<password>")) return { ok: false as const, reason: "MONGODB_URI still contains placeholder credentials." };
  return { ok: true as const, uri };
}

export function isMongoConfigured() {
  return uriState().ok;
}

export function mongoConfigError() {
  return uriState().reason ?? "MongoDB is not configured.";
}

export async function mongoDb(): Promise<Db> {
  const state = uriState();
  const dbName = process.env.MONGODB_DB_NAME ?? "Damaged_goods_tracked_cleanly";

  if (!globalForMongo.mongoLogState) {
    globalForMongo.mongoLogState = {};
  }

  if (!state.ok) {
    if (!globalForMongo.mongoLogState.configLogged) {
      console.error(`[repair-app] MongoDB disabled: ${state.reason}`);
      globalForMongo.mongoLogState.configLogged = true;
    }
    throw new Error(state.reason);
  }

  if (!globalForMongo.mongoClientPromise) {
    console.info(`[repair-app] Connecting to MongoDB database "${dbName}".`);
    globalForMongo.mongoClientPromise = new MongoClient(state.uri).connect();
  }

  try {
    const client = await globalForMongo.mongoClientPromise;
    if (!globalForMongo.mongoLogState.connectedLogged) {
      console.info(`[repair-app] MongoDB connection ready for "${dbName}".`);
      globalForMongo.mongoLogState.connectedLogged = true;
    }
    return client.db(dbName);
  } catch (error) {
    console.error("[repair-app] MongoDB connection failed.", error);
    globalForMongo.mongoClientPromise = undefined;
    throw error;
  }
}

export async function dataCollection<T extends Document = Document>(): Promise<Collection<T>> {
  const db = await mongoDb();
  return db.collection<T>(process.env.MONGODB_REPAIRS_COLLECTION ?? "data");
}

export async function partyCollection<T extends Document = Document>(): Promise<Collection<T>> {
  const db = await mongoDb();
  return db.collection<T>(process.env.MONGODB_PARTIES_COLLECTION ?? "party");
}
