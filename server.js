/**
 * Project: School E-Voting System
 * Developer: Hassan Iftikhar
 * Date: May 2025
 * Description: Backend & Frontend developed by Hassan Iftikhar.
 * Website: https://hassaniftikhar.vercel.app/
 * Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
 * LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
 * Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
 * Email: hassaniftikhardev@gmail.com
 * Note: Redistribution or commercial use without license is not allowed.
 */

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import apiRoutes from "./routes/api.js";
import electionRoutes from "./routes/electionRoutes.js";
import "./models/ActivityLog.js";
import { initDbMonitoring, getDbHealth } from "./utils/dbMonitor.js";
import cacheManager from "./utils/cacheManager.js";
import {
  getAllCircuitBreakerStats,
  resetAllCircuitBreakers,
} from "./utils/circuitBreaker.js";

// Load environment variables
dotenv.config();

// Add utility function for safely converting dates to ISO strings
const safeToISOString = (date) => {
  try {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch (error) {
    console.warn("Date conversion error:", error);
    return new Date().toISOString();
  }
};

// Get safe current date in ISO format
const getCurrentDateISO = () => {
  try {
    return new Date().toISOString().split("T")[0];
  } catch (error) {
    console.warn("Current date ISO format error:", error);
    return "2023-01-01";
  }
};

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Add server readiness checks
let isServerReady = false;
const readyChecks = {
  db: false,
  cache: false,
};

// Add dbHealth object to track database health
let dbHealth = {
  status: "initializing",
  lastCheck: new Date(),
  connectionAttempts: 0,
  connectionIssues: 0,
  slowQueries: 0,
  averageQueryTime: 0,
  lastSuccessfulQuery: null,
};

// Initialize cache globals instead of basic objects
const CACHE_DURATION = {
  ELECTION_STATUS: 5 * 60 * 1000,
  SETTINGS: 10 * 60 * 1000,
  HEALTH: 30 * 1000,
};

// Enhanced cache initialization with default values
function initCache() {
  // Initialize election status with default values instead of null
  cacheManager.set(
    "electionStatus",
    {
      isActive: false,
      title: "Default Election",
      date: getCurrentDateISO(),
      startTime: "08:00:00",
      endTime: "16:00:00",
    },
    {
      ttl: CACHE_DURATION.ELECTION_STATUS,
      source: "startup-defaults",
    }
  );

  // Initialize settings with default values
  cacheManager.set(
    "settings",
    {
      systemName: "Peki Senior High School",
      electionTitle: "Student Council Elections 2025",
      isActive: false,
      votingStartTime: "08:00",
      votingEndTime: "16:00",
    },
    {
      ttl: CACHE_DURATION.SETTINGS,
      source: "startup-defaults",
    }
  );

  readyChecks.cache = true;
  checkServerReady();
}

// Initialize cache at startup
initCache();

// Check if server is ready to serve requests
function checkServerReady() {
  if (Object.values(readyChecks).every(Boolean)) {
    isServerReady = true;
    console.log("🟢 Server is now ready to accept requests");
    console.info(
      `%c
      Project: School E-Voting System
      Developer: Hassan Iftikhar
      Date: May 2025
      Description: Backend & Frontend developed by Hassan Iftikhar.
      Website: https://hassaniftikhar.vercel.app/
      Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
      LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
      Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
      Email: hassaniftikhardev@gmail.com
      Note: Redistribution or commercial use without license is not allowed.
      `,
      "color: #0a0; font-size: 14px; font-family: monospace;"
    );
  }
}

// Add middleware to check server readiness
app.use((req, res, next) => {
  // Always allow health check and server-info endpoints
  if (
    req.path === "/health" ||
    req.path === "/api/health" ||
    req.path === "/server-info" ||
    req.path === "/api/server-info" ||
    req.path === "/api/health-check"
  ) {
    return next();
  }

  if (!isServerReady) {
    return res.status(503).json({
      status: "unavailable",
      message: "Server is starting up",
      readyChecks,
      uptime: process.uptime(),
    });
  }
  next();
});

// Middleware to attach cache to request object (keep for backward compatibility)
app.use((req, res, next) => {
  req.cache = {
    electionStatus: cacheManager.get("electionStatus"),
    electionStatusTime:
      cacheManager.cache.get("electionStatus")?.created || null,
    settings: cacheManager.get("settings"),
    settingsTime: cacheManager.cache.get("settings")?.created || null,
  };
  next();
});

// CORS middleware with proper configuration for Render.com
app.use(
  cors({
    origin: [
      "https://e-voting-frontend-5q4z.onrender.com",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://e-voting-pekiseniorhighschool.vercel.app", // Add your Vercel domain
      process.env.ALLOWED_ORIGIN, // Also keep this for flexibility
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "X-Requested-With",
      "Accept",
      "Pragma",
      "Origin",
      "If-None-Match",
      "ETag",
      "expires",
    ],
    credentials: true,
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Body parser middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Basic routes
app.get("/", (req, res) => {
  res.send("Server is running");
});

// Add a dedicated health check endpoint - MUST be before API routes are mounted
app.get("/api/health-check", (req, res) => {
  const mongoReadyState = mongoose.connection.readyState;
  const mongoStatus =
    ["disconnected", "connected", "connecting", "disconnecting"][
      mongoReadyState
    ] || "unknown";

  // Update dbHealth before responding
  dbHealth.status = mongoStatus;
  dbHealth.lastCheck = new Date();

  const healthData = {
    status: "ok",
    timestamp: Date.now(),
    serverTime: safeToISOString(new Date()), // Use safe method
    uptime: process.uptime(),
    database: {
      status: mongoStatus,
      connected: mongoReadyState === 1,
      connectionAttempts: dbHealth.connectionAttempts || 0,
    },
    memory: {
      rss: Math.round(process.memoryUsage().rss / (1024 * 1024)) + "MB",
      heapTotal:
        Math.round(process.memoryUsage().heapTotal / (1024 * 1024)) + "MB",
      heapUsed:
        Math.round(process.memoryUsage().heapUsed / (1024 * 1024)) + "MB",
    },
    cache: cacheManager.getStats(),
    version: process.env.npm_package_version || "1.0.0",
  };

  // Set appropriate HTTP headers for better caching and cross-origin support
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.set("Cache-Control", "no-cache");
  res.status(200).json(healthData);
});

// Quick election status endpoint (with improved caching)
app.get("/api/election-status-quick", async (req, res) => {
  try {
    const now = Date.now();

    // Get from cache first (more robust caching with the new cache manager)
    const cachedStatus = cacheManager.get("electionStatus");
    if (cachedStatus) {
      console.log("Serving election status from cache");
      console.info(
        `%c
        Project: School E-Voting System
        Developer: Hassan Iftikhar
        Date: May 2025
        Description: Backend & Frontend developed by Hassan Iftikhar.
        Website: https://hassaniftikhar.vercel.app/
        Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
        LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
        Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
        Email: hassaniftikhardev@gmail.com
        Note: Redistribution or commercial use without license is not allowed.
        `,
        "color: #0a0; font-size: 14px; font-family: monospace;"
      );

      return res.json(cachedStatus);
    }

    // If no cache, fetch from database with timeout protection
    const Election = mongoose.model("Election");
    const Setting = mongoose.model("Setting");

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Election status query timed out")),
        5000
      );
    });

    // Use faster query with lean() to get only what we need
    const electionQuery = Election.findOne({ isCurrent: true })
      .select(
        "title date startDate endDate startTime endTime isActive resultsPublished"
      )
      .lean();

    // Race against timeout
    let election;
    try {
      election = await Promise.race([electionQuery, timeoutPromise]);
    } catch (timeoutError) {
      console.warn("Election query timed out, using cached data if available");

      // Try to get expired cache if available
      const expiredCache = cacheManager.get("electionStatus", {
        allowExpired: true,
      });
      if (expiredCache) {
        console.log("Using expired cache for election status");
        console.info(
          `%c
          Project: School E-Voting System
          Developer: Hassan Iftikhar
          Date: May 2025
          Description: Backend & Frontend developed by Hassan Iftikhar.
          Website: https://hassaniftikhar.vercel.app/
          Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
          LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
          Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
          Email: hassaniftikhardev@gmail.com
          Note: Redistribution or commercial use without license is not allowed.
          `,
          "color: #0a0; font-size: 14px; font-family: monospace;"
        );

        res.set("X-Cache-Status", "expired");
        return res.json(expiredCache);
      }

      // Create a minimal fallback
      const fallbackData = {
        title: "Election",
        date: getCurrentDateISO(), // Use safe method
        isActive: true,
        startTime: "08:00:00",
        endTime: "16:00:00",
      };

      // Cache the fallback to prevent repeated failures
      cacheManager.set("electionStatus", fallbackData, {
        ttl: 60000, // Short TTL for fallback data
        source: "fallback",
      });

      res.set("X-Cache-Status", "fallback");
      return res.json(fallbackData);
    }

    if (!election) {
      console.log("No active election found, using defaults");
      console.info(
        `%c
        Project: School E-Voting System
        Developer: Hassan Iftikhar
        Date: May 2025
        Description: Backend & Frontend developed by Hassan Iftikhar.
        Website: https://hassaniftikhar.vercel.app/
        Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
        LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
        Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
        Email: hassaniftikhardev@gmail.com
        Note: Redistribution or commercial use without license is not allowed.
        `,
        "color: #0a0; font-size: 14px; font-family: monospace;"
      );

      const defaultData = {
        title: "Election",
        date: getCurrentDateISO(), // Use safe method
        isActive: false,
        message: "No active election found",
      };

      cacheManager.set("electionStatus", defaultData, {
        ttl: CACHE_DURATION.ELECTION_STATUS,
        source: "default-no-election",
      });

      return res.status(200).json(defaultData);
    }

    // Attempt to get settings to enhance the response
    let settings = null;
    try {
      const settingsQuery = Setting.findOne()
        .select("votingStartDate votingEndDate votingStartTime votingEndTime")
        .lean();

      settings = await Promise.race([
        settingsQuery,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Settings query timeout")), 3000)
        ),
      ]);
    } catch (settingsError) {
      console.warn(
        "Settings query for election status timed out, proceeding with election data only"
      );
    }

    // Merge data and fill in gaps
    const response = {
      ...election,
      startDate:
        election.startDate ||
        (settings ? settings.votingStartDate : election.date),
      endDate:
        election.endDate || (settings ? settings.votingEndDate : election.date),
      startTime:
        election.startTime ||
        (settings ? settings.votingStartTime + ":00" : "08:00:00"),
      endTime:
        election.endTime ||
        (settings ? settings.votingEndTime + ":00" : "16:00:00"),
    };

    // Cache the result with the new cache manager
    cacheManager.set("electionStatus", response, {
      ttl: CACHE_DURATION.ELECTION_STATUS,
      source: "database",
    });

    console.log("Successfully fetched election status:", {
      startDate: response.startDate,
      endDate: response.endDate,
      date: response.date,
      isActive: response.isActive,
    });
    console.info(
      `%c
      Project: School E-Voting System
      Developer: Hassan Iftikhar
      Date: May 2025
      Description: Backend & Frontend developed by Hassan Iftikhar.
      Website: https://hassaniftikhar.vercel.app/
      Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
      LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
      Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
      Email: hassaniftikhardev@gmail.com
      Note: Redistribution or commercial use without license is not allowed.
      `,
      "color: #0a0; font-size: 14px; font-family: monospace;"
    );

    res.set("X-Cache-Status", "fresh");
    return res.json(response);
  } catch (error) {
    console.error("Error in quick election status:", error);

    // Try to get any cached data, even if expired
    const cachedStatus = cacheManager.get("electionStatus", {
      allowExpired: true,
    });
    if (cachedStatus) {
      console.log("Using potentially expired cache due to error");
      console.info(
        `%c
        Project: School E-Voting System
        Developer: Hassan Iftikhar
        Date: May 2025
        Description: Backend & Frontend developed by Hassan Iftikhar.
        Website: https://hassaniftikhar.vercel.app/
        Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
        LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
        Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
        Email: hassaniftikhardev@gmail.com
        Note: Redistribution or commercial use without license is not allowed.
        `,
        "color: #0a0; font-size: 14px; font-family: monospace;"
      );

      res.set("X-Cache-Status", "error-fallback");
      return res.json(cachedStatus);
    }

    // Ultimate fallback
    const errorFallback = {
      title: "Election Service Unavailable",
      date: getCurrentDateISO(), // Use safe method
      isActive: false,
      error: "Service temporarily unavailable",
    };

    return res.status(200).json(errorFallback);
  }
});

