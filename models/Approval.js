import mongoose from "mongoose";

const approvalMaterialSchema = new mongoose.Schema(
  {
    materialType: {
      type: String,
      required: [true, "Please provide material type"],
      enum: [
        "TLB Filing",
        "TLB Non Filing",
        "Zimbabwe Filing",
        "Zimbabwe Non Filing",
        "Kilwas Filing",
        "Kilwas Non Filing",
      ],
    },
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
      default: 0,
    },
    amount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "sold", "returned"],
      default: "pending",
    },
    saleDetails: {
      buyerName: {
        type: String,
      },
      saleDate: {
        type: Date,
      },
      rate: {
        type: Number,
      },
      caretSold: {
        type: Number,
      },
      amount: {
        type: Number,
      },
    },
    returnedDate: {
      type: Date,
    },
    soldDate: {
      type: Date,
    },
  },
  { _id: true },
);

const approvalSchema = new mongoose.Schema(
  {
    brokerName: {
      type: String,
      required: [true, "Please provide broker name"],
      trim: true,
    },
    brokerPhone: {
      type: String,
      trim: true,
    },
    dateSent: {
      type: Date,
      required: [true, "Please provide date sent"],
      default: Date.now,
    },
    remarks: {
      type: String,
      trim: true,
    },
    materials: {
      type: [approvalMaterialSchema],
      required: true,
      validate: {
        validator: function (v) {
          return v.length > 0;
        },
        message: "At least one material is required",
      },
    },
    status: {
      type: String,
      enum: ["pending", "partial", "completed", "cancelled"],
      default: "pending",
    },
    totalCaret: {
      type: Number,
      default: 0,
    },
    soldCaret: {
      type: Number,
      default: 0,
    },
    returnedCaret: {
      type: Number,
      default: 0,
    },
    pendingCaret: {
      type: Number,
      default: 0,
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
approvalSchema.pre("save", function (next) {
  this.totalCaret = this.materials.reduce((sum, m) => sum + m.caret, 0);
  this.soldCaret = this.materials
    .filter((m) => m.status === "sold")
    .reduce((sum, m) => sum + (m.saleDetails?.caretSold || m.caret), 0);
  this.returnedCaret = this.materials
    .filter((m) => m.status === "returned")
    .reduce((sum, m) => sum + m.caret, 0);
  this.pendingCaret = this.totalCaret - this.soldCaret - this.returnedCaret;

  // Update overall status
  if (this.pendingCaret === this.totalCaret) {
    this.status = "pending";
  } else if (this.pendingCaret === 0) {
    this.status = "completed";
  } else {
    this.status = "partial";
  }

  next();
});

const Approval = mongoose.model("Approval", approvalSchema);

export default Approval;
