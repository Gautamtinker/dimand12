import express from "express";
import {
  getSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  getSaleSummary,
  checkOverdueSales,
} from "../controllers/saleController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router
  .route("/")
  .get(protect, getSales)
  .post(protect, authorize("admin", "manager", "accountant"), createSale);

router.route("/summary").get(protect, getSaleSummary);

router
  .route("/check-overdue")
  .post(protect, authorize("admin"), checkOverdueSales);

router
  .route("/:id")
  .get(protect, getSale)
  .put(protect, authorize("admin", "manager", "accountant"), updateSale)
  .delete(protect, authorize("admin"), deleteSale);

export default router;
