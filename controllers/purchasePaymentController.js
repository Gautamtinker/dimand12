import {
  PurchasePayment,
  SalePayment,
  Purchase,
  Sale,
  StockLedger,
  Notification,
  AuditLog,
} from "../models/index.js";

// @desc    Get all purchase payments
// @route   GET /api/purchase-payments
// @access  Private
export const getPurchasePayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, purchase, startDate, endDate } = req.query;

    const query = {};

    if (purchase) query.purchase = purchase;
    if (startDate && endDate) {
      query.paymentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const skip = (page - 1) * limit;

    const payments = await PurchasePayment.find(query)
      .sort({ paymentDate: -1 })
      .limit(limit * 1)
      .skip(skip)
      .populate("purchase", "vendorName totalAmount outstandingAmount")
      .populate("createdBy", "name email");

    const count = await PurchasePayment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: payments,
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

// @desc    Get single purchase payment
// @route   GET /api/purchase-payments/:id
// @access  Private
export const getPurchasePayment = async (req, res, next) => {
  try {
    const payment = await PurchasePayment.findById(req.params.id)
      .populate("purchase")
      .populate("createdBy", "name email");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create purchase payment
// @route   POST /api/purchase-payments
// @access  Private
export const createPurchasePayment = async (req, res, next) => {
  try {
    const {
      purchase,
      paymentDate,
      amount,
      paymentMethod,
      remarks,
      referenceNumber,
    } = req.body;

    // Get purchase to get vendor name
    const purchaseDoc = await Purchase.findById(purchase);

    if (!purchaseDoc) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    // Check if amount is valid
    if (amount > purchaseDoc.outstandingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount cannot exceed outstanding amount (${purchaseDoc.outstandingAmount})`,
      });
    }

    const payment = await PurchasePayment.create({
      purchase,
      vendorName: purchaseDoc.vendorName,
      paymentDate: paymentDate || Date.now(),
      amount,
      paymentMethod,
      remarks,
      referenceNumber,
      createdBy: req.user.id,
    });

    // Update purchase's totalPaidAmount and outstandingAmount
    purchaseDoc.totalPaidAmount = (purchaseDoc.totalPaidAmount || 0) + amount;
    await purchaseDoc.save();

    // Create audit log
    await AuditLog.create({
      action: "create",
      entityType: "payment",
      entityId: payment._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { after: payment },
      ipAddress: req.ip,
    });

    // If purchase is now fully paid, create notification
    if (purchaseDoc.outstandingAmount - amount <= 0) {
      await Notification.create({
        title: "Purchase Paid in Full",
        message: `Purchase from ${purchaseDoc.vendorName} has been fully paid`,
        type: "payment_made",
        priority: "medium",
        relatedEntity: {
          entityType: "purchase",
          entityId: purchase,
        },
        createdBy: req.user.id,
      });
    }

    res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update purchase payment
// @route   PUT /api/purchase-payments/:id
// @access  Private
export const updatePurchasePayment = async (req, res, next) => {
  try {
    const payment = await PurchasePayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const updatedPayment = await PurchasePayment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    // Create audit log
    await AuditLog.create({
      action: "update",
      entityType: "payment",
      entityId: payment._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { before: payment, after: updatedPayment },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: updatedPayment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete purchase payment
// @route   DELETE /api/purchase-payments/:id
// @access  Private
export const deletePurchasePayment = async (req, res, next) => {
  try {
    const payment = await PurchasePayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    await payment.deleteOne();

    // Create audit log
    await AuditLog.create({
      action: "delete",
      entityType: "payment",
      entityId: payment._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { before: payment },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Payment deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get payment history for a purchase
// @route   GET /api/purchases/:id/payments
// @access  Private
export const getPurchasePaymentHistory = async (req, res, next) => {
  try {
    const payments = await PurchasePayment.find({ purchase: req.params.id })
      .sort({ paymentDate: -1 })
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all sale payments
// @route   GET /api/sale-payments
// @access  Private
export const getSalePayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sale, startDate, endDate } = req.query;

    const query = {};

    if (sale) query.sale = sale;
    if (startDate && endDate) {
      query.paymentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const skip = (page - 1) * limit;

    const payments = await SalePayment.find(query)
      .sort({ paymentDate: -1 })
      .limit(limit * 1)
      .skip(skip)
      .populate("sale", "buyerName totalAmount outstandingAmount")
      .populate("createdBy", "name email");

    const count = await SalePayment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: payments,
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

// @desc    Get single sale payment
// @route   GET /api/sale-payments/:id
// @access  Private
export const getSalePayment = async (req, res, next) => {
  try {
    const payment = await SalePayment.findById(req.params.id)
      .populate("sale")
      .populate("createdBy", "name email");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create sale payment
// @route   POST /api/sale-payments
// @access  Private
export const createSalePayment = async (req, res, next) => {
  try {
    const {
      sale,
      paymentDate,
      amount,
      paymentMethod,
      remarks,
      referenceNumber,
    } = req.body;

    // Get sale to get buyer name
    const saleDoc = await Sale.findById(sale);

    if (!saleDoc) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Check if amount is valid
    if (amount > saleDoc.outstandingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount cannot exceed outstanding amount (${saleDoc.outstandingAmount})`,
      });
    }

    const payment = await SalePayment.create({
      sale,
      buyerName: saleDoc.buyerName,
      paymentDate: paymentDate || Date.now(),
      amount,
      paymentMethod,
      remarks,
      referenceNumber,
      createdBy: req.user.id,
    });

    // Update sale's totalReceivedAmount and outstandingAmount
    saleDoc.totalReceivedAmount = (saleDoc.totalReceivedAmount || 0) + amount;
    await saleDoc.save();

    // Create audit log
    await AuditLog.create({
      action: "create",
      entityType: "payment",
      entityId: payment._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { after: payment },
      ipAddress: req.ip,
    });

    // If sale is now fully paid, create notification
    if (saleDoc.outstandingAmount - amount <= 0) {
      await Notification.create({
        title: "Sale Paid in Full",
        message: `Sale to ${saleDoc.buyerName} has been fully paid`,
        type: "payment_received",
        priority: "medium",
        relatedEntity: {
          entityType: "sale",
          entityId: sale,
        },
        createdBy: req.user.id,
      });
    }

    res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update sale payment
// @route   PUT /api/sale-payments/:id
// @access  Private
export const updateSalePayment = async (req, res, next) => {
  try {
    const payment = await SalePayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const updatedPayment = await SalePayment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    // Create audit log
    await AuditLog.create({
      action: "update",
      entityType: "payment",
      entityId: payment._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { before: payment, after: updatedPayment },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: updatedPayment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete sale payment
// @route   DELETE /api/sale-payments/:id
// @access  Private
export const deleteSalePayment = async (req, res, next) => {
  try {
    const payment = await SalePayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    await payment.deleteOne();

    // Create audit log
    await AuditLog.create({
      action: "delete",
      entityType: "payment",
      entityId: payment._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { before: payment },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Payment deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get payment history for a sale
// @route   GET /api/sales/:id/payments
// @access  Private
export const getSalePaymentHistory = async (req, res, next) => {
  try {
    const payments = await SalePayment.find({ sale: req.params.id })
      .sort({ paymentDate: -1 })
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};
