import nodemailer from "nodemailer";
import twilio from "twilio";
import { Notification } from "../models/index.js";

// Email transporter
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Email configuration not set up");
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Twilio client
const createTwilioClient = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn("Twilio configuration not set up");
    return null;
  }

  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
};

// Send email notification
export const sendEmail = async (to, subject, message, html = null) => {
  try {
    const transporter = createTransporter();
    if (!transporter) return false;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text: message,
      html: html || `<p>${message}</p>`,
    });

    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
};

// Send SMS notification via Twilio
export const sendSMS = async (to, message) => {
  try {
    // Log configuration status
    console.log("SMS send attempt:", {
      to,
      messageLength: message?.length || 0,
      hasTwilioSid: !!process.env.TWILIO_ACCOUNT_SID,
      hasTwilioToken: !!process.env.TWILIO_AUTH_TOKEN,
      hasTwilioPhone: !!process.env.TWILIO_PHONE_NUMBER,
    });

    const client = createTwilioClient();
    if (!client) {
      console.warn(
        "Twilio client not initialized. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env",
      );
      return false;
    }

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });

    console.log("SMS sent successfully:", result.sid);
    return true;
  } catch (error) {
    console.error("SMS send error:", error.message);
    if (error.code) {
      console.error("Twilio error code:", error.code);
    }
    return false;
  }
};

// Send push notification via Firebase
export const sendPushNotification = async (tokens, title, body, data = {}) => {
  try {
    // This would use Firebase Admin SDK
    // For now, we'll log the notification
    console.log("Push notification:", { tokens, title, body, data });
    return true;
  } catch (error) {
    console.error("Push notification error:", error);
    return false;
  }
};

// Send overdue purchase notification
export const sendOverduePurchaseNotification = async (purchase, user) => {
  const daysOverdue = Math.floor(
    (new Date() - new Date(purchase.dueDate)) / (1000 * 60 * 60 * 24),
  );

  // Format dates for display
  const purchaseDate = new Date(purchase.purchaseDate).toLocaleDateString(
    "en-IN",
  );
  const dueDate = new Date(purchase.dueDate).toLocaleDateString("en-IN");

  // Create detailed message showing complete purchase row information
  const message = `Date: ${purchaseDate}
Vendor: ${purchase.vendorName}
Category: ${purchase.materialCategory}
Caret: ${purchase.totalCaret?.toFixed(2) || 0} ct
Amount: ₹${purchase.totalAmount?.toLocaleString() || 0}
Outstanding: ₹${purchase.outstandingAmount?.toLocaleString() || 0}
Due Date: ${dueDate}
Status: ${purchase.status?.toUpperCase() || "PENDING"}
Days Overdue: ${daysOverdue}

Please pay the outstanding amount of ₹${purchase.outstandingAmount?.toLocaleString() || 0} immediately.`;

  // Create notification record with full details
  const notification = await Notification.create({
    title: `${purchase.vendorName} - Outstanding: ₹${purchase.outstandingAmount?.toLocaleString() || 0}`,
    message,
    type: "purchase_overdue",
    priority: "urgent",
    relatedEntity: {
      entityType: "purchase",
      entityId: purchase._id,
    },
    actionRequired: true,
    actionUrl: `/purchases/${purchase._id}`,
    metadata: {
      vendorName: purchase.vendorName,
      materialCategory: purchase.materialCategory,
      purchaseDate: purchase.purchaseDate,
      dueDate: purchase.dueDate,
      totalCaret: purchase.totalCaret,
      totalAmount: purchase.totalAmount,
      paidAmount: purchase.totalPaidAmount,
      outstandingAmount: purchase.outstandingAmount,
      status: purchase.status,
      daysOverdue,
      creditDays: purchase.creditDays,
    },
  });

  // Send email
  let emailSent = false;
  if (user?.email) {
    emailSent = await sendEmail(
      user.email,
      `${purchase.vendorName} - Payment Due`,
      message,
    );
  }

  // Send SMS (shorter version)
  let smsSent = false;
  if (user?.phone) {
    const smsMessage = `${purchase.vendorName}: ₹${purchase.outstandingAmount?.toLocaleString()} due on ${dueDate}. Days: ${daysOverdue}.`;
    smsSent = await sendSMS(user.phone, smsMessage);
  }

  // Update notification with delivery status
  if (emailSent || smsSent) {
    notification.sentVia = {
      email: emailSent,
      sms: smsSent,
      push: false,
    };
    await notification.save();
  }

  return notification;
};

