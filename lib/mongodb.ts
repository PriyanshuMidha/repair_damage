import { MongoClient, type Collection, type Db, type Document } from "mongodb";

const globalForMongo = globalThis as unknown as {
  mongoClientPromise?: Promise<MongoClient>;
};

export function isMongoConfigured() {
  const uri = process.env.MONGODB_URI;
  return Boolean(uri && !uri.includes("<cluster-host>"));
}

export async function mongoDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME ?? "Damaged_goods_tracked_cleanly";

  if (!uri || uri.includes("<cluster-host>")) {
    throw new Error("MONGODB_URI is missing or still contains <cluster-host>.");
  }

  if (!globalForMongo.mongoClientPromise) {
    globalForMongo.mongoClientPromise = new MongoClient(uri).connect();
  }

  const client = await globalForMongo.mongoClientPromise;
  return client.db(dbName);
}

export async function dataCollection<T extends Document = Document>(): Promise<Collection<T>> {
  const db = await mongoDb();
  return db.collection<T>(process.env.MONGODB_REPAIRS_COLLECTION ?? "data");
}

export async function partyCollection<T extends Document = Document>(): Promise<Collection<T>> {
  const db = await mongoDb();
  return db.collection<T>(process.env.MONGODB_PARTIES_COLLECTION ?? "party");
}
