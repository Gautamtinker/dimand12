// Test script to check and send due date notifications
// Run with: node test-due-notifications.js

import dotenv from "dotenv";
dotenv.config();

import { User, Purchase, Sale } from "./models/index.js";
import {
  sendUpcomingDueNotification,
  sendOverduePurchaseNotification,
} from "./services/notificationService.js";

async function test() {
  console.log("=== Testing Due Date Notifications ===");

  // Get all active users
  const users = await User.find({ isActive: true });
  console.log("Found", users.length, "active users");

  users.forEach((u) => {
    console.log("User:", u.name, "Phone:", u.phone || "NOT SET");
  });

  // Check purchases due today or in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const duePurchases = await Purchase.find({
    dueDate: { $lte: today },
    outstandingAmount: { $gt: 0 },
  })
    .sort({ dueDate: 1 })
    .limit(5);

  console.log("\nFound", duePurchases.length, "purchases due or overdue:");
  duePurchases.forEach((p) => {
    console.log(
      "- Vendor:",
      p.vendorName,
      "Due:",
      p.dueDate,
      "Outstanding:",
      p.outstandingAmount,
      "isOverdue:",
      p.isOverdue,
    );
  });

  // Send notifications for upcoming due (including today)
  if (duePurchases.length > 0 && users.length > 0) {
    console.log("\n=== Sending Notifications ===");
    let smsCount = 0;
    for (const purchase of duePurchases) {
      for (const user of users) {
        if (user.phone) {
          console.log("Sending SMS to", user.phone, "for", purchase.vendorName);
          const result = await sendUpcomingDueNotification(
            purchase,
            "purchase",
            user,
          );
          if (result) {
            console.log("Result: Sent (SMS delivered)");
            smsCount++;
          } else {
            console.log("Result: Failed or null (no SMS sent)");
          }
        } else {
          console.log("Skipping", user.name, "- no phone number");
        }
      }
    }
    console.log("\n=== Summary ===");
    console.log("Total SMS sent:", smsCount);
  } else {
    console.log("\nNo due purchases found or no users with phone numbers.");
    console.log(
      "To test, create a purchase with due date <= today and outstanding amount > 0",
    );
  }

  process.exit(0);
}

test().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
