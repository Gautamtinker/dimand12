import mongoose from "mongoose";

const packetSchema = new mongoose.Schema(
  {
    range: {
      type: String,
      trim: true,
    },
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
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    amount: {
      type: Number,
      required: true,
    },
  },
  { _id: true },
);

const brokerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    amount: {
      type: Number,
      default: 0,
    },
  },
  { _id: true },
);

const saleSchema = new mongoose.Schema(
  {
    buyerName: {
      type: String,
      required: [true, "Please provide buyer name"],
      trim: true,
    },
    buyerContact: {
      type: String,
      trim: true,
    },
    buyerPhone: {
      type: String,
      trim: true,
    },
    saleDate: {
      type: Date,
      required: [true, "Please provide sale date"],
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
    brokers: {
      type: [brokerSchema],
      default: [],
    },
    totalCaret: {
      type: Number,
      default: 0,
    },
    grossAmount: {
      type: Number,
      default: 0,
    },
    totalBrokerCommission: {
      type: Number,
      default: 0,
    },
    netAmount: {
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
    globalDeduction: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    globalDeductionAmount: {
      type: Number,
      default: 0,
    },
    outstandingAmount: {
      type: Number,
      default: 0,
    },
    totalReceivedAmount: {
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
    isFromApproval: {
      type: Boolean,
      default: false,
    },
    approvalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Approval",
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save middleware to calculate totals
saleSchema.pre("save", function (next) {
  // Calculate total caret and gross amount from packets
  this.totalCaret = this.packets.reduce((sum, packet) => sum + packet.caret, 0);
  this.grossAmount = this.packets.reduce(
    (sum, packet) => sum + packet.amount,
    0,
  );

  // Calculate broker commissions
  this.totalBrokerCommission = this.brokers.reduce((sum, broker) => {
    broker.amount = (this.grossAmount * (broker.percentage || 0)) / 100;
    return sum + broker.amount;
  }, 0);

  // Calculate global deduction
  this.globalDeductionAmount =
    (this.grossAmount * (this.globalDeduction || 0)) / 100;

  // Calculate net amount
  this.netAmount =
    this.grossAmount - this.totalBrokerCommission - this.globalDeductionAmount;
  this.outstandingAmount = this.netAmount - this.totalReceivedAmount;

  // Update status based on payment
  if (this.totalReceivedAmount === 0) {
    this.status = "pending";
  } else if (this.totalReceivedAmount < this.netAmount) {
    this.status = "partial";
  } else {
    this.status = "completed";
  }

  // Check if overdue
  this.isOverdue = new Date() > this.dueDate && this.outstandingAmount > 0;

  next();
});

const Sale = mongoose.model("Sale", saleSchema);

export default Sale;
