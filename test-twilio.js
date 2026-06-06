// Simple Twilio test script
// Run with: node test-twilio.js

import dotenv from "dotenv";
dotenv.config();

console.log("=== Twilio Configuration Check ===");
console.log(
  "TWILIO_ACCOUNT_SID:",
  process.env.TWILIO_ACCOUNT_SID ? "Set" : "NOT SET",
);
console.log(
  "TWILIO_AUTH_TOKEN:",
  process.env.TWILIO_AUTH_TOKEN ? "Set" : "NOT SET",
);
console.log(
  "TWILIO_PHONE_NUMBER:",
  process.env.TWILIO_PHONE_NUMBER ? "Set" : "NOT SET",
);

if (
  !process.env.TWILIO_ACCOUNT_SID ||
  !process.env.TWILIO_AUTH_TOKEN ||
  !process.env.TWILIO_PHONE_NUMBER
) {
  console.error("ERROR: Missing Twilio configuration in .env file");
  process.exit(1);
}

try {
  const twilio = (await import("twilio")).default;

  console.log("\n=== Creating Twilio Client ===");
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );
  console.log("Twilio client created successfully");

  console.log("\n=== Testing SMS Send ===");
  const toNumber = process.argv[2] || "+919876543210"; // Default test number
  const message =
    process.argv[3] ||
    "Test SMS from Diamond Trading - " + new Date().toISOString();

  console.log(`Sending SMS to: ${toNumber}`);
  console.log(`From: ${process.env.TWILIO_PHONE_NUMBER}`);
  console.log(`Message: ${message}`);

  const result = await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: toNumber,
  });

  console.log("\n=== SUCCESS ===");
  console.log("SMS sent! SID:", result.sid);
  console.log("Status:", result.status);
  console.log("Date Created:", result.dateCreated);
} catch (error) {
  console.error("\n=== ERROR ===");
  console.error("Error type:", error.name);
  console.error("Error message:", error.message);
  console.error("Error code:", error.code);
  console.error("Error status:", error.status);

  if (error.code === 21211) {
    console.error("\n*** INVALID PHONE NUMBER ***");
    console.error(
      'The "to" phone number is not valid. Make sure it includes country code (e.g., +919876543210)',
    );
  } else if (error.code === 21216) {
    console.error("\n*** TRIAL ACCOUNT RESTRICTION ***");
    console.error(
      "Your Twilio trial account can only send SMS to verified numbers.",
    );
    console.error(
      "Go to Twilio Console → Verified Caller IDs and add your destination number.",
    );
  } else if (error.code === 21610) {
    console.error("\n*** TRIAL ACCOUNT RESTRICTION ***");
    console.error(
      "Your Twilio trial account cannot send SMS to this destination.",
    );
  } else if (error.code === 21612) {
    console.error("\n*** INVALID FROM NUMBER ***");
    console.error(
      'The "from" phone number is not valid or not assigned to your account.',
    );
  }

  process.exit(1);
}
