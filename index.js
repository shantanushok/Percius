import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import { connectMongo } from "./src/config/mongodb.js";
import sdgRoutes from "./src/routes/sdgRoutes.js";
import { createGraphQLMiddleware } from "./src/routes/sdgvalues.js"; 
import indicatorRoutes from "./src/routes/sdgMeaning.js"

dotenv.config();
const app = express();

// 🧩 Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(bodyParser.json());

// 🧠 REST API routes
app.use("/api/sdg", sdgRoutes);

// 🚀 Initialize GraphQL middleware
console.log("🚀 Initializing GraphQL Middleware...");
const graphQLMiddleware = await createGraphQLMiddleware(); // ✅ await it here
app.use("/graphql-a", graphQLMiddleware);
app.use("/graphql-b", graphQLMiddleware);
console.log("✅ GraphQL middleware initialized and ready.");

// 🗄️ MongoDB connection
await connectMongo();

// ✅ REST routes
app.use("/api/indicators", indicatorRoutes);


// 🗄️ Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
