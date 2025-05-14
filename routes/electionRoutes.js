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

const router = express.Router();

// Modify the route for getting election status to implement caching and reduce logging
router.get("/status", async (req, res) => {
  try {
    // Get cache timestamp query parameter (if provided by client)
    const timestamp = req.query.timestamp;

    // Implement cache response headers
    res.set("Cache-Control", "private, max-age=15"); // Allow client caching for 15 seconds

    // Find current election
    const election = await Election.findOne({ isCurrent: true });

    // If no election exists, create a default response
    if (!election) {
      return res.status(404).json({
        message: "No active election found",
        isActive: false,
        date: new Date().toISOString().split("T")[0],
        // Include voting times even in the no-election case
        votingStartDate: new Date().toISOString().split("T")[0],
        votingStartTime: "08:00",
        votingEndDate: new Date().toISOString().split("T")[0],
        votingEndTime: "17:00",
      });
    }

    // Only log on server once per minute using a simple timestamp check
    const currentMinute = Math.floor(Date.now() / 60000);
    if (
      !global.lastElectionStatusLogMinute ||
      global.lastElectionStatusLogMinute !== currentMinute
    ) {
      console.log("Sending election status with:", {
        startDate: election.startDate,
        endDate: election.endDate,
        date: election.date,
        isActive: election.isActive,
      });
      global.lastElectionStatusLogMinute = currentMinute;
    }

    // Send response with election data, ensuring voting times are included
    res.json({
      _id: election._id,
      title: election.title,
      date: election.date,
      startDate: election.startDate || election.date,
      endDate: election.endDate || election.date,
      startTime: election.startTime || "08:00",
      endTime: election.endTime || "16:00",
      isActive: election.isActive,
      resultsPublished: election.resultsPublished,
      // Add these explicit voting time fields
      votingStartDate: election.startDate || election.date,
      votingEndDate: election.endDate || election.date,
      votingStartTime: election.startTime
        ? election.startTime.substring(0, 5)
        : "08:00",
      votingEndTime: election.endTime
        ? election.endTime.substring(0, 5)
        : "17:00",
    });
  } catch (error) {
    console.error("Error fetching election status:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      // Include voting times even in error case
      votingStartDate: new Date().toISOString().split("T")[0],
      votingStartTime: "08:00",
      votingEndDate: new Date().toISOString().split("T")[0],
      votingEndTime: "17:00",
    });
  }
});

// Add this route to handle setting an election as current
router.put("/elections/set-current/:id", electionController.setCurrentElection);

// Make sure we also expose the original route for compatibility
router.put("/set-current/:id", electionController.setCurrentElection);

// Update this route path to match what's being used in the client
router.put("/elections/:id/order", electionController.updateElectionOrder);

export default router;
