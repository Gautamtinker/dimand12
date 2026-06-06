import {
  Approval,
  Sale,
  StockLedger,
  Notification,
  AuditLog,
} from "../models/index.js";

// @desc    Get all approvals with filters
// @route   GET /api/approvals
// @access  Private
export const getApprovals = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      brokerName,
      status,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (brokerName) query.brokerName = { $regex: brokerName, $options: "i" };
    if (status) query.status = status;
    if (startDate && endDate) {
      query.dateSent = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const skip = (page - 1) * limit;

    const approvals = await Approval.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip(skip)
      .populate("createdBy", "name email");

    const count = await Approval.countDocuments(query);

    res.status(200).json({
      success: true,
      data: approvals,
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

// @desc    Get single approval
// @route   GET /api/approvals/:id
// @access  Private
export const getApproval = async (req, res, next) => {
  try {
    const approval = await Approval.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Approval not found",
      });
    }

    res.status(200).json({
      success: true,
      data: approval,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create approval
// @route   POST /api/approvals
// @access  Private
export const createApproval = async (req, res, next) => {
  try {
    const { brokerName, brokerPhone, dateSent, remarks, materials } = req.body;

    const approval = await Approval.create({
      brokerName,
      brokerPhone,
      dateSent: dateSent || Date.now(),
      remarks,
      materials,
      createdBy: req.user.id,
    });

    // Create audit log
    await AuditLog.create({
      action: "create",
      entityType: "approval",
      entityId: approval._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { after: approval },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: approval,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update approval material status to SOLD
// @route   PUT /api/approvals/:id/materials/:materialId/sold
// @access  Private
export const markMaterialAsSold = async (req, res, next) => {
  try {
    const { approvalId, materialId } = req.params;
    const { buyerName, saleDate, rate, caretSold, amount } = req.body;

    const approval = await Approval.findById(approvalId);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Approval not found",
      });
    }

    const material = approval.materials.id(materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    // Update material status
    material.status = "sold";
    material.saleDetails = {
      buyerName,
      saleDate: saleDate || Date.now(),
      rate,
      caretSold: caretSold || material.caret,
      amount,
    };
    material.soldDate = Date.now();

    await approval.save();

    // Create corresponding sale entry
    const sale = await Sale.create({
      buyerName,
      saleDate: saleDate || Date.now(),
      materialCategory: material.materialType,
      caret: caretSold || material.caret,
      rate,
      brokers: [],
      dueDate: saleDate || Date.now(),
      creditDays: 30,
      isFromApproval: true,
      approvalId: approval._id,
      createdBy: req.user.id,
    });

    // Update stock ledger (reduce stock)
    const currentStock = await StockLedger.getCurrentStock();
    const categoryStock = currentStock[material.materialType] || 0;

    await StockLedger.create({
      materialCategory: material.materialType,
      transactionType: "approval_sold",
      caretChange: -(caretSold || material.caret),
      runningBalance: categoryStock - (caretSold || material.caret),
      rate,
      amount,
      referenceEntity: "approval",
      referenceId: approval._id,
      notes: `Sold via approval - Sale ID: ${sale._id}`,
      createdBy: req.user.id,
    });

    // Create audit log
    await AuditLog.create({
      action: "update",
      entityType: "approval",
      entityId: approval._id,
      user: req.user.id,
      userName: req.user.name,
      changes: {
        after: { materialId, status: "sold", saleDetails },
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: { approval, sale },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update approval material status to RETURNED
// @route   PUT /api/approvals/:id/materials/:materialId/returned
// @access  Private
export const markMaterialAsReturned = async (req, res, next) => {
  try {
    const { approvalId, materialId } = req.params;

    const approval = await Approval.findById(approvalId);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Approval not found",
      });
    }

    const material = approval.materials.id(materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    // Update material status
    material.status = "returned";
    material.returnedDate = Date.now();

    await approval.save();

    // Update stock ledger (add stock back)
    const currentStock = await StockLedger.getCurrentStock();
    const categoryStock = currentStock[material.materialType] || 0;

    await StockLedger.create({
      materialCategory: material.materialType,
      transactionType: "approval_returned",
      caretChange: material.caret,
      runningBalance: categoryStock + material.caret,
      referenceEntity: "approval",
      referenceId: approval._id,
      notes: "Material returned from approval",
      createdBy: req.user.id,
    });

    // Create notification
    await Notification.create({
      title: "Approval Material Returned",
      message: `${material.caret} caret of ${material.materialType} returned from ${approval.brokerName}`,
      type: "approval_pending",
      priority: "low",
      relatedEntity: {
        entityType: "approval",
        entityId: approval._id,
      },
      createdBy: req.user.id,
    });

    // Create audit log
    await AuditLog.create({
      action: "update",
      entityType: "approval",
      entityId: approval._id,
      user: req.user.id,
      userName: req.user.name,
      changes: {
        after: { materialId, status: "returned" },
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: approval,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update approval
// @route   PUT /api/approvals/:id
// @access  Private
export const updateApproval = async (req, res, next) => {
  try {
    const approval = await Approval.findById(req.params.id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Approval not found",
      });
    }

    const updatedApproval = await Approval.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    // Create audit log
    await AuditLog.create({
      action: "update",
      entityType: "approval",
      entityId: approval._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { before: approval, after: updatedApproval },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: updatedApproval,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete approval
// @route   DELETE /api/approvals/:id
// @access  Private
export const deleteApproval = async (req, res, next) => {
  try {
    const approval = await Approval.findById(req.params.id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Approval not found",
      });
    }

    await approval.deleteOne();

    // Create audit log
    await AuditLog.create({
      action: "delete",
      entityType: "approval",
      entityId: approval._id,
      user: req.user.id,
      userName: req.user.name,
      changes: { before: approval },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Approval deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending approvals summary
// @route   GET /api/approvals/summary/pending
// @access  Private
export const getPendingApprovalsSummary = async (req, res, next) => {
  try {
    const pendingApprovals = await Approval.aggregate([
      { $match: { status: { $in: ["pending", "partial"] } } },
      {
        $group: {
          _id: "$brokerName",
          totalPendingCaret: { $sum: "$pendingCaret" },
          approvalCount: { $sum: 1 },
        },
      },
    ]);

    const totalPendingCaret = pendingApprovals.reduce(
      (sum, a) => sum + a.totalPendingCaret,
      0,
    );

    res.status(200).json({
      success: true,
      data: {
        byBroker: pendingApprovals,
        totalPendingCaret,
        totalApprovals: pendingApprovals.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
