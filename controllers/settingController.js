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
import Setting from "../models/Setting.js";
import Election from "../models/Election.js";
import cacheManager from "../utils/cacheManager.js";
import { getCircuitBreaker } from "../utils/circuitBreaker.js";

// Timeout constants
const QUERY_TIMEOUT = 10000; // 10 seconds
const ELECTION_QUERY_TIMEOUT = 5000; // 5 seconds

// Create circuit breaker for settings with more robust fallback
const settingsCircuitBreaker = getCircuitBreaker("settings", {
  failureThreshold: 3,
  resetTimeout: 60000, // 1 minute
  successThreshold: 2, // 2 successful operations to close circuit
  fallback: (req, res) => {
    console.log("[CIRCUIT BREAKER] Using fallback for settings");

    // Use cache if available (even if expired)
    const cachedSettings = cacheManager.get("settings", { allowExpired: true });
    if (cachedSettings) {
      console.log("[CIRCUIT BREAKER] Returning cached settings as fallback");
      res.set("X-Settings-Source", "circuit-breaker-cache");
      return cachedSettings;
    }

    // Create defaults as last resort
    console.log("[CIRCUIT BREAKER] Creating default settings as last resort");
    const defaultSettings = createDefaultSettings();
    return defaultSettings;
  },
});

// Get settings with timeout and fallback
export const getSettings = async (req, res) => {
  const startTime = Date.now();
  console.log(
    `[PERF][SERVER] Settings request received at ${new Date().toISOString()}`
  );

  // Check if nocache parameter is present in the query string
  const noCache =
    req.query.nocache || req.headers["cache-control"] === "no-cache";

  try {
    // Only use cache if nocache parameter is not present
    if (!noCache) {
      const cachedSettings = cacheManager.get("settings");
      if (cachedSettings) {
        console.log(
          `[PERF][SERVER] Returning cached settings from ${new Date(
            cacheManager.cache.get("settings").created
          ).toISOString()}`
        );

        // Add ETag for client-side caching
        const etag = `"${cacheManager.cache.get("settings").created}"`;
        res.set("ETag", etag);

        // Check if client has the latest version
        const clientETag = req.headers["if-none-match"];
        if (clientETag === etag) {
          console.log(
            `[PERF][SERVER] Client has current version, returning 304 Not Modified`
          );
          console.log(`[PERF][SERVER] Total time: ${Date.now() - startTime}ms`);
          return res.status(304).end(); // Not Modified
        }

        console.log(`[PERF][SERVER] Total time: ${Date.now() - startTime}ms`);
        res.set("X-Settings-Source", "cache");
        return res.json(cachedSettings);
      }
    } else {
      console.log("[PERF][SERVER] Bypassing cache due to nocache parameter");
    }

    // Execute with circuit breaker protection
    const settings = await settingsCircuitBreaker.execute(
      async () => {
        // If we need to fetch from database, use a timeout
        console.log(
          "[PERF][SERVER] Fetching settings from database with timeout protection"
        );
        const dbFetchStart = Date.now();

        // Create a promise that will reject after timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("Database query timed out"));
          }, QUERY_TIMEOUT);
        });

        // Create the actual database query
        const queryPromise = Setting.findOne().lean().exec();

        // Race the query against the timeout
        let settings;
        try {
          settings = await Promise.race([queryPromise, timeoutPromise]);
        } catch (timeoutError) {
          console.warn(
            "[PERF][SERVER] Settings query timed out, using fallback"
          );

          // Try to get expired cache as fallback
          const expiredCache = cacheManager.get("settings", {
            allowExpired: true,
          });
          if (expiredCache) {
            console.log(
              "[PERF][SERVER] Using expired cached settings as fallback"
            );
            res.set("X-Settings-Source", "expired-cache-fallback");
            return expiredCache;
          }

          // Create default settings if no cache available
          settings = createDefaultSettings();
          res.set("X-Settings-Source", "default-fallback");
        }

        console.log(
          `[PERF][SERVER] Settings DB fetch took: ${
            Date.now() - dbFetchStart
          }ms`
        );

        if (!settings) {
          console.log("[PERF][SERVER] Creating new settings document");
          const newSettings = createDefaultSettings();

          // Try to save in background but don't wait for it
          Setting.create(newSettings).catch((err) =>
            console.error("Error saving default settings:", err)
          );

          settings = newSettings;
        }

        return settings;
      },
      req,
      res
    );

    // If circuit breaker fallback sent a response directly, we're done
    if (!settings) return;

    // Cache the settings (this happens regardless of source)
    cacheManager.set("settings", settings, {
      ttl: 10 * 60 * 1000, // 10 minutes
      source: "database",
    });

    // Try to add supplemental election data
    try {
      const electionFetchStart = Date.now();
      const currentElection = await Promise.race([
        Election.findOne({ isCurrent: true }).lean().exec(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Election query timeout")),
            ELECTION_QUERY_TIMEOUT
          )
        ),
      ]);

      console.log(
        `[PERF][SERVER] Election DB fetch took: ${
          Date.now() - electionFetchStart
        }ms`
      );

      if (currentElection) {
        // Synchronize election dates with settings
        settings.electionDate = currentElection.date;
        settings.electionStartDate =
          currentElection.startDate || currentElection.date;
        settings.electionEndDate =
          currentElection.endDate || currentElection.date;
        settings.electionStartTime =
          currentElection.startTime?.substring(0, 5) || "08:00";
        settings.electionEndTime =
          currentElection.endTime?.substring(0, 5) || "17:00";
        settings.electionTitle =
          currentElection.title || settings.electionTitle;
        settings.isActive = currentElection.isActive;
      }
    } catch (electionError) {
      console.warn(
        "[PERF][SERVER] Election fetch error:",
        electionError.message
      );
      // Proceed without election data
    }

    console.log(
      `[PERF][SERVER] Total settings processing time: ${
        Date.now() - startTime
      }ms`
    );

    // Set ETag for client caching
    const etag = `"${Date.now()}"`;
    res.set("ETag", etag);
    res.set("X-Settings-Source", "database");

    return res.json(settings);
  } catch (error) {
    console.error("Error retrieving settings:", error);

    // Try to get even expired cached settings in case of error
    const cachedSettings = cacheManager.get("settings", { allowExpired: true });
    if (cachedSettings) {
      console.log(
        "[PERF][SERVER] Error fetching settings, using cached version"
      );
      res.set("X-Settings-Source", "error-fallback");
      return res.json(cachedSettings);
    }

    // Last resort - create default settings
    const defaultSettings = createDefaultSettings();
    res.set("X-Settings-Source", "error-default");
    return res.status(200).json(defaultSettings);
  }
};

