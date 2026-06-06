import express from "express";
import {
  getApprovals,
  getApproval,
  createApproval,
  updateApproval,
  deleteApproval,
  markMaterialAsSold,
  markMaterialAsReturned,
  getPendingApprovalsSummary,
} from "../controllers/approvalController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router
  .route("/")
  .get(protect, getApprovals)
  .post(protect, authorize("admin", "manager", "accountant"), createApproval);

router.route("/summary/pending").get(protect, getPendingApprovalsSummary);

router
  .route("/:id")
  .get(protect, getApproval)
  .put(protect, authorize("admin", "manager", "accountant"), updateApproval)
  .delete(protect, authorize("admin"), deleteApproval);

router
  .route("/:approvalId/materials/:materialId/sold")
  .put(
    protect,
    authorize("admin", "manager", "accountant"),
    markMaterialAsSold,
  );

router
  .route("/:approvalId/materials/:materialId/returned")
  .put(
    protect,
    authorize("admin", "manager", "accountant"),
    markMaterialAsReturned,
  );

export default router;
