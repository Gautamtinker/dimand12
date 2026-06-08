import {
  Purchase,
  PurchasePayment,
  StockLedger,
  Notification,
  AuditLog,
} from "../models/index.js";

// @desc    Get all purchases with filters
// @route   GET /api/purchases
// @access  Private
export const getPurchases = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      materialCategory,
      vendorName,
      status,
      startDate,
      endDate,
      isOverdue,
    } = req.query;

    const query = {};

    if (materialCategory) query.materialCategory = materialCategory;
    if (vendorName) query.vendorName = { $regex: vendorName, $options: "i" };
    if (status) query.status = status;
    if (isOverdue !== undefined) query.isOverdue = isOverdue === "true";
    if (startDate && endDate) {
      query.purchaseDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const skip = (page - 1) * limit;

    const purchases = await Purchase.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(skip)
      .populate("createdBy", "name email");

    const count = await Purchase.countDocuments(query);

    res.status(200).json({
      success: true,
      data: purchases,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single purchase
// @route   GET /api/purchases/:id
// @access  Private
export const getPurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    // Get payment history
    const payments = await PurchasePayment.find({ purchase: req.params.id })
      .sort({ paymentDate: -1 })
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      data: {
        ...purchase.toObject(),
        payments,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create purchase
// @route   POST /api/purchases
// @access  Private
export const createPurchase = async (req, res, next) => {
  try {
    const {
      vendorName,
      vendorContact,
      vendorPhone,
      purchaseDate,
      materialCategory,
      packets,
      dueDate,
      creditDays,
      notes,
    } = req.body;

    // Calculate packet amounts and totals
    const processedPackets = packets.map((packet) => ({
      range: packet.range,
      caret: packet.caret,
      rate: packet.rate,
      amount: packet.caret * packet.rate,
    }));

    // Calculate totalCaret and totalAmount
    const totalCaret = processedPackets.reduce((sum, p) => sum + p.caret, 0);
    const totalAmount = processedPackets.reduce((sum, p) => sum + p.amount, 0);

    const purchase = await Purchase.create({
      vendorName,
      vendorContact,
      vendorPhone,
      purchaseDate: purchaseDate || Date.now(),
      materialCategory,
      packets: processedPackets,
      dueDate,
      creditDays,
      notes,
      createdBy: req.user.id,
      totalCaret,
      totalAmount,
      outstandingAmount: totalAmount, // Initially full amount is outstanding
    });

    // Get previous running balance for this category
    const lastEntry = await StockLedger.findOne({ materialCategory })
      .sort({ createdAt: -1 })
      .exec();
    const previousBalance = lastEntry ? lastEntry.runningBalance : 0;
    const newRunningBalance = previousBalance + purchase.totalCaret;

    // Create stock ledger entry
    await StockLedger.create({
      materialCategory,
      transactionType: "purchase",
      caretChange: purchase.totalCaret,
      runningBalance: newRunningBalance,
      rate: purchase.totalAmount / purchase.totalCaret,
      amount: purchase.totalAmount,
      referenceEntity: "purchase",
      referenceId: purchase._id,
      createdBy: req.user.id,
    });

    // Create audit log
    await AuditLog.create({
      action: "create",
      entityType: "purchase",
      entityId: purchase._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { after: purchase },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update purchase
// @route   PUT /api/purchases/:id
// @access  Private
export const updatePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    const updatedPurchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    // Create audit log
    await AuditLog.create({
      action: "update",
      entityType: "purchase",
      entityId: purchase._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { before: purchase, after: updatedPurchase },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: updatedPurchase,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete purchase
// @route   DELETE /api/purchases/:id
// @access  Private
export const deletePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    await purchase.deleteOne();

    // Create audit log
    await AuditLog.create({
      action: "delete",
      entityType: "purchase",
      entityId: purchase._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { before: purchase },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Purchase deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get purchase summary/statistics
// @route   GET /api/purchases/summary
// @access  Private
export const getPurchaseSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};

    if (startDate && endDate) {
      query.purchaseDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Total purchase amount and caret
    const totals = await Purchase.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" },
          totalCaret: { $sum: "$totalCaret" },
          totalOutstanding: { $sum: "$outstandingAmount" },
        },
      },
    ]);

    // Group by material category
    const byCategory = await Purchase.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$materialCategory",
          totalCaret: { $sum: "$totalCaret" },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);

    // Pending amount
    const pendingQuery = { ...query, status: { $ne: "completed" } };
    const pendingTotals = await Purchase.aggregate([
      { $match: pendingQuery },
      {
        $group: {
          _id: null,
          pendingAmount: { $sum: "$outstandingAmount" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalAmount: totals[0]?.totalAmount || 0,
        totalCaret: totals[0]?.totalCaret || 0,
        totalOutstanding: totals[0]?.totalOutstanding || 0,
        pendingAmount: pendingTotals[0]?.pendingAmount || 0,
        byCategory,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check for overdue purchases and create notifications
// @route   POST /api/purchases/check-overdue
// @access  Private (Admin)
export const checkOverduePurchases = async (req, res, next) => {
  try {
    const now = new Date();
    const overduePurchases = await Purchase.find({
      dueDate: { $lt: now },
      outstandingAmount: { $gt: 0 },
      isOverdue: false,
    });

    const notifications = [];

    for (const purchase of overduePurchases) {
      const daysOverdue = Math.floor(
        (now - new Date(purchase.dueDate)) / (1000 * 60 * 60 * 24),
      );

      // Update purchase overdue status
      purchase.isOverdue = true;
      await purchase.save();

      // Create notification
      const notification = await Notification.create({
        title: "Parchi Pak Gayi - Purchase Overdue",
        message: `Payment overdue for ${purchase.vendorName}`,
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
          amount: purchase.outstandingAmount,
          dueDate: purchase.dueDate,
          daysOverdue,
        },
        createdBy: req.user?.id,
      });

      notifications.push(notification);

      // TODO: Send SMS notification
      // TODO: Send push notification
    }

    res.status(200).json({
      success: true,
      data: {
        overdueCount: overduePurchases.length,
        notifications,
      },
    });
  } catch (error) {
    next(error);
  }
};
