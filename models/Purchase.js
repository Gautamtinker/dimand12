import mongoose from "mongoose";

const packetSchema = new mongoose.Schema(
  {
    caret: {
      type: Number,
      required: [true, "Please provide caret weight"],
      min: 0,
    },
    rate: {
      type: Number,
      required: [true, "Please provide rate"],
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
    },
  },
  { _id: true },
);

const purchaseSchema = new mongoose.Schema(
  {
    vendorName: {
      type: String,
      required: [true, "Please provide vendor name"],
      trim: true,
    },
    vendorContact: {
      type: String,
      trim: true,
    },
    vendorPhone: {
      type: String,
      trim: true,
    },
    purchaseDate: {
      type: Date,
      required: [true, "Please provide purchase date"],
      default: Date.now,
    },
    materialCategory: {
      type: String,
      enum: [
        "TLB Filing",
        "TLB Non Filing",
        "Zimbabwe Filing",
        "Zimbabwe Non Filing",
        "Kilwas Filing",
        "Kilwas Non Filing",
      ],
      required: [true, "Please provide material category"],
    },
    packets: {
      type: [packetSchema],
      required: true,
      validate: {
        validator: function (v) {
          return v.length > 0;
        },
        message: "At least one packet is required",
      },
    },
    totalCaret: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    dueDate: {
      type: Date,
      required: [true, "Please provide due date"],
    },
    creditDays: {
      type: Number,
      default: 30,
      enum: [30, 60, 90, 120, 180, 360],
    },
    notes: {
      type: String,
      trim: true,
    },
    outstandingAmount: {
      type: Number,
      default: 0,
    },
    totalPaidAmount: {
      type: Number,
      default: 0,
    },
    isOverdue: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "partial", "completed"],
      default: "pending",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save middleware to calculate totals
purchaseSchema.pre("save", function (next) {
  // Calculate total caret and amount from packets
  this.totalCaret = this.packets.reduce((sum, packet) => sum + packet.caret, 0);
  this.totalAmount = this.packets.reduce(
    (sum, packet) => sum + packet.amount,
    0,
  );
  this.outstandingAmount = this.totalAmount - this.totalPaidAmount;

  // Update status based on payment
  if (this.totalPaidAmount === 0) {
    this.status = "pending";
  } else if (this.totalPaidAmount < this.totalAmount) {
    this.status = "partial";
  } else {
    this.status = "completed";
  }

  // Check if overdue
  this.isOverdue = new Date() > this.dueDate && this.outstandingAmount > 0;

  next();
});

// Static method to get stock summary by category
purchaseSchema.statics.getStockSummary = async function () {
  const summary = await this.aggregate([
    {
      $group: {
        _id: "$materialCategory",
        totalCaret: { $sum: "$totalCaret" },
        totalAmount: { $sum: "$totalAmount" },
      },
    },
  ]);
  return summary;
};

const Purchase = mongoose.model("Purchase", purchaseSchema);

export default Purchase;