// API Routes - Mount apiRoutes to /api
app.use("/api", apiRoutes);
app.use("/api/election", electionRoutes);

// Add the server-info and health endpoints with /api prefix
// This duplicates them for backward compatibility
app.get("/api/server-info", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.set("Access-Control-Max-Age", "600");
  res.json({
    status: "online",
    port: process.env.PORT || 5000,
    timestamp: Date.now(),
    serverTime: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: Date.now(),
    uptime: process.uptime(),
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// Also keep the original routes for backward compatibility
app.get("/server-info", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.set("Access-Control-Max-Age", "600");
  res.json({
    status: "online",
    port: process.env.PORT || 5000,
    timestamp: Date.now(),
    serverTime: safeToISOString(new Date()), // Use safe method
    version: process.env.npm_package_version || "1.0.0",
  });
});

// Enhanced health check endpoint
app.get("/health", (req, res) => {
  const mongoStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const status = mongoStatus === "connected" ? "ok" : "degraded";

  res.status(status === "ok" ? 200 : 503).json({
    status,
    timestamp: Date.now(),
    uptime: process.uptime(),
    database: {
      status: mongoStatus,
      connectionTime:
        mongoose.connection.readyState === 1
          ? safeToISOString(new Date(mongoose.connection.openTime)) // Use safe method
          : null,
    },
  });
});

// Debug middleware for bulk import
app.use("/api/voters/bulk", (req, res, next) => {
  console.log("==== BULK IMPORT MIDDLEWARE ====");
  console.info(
    `%c
    Project: School E-Voting System
    Developer: Hassan Iftikhar
    Date: May 2025
    Description: Backend & Frontend developed by Hassan Iftikhar.
    Website: https://hassaniftikhar.vercel.app/
    Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
    LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
    Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
    Email: hassaniftikhardev@gmail.com
    Note: Redistribution or commercial use without license is not allowed.
    `,
    "color: #0a0; font-size: 14px; font-family: monospace;"
  );

  console.log("Request method:", req.method);
  console.info(
    `%c
    Project: School E-Voting System
    Developer: Hassan Iftikhar
    Date: May 2025
    Description: Backend & Frontend developed by Hassan Iftikhar.
    Website: https://hassaniftikhar.vercel.app/
    Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
    LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
    Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
    Email: hassaniftikhardev@gmail.com
    Note: Redistribution or commercial use without license is not allowed.
    `,
    "color: #0a0; font-size: 14px; font-family: monospace;"
  );

  console.log("Request headers:", JSON.stringify(req.headers, null, 2));
  console.info(
    `%c
    Project: School E-Voting System
    Developer: Hassan Iftikhar
    Date: May 2025
    Description: Backend & Frontend developed by Hassan Iftikhar.
    Website: https://hassaniftikhar.vercel.app/
    Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
    LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
    Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
    Email: hassaniftikhardev@gmail.com
    Note: Redistribution or commercial use without license is not allowed.
    `,
    "color: #0a0; font-size: 14px; font-family: monospace;"
  );

  if (req.method === "POST") {
    try {
      const rawBody = JSON.stringify(req.body, null, 2);
      console.log("Raw request body size:", rawBody.length);
      console.info(
        `%c
        Project: School E-Voting System
        Developer: Hassan Iftikhar
        Date: May 2025
        Description: Backend & Frontend developed by Hassan Iftikhar.
        Website: https://hassaniftikhar.vercel.app/
        Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
        LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
        Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
        Email: hassaniftikhardev@gmail.com
        Note: Redistribution or commercial use without license is not allowed.
        `,
        "color: #0a0; font-size: 14px; font-family: monospace;"
      );

      console.log("Request body sample:", rawBody.substring(0, 500));
      console.info(
        `%c
        Project: School E-Voting System
        Developer: Hassan Iftikhar
        Date: May 2025
        Description: Backend & Frontend developed by Hassan Iftikhar.
        Website: https://hassaniftikhar.vercel.app/
        Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
        LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
        Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
        Email: hassaniftikhardev@gmail.com
        Note: Redistribution or commercial use without license is not allowed.
        `,
        "color: #0a0; font-size: 14px; font-family: monospace;"
      );

      if (!req.body || !req.body.voters) {
        console.log("⚠️ Warning: Missing voters array in request body");
        console.info(
          `%c
          Project: School E-Voting System
          Developer: Hassan Iftikhar
          Date: May 2025
          Description: Backend & Frontend developed by Hassan Iftikhar.
          Website: https://hassaniftikhar.vercel.app/
          Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
          LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
          Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
          Email: hassaniftikhardev@gmail.com
          Note: Redistribution or commercial use without license is not allowed.
          `,
          "color: #0a0; font-size: 14px; font-family: monospace;"
        );
      } else if (!Array.isArray(req.body.voters)) {
        console.log(
          "⚠️ Warning: Body.voters is not an array, it is:",
          typeof req.body.voters
        );
      } else {
        console.log(
          `✅ Valid voters array with ${req.body.voters.length} items`
        );
        console.info(
          `%c
          Project: School E-Voting System
          Developer: Hassan Iftikhar
          Date: May 2025
          Description: Backend & Frontend developed by Hassan Iftikhar.
          Website: https://hassaniftikhar.vercel.app/
          Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
          LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
          Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
          Email: hassaniftikhardev@gmail.com
          Note: Redistribution or commercial use without license is not allowed.
          `,
          "color: #0a0; font-size: 14px; font-family: monospace;"
        );
      }
    } catch (error) {
      console.error("Error parsing/logging request body:", error);
    }
  }

  next();
});

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error("Global error handler caught:", err);

  // Ensure dbHealth exists
  if (typeof dbHealth === "undefined") {
    dbHealth = {
      status: "error",
      lastCheck: new Date(),
      connectionAttempts: 0,
      error: "dbHealth was undefined",
    };
  }

  const error =
    process.env.NODE_ENV === "production"
      ? { message: "Internal server error" }
      : { message: err.message, stack: err.stack };

  res.status(err.statusCode || 500).json({
    success: false,
    error,
  });
});

