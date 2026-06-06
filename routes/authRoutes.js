import express from "express";
import {
  register,
  login,
  logout,
  getMe,
  updatePassword,
  forgotPassword,
  updateFCMToken,
  updateProfile,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/logout", protect, logout);
router.get("/me", protect, getMe);
router.put("/updatepassword", protect, updatePassword);
router.post("/forgotpassword", forgotPassword);
router.post("/fcm-token", protect, updateFCMToken);
router.put("/updateprofile", protect, updateProfile);

export default router;
