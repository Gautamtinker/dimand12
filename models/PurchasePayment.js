import mongoose from "mongoose";

const purchasePaymentSchema = new mongoose.Schema(
  {
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      required: [true, "Please provide purchase reference"],
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
    },
    paymentDate: {
      type: Date,
      required: [true, "Please provide payment date"],
      default: Date.now,
    },
    amount: {
      type: Number,
      required: [true, "Please provide payment amount"],
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["NEFT", "RTGS", "UPI", "Cash", "Angadiya", "Cheque"],
      required: [true, "Please provide payment method"],
    },
    remarks: {
      type: String,
      trim: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
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

// Post-save middleware to update purchase outstanding
purchasePaymentSchema.post("save", async function () {
  const Purchase = mongoose.model("Purchase");
  const purchase = await Purchase.findById(this.purchase);

  if (purchase) {
    // Recalculate total paid amount
    const allPayments = await mongoose
      .model("PurchasePayment")
      .find({ purchase: this.purchase });
    const totalPaid = allPayments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    purchase.totalPaidAmount = totalPaid;
    await purchase.save();
  }
});

// Post-delete middleware to update purchase outstanding
purchasePaymentSchema.post("deleteOne", async function () {
  const Purchase = mongoose.model("Purchase");
  const purchase = await Purchase.findById(this.getQuery().purchase);

  if (purchase) {
    const allPayments = await mongoose
      .model("PurchasePayment")
      .find({ purchase: this.getQuery().purchase });
    const totalPaid = allPayments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    purchase.totalPaidAmount = totalPaid;
    await purchase.save();
  }
});

const PurchasePayment = mongoose.model(
  "PurchasePayment",
  purchasePaymentSchema,
);

export default PurchasePayment;