// Helper function to create default settings
function createDefaultSettings() {
  return {
    isActive: true,
    electionTitle: "Student Council Election 2025",
    votingStartDate: new Date().toISOString().split("T")[0],
    votingEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    votingStartTime: "08:00",
    votingEndTime: "17:00",
    resultsPublished: false,
    allowVoterRegistration: false,
    requireEmailVerification: false,
    maxVotesPerVoter: 1,
    systemName: "Peki Senior High School Elections",
    systemLogo: "",
    companyName: "",
    companyLogo: "",
    schoolName: "Peki Senior High School",
    schoolLogo: "",
  };
}

// Update settings with improved error handling and election synchronization
export const updateSettings = async (req, res) => {
  // Start a MongoDB session for transaction support
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("Update settings request received with data:", req.body);

    // Convert string boolean values to actual booleans if needed
    const sanitizedData = { ...req.body };
    if (typeof sanitizedData.isActive === "string") {
      sanitizedData.isActive = sanitizedData.isActive === "true";
    }

    // Check if settings exist
    let settings = await Setting.findOne().session(session);

    if (settings) {
      // Update existing settings
      console.log("Updating existing settings");
      settings = await Setting.findOneAndUpdate({}, sanitizedData, {
        new: true,
        runValidators: true,
        session,
      });
    } else {
      // Create new settings
      console.log("Creating new settings");
      settings = await Setting.create([sanitizedData], { session });
      settings = settings[0]; // Extract from array returned by create with session
    }

    // Update the current election with matching settings fields
    // This ensures synchronization between settings and current election
    if (
      sanitizedData.votingStartDate ||
      sanitizedData.votingEndDate ||
      sanitizedData.votingStartTime ||
      sanitizedData.votingEndTime ||
      sanitizedData.isActive ||
      sanitizedData.electionTitle
    ) {
      console.log("Synchronizing election settings with current election");

      // Find current election
      const currentElection = await Election.findOne({
        isCurrent: true,
      }).session(session);

      if (currentElection) {
        // Map settings fields to election fields
        const electionUpdate = {};

        // Update title if changed
        if (sanitizedData.electionTitle) {
          electionUpdate.title = sanitizedData.electionTitle;
        }

        // Update dates if changed
        if (sanitizedData.votingStartDate) {
          electionUpdate.startDate = sanitizedData.votingStartDate;
          // Also update the main date field if it's a start date change
          electionUpdate.date = sanitizedData.votingStartDate;
        }

        if (sanitizedData.votingEndDate) {
          electionUpdate.endDate = sanitizedData.votingEndDate;
        }

        // Update times if changed
        if (sanitizedData.votingStartTime) {
          // Ensure time format is consistent (HH:MM:SS)
          const formattedTime =
            sanitizedData.votingStartTime.length === 5
              ? `${sanitizedData.votingStartTime}:00`
              : sanitizedData.votingStartTime;
          electionUpdate.startTime = formattedTime;
        }

        if (sanitizedData.votingEndTime) {
          // Ensure time format is consistent (HH:MM:SS)
          const formattedTime =
            sanitizedData.votingEndTime.length === 5
              ? `${sanitizedData.votingEndTime}:00`
              : sanitizedData.votingEndTime;
          electionUpdate.endTime = formattedTime;
        }

        // Update active status if changed
        if (typeof sanitizedData.isActive !== "undefined") {
          electionUpdate.isActive = sanitizedData.isActive;
          electionUpdate.status = sanitizedData.isActive
            ? "active"
            : "not-started";
        }

        // Check if current date falls within the election period
        const currentDate = new Date();
        const startDate = new Date(
          `${sanitizedData.votingStartDate}T${sanitizedData.votingStartTime}`
        );
        const endDate = new Date(
          `${sanitizedData.votingEndDate}T${sanitizedData.votingEndTime}`
        );

        // If current date is within range, ensure isActive is true
        if (currentDate >= startDate && currentDate <= endDate) {
          sanitizedData.isActive = true;
          electionUpdate.isActive = true;
          electionUpdate.status = "active";
        }

        // Only update if there are changes
        if (Object.keys(electionUpdate).length > 0) {
          console.log("Updating current election with:", electionUpdate);

          // Update the current election
          await Election.findByIdAndUpdate(
            currentElection._id,
            {
              ...electionUpdate,
              updatedAt: new Date(),
            },
            { session }
          );

          // Invalidate cache for both settings and election status
          cacheManager.invalidate("settings");
          cacheManager.invalidate("electionStatus");
        }
      } else {
        console.log("No current election found to synchronize with");
      }
    }

    // Explicitly invalidate the cache before setting the new value
    cacheManager.invalidate("settings");

    // Clear and update cache with a shorter TTL
    cacheManager.set(
      "settings",
      settings.toObject ? settings.toObject() : settings,
      {
        ttl: 5 * 60 * 1000, // 5 minutes - shorter TTL for more frequent refresh
        source: "updated",
      }
    );

    // Also invalidate related caches
    cacheManager.invalidate("electionStatus");

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Log the updated settings
    console.log(
      "Successfully updated settings and synchronized with current election"
    );

    res.json(settings);
  } catch (error) {
    // Abort the transaction on error
    await session.abortTransaction();
    session.endSession();

    console.error("Error updating settings:", error);
    res.status(500).json({ message: error.message });
  }
};

// Create a backup
export const createBackup = async (req, res) => {
  // Backup implementation...
};

// Restore from backup
export const restoreSystem = async (req, res) => {
  // Restore implementation...
};
