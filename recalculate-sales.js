import mongoose from "mongoose";
import dotenv from "dotenv";
import Sale from "./models/Sale.js";

dotenv.config();

const recalculateSales = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const sales = await Sale.find({});
    console.log(`Found ${sales.length} sales to recalculate`);

    let updated = 0;
    for (const sale of sales) {
      // Trigger the pre-save middleware by saving the document
      await sale.save();
      updated++;
      if (updated % 10 === 0) {
        console.log(`Updated ${updated} sales...`);
      }
    }

    console.log(`Successfully recalculated ${updated} sales`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error recalculating sales:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

recalculateSales();
