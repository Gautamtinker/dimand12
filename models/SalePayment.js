import mongoose from "mongoose";

const salePaymentSchema = new mongoose.Schema(
  {
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: [true, "Please provide sale reference"],
    },
    buyerName: {
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

// Post-save middleware to update sale outstanding
salePaymentSchema.post("save", async function () {
  const Sale = mongoose.model("Sale");
  const sale = await Sale.findById(this.sale);

  if (sale) {
    // Recalculate total received amount
    const allPayments = await mongoose
      .model("SalePayment")
      .find({ sale: this.sale });
    const totalReceived = allPayments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    sale.totalReceivedAmount = totalReceived;
    await sale.save();
  }
});

// Post-delete middleware to update sale outstanding
salePaymentSchema.post("deleteOne", async function () {
  const Sale = mongoose.model("Sale");
  const sale = await Sale.findById(this.getQuery().sale);

  if (sale) {
    const allPayments = await mongoose
      .model("SalePayment")
      .find({ sale: this.getQuery().sale });
    const totalReceived = allPayments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    sale.totalReceivedAmount = totalReceived;
    await sale.save();
  }
});

const SalePayment = mongoose.model("SalePayment", salePaymentSchema);

export default SalePayment;
