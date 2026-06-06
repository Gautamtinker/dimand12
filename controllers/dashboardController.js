import {
  Purchase,
  Sale,
  Approval,
  StockLedger,
  Notification,
  PurchasePayment,
  SalePayment,
  User,
} from "../models/index.js";
import {
  sendOverduePurchaseNotification,
  sendOverdueSaleNotification,
  sendUpcomingDueNotification,
} from "../services/notificationService.js";

// Get Socket.IO instance from app
let io = null;
export const setIO = (ioInstance) => {
  io = ioInstance;
};

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  try {
    // Get purchased caret from purchases (sum ALL purchases)
    const purchaseStats = await Purchase.aggregate([
      {
        $group: {
          _id: "$materialCategory",
          totalCaret: { $sum: { $ifNull: ["$totalCaret", 0] } },
          totalAmount: { $sum: { $ifNull: ["$totalAmount", 0] } },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 1,
          totalCaret: 1,
          totalAmount: 1,
          count: 1,
          avgRate: {
            $cond: [
              { $gt: ["$totalCaret", 0] },
              { $divide: ["$totalAmount", "$totalCaret"] },
              0,
            ],
          },
        },
      },
    ]);

    // Get sold caret from sales (sum ALL sales)
    const saleStats = await Sale.aggregate([
      {
        $group: {
          _id: "$materialCategory",
          totalCaret: { $sum: { $ifNull: ["$totalCaret", 0] } },
        },
      },
    ]);

    // Build current stock object (purchased - sold)
    const currentStock = {};
    let totalStock = 0;
    const categories = [
      "TLB Filing",
      "TLB Non Filing",
      "Zimbabwe Filing",
      "Zimbabwe Non Filing",
      "Kilwas Filing",
      "Kilwas Non Filing",
    ];

    for (const cat of categories) {
      const purchased = purchaseStats.find((p) => p._id === cat);
      const sold = saleStats.find((s) => s._id === cat);
      const purchasedCaret = purchased ? purchased.totalCaret : 0;
      const soldCaret = sold ? sold.totalCaret : 0;
      currentStock[cat] = purchasedCaret - soldCaret;
      totalStock += currentStock[cat];
    }
    currentStock.total = totalStock;

    // Get stock value
    const stockValue = purchaseStats.map((p) => ({
      materialCategory: p._id,
      totalCaret: p.totalCaret,
      avgRate: p.avgRate,
      estimatedValue: p.totalCaret * (p.avgRate || 0),
    }));

    // Calculate total stock value
    const totalStockValue = stockValue.reduce(
      (sum, item) => sum + (item.estimatedValue || 0),
      0,
    );

    // Get purchase outstanding
    const purchaseOutstanding = await Purchase.aggregate([
      { $match: { status: { $ne: "completed" } } },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: "$outstandingAmount" },
        },
      },
    ]);

    // Get sales receivable
    const salesReceivable = await Sale.aggregate([
      { $match: { status: { $ne: "completed" } } },
      {
        $group: {
          _id: null,
          totalReceivable: { $sum: "$outstandingAmount" },
        },
      },
    ]);

    // Get stock by category (TLB, Zimbabwe, Kilwas)
    const tlbFiling = currentStock["TLB Filing"] || 0;
    const tlbNonFiling = currentStock["TLB Non Filing"] || 0;
    const zimbabweFiling = currentStock["Zimbabwe Filing"] || 0;
    const zimbabweNonFiling = currentStock["Zimbabwe Non Filing"] || 0;
    const kilwasFiling = currentStock["Kilwas Filing"] || 0;
    const kilwasNonFiling = currentStock["Kilwas Non Filing"] || 0;

    // Get pending approvals
    const pendingApprovals = await Approval.aggregate([
      { $match: { status: { $in: ["pending", "partial"] } } },
      {
        $group: {
          _id: null,
          totalPendingCaret: { $sum: "$pendingCaret" },
        },
      },
    ]);

    // Get unread notifications count
    const unreadNotifications = await Notification.countDocuments({
      status: "unread",
    });

    // Get overdue purchases count
    const overduePurchases = await Purchase.countDocuments({
      isOverdue: true,
      outstandingAmount: { $gt: 0 },
    });

    // Get overdue sales count
    const overdueSales = await Sale.countDocuments({
      isOverdue: true,
      outstandingAmount: { $gt: 0 },
    });

    res.status(200).json({
      success: true,
      data: {
        // Main dashboard cards
        totalStock: currentStock.total || 0,
        totalPacketCount: await Purchase.countDocuments(),
        totalStockValue: totalStockValue,
        totalPurchaseOutstanding: purchaseOutstanding[0]?.totalOutstanding || 0,
        totalSalesReceivable: salesReceivable[0]?.totalReceivable || 0,

        // Category-wise breakdown
        categories: {
          TLB: {
            totalCaret: tlbFiling + tlbNonFiling,
            filingCaret: tlbFiling,
            nonFilingCaret: tlbNonFiling,
          },
          Zimbabwe: {
            totalCaret: zimbabweFiling + zimbabweNonFiling,
            filingCaret: zimbabweFiling,
            nonFilingCaret: zimbabweNonFiling,
          },
          Kilwas: {
            totalCaret: kilwasFiling + kilwasNonFiling,
            filingCaret: kilwasFiling,
            nonFilingCaret: kilwasNonFiling,
          },
        },

        // Alerts
        pendingApprovals: pendingApprovals[0]?.totalPendingCaret || 0,
        unreadNotifications,
        overduePurchases,
        overdueSales,

        // Detailed stock by category
        stockByCategory: stockValue,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get notifications for dashboard
// @route   GET /api/dashboard/notifications
// @access  Private
export const getDashboardNotifications = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    // Get today's date at start of day for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get notifications sorted by priority and date relevance
    // Priority order: urgent > high > medium > low
    // For same priority, sort by due date (closest first) then by createdAt
    const notifications = await Notification.find()
      .sort({ priority: -1, "metadata.dueDate": 1, createdAt: -1 })
      .limit(parseInt(limit))
      .populate("createdBy", "name email");

    // Group by type
    const overduePurchaseParchi = notifications.filter(
      (n) => n.type === "purchase_overdue",
    );
    const overdueSalesRecovery = notifications.filter(
      (n) => n.type === "sale_overdue",
    );
    const pendingApprovalMaterials = notifications.filter(
      (n) => n.type === "approval_pending",
    );
    const upcomingDueDates = notifications.filter(
      (n) => n.type === "upcoming_due",
    );

    res.status(200).json({
      success: true,
      data: {
        all: notifications,
        overduePurchaseParchi,
        overdueSalesRecovery,
        pendingApprovalMaterials,
        upcomingDueDates,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
// @route   PUT /api/dashboard/notifications/:id/read
// @access  Private
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    notification.status = "read";
    notification.readBy.push({
      user: req.user.id,
      readAt: Date.now(),
    });

    await notification.save();

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/dashboard/notifications/read-all
// @access  Private
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { status: "unread" },
      {
        $set: { status: "read" },
        $push: {
          readBy: {
            user: req.user.id,
            readAt: Date.now(),
          },
        },
      },
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually trigger overdue payment check
// @route   POST /api/dashboard/check-overdue
// @access  Private (Admin)
export const triggerOverdueCheck = async (req, res, next) => {
  try {
    console.log("Manual overdue check triggered");

    // Get all users for notifications
    const users = await User.find({ isActive: true });

    let notificationsCreated = 0;

    // Check overdue purchases (due date is today or has passed)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today

    const overduePurchases = await Purchase.find({
      dueDate: { $lte: today },
      outstandingAmount: { $gt: 0 },
      isOverdue: false,
    });

    for (const purchase of overduePurchases) {
      purchase.isOverdue = true;
      await purchase.save();

      for (const user of users) {
        await sendOverduePurchaseNotification(purchase, user);
        if (io) {
          io.to(`user_${user._id}`).emit("notification", {
            type: "purchase_overdue",
            title: "Parchi Pak Gayi",
            message: `Payment overdue for ${purchase.vendorName}`,
          });
        }
        notificationsCreated++;
      }
    }

    // Check overdue sales (due date is today or has passed)
    const overdueSales = await Sale.find({
      dueDate: { $lte: today },
      outstandingAmount: { $gt: 0 },
      isOverdue: false,
    });

    for (const sale of overdueSales) {
      sale.isOverdue = true;
      await sale.save();

      for (const user of users) {
        await sendOverdueSaleNotification(sale, user);
        if (io) {
          io.to(`user_${user._id}`).emit("notification", {
            type: "sale_overdue",
            title: "Sale Recovery Overdue",
            message: `Payment overdue from ${sale.buyerName}`,
          });
        }
        notificationsCreated++;
      }
    }

    // Check upcoming due dates (due date >= today, not just within 3 days)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const upcomingPurchases = await Purchase.find({
      dueDate: {
        $gte: todayStart,
      },
      outstandingAmount: { $gt: 0 },
      isOverdue: false,
    }).sort({ dueDate: 1 });

    for (const purchase of upcomingPurchases) {
      for (const user of users) {
        await sendUpcomingDueNotification(purchase, "purchase", user);
        notificationsCreated++;
      }
    }

    const upcomingSales = await Sale.find({
      dueDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      outstandingAmount: { $gt: 0 },
    });

    for (const sale of upcomingSales) {
      for (const user of users) {
        await sendUpcomingDueNotification(sale, "sale", user);
        notificationsCreated++;
      }
    }

    res.status(200).json({
      success: true,
      message: "Overdue check completed",
      data: {
        notificationsCreated,
        overduePurchases: overduePurchases.length,
        overdueSales: overdueSales.length,
        upcomingPurchases: upcomingPurchases.length,
        upcomingSales: upcomingSales.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get purchase due notifications (due date <= today, i.e., due today or overdue)
// @route   GET /api/dashboard/upcoming-dues
// @access  Private
export const getUpcomingPurchaseDues = async (req, res, next) => {
  try {
    // Get today's date at start of day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all purchases with due date <= today (due today or overdue) and outstanding amount > 0
    const upcomingPurchases = await Purchase.find({
      dueDate: { $lte: today },
      outstandingAmount: { $gt: 0 },
    })
      .sort({ dueDate: 1 }) // Sort by due date (oldest first)
      .limit(20); // Limit to 20 results

    // Format notifications with full purchase details
    const notifications = upcomingPurchases.map((purchase) => {
      const dueDate = new Date(purchase.dueDate);
      const daysUntilDue = Math.floor(
        (dueDate - today) / (1000 * 60 * 60 * 24),
      );
      const purchaseDate = new Date(purchase.purchaseDate).toLocaleDateString(
        "en-IN",
      );
      const dueDateStr = dueDate.toLocaleDateString("en-IN");
      const rate =
        purchase.totalAmount && purchase.totalCaret
          ? (purchase.totalAmount / purchase.totalCaret).toFixed(2)
          : 0;

      const message = `PURCHASE DUE NOTIFICATION

Date: ${purchaseDate}
Vendor: ${purchase.vendorName}
Category: ${purchase.materialCategory}
Caret: ${purchase.totalCaret?.toFixed(2) || 0} ct
Rate: ₹${rate}/ct
Total Amount: ₹${purchase.totalAmount?.toLocaleString() || 0}
Paid Amount: ₹${purchase.totalPaidAmount?.toLocaleString() || 0}
Outstanding: ₹${purchase.outstandingAmount?.toLocaleString() || 0}
Due Date: ${dueDateStr}
Credit Days: ${purchase.creditDays || 30} days
Status: ${purchase.status?.toUpperCase() || "PENDING"}
Days Until Due: ${daysUntilDue} day(s)

${daysUntilDue === 0 ? "Payment is due TODAY!" : daysUntilDue < 0 ? `Payment is OVERDUE by ${Math.abs(daysUntilDue)} day(s)!` : `Payment due in ${daysUntilDue} day(s). Please arrange payment.`}`;

      return {
        _id: `purchase_${purchase._id}`,
        title: `${purchase.vendorName} - Due: ₹${purchase.outstandingAmount?.toLocaleString() || 0}`,
        message,
        type: "upcoming_due",
        priority: daysUntilDue === 0 ? "urgent" : "high",
        relatedEntity: {
          entityType: "purchase",
          entityId: purchase._id,
        },
        actionRequired: true,
        actionUrl: `/purchases/${purchase._id}`,
        metadata: {
          vendorName: purchase.vendorName,
          materialCategory: purchase.materialCategory,
          purchaseDate: purchase.purchaseDate,
          dueDate: purchase.dueDate,
          totalCaret: purchase.totalCaret,
          totalAmount: purchase.totalAmount,
          paidAmount: purchase.totalPaidAmount,
          outstandingAmount: purchase.outstandingAmount,
          rate,
          status: purchase.status,
          daysUntilDue,
          creditDays: purchase.creditDays,
        },
        createdAt: purchase.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        count: notifications.length,
        notifications,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sale due notifications (due date <= today, i.e., due today or overdue)
// @route   GET /api/dashboard/upcoming-sale-dues
// @access  Private
export const getUpcomingSaleDues = async (req, res, next) => {
  try {
    // Get today's date at start of day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all sales with due date <= today (due today or overdue) and outstanding amount > 0
    const upcomingSales = await Sale.find({
      dueDate: { $lte: today },
      outstandingAmount: { $gt: 0 },
    })
      .sort({ dueDate: 1 }) // Sort by due date (oldest first)
      .limit(20); // Limit to 20 results

    // Format notifications with full sale details
    const notifications = upcomingSales.map((sale) => {
      const dueDate = new Date(sale.dueDate);
      const daysUntilDue = Math.floor(
        (dueDate - today) / (1000 * 60 * 60 * 24),
      );
      const saleDate = new Date(sale.saleDate).toLocaleDateString("en-IN");
      const dueDateStr = dueDate.toLocaleDateString("en-IN");

      const message = `SALE DUE NOTIFICATION

Date: ${saleDate}
Buyer: ${sale.buyerName}
Category: ${sale.materialCategory}
Caret: ${sale.totalCaret?.toFixed(2) || 0} ct
Total Amount: ₹${sale.netAmount?.toLocaleString() || 0}
Received Amount: ₹${sale.totalReceivedAmount?.toLocaleString() || 0}
Outstanding: ₹${sale.outstandingAmount?.toLocaleString() || 0}
Due Date: ${dueDateStr}
Credit Days: ${sale.creditDays || 30} days
Status: ${sale.status?.toUpperCase() || "PENDING"}
Days Until Due: ${daysUntilDue} day(s)

${daysUntilDue === 0 ? "Payment is due TODAY!" : daysUntilDue < 0 ? `Payment is OVERDUE by ${Math.abs(daysUntilDue)} day(s)!` : `Payment due in ${daysUntilDue} day(s). Please collect payment.`}`;

      return {
        _id: `sale_${sale._id}`,
        title: `${sale.buyerName} - Due: ₹${sale.outstandingAmount?.toLocaleString() || 0}`,
        message,
        type: "sale_due",
        priority: daysUntilDue === 0 ? "urgent" : "high",
        relatedEntity: {
          entityType: "sale",
          entityId: sale._id,
        },
        actionRequired: true,
        actionUrl: `/sales/${sale._id}`,
        metadata: {
          buyerName: sale.buyerName,
          materialCategory: sale.materialCategory,
          saleDate: sale.saleDate,
          dueDate: sale.dueDate,
          totalCaret: sale.totalCaret,
          totalAmount: sale.netAmount,
          receivedAmount: sale.totalReceivedAmount,
          outstandingAmount: sale.outstandingAmount,
          status: sale.status,
          daysUntilDue,
          creditDays: sale.creditDays,
        },
        createdAt: sale.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        count: notifications.length,
        notifications,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Test SMS configuration
// @route   POST /api/dashboard/test-sms
// @access  Private (Admin)
export const testSMS = async (req, res, next) => {
  try {
    const { phone, message } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const testMessage =
      message ||
      `Test SMS from Diamond Trading App - ${new Date().toISOString()}`;

    console.log("Testing SMS with phone:", phone);
    console.log("Twilio config check:", {
      accountSid: process.env.TWILIO_ACCOUNT_SID ? "Set" : "NOT SET",
      authToken: process.env.TWILIO_AUTH_TOKEN ? "Set" : "NOT SET",
      phoneNumber: process.env.TWILIO_PHONE_NUMBER ? "Set" : "NOT SET",
    });

    const { sendSMS } = await import("../services/notificationService.js");
    const result = await sendSMS(phone, testMessage);

    if (result) {
      res.status(200).json({
        success: true,
        message: "Test SMS sent successfully",
        data: { phone, message: testMessage },
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to send test SMS. Check Twilio configuration.",
      });
    }
  } catch (error) {
    console.error("Test SMS error:", error);
    next(error);
  }
};

// @desc    Get cash flow summary
// @route   GET /api/dashboard/cashflow
// @access  Private
export const getCashFlowSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};

    if (startDate && endDate) {
      query.paymentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Total purchase payments (outflow)
    const purchasePayments = await PurchasePayment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalOutflow: { $sum: "$amount" },
        },
      },
    ]);

    // Total sale payments received (inflow)
    const salePayments = await SalePayment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalInflow: { $sum: "$amount" },
        },
      },
    ]);

    const totalInflow = salePayments[0]?.totalInflow || 0;
    const totalOutflow = purchasePayments[0]?.totalOutflow || 0;
    const netCashFlow = totalInflow - totalOutflow;

    // Group by payment method
    const inflowByMethod = await SalePayment.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$amount" },
        },
      },
    ]);

    const outflowByMethod = await PurchasePayment.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$amount" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalInflow,
        totalOutflow,
        netCashFlow,
        inflowByMethod,
        outflowByMethod,
      },
    });
  } catch (error) {
    next(error);
  }
};
