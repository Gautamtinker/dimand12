import express from "express";
import {
  getDashboardStats,
  getDashboardNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getCashFlowSummary,
  triggerOverdueCheck,
  getUpcomingPurchaseDues,
  getUpcomingSaleDues,
  testSMS,
} from "../controllers/dashboardController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.route("/stats").get(protect, getDashboardStats);

router.route("/notifications").get(protect, getDashboardNotifications);

router
  .route("/notifications/read-all")
  .put(protect, markAllNotificationsAsRead);

router.route("/notifications/:id/read").put(protect, markNotificationAsRead);

router.route("/cashflow").get(protect, getCashFlowSummary);

// Manual trigger for overdue check
router.route("/check-overdue").post(protect, triggerOverdueCheck);

// Get upcoming purchase dues (due date >= today)
router.route("/upcoming-dues").get(protect, getUpcomingPurchaseDues);

// Get upcoming sale dues (due date >= today)
router.route("/upcoming-sale-dues").get(protect, getUpcomingSaleDues);

// Test SMS configuration
router.route("/test-sms").post(protect, testSMS);

export default router;
