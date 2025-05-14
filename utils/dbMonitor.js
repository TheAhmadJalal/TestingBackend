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

import mongoose from "mongoose";

// Connection states in readable form
const CONNECTION_STATES = [
  "disconnected",
  "connected",
  "connecting",
  "disconnecting",
  "uninitialized",
];

// Stores query timings
const queryTimings = {
  recent: [],
  slow: [],
  maxEntries: 100,
  slowThreshold: 1000, // 1 second
};

// Tracks overall database health
let dbHealth = {
  status: "unknown",
  lastCheck: null,
  connectionIssues: 0,
  slowQueries: 0,
  averageQueryTime: 0,
  lastSuccessfulQuery: null,
  connectionAttempts: 0,
  lastReconnectAttempt: null,
};

// Connection retry management
let connectionRetries = 0;
const MAX_RETRIES = 5;
let reconnectTimer = null;

// Initialize monitoring
export const initDbMonitoring = () => {
  // Listen to MongoDB connection events
  mongoose.connection.on("connected", () => {
    dbHealth.status = "healthy";
    dbHealth.lastCheck = new Date();
    dbHealth.connectionIssues = 0;
    connectionRetries = 0;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    console.log("[DB MONITOR] Connected to MongoDB");
  });

  mongoose.connection.on("error", (err) => {
    dbHealth.status = "degraded";
    dbHealth.lastCheck = new Date();
    dbHealth.connectionIssues++;
    console.error("[DB MONITOR] MongoDB connection error:", err);

    // Try to recover immediately on certain types of errors
    if (
      err.name === "MongoNetworkTimeoutError" ||
      err.name === "MongoNetworkError"
    ) {
      attemptReconnect();
    }
  });

  mongoose.connection.on("disconnected", () => {
    dbHealth.status = "critical";
    dbHealth.lastCheck = new Date();
    dbHealth.connectionIssues++;
    console.warn("[DB MONITOR] MongoDB disconnected");
    attemptReconnect();
  });

  mongoose.connection.on("reconnected", () => {
    console.log("[DB MONITOR] MongoDB reconnected!");
    connectionRetries = 0;
    dbHealth.status = "healthy";
    dbHealth.connectionAttempts = 0;
  });

  // Setup query monitoring
  if (process.env.NODE_ENV !== "production") {
    mongoose.set("debug", (collectionName, methodName, ...methodArgs) => {
      const startTime = Date.now();

      return () => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Record timing
        recordQueryTiming(collectionName, methodName, duration);

        // Log slow queries
        if (duration > queryTimings.slowThreshold) {
          console.warn(
            `[DB MONITOR] Slow query: ${collectionName}.${methodName} took ${duration}ms`
          );
          dbHealth.slowQueries++;
        }

        dbHealth.lastSuccessfulQuery = new Date();
      };
    });
  }

  // Start periodic health check
  setInterval(checkDbHealth, 60000); // Every minute
};

// Attempt to reconnect with exponential backoff
const attemptReconnect = () => {
  if (connectionRetries >= MAX_RETRIES) {
    console.warn(
      "[DB MONITOR] Maximum reconnection attempts reached. Manual intervention required."
    );
    return;
  }

  // Clear existing timer if any
  if (reconnectTimer) clearTimeout(reconnectTimer);

  connectionRetries++;
  dbHealth.connectionAttempts = connectionRetries;
  dbHealth.lastReconnectAttempt = new Date();

  // Exponential backoff with jitter to prevent thundering herd
  const retryDelay = Math.min(
    1000 * Math.pow(2, connectionRetries) * (0.8 + Math.random() * 0.4),
    30000
  );

  console.log(
    `[DB MONITOR] Attempting reconnect in ${Math.round(
      retryDelay / 1000
    )}s... (attempt ${connectionRetries} of ${MAX_RETRIES})`
  );

  reconnectTimer = setTimeout(() => {
    console.log("[DB MONITOR] Executing reconnection attempt...");

    // Use the same MongoDB options as the main connection
    const mongooseOptions = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      retryReads: true,
      ssl: true,
      tlsAllowInvalidCertificates: false,
    };

    mongoose
      .connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/eVotingSystem",
        mongooseOptions
      )
      .catch((err) =>
        console.error("[DB MONITOR] Reconnection attempt failed:", err)
      );
  }, retryDelay);
};

// Record query timing information
const recordQueryTiming = (collection, method, duration) => {
  const queryInfo = {
    collection,
    method,
    duration,
    timestamp: new Date(),
  };

  // Add to recent queries list
  queryTimings.recent.unshift(queryInfo);
  if (queryTimings.recent.length > queryTimings.maxEntries) {
    queryTimings.recent.pop();
  }

  // Add to slow queries list if necessary
  if (duration > queryTimings.slowThreshold) {
    queryTimings.slow.unshift(queryInfo);
    if (queryTimings.slow.length > queryTimings.maxEntries) {
      queryTimings.slow.pop();
    }
  }

  // Update average
  if (queryTimings.recent.length > 0) {
    const sum = queryTimings.recent.reduce(
      (acc, query) => acc + query.duration,
      0
    );
    dbHealth.averageQueryTime = Math.round(sum / queryTimings.recent.length);
  }
};

// Check database health
const checkDbHealth = () => {
  const state = mongoose.connection.readyState;
  const stateText = CONNECTION_STATES[state] || "unknown";

  dbHealth.status =
    state === 1 ? "healthy" : state === 2 ? "connecting" : "critical";
  dbHealth.lastCheck = new Date();

  console.log(`[DB MONITOR] Health check: ${dbHealth.status} (${stateText})`);

  // Check if we haven't had a successful query in a while
  if (dbHealth.lastSuccessfulQuery) {
    const now = new Date();
    const timeSinceLastQuery = now - dbHealth.lastSuccessfulQuery;

    if (timeSinceLastQuery > 120000) {
      // 2 minutes
      console.warn(
        `[DB MONITOR] No successful queries for ${Math.round(
          timeSinceLastQuery / 1000
        )}s`
      );
      dbHealth.status = "degraded";

      // If MongoDB is connected but no successful queries, attempt to trigger reconnect
      if (state === 1 && connectionRetries < MAX_RETRIES) {
        console.warn(
          "[DB MONITOR] Connection appears stale, triggering reconnect..."
        );
        mongoose.connection
          .close()
          .then(() => attemptReconnect())
          .catch((err) => {
            console.error("[DB MONITOR] Error closing connection:", err);
            attemptReconnect();
          });
      }
    }
  }
};

// Get current health status
export const getDbHealth = () => {
  return {
    ...dbHealth,
    readyState: mongoose.connection.readyState,
    readyStateText:
      CONNECTION_STATES[mongoose.connection.readyState] || "unknown",
    recentQueries: queryTimings.recent.slice(0, 5),
    slowQueries: queryTimings.slow.slice(0, 5),
    reconnectStatus:
      connectionRetries >= MAX_RETRIES
        ? "maxed"
        : reconnectTimer
        ? "pending"
        : "none",
    reconnectAttempt: connectionRetries,
    maxReconnectAttempts: MAX_RETRIES,
  };
};

export default {
  initDbMonitoring,
  getDbHealth,
};
