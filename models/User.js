import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "manager", "accountant", "viewer"],
      default: "viewer",
    },
    permissions: {
      canCreatePurchase: { type: Boolean, default: false },
      canEditPurchase: { type: Boolean, default: false },
      canDeletePurchase: { type: Boolean, default: false },
      canCreateSale: { type: Boolean, default: false },
      canEditSale: { type: Boolean, default: false },
      canDeleteSale: { type: Boolean, default: false },
      canCreateApproval: { type: Boolean, default: false },
      canEditApproval: { type: Boolean, default: false },
      canDeleteApproval: { type: Boolean, default: false },
      canViewReports: { type: Boolean, default: false },
      canManageUsers: { type: Boolean, default: false },
      canMakePayments: { type: Boolean, default: false },
      canReceivePayments: { type: Boolean, default: false },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    fcmToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
