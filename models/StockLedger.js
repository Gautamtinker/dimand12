import mongoose from "mongoose";

const stockLedgerSchema = new mongoose.Schema(
  {
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
      required: true,
    },
    transactionType: {
      type: String,
      enum: ["purchase", "sale", "approval_sold", "approval_returned"],
      required: true,
    },
    caretChange: {
      type: Number,
      required: true,
    },
    runningBalance: {
      type: Number,
      required: true,
    },
    rate: {
      type: Number,
    },
    amount: {
      type: Number,
    },
    referenceEntity: {
      type: String,
      enum: ["purchase", "sale", "approval"],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    notes: {
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

// Index for efficient querying
stockLedgerSchema.index({ materialCategory: 1, createdAt: -1 });
stockLedgerSchema.index({ referenceEntity: 1, referenceId: 1 });

// Static method to get current stock by category
stockLedgerSchema.statics.getCurrentStock = async function () {
  const categories = [
    "TLB Filing",
    "TLB Non Filing",
    "Zimbabwe Filing",
    "Zimbabwe Non Filing",
    "Kilwas Filing",
    "Kilwas Non Filing",
  ];

  const stock = {};
  let totalCaret = 0;

  for (const category of categories) {
    const ledgerEntries = await this.find({ materialCategory: category })
      .sort({ createdAt: -1 })
      .limit(1);

    const categoryCaret =
      ledgerEntries.length > 0 ? ledgerEntries[0].runningBalance : 0;
    stock[category] = categoryCaret;
    totalCaret += categoryCaret;
  }

  stock.total = totalCaret;
  return stock;
};

// Static method to get stock value
stockLedgerSchema.statics.getStockValue = async function () {
  const result = await this.aggregate([
    {
      $group: {
        _id: "$materialCategory",
        totalCaret: { $last: "$runningBalance" },
        avgRate: { $avg: "$rate" },
      },
    },
    {
      $project: {
        materialCategory: "$_id",
        totalCaret: 1,
        avgRate: 1,
        estimatedValue: { $multiply: ["$totalCaret", "$avgRate"] },
      },
    },
  ]);

  return result;
};

const StockLedger = mongoose.model("StockLedger", stockLedgerSchema);

export default StockLedger;