// Serve static files and handle SPA routing in production
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  // Check multiple possible build paths
  const possiblePaths = ["./dist", "../dist", "../../dist", "./server/dist"];

  let staticPath = null;
  for (const path of possiblePaths) {
    try {
      const fullPath = fs.realpathSync(path);
      if (fs.existsSync(fullPath)) {
        console.log(`Found static files in: ${fullPath}`);
        console.info(
          `%c
          Project: School E-Voting System
          Developer: Hassan Iftikhar
          Date: May 2025
          Description: Backend & Frontend developed by Hassan Iftikhar.
          Website: https://hassaniftikhar.vercel.app/
          Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
          LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
          Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
          Email: hassaniftikhardev@gmail.com
          Note: Redistribution or commercial use without license is not allowed.
          `,
          "color: #0a0; font-size: 14px; font-family: monospace;"
        );

        staticPath = fullPath;
        break;
      }
    } catch (error) {
      console.log(`Error checking path ${path}:`, error.message);
      console.info(
        `%c
        Project: School E-Voting System
        Developer: Hassan Iftikhar
        Date: May 2025
        Description: Backend & Frontend developed by Hassan Iftikhar.
        Website: https://hassaniftikhar.vercel.app/
        Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
        LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
        Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
        Email: hassaniftikhardev@gmail.com
        Note: Redistribution or commercial use without license is not allowed.
        `,
        "color: #0a0; font-size: 14px; font-family: monospace;"
      );
    }
  }

  if (staticPath) {
    // Serve static files
    app.use(express.static(staticPath));

    // Handle SPA routing - IMPORTANT: This needs to come AFTER API routes
    // This handler explicitly excludes /api and other backend-specific paths
    app.get("*", (req, res, next) => {
      // Skip API routes and other backend endpoints
      if (
        req.path.startsWith("/api/") ||
        req.path === "/health" ||
        req.path === "/server-info"
      ) {
        return next();
      }

      // Otherwise serve the SPA index.html
      res.sendFile(path.join(staticPath, "index.html"));
    });
  } else {
    console.warn("No static files found for production mode!");
  }
}

