import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI not found in .env file");
  process.exit(1);
}

console.log(
  "Connecting to:",
  MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@"),
);

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB");

    // Drop all collections
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.drop();
      console.log("Dropped collection:", collection.collectionName);
    }

    console.log("All data cleared successfully!");
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
