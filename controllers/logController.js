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

import Log from "../models/Log.js";
import Election from "../models/Election.js";

// Get all activity logs with pagination
export const getAllLogs = async (req, res) => {
  try {
    const {
      user,
      action,
      startDate,
      endDate,
      limit = 20,
      skip = 0,
    } = req.query;

    // Build filter object
    const filter = {};

    if (user) {
      filter.user = user;
    }

    if (action) {
      filter.action = action;
    }

    if (startDate || endDate) {
      filter.timestamp = {};

      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }

      if (endDate) {
        // Set time to end of day for endDate
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = endDateTime;
      }
    }

    // Parse pagination parameters
    const limitNum = parseInt(limit, 10);
    const skipNum = parseInt(skip, 10);

    // Get total count (optional - can be used for pagination info)
    const totalCount = await Log.countDocuments(filter);

    // Get logs with pagination
    const logs = await Log.find(filter)
      .sort({ timestamp: -1 })
      .skip(skipNum)
      .limit(limitNum);

    // Include total count in response headers (optional)
    res.set("X-Total-Count", totalCount.toString());

    res.status(200).json(logs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create a new log entry
export const createLog = async (req, res) => {
  try {
    const { action, details, resourceId, resourceType } = req.body;

    // Create the log object with more careful handling
    const log = new Log({
      action,
      userId: req.user ? req.user._id : null, // Use userId instead of user
      details: details || {},
      resourceId: resourceId || null,
      resourceType: resourceType || null,
      timestamp: new Date(),
    });

    await log.save();
    res.status(201).json(log);
  } catch (error) {
    console.error("Error creating log:", error);
    res
      .status(500)
      .json({ message: "Error creating log entry", error: error.message });
  }
};

// Clear logs
export const clearLogs = async (req, res) => {
  try {
    // Only allow clearing logs that are older than a certain date if specified
    const { olderThan } = req.body;

    let filter = {};
    if (olderThan) {
      filter = { timestamp: { $lt: new Date(olderThan) } };
    }

    const result = await Log.deleteMany(filter);
    res.status(200).json({
      message: `${result.deletedCount} logs deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error clearing logs:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Helper function to log actions (can be imported and used by other controllers)
export const logActivity = async (
  action,
  user,
  details = "",
  electionId = null
) => {
  try {
    const log = new Log({
      action,
      user,
      details,
      electionId,
    });
    await log.save();
    return log;
  } catch (error) {
    console.error("Error logging activity:", error);
    return null;
  }
};