// Add MongoDB query debugging in development
if (process.env.NODE_ENV !== "production") {
  const SLOW_QUERY_THRESHOLD_MS = 1000; // 1 second

  mongoose.set("debug", (collectionName, methodName, ...methodArgs) => {
    const startTime = Date.now();

    // Return a custom function for the callback
    return () => {
      const endTime = Date.now();
      const elapsedTime = endTime - startTime;

      if (elapsedTime > SLOW_QUERY_THRESHOLD_MS) {
        console.warn(
          `[SLOW QUERY] ${collectionName}.${methodName} took ${elapsedTime}ms`
        );
      }
    };
  });
}

// Enable additional Mongoose options for better stability
mongoose.set("bufferCommands", false); // Disable buffering to avoid memory issues
mongoose.set("autoIndex", false); // Disable automatic index building in production

// MongoDB connection with improved error handling and optimized settings
console.log("Connecting to MongoDB at:", process.env.MONGODB_URI);
console.info(
  `%c
  Project: School E-Voting System
  Developer: Hassan Iftikhar
  Date: May 2025
  Description: Backend & Frontend developed by Hassan Iftikhar.
  Website: https://hassaniftikhar.vercel.app/
  Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
  LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
  Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
  Email: hassaniftikhardev@gmail.com
  Note: Redistribution or commercial use without license is not allowed.
  `,
  "color: #0a0; font-size: 14px; font-family: monospace;"
);

