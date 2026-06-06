import express from "express";
import {
  getPurchasePayments,
  getPurchasePayment,
  createPurchasePayment,
  updatePurchasePayment,
  deletePurchasePayment,
  getPurchasePaymentHistory,
} from "../controllers/purchasePaymentController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router
  .route("/")
  .get(protect, getPurchasePayments)
  .post(
    protect,
    authorize("admin", "manager", "accountant"),
    createPurchasePayment,
  );

router
  .route("/:id")
  .get(protect, getPurchasePayment)
  .put(
    protect,
    authorize("admin", "manager", "accountant"),
    updatePurchasePayment,
  )
  .delete(protect, authorize("admin"), deletePurchasePayment);

router.route("/purchase/:id").get(protect, getPurchasePaymentHistory);

export default router;
