import mongoose from "mongoose";

const brokerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide broker name"],
      trim: true,
      unique: true,
    },
    contact: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    defaultCommissionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    totalCommissionEarned: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const Broker = mongoose.model("Broker", brokerSchema);

export default Broker;