// Remove the problematic options and use this instead:
const mongooseOptions = {
  serverSelectionTimeoutMS: 10000, // 10 seconds
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10,
  minPoolSize: 2,
  waitQueueTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000,
};

mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/eVotingSystem",
    mongooseOptions
  )
  .then(() => {
    console.log("Connected to MongoDB");
    console.info(
      `%c
      Project: School E-Voting System
      Developer: Hassan Iftikhar
      Date: May 2025
      Description: Backend & Frontend developed by Hassan Iftikhar.
      Website: https://hassaniftikhar.vercel.app/
      Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
      LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
      Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
      Email: hassaniftikhardev@gmail.com
      Note: Redistribution or commercial use without license is not allowed.
      `,
      "color: #0a0; font-size: 14px; font-family: monospace;"
    );

    startServer();
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    // Start server in limited mode if in development
    if (process.env.NODE_ENV !== "production") {
      console.warn("Proceeding with limited functionality in development mode");
      console.info(
        `%c
        Project: School E-Voting System
        Developer: Hassan Iftikhar
        Date: May 2025
        Description: Backend & Frontend developed by Hassan Iftikhar.
        Website: https://hassaniftikhar.vercel.app/
        Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
        LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
        Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
        Email: hassaniftikhardev@gmail.com
        Note: Redistribution or commercial use without license is not allowed.
        `,
        "color: #0a0; font-size: 14px; font-family: monospace;"
      );

      startServer();
    } else {
      console.error("Fatal MongoDB connection error in production");
      console.info(
        `%c
        Project: School E-Voting System
        Developer: Hassan Iftikhar
        Date: May 2025
        Description: Backend & Frontend developed by Hassan Iftikhar.
        Website: https://hassaniftikhar.vercel.app/
        Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
        LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
        Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
        Email: hassaniftikhardev@gmail.com
        Note: Redistribution or commercial use without license is not allowed.
        `,
        "color: #0a0; font-size: 14px; font-family: monospace;"
      );

      process.exit(1);
    }
  });

