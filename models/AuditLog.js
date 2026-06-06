import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, "Please provide action"],
      enum: [
        "create",
        "update",
        "delete",
        "login",
        "logout",
        "payment",
        "approval",
        "return",
      ],
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        "user",
        "purchase",
        "sale",
        "approval",
        "broker",
        "payment",
        "notification",
      ],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    remarks: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient querying
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// Static method to get activity history for an entity
auditLogSchema.statics.getEntityHistory = async function (
  entityType,
  entityId,
) {
  return await this.find({ entityType, entityId })
    .sort({ createdAt: -1 })
    .populate("user", "name email role");
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
