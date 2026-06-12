import {
  Sale,
  SalePayment,
  StockLedger,
  Notification,
  AuditLog,
  Approval,
} from "../models/index.js";

// @desc    Get all sales with filters
// @route   GET /api/sales
// @access  Private
export const getSales = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      materialCategory,
      buyerName,
      status,
      startDate,
      endDate,
      isOverdue,
      isFromApproval,
    } = req.query;

    const query = {};

    if (materialCategory) query.materialCategory = materialCategory;
    if (buyerName) query.buyerName = { $regex: buyerName, $options: "i" };
    if (status) query.status = status;
    if (isOverdue !== undefined) query.isOverdue = isOverdue === "true";
    if (isFromApproval !== undefined)
      query.isFromApproval = isFromApproval === "true";
    if (startDate && endDate) {
      query.saleDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const skip = (page - 1) * limit;

    const sales = await Sale.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(skip)
      .populate("createdBy", "name email");

    const count = await Sale.countDocuments(query);

    res.status(200).json({
      success: true,
      data: sales,
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

// @desc    Get single sale
// @route   GET /api/sales/:id
// @access  Private
export const getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("approvalId");

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Get payment history
    const payments = await SalePayment.find({ sale: req.params.id })
      .sort({ paymentDate: -1 })
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      data: {
        ...sale.toObject(),
        payments,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create sale
// @route   POST /api/sales
// @access  Private
export const createSale = async (req, res, next) => {
  try {
    const {
      buyerName,
      buyerContact,
      buyerPhone,
      saleDate,
      materialCategory,
      packets,
      brokers,
      dueDate,
      creditDays,
      notes,
      globalDeduction,
      out,
      isFromApproval,
      approvalId,
    } = req.body;

    // Calculate total caret from packets
    const totalCaret = packets.reduce((sum, p) => sum + (p.caret || 0), 0);

    const sale = await Sale.create({
      buyerName,
      buyerContact,
      buyerPhone,
      saleDate: saleDate || Date.now(),
      materialCategory,
      packets: packets || [],
      brokers: brokers || [],
      dueDate,
      creditDays,
      notes,
      globalDeduction: globalDeduction || 0,
      out: out || 0,
      isFromApproval: isFromApproval || false,
      approvalId: approvalId || null,
      createdBy: req.user.id,
    });

    // Create stock ledger entry (reduce stock)
    const currentStock = await StockLedger.getCurrentStock();
    const categoryStock = currentStock[materialCategory] || 0;

    await StockLedger.create({
      materialCategory,
      transactionType: "sale",
      caretChange: -totalCaret,
      runningBalance: categoryStock - totalCaret,
      rate: packets[0]?.rate || 0,
      amount: sale.netAmount,
      referenceEntity: "sale",
      referenceId: sale._id,
      createdBy: req.user.id,
    });

    // Create audit log
    await AuditLog.create({
      action: "create",
      entityType: "sale",
      entityId: sale._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { after: sale },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: sale,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update sale
// @route   PUT /api/sales/:id
// @access  Private
export const updateSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    const updatedSale = await Sale.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    // Create audit log
    await AuditLog.create({
      action: "update",
      entityType: "sale",
      entityId: sale._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { before: sale, after: updatedSale },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: updatedSale,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete sale
// @route   DELETE /api/sales/:id
// @access  Private
export const deleteSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    await sale.deleteOne();

    // Create audit log
    await AuditLog.create({
      action: "delete",
      entityType: "sale",
      entityId: sale._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { before: sale },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Sale deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sale summary/statistics
// @route   GET /api/sales/summary
// @access  Private
export const getSaleSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};

    if (startDate && endDate) {
      query.saleDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Total sale amount and caret
    const totals = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          grossAmount: { $sum: "$grossAmount" },
          netAmount: { $sum: "$netAmount" },
          totalCaret: { $sum: "$caret" },
          totalBrokerCommission: { $sum: "$totalBrokerCommission" },
          totalReceivable: { $sum: "$outstandingAmount" },
        },
      },
    ]);

    // Group by material category
    const byCategory = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$materialCategory",
          totalCaret: { $sum: "$caret" },
          netAmount: { $sum: "$netAmount" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        grossAmount: totals[0]?.grossAmount || 0,
        netAmount: totals[0]?.netAmount || 0,
        totalCaret: totals[0]?.totalCaret || 0,
        totalBrokerCommission: totals[0]?.totalBrokerCommission || 0,
        totalReceivable: totals[0]?.totalReceivable || 0,
        byCategory,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check for overdue sales and create notifications
// @route   POST /api/sales/check-overdue
// @access  Private (Admin)
export const checkOverdueSales = async (req, res, next) => {
  try {
    const now = new Date();
    const overdueSales = await Sale.find({
      dueDate: { $lt: now },
      outstandingAmount: { $gt: 0 },
      isOverdue: false,
    });

    const notifications = [];

    for (const sale of overdueSales) {
      const daysOverdue = Math.floor(
        (now - new Date(sale.dueDate)) / (1000 * 60 * 60 * 24),
      );

      // Update sale overdue status
      sale.isOverdue = true;
      await sale.save();

      // Create notification
      const notification = await Notification.create({
        title: "Sale Recovery Overdue",
        message: `Payment overdue from ${sale.buyerName}`,
        type: "sale_overdue",
        priority: "urgent",
        relatedEntity: {
          entityType: "sale",
          entityId: sale._id,
        },
        actionRequired: true,
        actionUrl: `/sales/${sale._id}`,
        metadata: {
          buyerName: sale.buyerName,
          amount: sale.outstandingAmount,
          dueDate: sale.dueDate,
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
        overdueCount: overdueSales.length,
        notifications,
      },
    });
  } catch (error) {
    next(error);
  }
};
