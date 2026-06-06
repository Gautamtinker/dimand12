import {
  Purchase,
  Sale,
  Approval,
  StockLedger,
  PurchasePayment,
  SalePayment,
  Broker,
} from "../models/index.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import moment from "moment";

// @desc    Generate purchase report
// @route   GET /api/reports/purchases
// @access  Private
export const generatePurchaseReport = async (req, res, next) => {
  try {
    const {
      startDate,
      endDate,
      vendorName,
      materialCategory,
      format = "json",
    } = req.query;

    const query = {};
    if (startDate && endDate) {
      query.purchaseDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    if (vendorName) query.vendorName = { $regex: vendorName, $options: "i" };
    if (materialCategory) query.materialCategory = materialCategory;

    const purchases = await Purchase.find(query)
      .sort({ purchaseDate: -1 })
      .populate("createdBy", "name email");

    if (format === "excel") {
      return exportToExcel(res, purchases, "Purchase Report", [
        [
          "Date",
          "Vendor",
          "Category",
          "Caret",
          "Amount",
          "Status",
          "Outstanding",
        ],
        ...purchases.map((p) => [
          moment(p.purchaseDate).format("DD/MM/YYYY"),
          p.vendorName,
          p.materialCategory,
          p.totalCaret,
          p.totalAmount,
          p.status,
          p.outstandingAmount,
        ]),
      ]);
    }

    if (format === "pdf") {
      return exportToPDF(res, purchases, "Purchase Report", (doc, purchase) => {
        doc.text(
          `${moment(purchase.purchaseDate).format("DD/MM/YYYY")} | ${purchase.vendorName} | ${purchase.materialCategory} | ${purchase.totalCaret} ct | ₹${purchase.totalAmount} | ${purchase.status}`,
          50,
          doc.y,
        );
        doc.moveDown(0.5);
      });
    }

    res.status(200).json({
      success: true,
      data: purchases,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate sales report
// @route   GET /api/reports/sales
// @access  Private
export const generateSalesReport = async (req, res, next) => {
  try {
    const {
      startDate,
      endDate,
      buyerName,
      materialCategory,
      format = "json",
    } = req.query;

    const query = {};
    if (startDate && endDate) {
      query.saleDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (buyerName) query.buyerName = { $regex: buyerName, $options: "i" };
    if (materialCategory) query.materialCategory = materialCategory;

    const sales = await Sale.find(query)
      .sort({ saleDate: -1 })
      .populate("createdBy", "name email");

    if (format === "excel") {
      return exportToExcel(res, sales, "Sales Report", [
        [
          "Date",
          "Buyer",
          "Category",
          "Caret",
          "Rate",
          "Gross Amt",
          "Broker Comm",
          "Net Amt",
          "Status",
          "Receivable",
        ],
        ...sales.map((s) => [
          moment(s.saleDate).format("DD/MM/YYYY"),
          s.buyerName,
          s.materialCategory,
          s.caret,
          s.rate,
          s.grossAmount,
          s.totalBrokerCommission,
          s.netAmount,
          s.status,
          s.outstandingAmount,
        ]),
      ]);
    }

    if (format === "pdf") {
      return exportToPDF(res, sales, "Sales Report", (doc, sale) => {
        doc.text(
          `${moment(sale.saleDate).format("DD/MM/YYYY")} | ${sale.buyerName} | ${sale.materialCategory} | ${sale.caret} ct | ₹${sale.rate}/ct | Gross: ₹${sale.grossAmount} | Net: ₹${sale.netAmount}`,
          50,
          doc.y,
        );
        doc.moveDown(0.5);
      });
    }

    res.status(200).json({
      success: true,
      data: sales,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate approval report
// @route   GET /api/reports/approvals
// @access  Private
export const generateApprovalReport = async (req, res, next) => {
  try {
    const {
      startDate,
      endDate,
      brokerName,
      status,
      format = "json",
    } = req.query;

    const query = {};
    if (startDate && endDate) {
      query.dateSent = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (brokerName) query.brokerName = { $regex: brokerName, $options: "i" };
    if (status) query.status = status;

    const approvals = await Approval.find(query)
      .sort({ dateSent: -1 })
      .populate("createdBy", "name email");

    if (format === "excel") {
      return exportToExcel(res, approvals, "Approval Report", [
        [
          "Date",
          "Broker",
          "Total Caret",
          "Sold",
          "Returned",
          "Pending",
          "Status",
        ],
        ...approvals.map((a) => [
          moment(a.dateSent).format("DD/MM/YYYY"),
          a.brokerName,
          a.totalCaret,
          a.soldCaret,
          a.returnedCaret,
          a.pendingCaret,
          a.status,
        ]),
      ]);
    }

    res.status(200).json({
      success: true,
      data: approvals,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate outstanding vendor report
// @route   GET /api/reports/outstanding/vendors
// @access  Private
export const generateVendorOutstandingReport = async (req, res, next) => {
  try {
    const { format = "json" } = req.query;

    const outstanding = await Purchase.aggregate([
      { $match: { outstandingAmount: { $gt: 0 } } },
      {
        $group: {
          _id: "$vendorName",
          totalOutstanding: { $sum: "$outstandingAmount" },
          purchaseCount: { $sum: 1 },
          oldestDueDate: { $min: "$dueDate" },
        },
      },
      { $sort: { totalOutstanding: -1 } },
    ]);

    if (format === "excel") {
      return exportToExcel(res, outstanding, "Vendor Outstanding Report", [
        ["Vendor", "Total Outstanding", "Purchase Count", "Oldest Due Date"],
        ...outstanding.map((o) => [
          o._id,
          o.totalOutstanding,
          o.purchaseCount,
          moment(o.oldestDueDate).format("DD/MM/YYYY"),
        ]),
      ]);
    }

    res.status(200).json({
      success: true,
      data: outstanding,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate outstanding buyer report
// @route   GET /api/reports/outstanding/buyers
// @access  Private
export const generateBuyerOutstandingReport = async (req, res, next) => {
  try {
    const { format = "json" } = req.query;

    const outstanding = await Sale.aggregate([
      { $match: { outstandingAmount: { $gt: 0 } } },
      {
        $group: {
          _id: "$buyerName",
          totalOutstanding: { $sum: "$outstandingAmount" },
          saleCount: { $sum: 1 },
          oldestDueDate: { $min: "$dueDate" },
        },
      },
      { $sort: { totalOutstanding: -1 } },
    ]);

    if (format === "excel") {
      return exportToExcel(res, outstanding, "Buyer Outstanding Report", [
        ["Buyer", "Total Outstanding", "Sale Count", "Oldest Due Date"],
        ...outstanding.map((o) => [
          o._id,
          o.totalOutstanding,
          o.saleCount,
          moment(o.oldestDueDate).format("DD/MM/YYYY"),
        ]),
      ]);
    }

    res.status(200).json({
      success: true,
      data: outstanding,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate broker commission report
// @route   GET /api/reports/broker-commission
// @access  Private
export const generateBrokerCommissionReport = async (req, res, next) => {
  try {
    const { startDate, endDate, format = "json" } = req.query;

    const query = {};
    if (startDate && endDate) {
      query.saleDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Get all sales with brokers
    const sales = await Sale.find({
      ...query,
      "brokers.0": { $exists: true },
    });

    // Aggregate commission by broker
    const commissionByBroker = {};
    sales.forEach((sale) => {
      sale.brokers.forEach((broker) => {
        if (!commissionByBroker[broker.name]) {
          commissionByBroker[broker.name] = {
            totalCommission: 0,
            transactionCount: 0,
            totalSaleAmount: 0,
          };
        }
        commissionByBroker[broker.name].totalCommission += broker.amount;
        commissionByBroker[broker.name].transactionCount++;
        commissionByBroker[broker.name].totalSaleAmount += sale.grossAmount;
      });
    });

    const report = Object.entries(commissionByBroker).map(([name, data]) => ({
      brokerName: name,
      ...data,
    }));

    if (format === "excel") {
      return exportToExcel(res, report, "Broker Commission Report", [
        [
          "Broker",
          "Total Commission",
          "Transaction Count",
          "Total Sale Amount",
        ],
        ...report.map((r) => [
          r.brokerName,
          r.totalCommission,
          r.transactionCount,
          r.totalSaleAmount,
        ]),
      ]);
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate stock report
// @route   GET /api/reports/stock
// @access  Private
export const generateStockReport = async (req, res, next) => {
  try {
    const { format = "json" } = req.query;

    const stock = await StockLedger.getCurrentStock();
    const stockValue = await StockLedger.getStockValue();

    const report = stockValue.map((item) => ({
      category: item.materialCategory,
      totalCaret: item.totalCaret || 0,
      avgRate: item.avgRate || 0,
      estimatedValue: item.estimatedValue || 0,
    }));

    if (format === "excel") {
      return exportToExcel(res, report, "Stock Report", [
        ["Category", "Total Caret", "Avg Rate", "Estimated Value"],
        ...report.map((r) => [
          r.category,
          r.totalCaret,
          r.avgRate,
          r.estimatedValue,
        ]),
      ]);
    }

    res.status(200).json({
      success: true,
      data: {
        byCategory: report,
        totalStock: stock.total || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate profit/loss report
// @route   GET /api/reports/profit-loss
// @access  Private
export const generateProfitLossReport = async (req, res, next) => {
  try {
    const { startDate, endDate, format = "json" } = req.query;

    const query = {};
    if (startDate && endDate) {
      query.purchaseDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Total purchases
    const purchases = await Purchase.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" },
          totalCaret: { $sum: "$totalCaret" },
        },
      },
    ]);

    // Total sales
    const salesQuery = {};
    if (startDate && endDate) {
      salesQuery.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const sales = await Sale.aggregate([
      { $match: salesQuery },
      {
        $group: {
          _id: null,
          grossAmount: { $sum: "$grossAmount" },
          netAmount: { $sum: "$netAmount" },
          totalBrokerCommission: { $sum: "$totalBrokerCommission" },
          totalCaret: { $sum: "$caret" },
        },
      },
    ]);

    const totalPurchase = purchases[0]?.totalAmount || 0;
    const totalSalesGross = sales[0]?.grossAmount || 0;
    const totalSalesNet = sales[0]?.netAmount || 0;
    const totalBrokerCommission = sales[0]?.totalBrokerCommission || 0;

    const grossProfit = totalSalesGross - totalPurchase - totalBrokerCommission;
    const netProfit = totalSalesNet - totalPurchase;

    const report = {
      period: { startDate, endDate },
      purchases: {
        totalAmount: totalPurchase,
        totalCaret: purchases[0]?.totalCaret || 0,
      },
      sales: {
        grossAmount: totalSalesGross,
        netAmount: totalSalesNet,
        brokerCommission: totalBrokerCommission,
        totalCaret: sales[0]?.totalCaret || 0,
      },
      profit: {
        grossProfit,
        netProfit,
        profitMargin:
          totalSalesGross > 0 ? (grossProfit / totalSalesGross) * 100 : 0,
      },
    };

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate cash flow report
// @route   GET /api/reports/cashflow
// @access  Private
export const generateCashFlowReport = async (req, res, next) => {
  try {
    const { startDate, endDate, format = "json" } = req.query;

    const query = {};
    if (startDate && endDate) {
      query.paymentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Cash inflow (sale payments)
    const inflow = await SalePayment.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Cash outflow (purchase payments)
    const outflow = await PurchasePayment.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalInflow = inflow.reduce((sum, i) => sum + i.total, 0);
    const totalOutflow = outflow.reduce((sum, o) => sum + o.total, 0);
    const netCashFlow = totalInflow - totalOutflow;

    const report = {
      period: { startDate, endDate },
      inflow: {
        byMethod: inflow,
        total: totalInflow,
      },
      outflow: {
        byMethod: outflow,
        total: totalOutflow,
      },
      netCashFlow,
    };

    if (format === "excel") {
      return exportToExcel(res, report, "Cash Flow Report", [
        ["Type", "Method", "Total", "Count"],
        ...inflow.map((i) => ["Inflow", i._id, i.total, i.count]),
        ...outflow.map((o) => ["Outflow", o._id, o.total, o.count]),
        ["Net", "Cash Flow", netCashFlow, ""],
      ]);
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to export to Excel
const exportToExcel = async (res, data, sheetName, rows) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  rows.forEach((row) => {
    worksheet.addRow(row);
  });

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFE0E0" },
    };
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${sheetName.replace(/\s/g, "_")}_${moment().format("YYYYMMDD")}.xlsx"`,
  );

  await workbook.xlsx.write(res);
  res.end();
};

// Helper function to export to PDF
const exportToPDF = (res, data, title, contentFn) => {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${title.replace(/\s/g, "_")}_${moment().format("YYYYMMDD")}.pdf"`,
  );

  doc.pipe(res);

  // Title
  doc.fontSize(20).text(title, { align: "center" });
  doc.moveDown();

  // Generated date
  doc
    .fontSize(10)
    .text(`Generated on: ${moment().format("DD/MM/YYYY HH:mm")}`, {
      align: "right",
    });
  doc.moveDown();

  // Content
  doc.fontSize(11);
  data.forEach((item) => {
    contentFn(doc, item);
  });

  doc.end();
};