// Add more robust connection event listeners
mongoose.connection.on("connected", () => {
  console.log("MongoDB connected successfully");
  console.info(
    `%c
    Project: School E-Voting System
    Developer: Hassan Iftikhar
    Date: May 2025
    Description: Backend & Frontend developed by Hassan Iftikhar.
    Website: https://hassaniftikhar.vercel.app/
    Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
    LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
    Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
    Email: hassaniftikhardev@gmail.com
    Note: Redistribution or commercial use without license is not allowed.
    `,
    "color: #0a0; font-size: 14px; font-family: monospace;"
  );

  dbHealth.status = "connected";
  dbHealth.lastCheck = new Date();
  readyChecks.db = true;
  checkServerReady();
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
  console.info(
    `%c
    Project: School E-Voting System
    Developer: Hassan Iftikhar
    Date: May 2025
    Description: Backend & Frontend developed by Hassan Iftikhar.
    Website: https://hassaniftikhar.vercel.app/
    Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
    LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
    Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
    Email: hassaniftikhardev@gmail.com
    Note: Redistribution or commercial use without license is not allowed.
    `,
    "color: #0a0; font-size: 14px; font-family: monospace;"
  );

  dbHealth.status = "disconnected";
  dbHealth.lastCheck = new Date();
  readyChecks.db = false;
  checkServerReady();
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
  console.info(
    `%c
    Project: School E-Voting System
    Developer: Hassan Iftikhar
    Date: May 2025
    Description: Backend & Frontend developed by Hassan Iftikhar.
    Website: https://hassaniftikhar.vercel.app/
    Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
    LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
    Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
    Email: hassaniftikhardev@gmail.com
    Note: Redistribution or commercial use without license is not allowed.
    `,
    "color: #0a0; font-size: 14px; font-family: monospace;"
  );

  dbHealth.status = "error";
  dbHealth.lastCheck = new Date();
  dbHealth.connectionIssues++;
  readyChecks.db = false;
});

