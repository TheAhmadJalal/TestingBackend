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
import * as electionController from "../controllers/electionController.js";
import * as settingController from "../controllers/settingController.js";
import * as voterController from "../controllers/voterController.js";
import * as adminController from "../controllers/adminController.js";
import * as positionController from "../controllers/positionController.js";
import * as candidateController from "../controllers/candidateController.js";
import * as yearController from "../controllers/yearController.js";
import * as classController from "../controllers/classController.js";
import * as houseController from "../controllers/houseController.js";
import * as logController from "../controllers/logController.js";
import * as roleController from "../controllers/roleController.js";
import * as authController from "../controllers/authController.js";
import * as analyticsController from "../controllers/analyticsController.js";
import { authenticateToken, checkPermission } from "../middleware/auth.js";
import { getCandidatesByPosition } from "../controllers/candidateController.js";
import {
  getRecentVoters,
  validateVoter,
} from "../controllers/voterController.js";
import { submitVote } from "../controllers/voteController.js";
import User from "../models/User.js"; // Add this import for the User model
import Setting from "../models/Setting.js"; // Add this import for the Setting model
import Election from "../models/Election.js"; // Add this import for the Election model
import { getCandidatesForVoter } from "../controllers/candidateController.js";
import mongoose from "mongoose";

const router = express.Router();

