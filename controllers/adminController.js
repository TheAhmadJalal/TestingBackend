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

import Election from "../models/Election.js";
import Voter from "../models/Voter.js";

// Sample data for voters (same as in seedData.js)
const sampleVoters = [
  {
    name: "John Doe",
    voterId: "V2025001",
    class: "Form 3A",
    year: "2025",
    house: "Red House",
    hasVoted: false,
  },
  {
    name: "Jane Smith",
    voterId: "V2025002",
    class: "Form 3B",
    year: "2025",
    house: "Blue House",
    hasVoted: true,
    votedAt: new Date(),
  },
  // ...continue with other sample voters
];

// Seed database with test data
export const seedTestData = async (req, res) => {
  try {
    // Check if there's existing data
    const electionCount = await Election.countDocuments();
    const voterCount = await Voter.countDocuments();

    if (electionCount > 0 || voterCount > 0) {
      // Only clear data if the request specifically asks for it
      if (req.query.clear === "true" || req.body.clear === true) {
        await Voter.deleteMany({});
        await Election.deleteMany({});
      } else {
        return res.status(400).json({
          message:
            "Database already has data. Use ?clear=true to clear existing data.",
        });
      }
    }

    // Create a default election
    const defaultElection = new Election({
      title: "Student Council Election 2025",
      date: "2025-05-15",
      startTime: "08:00:00",
      endTime: "17:00:00",
      isCurrent: true,
      status: "active",
      totalVoters: sampleVoters.length,
      votedCount: sampleVoters.filter((v) => v.hasVoted).length,
    });

    await defaultElection.save();

    // Create sample voters
    const voters = [];
    for (const voterData of sampleVoters) {
      const voter = new Voter({
        ...voterData,
        electionId: defaultElection._id,
      });
      await voter.save();
      voters.push(voter);
    }

    res.status(200).json({
      message: "Test data seeded successfully",
      election: defaultElection,
      voterCount: voters.length,
    });
  } catch (error) {
    console.error("Error seeding test data:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
