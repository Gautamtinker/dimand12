import express from "express";
import authRoutes from "./authRoutes.js";
import purchaseRoutes from "./purchaseRoutes.js";
import purchasePaymentRoutes from "./purchasePaymentRoutes.js";
import saleRoutes from "./saleRoutes.js";
import salePaymentRoutes from "./salePaymentRoutes.js";
import approvalRoutes from "./approvalRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import reportRoutes from "./reportRoutes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/purchases", purchaseRoutes);
router.use("/purchase-payments", purchasePaymentRoutes);
router.use("/sales", saleRoutes);
router.use("/sale-payments", salePaymentRoutes);
router.use("/approvals", approvalRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/reports", reportRoutes);

export default router;
