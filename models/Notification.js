import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please provide notification title"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Please provide notification message"],
    },
    type: {
      type: String,
      enum: [
        "purchase_overdue",
        "sale_overdue",
        "approval_pending",
        "upcoming_due",
        "stock_low",
        "payment_received",
        "payment_made",
        "general",
      ],
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["unread", "read", "archived"],
      default: "unread",
    },
    relatedEntity: {
      entityType: {
        type: String,
        enum: ["purchase", "sale", "approval", "user"],
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },
    actionRequired: {
      type: Boolean,
      default: false,
    },
    actionUrl: {
      type: String,
    },
    metadata: {
      vendorName: String,
      buyerName: String,
      amount: Number,
      dueDate: Date,
      daysOverdue: Number,
      materialCategory: String,
    },
    sentVia: {
      sms: {
        type: Boolean,
        default: false,
      },
      push: {
        type: Boolean,
        default: false,
      },
      email: {
        type: Boolean,
        default: false,
      },
    },
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient querying
notificationSchema.index({ status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, status: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