// Add monitoring for MongoDB connections
setInterval(() => {
  if (mongoose.connection.readyState === 1) {
    // Only log when connected
    try {
      // MongoDB driver structure may vary between versions
      const client = mongoose.connection.getClient();

      // Check if we can access pool stats (structure depends on driver version)
      if (client && client.s && client.s.pool) {
        const pool = client.s.pool;
        console.log(`MongoDB Pool Stats: 
          Current: ${pool.currentSize || "N/A"}
          Available: ${pool.availableCount || "N/A"}
          WaitQueue: ${pool.waitQueueSize || "N/A"}`);
        console.info(
          `%c
            Project: School E-Voting System
            Developer: Hassan Iftikhar
            Date: May 2025
            Description: Backend & Frontend developed by Hassan Iftikhar.
            Website: https://hassaniftikhar.vercel.app/
            Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
            LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
            Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
            Email: hassaniftikhardev@gmail.com
            Note: Redistribution or commercial use without license is not allowed.
            `,
          "color: #0a0; font-size: 14px; font-family: monospace;"
        );
      } else if (client && client.topology) {
        // Alternative for newer MongoDB driver versions
        const topology = client.topology;
        console.log(`MongoDB Connection Status: 
          Connected: ${topology.isConnected()}
          Server Count: ${topology.s?.servers?.size || "N/A"}
          Type: ${topology.s?.description?.type || "N/A"}`);
        console.info(
          `%c
            Project: School E-Voting System
            Developer: Hassan Iftikhar
            Date: May 2025
            Description: Backend & Frontend developed by Hassan Iftikhar.
            Website: https://hassaniftikhar.vercel.app/
            Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
            LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
            Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
            Email: hassaniftikhardev@gmail.com
            Note: Redistribution or commercial use without license is not allowed.
            `,
          "color: #0a0; font-size: 14px; font-family: monospace;"
        );
      } else {
        // Basic connection stats if pool isn't accessible
        console.log(`MongoDB Basic Connection Stats:
          ReadyState: ${mongoose.connection.readyState}
          Host: ${mongoose.connection.host || "N/A"}
          Name: ${mongoose.connection.name || "N/A"}`);
        console.info(
          `%c
            Project: School E-Voting System
            Developer: Hassan Iftikhar
            Date: May 2025
            Description: Backend & Frontend developed by Hassan Iftikhar.
            Website: https://hassaniftikhar.vercel.app/
            Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
            LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
            Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
            Email: hassaniftikhardev@gmail.com
            Note: Redistribution or commercial use without license is not allowed.
            `,
          "color: #0a0; font-size: 14px; font-family: monospace;"
        );
      }
    } catch (error) {
      console.warn("Unable to get MongoDB connection stats:", error.message);
      console.info(
        `%c
        Project: School E-Voting System
        Developer: Hassan Iftikhar
        Date: May 2025
        Description: Backend & Frontend developed by Hassan Iftikhar.
        Website: https://hassaniftikhar.vercel.app/
        Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
        LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
        Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
        Email: hassaniftikhardev@gmail.com
        Note: Redistribution or commercial use without license is not allowed.
        `,
        "color: #0a0; font-size: 14px; font-family: monospace;"
      );
    }
  }
}, 10000);

