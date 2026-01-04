import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

// --- Hard fail early with clear errors ---
if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is not set");
}

if (!process.env.MONGO_SSL_CERT_PATH) {
  throw new Error("MONGO_SSL_CERT_PATH is not set");
}

// --- Create Mongo client (X.509 auth) ---
const client = new MongoClient(process.env.MONGO_URI, {
  tls: true,
  authMechanism: "MONGODB-X509",
  tlsCertificateKeyFile:process.env.MONGO_SSL_CERT_PATH ,
});

// --- Optional: verify connection on startup ---
export async function connectMongo() {
  if (!client.topology?.isConnected()) {
    await client.connect();
    console.log("✅ MongoDB connected using X.509");
  }
  return client;
}

export default client;
