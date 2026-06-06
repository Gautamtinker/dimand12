import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./models/index.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB Connected for seeding...");

    // Delete existing users first
    await User.deleteMany({});
    console.log("Cleared existing users");

    // Create admin user
    const admin = await User.create({
      name: "Admin",
      email: "admin@diamond.com",
      password: "admin@123WE",
      phone: "+916376365191",
      role: "admin",
      permissions: {
        canCreatePurchase: true,
        canUpdatePurchase: true,
        canDeletePurchase: true,
        canCreateSale: true,
        canUpdateSale: true,
        canDeleteSale: true,
        canCreateApproval: true,
        canUpdateApproval: true,
        canDeleteApproval: true,
        canViewReports: true,
        canManageUsers: true,
      },
      isActive: true,
    });

    console.log("Admin user created successfully!");
    console.log("Login credentials:");
    console.log("  Email: admin@diamond.com");
    console.log("  Password: admin@123WE");

    // Create a manager user
    const manager = await User.create({
      name: "Manager",
      email: "manager@diamond.com",
      password: "manager123",
      phone: "+91 9876543211",
      role: "manager",
      permissions: {
        canCreatePurchase: true,
        canUpdatePurchase: true,
        canDeletePurchase: false,
        canCreateSale: true,
        canUpdateSale: true,
        canDeleteSale: false,
        canCreateApproval: true,
        canUpdateApproval: true,
        canDeleteApproval: false,
        canViewReports: true,
        canManageUsers: false,
      },
      isActive: true,
    });

    console.log("\nManager user created successfully!");
    console.log("Login credentials:");
    console.log("  Email: manager@diamond.com");
    console.log("  Password: manager123");

    // Create an accountant user
    const accountant = await User.create({
      name: "Accountant",
      email: "accountant@diamond.com",
      password: "accountant123",
      phone: "+91 9876543212",
      role: "accountant",
      permissions: {
        canCreatePurchase: true,
        canUpdatePurchase: false,
        canDeletePurchase: false,
        canCreateSale: true,
        canUpdateSale: false,
        canDeleteSale: false,
        canCreateApproval: false,
        canUpdateApproval: false,
        canDeleteApproval: false,
        canViewReports: true,
        canManageUsers: false,
      },
      isActive: true,
    });

    console.log("\nAccountant user created successfully!");
    console.log("Login credentials:");
    console.log("  Email: accountant@diamond.com");
    console.log("  Password: accountant123");

    // Create a viewer user
    const viewer = await User.create({
      name: "Viewer",
      email: "viewer@diamond.com",
      password: "viewer123",
      phone: "+91 9876543213",
      role: "viewer",
      permissions: {
        canCreatePurchase: false,
        canUpdatePurchase: false,
        canDeletePurchase: false,
        canCreateSale: false,
        canUpdateSale: false,
        canDeleteSale: false,
        canCreateApproval: false,
        canUpdateApproval: false,
        canDeleteApproval: false,
        canViewReports: true,
        canManageUsers: false,
      },
      isActive: true,
    });

    console.log("\nViewer user created successfully!");
    console.log("Login credentials:");
    console.log("  Email: viewer@diamond.com");
    console.log("  Password: viewer123");

    console.log("\n===========================================");
    console.log("All users created successfully!");
    console.log("===========================================");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedAdmin();
