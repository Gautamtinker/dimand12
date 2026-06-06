import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cron from "cron";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

// Import config and middleware
import connectDB from "./config/db.js";
import { errorHandler, notFound } from "./middleware/error.js";
import routes from "./routes/index.js";
import { setIO } from "./controllers/dashboardController.js";

// Import notification services
import {
  sendOverduePurchaseNotification,
  sendOverdueSaleNotification,
  sendUpcomingDueNotification,
} from "./services/notificationService.js";

// Import models
import { Purchase, Sale, User, AuditLog } from "./models/index.js";

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Socket.IO setup for real-time notifications
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Export io for use in other modules
app.set("io", io);
setIO(io);

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api", routes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../frontend", "dist", "index.html"));
  });
}

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Socket.IO client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket.IO client disconnected:", socket.id);
  });

  socket.on("register", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} registered to socket ${socket.id}`);
  });
});

// Broadcast notification to users
export const broadcastNotification = (notification) => {
  io.emit("notification", notification);
};

// Function to check for overdue payments (used by cron job and manual trigger)
export const runOverdueCheck = async () => {
  console.log("Running scheduled task: Check overdue payments");

  try {
    // Get all users for notifications
    const users = await User.find({ isActive: true });

    // Check overdue purchases (due date is today or has passed)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today

    const overduePurchases = await Purchase.find({
      dueDate: { $lte: today },
      outstandingAmount: { $gt: 0 },
      isOverdue: false,
    });

    for (const purchase of overduePurchases) {
      purchase.isOverdue = true;
      await purchase.save();

      for (const user of users) {
        await sendOverduePurchaseNotification(purchase, user);
        io.to(`user_${user._id}`).emit("notification", {
          type: "purchase_overdue",
          title: "Parchi Pak Gayi",
          message: `Payment overdue for ${purchase.vendorName}`,
        });
      }
    }

    // Check overdue sales (due date is today or has passed)
    const overdueSales = await Sale.find({
      dueDate: { $lte: today },
      outstandingAmount: { $gt: 0 },
      isOverdue: false,
    });

    for (const sale of overdueSales) {
      sale.isOverdue = true;
      await sale.save();

      for (const user of users) {
        await sendOverdueSaleNotification(sale, user);
        io.to(`user_${user._id}`).emit("notification", {
          type: "sale_overdue",
          title: "Sale Recovery Overdue",
          message: `Payment overdue from ${sale.buyerName}`,
        });
      }
    }

    // Check upcoming due dates (within 3 days)
    const upcomingPurchases = await Purchase.find({
      dueDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      outstandingAmount: { $gt: 0 },
    });

    for (const purchase of upcomingPurchases) {
      for (const user of users) {
        await sendUpcomingDueNotification(purchase, "purchase", user);
      }
    }

    const upcomingSales = await Sale.find({
      dueDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      outstandingAmount: { $gt: 0 },
    });

    for (const sale of upcomingSales) {
      for (const user of users) {
        await sendUpcomingDueNotification(sale, "sale", user);
      }
    }

    console.log("Scheduled task completed successfully");
  } catch (error) {
    console.error("Error in scheduled task:", error);
  }
};

// Cron job to check for overdue payments every hour
const checkOverduePayments = new cron.CronJob(
  "0 * * * *", // Every hour at minute 0
  async () => {
    await runOverdueCheck();
  },
  null,
  true,
  "Asia/Kolkata",
);

// Start cron job
checkOverduePayments.start();
console.log(
  "Scheduled task for overdue payment checks started (runs every hour)",
);

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

export default app;