// Send overdue sale notification
export const sendOverdueSaleNotification = async (sale, user) => {
  const daysOverdue = Math.floor(
    (new Date() - new Date(sale.dueDate)) / (1000 * 60 * 60 * 24),
  );

  const message = `RECOVERY OVERDUE: Payment pending from ${sale.buyerName}. Amount: ₹${sale.outstandingAmount}. Due Date: ${new Date(sale.dueDate).toLocaleDateString()}. Days Overdue: ${daysOverdue}`;

  // Create notification record
  const notification = await Notification.create({
    title: "Sale Recovery Overdue",
    message,
    type: "sale_overdue",
    priority: "urgent",
    relatedEntity: {
      entityType: "sale",
      entityId: sale._id,
    },
    actionRequired: true,
    actionUrl: `/sales/${sale._id}`,
    metadata: {
      buyerName: sale.buyerName,
      amount: sale.outstandingAmount,
      dueDate: sale.dueDate,
      daysOverdue,
    },
  });

  // Send email
  let emailSent = false;
  if (user?.email) {
    emailSent = await sendEmail(user.email, "Sale Recovery Overdue", message);
  }

  // Send SMS
  let smsSent = false;
  if (user?.phone) {
    smsSent = await sendSMS(user.phone, message);
  }

  // Update notification with delivery status
  if (emailSent || smsSent) {
    notification.sentVia = {
      email: emailSent,
      sms: smsSent,
      push: false,
    };
    await notification.save();
  }

  return notification;
};

