import express from "express";
import {
  getSalePayments,
  getSalePayment,
  createSalePayment,
  updateSalePayment,
  deleteSalePayment,
  getSalePaymentHistory,
} from "../controllers/purchasePaymentController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router
  .route("/")
  .get(protect, getSalePayments)
  .post(
    protect,
    authorize("admin", "manager", "accountant"),
    createSalePayment,
  );

router
  .route("/:id")
  .get(protect, getSalePayment)
  .put(protect, authorize("admin", "manager", "accountant"), updateSalePayment)
  .delete(protect, authorize("admin"), deleteSalePayment);

router.route("/sale/:id").get(protect, getSalePaymentHistory);

export default router;