// Initialize DB monitoring
initDbMonitoring();

// Server startup function
const startServer = () => {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Server running in ${
        process.env.NODE_ENV || "development"
      } mode on port ${PORT}`
    );
    if (process.env.NODE_ENV !== "production") {
      console.log(`Access server at http://localhost:${PORT}`);
    }
  });

  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.log(`Port ${PORT} is busy, trying ${PORT + 1}...`);
      setTimeout(() => {
        server.close();
        app.listen(PORT + 1, "0.0.0.0", () => {
          console.log(`Server running on port ${PORT + 1}`);
        });
      }, 1000);
    } else {
      console.error("Server error:", e);
    }
  });
};

// Add a cache control endpoint for admins
app.post("/api/admin/cache/clear", async (req, res) => {
  try {
    // Check for auth - this should be properly secured in production
    if (!req.headers.authorization) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const keys = req.body.keys || [];
    let result;

    if (keys.length === 0) {
      // Clear all cache
      result = cacheManager.clear();
      console.log(`Cleared all cache entries (${result} items)`);
    } else {
      // Clear specific keys
      result = 0;
      for (const key of keys) {
        if (cacheManager.invalidate(key)) {
          result++;
        }
      }
      console.log(`Cleared ${result} specific cache keys`);
    }

    // Reset circuit breakers if requested
    if (req.body.resetCircuitBreakers) {
      const resetCount = resetAllCircuitBreakers();
      console.log(`Reset ${resetCount} circuit breakers`);
    }

    return res.status(200).json({
      success: true,
      message: `Cleared ${result} cache entries`,
      cacheStats: cacheManager.getStats(),
      circuitBreakers: getAllCircuitBreakerStats(),
    });
  } catch (error) {
    console.error("Error clearing cache:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default app;
