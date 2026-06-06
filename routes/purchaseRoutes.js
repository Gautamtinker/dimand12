import express from "express";
import {
  getPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
  getPurchaseSummary,
  checkOverduePurchases,
} from "../controllers/purchaseController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router
  .route("/")
  .get(protect, getPurchases)
  .post(protect, authorize("admin", "manager", "accountant"), createPurchase);

router.route("/summary").get(protect, getPurchaseSummary);

router
  .route("/check-overdue")
  .post(protect, authorize("admin"), checkOverduePurchases);

router
  .route("/:id")
  .get(protect, getPurchase)
  .put(protect, authorize("admin", "manager", "accountant"), updatePurchase)
  .delete(protect, authorize("admin"), deletePurchase);

export default router;