// Send upcoming due notification for purchases (due date >= today)
export const sendUpcomingDueNotification = async (entity, type, user) => {
  const dueDate = new Date(entity.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

  // Only send if due date is today or in the future
  if (daysUntilDue < 0) return null;

  if (type === "purchase") {
    // Format dates for display
    const purchaseDate = new Date(entity.purchaseDate).toLocaleDateString(
      "en-IN",
    );
    const dueDateStr = dueDate.toLocaleDateString("en-IN");

    // Create detailed message showing complete purchase information
    const message = `PURCHASE DUE NOTIFICATION

Date: ${purchaseDate}
Vendor: ${entity.vendorName}
Category: ${entity.materialCategory}
Caret: ${entity.totalCaret?.toFixed(2) || 0} ct
Rate: ₹${entity.totalAmount && entity.totalCaret ? (entity.totalAmount / entity.totalCaret).toFixed(2) : 0}/ct
Total Amount: ₹${entity.totalAmount?.toLocaleString() || 0}
Paid Amount: ₹${entity.totalPaidAmount?.toLocaleString() || 0}
Outstanding: ₹${entity.outstandingAmount?.toLocaleString() || 0}
Due Date: ${dueDateStr}
Credit Days: ${entity.creditDays || 30} days
Status: ${entity.status?.toUpperCase() || "PENDING"}
Days Until Due: ${daysUntilDue} day(s)

${daysUntilDue === 0 ? "Payment is due TODAY!" : `Payment due in ${daysUntilDue} day(s). Please arrange payment.`}`;

    // Create notification record with full details
    const notification = await Notification.create({
      title: `${entity.vendorName} - Due: ₹${entity.outstandingAmount?.toLocaleString() || 0}`,
      message,
      type: "upcoming_due",
      priority: daysUntilDue === 0 ? "urgent" : "high",
      relatedEntity: {
        entityType: "purchase",
        entityId: entity._id,
      },
      actionRequired: true,
      actionUrl: `/purchases/${entity._id}`,
      metadata: {
        vendorName: entity.vendorName,
        materialCategory: entity.materialCategory,
        purchaseDate: entity.purchaseDate,
        dueDate: entity.dueDate,
        totalCaret: entity.totalCaret,
        totalAmount: entity.totalAmount,
        paidAmount: entity.totalPaidAmount,
        outstandingAmount: entity.outstandingAmount,
        rate:
          entity.totalAmount && entity.totalCaret
            ? (entity.totalAmount / entity.totalCaret).toFixed(2)
            : 0,
        status: entity.status,
        daysUntilDue,
        creditDays: entity.creditDays,
      },
    });

    // Send email
    let emailSent = false;
    if (user?.email) {
      emailSent = await sendEmail(
        user.email,
        `${entity.vendorName} - Payment Due on ${dueDateStr}`,
        message,
      );
    }

    // Send SMS (shorter version)
    let smsSent = false;
    if (user?.phone) {
      const smsMessage = `${entity.vendorName}: ₹${entity.outstandingAmount?.toLocaleString()} due on ${dueDateStr}. Caret: ${entity.totalCaret}ct. ${daysUntilDue === 0 ? "Due TODAY!" : `Due in ${daysUntilDue} days.`}`;
      smsSent = await sendSMS(user.phone, smsMessage);
    }

    // Update notification with delivery status
    if (emailSent || smsSent) {
      notification.sentVia = {
        email: emailSent,
        sms: smsSent,
        push: false,
      };
      await notification.save();
    }

    return notification;
  } else {
    // For sales
    const saleDate = new Date(entity.saleDate).toLocaleDateString("en-IN");
    const dueDateStr = dueDate.toLocaleDateString("en-IN");

    const message = `SALE DUE NOTIFICATION

Date: ${saleDate}
Buyer: ${entity.buyerName}
Category: ${entity.materialCategory}
Caret: ${entity.totalCaret?.toFixed(2) || 0} ct
Total Amount: ₹${entity.totalAmount?.toLocaleString() || 0}
Received Amount: ₹${entity.totalReceivedAmount?.toLocaleString() || 0}
Outstanding: ₹${entity.outstandingAmount?.toLocaleString() || 0}
Due Date: ${dueDateStr}
Days Until Due: ${daysUntilDue} day(s)

${daysUntilDue === 0 ? "Payment is due TODAY!" : `Payment due in ${daysUntilDue} day(s). Please collect payment.`}`;

    const notification = await Notification.create({
      title: `${entity.buyerName} - Due: ₹${entity.outstandingAmount?.toLocaleString() || 0}`,
      message,
      type: "upcoming_due",
      priority: daysUntilDue === 0 ? "urgent" : "medium",
      relatedEntity: {
        entityType: "sale",
        entityId: entity._id,
      },
      actionRequired: true,
      actionUrl: `/sales/${entity._id}`,
      metadata: {
        buyerName: entity.buyerName,
        materialCategory: entity.materialCategory,
        saleDate: entity.saleDate,
        dueDate: entity.dueDate,
        totalCaret: entity.totalCaret,
        totalAmount: entity.totalAmount,
        receivedAmount: entity.totalReceivedAmount,
        outstandingAmount: entity.outstandingAmount,
        daysUntilDue,
      },
    });

    // Send email
    let emailSent = false;
    if (user?.email) {
      emailSent = await sendEmail(
        user.email,
        `${entity.buyerName} - Payment Due on ${dueDateStr}`,
        message,
      );
    }

    // Send SMS
    let smsSent = false;
    if (user?.phone) {
      const smsMessage = `${entity.buyerName}: ₹${entity.outstandingAmount?.toLocaleString()} due on ${dueDateStr}. ${daysUntilDue === 0 ? "Due TODAY!" : `Due in ${daysUntilDue} days.`}`;
      smsSent = await sendSMS(user.phone, smsMessage);
    }

    // Update notification with delivery status
    if (emailSent || smsSent) {
      notification.sentVia = {
        email: emailSent,
        sms: smsSent,
        push: false,
      };
      await notification.save();
    }

    return notification;
  }
};

export default {
  sendEmail,
  sendSMS,
  sendPushNotification,
  sendOverduePurchaseNotification,
  sendOverdueSaleNotification,
  sendUpcomingDueNotification,
};