// Simple test endpoint to check which port is active - NO AUTH REQUIRED
// Define this ONCE at the top of the file and remove duplicates below
router.get("/server-info", (req, res) => {
  // Add CORS headers for diagnostics
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.set("Access-Control-Max-Age", "600");

  // Send minimal payload for quick response
  res.json({
    status: "online",
    port: process.env.PORT || 5000,
    timestamp: Date.now(),
    serverTime: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

// HEAD request version - define ONCE
router.head("/server-info", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.set("Access-Control-Max-Age", "600");
  res.set("X-Server-Time", new Date().toISOString());
  res.set("X-Server-Status", "online");
  res.status(200).end();
});

// Add health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: Date.now(),
    uptime: process.uptime(),
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// Election routes
router.get("/elections/stats", electionController.getElectionStats);
router.get("/elections/status", electionController.getElectionStatus);
router.get("/elections", electionController.getAllElections);
router.get("/elections/current", electionController.getCurrentElection); // Add this new route
router.post(
  "/elections",
  authenticateToken,
  checkPermission({ page: "elections", action: "add" }),
  electionController.createElection
);
router.post(
  "/elections/default",
  authenticateToken,
  checkPermission({ page: "elections", action: "add" }),
  electionController.createDefaultElection
);
router.put(
  "/elections/:id/current",
  authenticateToken,
  checkPermission({ page: "elections", action: "edit" }),
  electionController.setCurrentElection
);
router.put(
  "/elections/set-current/:id",
  authenticateToken,
  checkPermission({ page: "elections", action: "edit" }),
  electionController.setCurrentElection
);

router.put(
  "/election/set-current/:id",
  authenticateToken,
  checkPermission({ page: "elections", action: "edit" }),
  electionController.setCurrentElection
);

router.delete(
  "/elections/:id",
  authenticateToken,
  checkPermission({ page: "elections", action: "delete" }),
  electionController.deleteElection
);
router.get("/elections/results", electionController.getElectionResults); // Current election results
router.get(
  "/elections/:electionId/results",
  electionController.getElectionResults
); // Specific election results
router.get(
  "/elections/detailed-vote-analysis",
  electionController.getDetailedVoteAnalysis
); // Add this new route

// Add this new route for toggling election status
router.post(
  "/election/toggle",
  authenticateToken,
  electionController.toggleElectionStatus
);

// Results endpoints
router.get("/results", electionController.getResults);
router.get("/election/status", electionController.getElectionStatus);
router.post(
  "/election/toggle-results",
  authenticateToken,
  checkPermission({ page: "results", action: "edit" }),
  electionController.toggleResultsPublication
);

// Settings routes
router.get(
  "/settings",
  (req, res, next) => {
    // Add cache headers for better client-side caching
    res.set("Cache-Control", "private, max-age=30"); // 30 seconds cache
    res.set("Vary", "Authorization"); // Vary by auth token
    next();
  },
  settingController.getSettings
);

router.put(
  "/settings",
  authenticateToken,
  checkPermission({ page: "settings", action: "edit" }),
  settingController.updateSettings
);
router.post(
  "/settings/backup",
  authenticateToken,
  checkPermission({ page: "settings", action: "add" }),
  settingController.createBackup
);
router.post(
  "/settings/restore",
  authenticateToken,
  checkPermission({ page: "settings", action: "add" }),
  settingController.restoreSystem
);

// Add this route

// Settings existence check - Fix by using imported Setting model
router.get("/settings/check-exists", async (req, res) => {
  try {
    const settings = await Setting.findOne();
    res.status(200).json({ exists: !!settings });
  } catch (error) {
    console.error("Error checking settings existence:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Voter routes
router.get("/voters", voterController.getAllVoters);
router.post(
  "/voters",
  authenticateToken,
  checkPermission({ page: "voters", action: "add" }),
  voterController.createVoter
);

// Add debug middleware to log requests for bulk voter import
router.post(
  "/voters/bulk",
  (req, res, next) => {
    console.log("==== BULK IMPORT DEBUG ====");
    console.log("Request body received:", JSON.stringify(req.body, null, 2));
    console.log("Voters array length:", req.body.voters?.length || 0);

    if (req.body.voters && req.body.voters.length > 0) {
      console.log(
        "First voter sample:",
        JSON.stringify(req.body.voters[0], null, 2)
      );
    } else {
      console.log("No voter data found in request body");
    }

    // Continue to the actual controller
    next();
  },
  authenticateToken,
  checkPermission({ page: "voters", action: "add" }),
  voterController.bulkAddVoters
);

// Debug the bulk voters endpoint by adding a test route
router.get("/voters/bulk-test", async (req, res) => {
  try {
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(400).json({
        message: "No active election found",
        hint: "Run the diagnostics.js script to create a test election",
      });
    }

    return res.status(200).json({
      message: "Endpoint is working, active election exists",
      electionId: currentElection._id,
      electionTitle: currentElection.title,
    });
  } catch (error) {
    console.error("Bulk test error:", error);
    return res
      .status(500)
      .json({ message: "Test route error", error: error.message });
  }
});

router.put(
  "/voters/:id",
  authenticateToken,
  checkPermission({ page: "voters", action: "edit" }),
  voterController.updateVoter
); // Add this missing route
router.put(
  "/voters/:id/vote",
  authenticateToken,
  checkPermission({ page: "voters", action: "edit" }),
  voterController.markVoterAsVoted
);
router.delete(
  "/voters/:id",
  authenticateToken,
  checkPermission({ page: "voters", action: "delete" }),
  voterController.deleteVoter
);

// Add this new route for voter statistics
router.get("/voters/stats", authenticateToken, voterController.getVoterStats);

// Admin routes
router.post("/admin/seed", adminController.seedTestData);

// Position routes
router.get("/positions", positionController.getAllPositions);
router.post(
  "/positions",
  authenticateToken,
  checkPermission({ page: "positions", action: "add" }),
  positionController.createPosition
);
router.post("/positions/seed", positionController.seedDefaultPositions);
router.put(
  "/positions/:id",
  authenticateToken,
  checkPermission({ page: "positions", action: "edit" }),
  positionController.updatePosition
);
router.put(
  "/positions/:id/order",
  authenticateToken,
  checkPermission({ page: "positions", action: "edit" }),
  positionController.updatePositionOrder
);
router.delete(
  "/positions/:id",
  authenticateToken,
  checkPermission({ page: "positions", action: "delete" }),
  positionController.deletePosition
);

// Candidate routes
router.get("/candidates", candidateController.getAllCandidates);
router.post(
  "/candidates",
  authenticateToken,
  checkPermission({ page: "candidates", action: "add" }),
  candidateController.createCandidate
);
router.put(
  "/candidates/:id",
  authenticateToken,
  checkPermission({ page: "candidates", action: "edit" }),
  candidateController.updateCandidate
);
router.delete(
  "/candidates/:id",
  authenticateToken,
  checkPermission({ page: "candidates", action: "delete" }),
  candidateController.deleteCandidate
);
router.get("/candidates/for-voter", getCandidatesForVoter);

// Year routes
router.get("/years", yearController.getAllYears);
router.post(
  "/years",
  authenticateToken,
  checkPermission({ page: "years", action: "add" }),
  yearController.createYear
);
router.put(
  "/years/:id",
  authenticateToken,
  checkPermission({ page: "years", action: "edit" }),
  yearController.updateYear
);
router.put(
  "/years/:id/active",
  authenticateToken,
  checkPermission({ page: "years", action: "edit" }),
  yearController.setActiveYear
);
router.delete(
  "/years/:id",
  authenticateToken,
  checkPermission({ page: "years", action: "delete" }),
  yearController.deleteYear
);

// Class routes
router.get("/classes", classController.getAllClasses);
router.post(
  "/classes",
  authenticateToken,
  checkPermission({ page: "classes", action: "add" }),
  classController.createClass
);
router.put(
  "/classes/:id",
  authenticateToken,
  checkPermission({ page: "classes", action: "edit" }),
  classController.updateClass
);
router.put(
  "/classes/:id/toggle-status",
  authenticateToken,
  checkPermission({ page: "classes", action: "edit" }),
  classController.toggleClassStatus
);
router.delete(
  "/classes/:id",
  authenticateToken,
  checkPermission({ page: "classes", action: "delete" }),
  classController.deleteClass
);

// House routes
router.get("/houses", houseController.getAllHouses);
router.post(
  "/houses",
  authenticateToken,
  checkPermission({ page: "houses", action: "add" }),
  houseController.createHouse
);
router.put(
  "/houses/:id",
  authenticateToken,
  checkPermission({ page: "houses", action: "edit" }),
  houseController.updateHouse
);
router.put(
  "/houses/:id/toggle-status",
  authenticateToken,
  checkPermission({ page: "houses", action: "edit" }),
  houseController.toggleHouseStatus
);
router.delete(
  "/houses/:id",
  authenticateToken,
  checkPermission({ page: "houses", action: "delete" }),
  houseController.deleteHouse
);

// Log routes
router.get("/logs", logController.getAllLogs);
router.post(
  "/logs",
  authenticateToken,
  checkPermission({ page: "logs", action: "add" }),
  logController.createLog
);
router.post(
  "/logs/clear",
  authenticateToken,
  checkPermission({ page: "logs", action: "delete" }),
  logController.clearLogs
);

// Role routes
router.get("/roles", roleController.getAllRoles);
router.post(
  "/roles",
  authenticateToken,
  checkPermission({ page: "roles", action: "add" }),
  roleController.createRole
);
router.put(
  "/roles/:id",
  authenticateToken,
  checkPermission({ page: "roles", action: "edit" }),
  roleController.updateRole
);
router.delete(
  "/roles/:id",
  authenticateToken,
  checkPermission({ page: "roles", action: "delete" }),
  roleController.deleteRole
);
router.put(
  "/roles/:id/toggle-status",
  authenticateToken,
  checkPermission({ page: "roles", action: "edit" }),
  roleController.toggleRoleStatus
);
router.post("/roles/seed", roleController.seedDefaultRoles);

// Auth routes - add debug endpoint
router.post("/auth/login", authController.login);
router.get("/auth/me", authenticateToken, authController.getCurrentUser);
router.post("/auth/seed-admin", authController.seedAdminUser);
router.get("/auth/debug-admin", authController.debugAdmin); // Add this debug route

// Public routes that don't require authentication
router.post("/auth/login", authController.login);
router.post("/auth/register", authController.register);
// router.post("/auth/forgot-password", authController.forgotPassword);
// router.post("/auth/reset-password", authController.resetPassword);

// Public API endpoints needed for the voting system
router.get("/candidates/byPosition", getCandidatesByPosition);
router.get("/voters/recent", getRecentVoters);
router.post("/voters/validate", validateVoter);

// Define submitVote route with a direct function reference, not by variable name
router.post("/votes/submit", submitVote);

// Analytics routes
router.get(
  "/analytics/voting-patterns",
  authenticateToken,
  checkPermission({ page: "analytics", action: "view" }),
  analyticsController.getVotingPatterns
);

router.get(
  "/analytics/position/:positionId/results",
  authenticateToken,
  checkPermission({ page: "analytics", action: "view" }),
  analyticsController.getPositionResults
);

// Add a simplified version of the bulk import endpoint
router.post("/voters/bulk-simple", async (req, res) => {
  try {
    console.log("==== BULK SIMPLE IMPORT ENDPOINT ====");

    // Validate request structure
    if (!req.body.voters || !Array.isArray(req.body.voters)) {
      return res.status(400).json({
        message: "Invalid request format - missing voters array",
        success: 0,
        failed: 0,
        errors: ["Request must include a voters array"],
      });
    }

    const { voters } = req.body;
    console.log(`Processing ${voters.length} voters in simplified endpoint`);

    // Initialize validVoters array
    const validVoters = [];

    // Debug the first voter to see fields
    if (voters.length > 0) {
      console.log("First voter data:", JSON.stringify(voters[0], null, 2));
      console.log("CSV field names:", Object.keys(voters[0]).join(", "));
    }

    // Find current election
    const election = await mongoose
      .model("Election")
      .findOne({ isCurrent: true });
    if (!election) {
      return res.status(400).json({
        message: "No active election found",
        success: 0,
        failed: 0,
        errors: ["No active election found"],
      });
    }

    // Verify election ID is valid
    if (!mongoose.Types.ObjectId.isValid(election._id)) {
      return res.status(400).json({
        message: "Invalid election ID",
        success: 0,
        failed: 0,
        errors: ["Invalid election ID format"],
      });
    }

    // Simple counter for results
    const results = {
      success: 0,
      failed: 0,
      errors: [],
      diagnostics: {
        csvFields: voters.length > 0 ? Object.keys(voters[0]) : [],
        firstRecord: voters.length > 0 ? voters[0] : null,
        matchAttempts: [], // Track matching attempts
      },
    };

    // Check for existing class, house, and year records
    const Class = mongoose.model("Class");
    const House = mongoose.model("House");
    const Year = mongoose.model("Year");
    const Voter = mongoose.model("Voter");

    // Fetch existing records to validate against
    const existingClasses = await Class.find().lean();
    const existingHouses = await House.find().lean();
    const existingYears = await Year.find().lean();

    // Count records for debugging
    console.log(
      `Found ${existingClasses.length} classes, ${existingHouses.length} houses, and ${existingYears.length} years in database`
    );

    // Log all records for debugging
    console.log(
      "All Class records:",
      existingClasses.map((c) => ({ id: c._id, name: c.name }))
    );
    console.log(
      "All Year records:",
      existingYears.map((y) => ({ id: y._id, name: y.name }))
    );
    console.log(
      "All House records:",
      existingHouses.map((h) => ({ id: h._id, name: h.name }))
    );

    // Store available values for both logging and response
    const availableValues = {
      classes: existingClasses.map((c) => c.name),
      houses: existingHouses.map((h) => h.name),
      years: existingYears.map((y) => y.name),
    };

    // Log available values for debugging
    console.log("Available classes:", availableValues.classes);
    console.log("Available houses:", availableValues.houses);
    console.log("Available years:", availableValues.years);

    // Add diagnostic data
    results.diagnostics.availableValues = availableValues;

    // Check for duplicate student IDs
    const existingStudentIds = await Voter.find({}, { studentId: 1 }).lean();
    const existingIds = new Set(
      existingStudentIds.map((v) => v.studentId?.toLowerCase())
    );
    console.log("Existing student IDs count:", existingIds.size);

    // IMPROVED: Helper function to find a match with better case-insensitive comparison
    const findMatchingRecord = (value, records, fieldName = "name") => {
      if (!value) return null;

      // Track all matching attempts for debugging
      const matchingAttempts = [];

      // First try exact match
      const exactMatch = records.find((r) => r[fieldName] === value);
      if (exactMatch) {
        matchingAttempts.push({
          type: "exact",
          value,
          recordValue: exactMatch[fieldName],
          matched: true,
        });
        return { match: exactMatch, attempts: matchingAttempts };
      } else {
        matchingAttempts.push({ type: "exact", value, matched: false });
      }

      // Then try case-insensitive match - with trimming
      try {
        const trimmedValue = value.trim().toLowerCase();

        for (const record of records) {
          if (!record || !record[fieldName]) continue;

          const recordValue = record[fieldName].trim().toLowerCase();
          matchingAttempts.push({
            type: "case-insensitive",
            value: trimmedValue,
            recordValue,
            matched: trimmedValue === recordValue,
          });

          if (trimmedValue === recordValue) {
            return { match: record, attempts: matchingAttempts };
          }
        }

        return { match: null, attempts: matchingAttempts };
      } catch (error) {
        console.error("Error in case-insensitive matching:", error);
        matchingAttempts.push({ type: "error", error: error.message });
        return { match: null, attempts: matchingAttempts };
      }
    };

    // Create voters with improved validation
    for (const voterData of voters) {
      try {
        // Record tracking info
        const processingRecord = {
          name: voterData.name || "Unknown",
          studentId: voterData.studentid || voterData.studentId || "Missing",
          matchAttempts: {
            class: null,
            year: null,
            house: null,
          },
        };

        // Basic data validation - ensure fields exist
        if (
          !voterData.name ||
          !voterData.gender ||
          !voterData.class ||
          !voterData.year ||
          !voterData.house ||
          !(voterData.studentid || voterData.studentId) // Accept either lowercase or camelCase
        ) {
          console.log(
            `Missing required fields for voter: ${JSON.stringify(voterData)}`
          );
          results.failed++;
          results.errors.push(
            `Missing required fields for voter: ${JSON.stringify(voterData)}`
          );
          continue;
        }

        // Use either studentid (from CSV) or studentId property
        const studentId = voterData.studentid || voterData.studentId;

        // Check for duplicate student ID with case-insensitive comparison
        if (existingIds.has(studentId.toLowerCase())) {
          console.log(`Duplicate student ID: ${studentId}`);
          results.failed++;
          results.errors.push(
            `Student ID "${studentId}" already exists in the database`
          );
          continue;
        }

        // More flexible matching for class, year, and house using enhanced case-insensitive comparison
        console.log(`Checking if class ${voterData.class} exists...`);
        const classResult = findMatchingRecord(
          voterData.class,
          existingClasses
        );
        processingRecord.matchAttempts.class = classResult.attempts;

        if (!classResult.match) {
          console.log(`Class not found: ${voterData.class}`);
          results.failed++;
          results.errors.push(
            `Class "${
              voterData.class
            }" does not exist in the database. Available classes: ${availableValues.classes.join(
              ", "
            )}`
          );
          // Add to diagnostics
          results.diagnostics.matchAttempts.push(processingRecord);
          continue;
        }

        const classMatch = classResult.match;
        console.log(`Class match found: ${classMatch.name}`);

        // Use more flexible matching for year - case-insensitive for alphanumeric support
        console.log(`Checking if year ${voterData.year} exists...`);
        const yearResult = findMatchingRecord(voterData.year, existingYears);
        processingRecord.matchAttempts.year = yearResult.attempts;

        if (!yearResult.match) {
          console.log(`Year not found: ${voterData.year}`);
          results.failed++;
          results.errors.push(
            `Year "${
              voterData.year
            }" does not exist in the database. Available years: ${availableValues.years.join(
              ", "
            )}`
          );
          // Add to diagnostics
          results.diagnostics.matchAttempts.push(processingRecord);
          continue;
        }

        const yearMatch = yearResult.match;
        console.log(`Year match found: ${yearMatch.name}`);

        console.log(`Checking if house ${voterData.house} exists...`);
        const houseResult = findMatchingRecord(voterData.house, existingHouses);
        processingRecord.matchAttempts.house = houseResult.attempts;

        if (!houseResult.match) {
          console.log(`House not found: ${voterData.house}`);
          results.failed++;
          results.errors.push(
            `House "${
              voterData.house
            }" does not exist in the database. Available houses: ${availableValues.houses.join(
              ", "
            )}`
          );
          // Add to diagnostics
          results.diagnostics.matchAttempts.push(processingRecord);
          continue;
        }

        const houseMatch = houseResult.match;
        console.log(`House match found: ${houseMatch.name}`);

        // Normalize gender
        const normalizedGender = voterData.gender.toLowerCase().includes("f")
          ? "Female"
          : "Male";

        // First check if voter already exists by studentId (double check)
        const existingVoter = await Voter.findOne({
          studentId: studentId,
        });

        if (existingVoter) {
          console.log(`Voter with student ID ${studentId} already exists`);
          results.failed++;
          results.errors.push(
            `Student ID "${studentId}" already exists for voter ${existingVoter.name}`
          );
          // Add to diagnostics
          results.diagnostics.matchAttempts.push(processingRecord);
          continue;
        }

        // Generate unique voter ID with retry logic
        let voterId;
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 5) {
          const randomDigits = Math.floor(10000 + Math.random() * 90000);
          voterId = `VOTER${randomDigits}`;
          const existingVoterId = await Voter.findOne({ voterId });
          if (!existingVoterId) isUnique = true;
          attempts++;
        }

        if (!isUnique) {
          console.log(
            `Failed to generate unique voter ID after ${attempts} attempts`
          );
          results.failed++;
          results.errors.push(
            `Failed to generate unique voter ID for ${voterData.name}`
          );
          // Add to diagnostics
          results.diagnostics.matchAttempts.push(processingRecord);
          continue;
        }

        // Create voter with exact matching values from database
        const newVoter = new Voter({
          name: voterData.name.trim(),
          gender: normalizedGender,
          class: classMatch.name, // Use exact case from database
          year: yearMatch.name, // Use exact case from database
          house: houseMatch.name, // Use exact case from database
          studentId: studentId.trim(), // Normalize and trim
          voterId: voterData.voterId, // Use the voter's ID from request
          electionId: election._id,
          hasVoted: false,
          createdAt: new Date(),
          _skipVoterIdGeneration: true, // CRITICAL: Always set to true for imports
        });

        // Log the complete voter object before saving
        console.log("About to save voter:", JSON.stringify(newVoter, null, 2));

        // Save with explicit error handling and await
        try {
          const savedVoter = await newVoter.save();
          console.log(
            `Successfully saved voter with ID: ${savedVoter._id}, voterId: ${savedVoter.voterId}`
          );

          // Add the student ID to the set to prevent duplicates in the same batch
          existingIds.add(studentId.toLowerCase());

          validVoters.push(savedVoter);
          results.success++;

          console.log(
            `Successfully added voter: ${savedVoter.name} with ID: ${savedVoter.voterId}`
          );
        } catch (saveError) {
          console.error(`Error saving voter:`, saveError);
          results.failed++;
          results.errors.push(
            `Database error saving voter: ${saveError.message}`
          );
          // Add to diagnostics
          results.diagnostics.matchAttempts.push({
            ...processingRecord,
            saveError: saveError.message,
          });
        }
      } catch (error) {
        console.error(
          `Error processing voter: ${JSON.stringify(voterData)}`,
          error
        );
        results.failed++;
        results.errors.push(
          `Error for voter ${voterData.name || "unknown"}: ${error.message}`
        );
      }
    }

    // Update election stats only if we had successful imports
    if (results.success > 0) {
      try {
        election.totalVoters += results.success;
        await election.save();
        console.log(
          `Updated election stats, new total: ${election.totalVoters}`
        );
      } catch (error) {
        console.error("Error updating election stats:", error);
        // Don't fail the whole operation if this update fails
      }
    }

    console.log(
      `Import completed: ${results.success} success, ${results.failed} failed, ${results.errors.length} errors`
    );
    console.log("Errors:", results.errors);

    return res.status(200).json({
      message: `Imported ${results.success} voters successfully with ${results.failed} failures`,
      success: results.success,
      failed: results.failed,
      errors: results.errors,
      diagnostics: results.diagnostics, // Include diagnostic information in the response
    });
  } catch (error) {
    console.error("Bulk simple import error:", error);
    return res.status(500).json({
      message: "Server error during import",
      error: error.message,
      success: 0,
      failed: req.body?.voters?.length || 0,
      errors: [error.message],
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Add migration routes for existing data
router.post(
  "/years/migrate",
  authenticateToken,
  checkPermission({ page: "years", action: "edit" }),
  yearController.migrateYearsToCurrentElection
);

router.post(
  "/classes/migrate",
  authenticateToken,
  checkPermission({ page: "classes", action: "edit" }),
  classController.migrateClassesToCurrentElection
);

router.post(
  "/houses/migrate",
  authenticateToken,
  checkPermission({ page: "houses", action: "edit" }),
  houseController.migrateHousesToCurrentElection
);

// Add position migration route
router.post(
  "/positions/migrate",
  authenticateToken,
  checkPermission({ page: "positions", action: "edit" }),
  positionController.migratePositionsToCurrentElection
);

// Add election copy route
router.post(
  "/elections/copy-data",
  authenticateToken,
  checkPermission({ page: "elections", action: "edit" }),
  electionController.copyElectionData
);

// Protected Routes - all routes below this middleware require authentication
router.use(authenticateToken);

// User routes
router.get(
  "/users",
  checkPermission("users", "view"),
  authController.getAllUsers
);
router.post(
  "/users",
  checkPermission("users", "add"),
  authController.createUser
);
router.put(
  "/users/:id",
  checkPermission("users", "edit"),
  authController.updateUser
);
router.delete(
  "/users/:id",
  checkPermission("users", "delete"),
  authController.deleteUser
);

// Users by role endpoint (after authentication middleware)
router.get(
  "/users-by-role",
  checkPermission("roles", "view"),
  async (req, res) => {
    try {
      const users = await User.find().select("username email role");

      // Group users by role
      const usersByRole = {};

      for (const user of users) {
        const roleName =
          typeof user.role === "object" ? user.role.name : user.role;

        if (!usersByRole[roleName]) {
          usersByRole[roleName] = [];
        }

        usersByRole[roleName].push({
          id: user._id,
          username: user.username,
          email: user.email,
        });
      }

      res.status(200).json(usersByRole);
    } catch (error) {
      console.error("Error fetching users by role:", error);
      res.status(500).json({
        message: "Error fetching users by role",
        error: error.message,
      });
    }
  }
);

// Users by role endpoint - Add special admin check
router.get("/users-by-role", async (req, res) => {
  try {
    // Double-check admin role for extra security
    const isAdmin =
      req.user?.role?.name?.toLowerCase() === "admin" ||
      (typeof req.user?.role === "string" &&
        req.user?.role.toLowerCase() === "admin");

    if (!isAdmin) {
      console.log("Non-admin tried to access users-by-role", req.user);
      return res.status(403).json({ message: "Admin access required" });
    }

    // Get all users with their roles
    const users = await User.find().select("username email role");

    // Group users by role
    const usersByRole = {};

    for (const user of users) {
      const roleName =
        typeof user.role === "object" ? user.role.name : user.role;

      if (!usersByRole[roleName]) {
        usersByRole[roleName] = [];
      }

      usersByRole[roleName].push({
        id: user._id,
        username: user.username,
        email: user.email,
      });
    }

    res.status(200).json(usersByRole);
  } catch (error) {
    console.error("Error fetching users by role:", error);
    res
      .status(500)
      .json({ message: "Error fetching users by role", error: error.message });
  }
});

// Vote submission
router.post("/votes/submit", submitVote);

// Add this route to help debug permission issues
router.get("/debug/my-permissions", authenticateToken, (req, res) => {
  try {
    // Return the complete user object with permissions
    const user = req.user;
    const roleInfo =
      typeof user.role === "string" ? { name: user.role } : user.role;

    res.json({
      username: user.username,
      role: roleInfo,
      permissions: user.role.permissions || {},
      message: "These are your current permissions",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
