import express from "express";
import {
  generatePurchaseReport,
  generateSalesReport,
  generateApprovalReport,
  generateVendorOutstandingReport,
  generateBuyerOutstandingReport,
  generateBrokerCommissionReport,
  generateStockReport,
  generateProfitLossReport,
  generateCashFlowReport,
} from "../controllers/reportController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router
  .route("/purchases")
  .get(
    protect,
    authorize("admin", "manager", "accountant"),
    generatePurchaseReport,
  );
router
  .route("/sales")
  .get(
    protect,
    authorize("admin", "manager", "accountant"),
    generateSalesReport,
  );
router
  .route("/approvals")
  .get(
    protect,
    authorize("admin", "manager", "accountant"),
    generateApprovalReport,
  );
router
  .route("/outstanding/vendors")
  .get(
    protect,
    authorize("admin", "manager", "accountant"),
    generateVendorOutstandingReport,
  );
router
  .route("/outstanding/buyers")
  .get(
    protect,
    authorize("admin", "manager", "accountant"),
    generateBuyerOutstandingReport,
  );
router
  .route("/broker-commission")
  .get(
    protect,
    authorize("admin", "manager", "accountant"),
    generateBrokerCommissionReport,
  );
router
  .route("/stock")
  .get(
    protect,
    authorize("admin", "manager", "accountant"),
    generateStockReport,
  );
router
  .route("/profit-loss")
  .get(
    protect,
    authorize("admin", "manager", "accountant"),
    generateProfitLossReport,
  );
router
  .route("/cashflow")
  .get(
    protect,
    authorize("admin", "manager", "accountant"),
    generateCashFlowReport,
  );

export default router;
