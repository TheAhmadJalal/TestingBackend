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

import Voter from "../models/Voter.js";
import Election from "../models/Election.js";
import mongoose from "mongoose";
import Setting from "../models/Setting.js";

// Get all voters
export const getAllVoters = async (req, res) => {
  try {
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(404).json({ message: "No active election found" });
    }

    const voters = await Voter.find({
      electionId: currentElection._id,
    });

    res.status(200).json(voters);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update createVoter function to handle Student ID
export const createVoter = async (req, res) => {
  try {
    const {
      name,
      gender,
      class: className,
      year,
      house,
      studentId,
      voterId,
    } = req.body;

    // Basic validation
    if (!name || !gender || !className || !year || !house || !studentId) {
      return res.status(400).json({
        message:
          "All fields are required: name, gender, class, year, house, and studentId",
      });
    }

    // Find current election
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(400).json({ message: "No active election found" });
    }

    // Create voter with student ID and include the voterId from the request
    const voter = new Voter({
      name,
      gender,
      class: className,
      year,
      house,
      studentId, // Add Student ID
      voterId, // Include voterId from frontend
      electionId: currentElection._id,
      hasVoted: false,
    });

    await voter.save();

    // Update election stats
    currentElection.totalVoters += 1;
    await currentElection.save();

    res.status(201).json(voter);
  } catch (error) {
    console.error("Error creating voter:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update voter details
export const updateVoter = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      gender,
      class: className,
      year,
      house,
      voterId,
      forceVoterIdUpdate,
    } = req.body;

    // Validation
    if (!name || !className || !year || !house) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const voter = await Voter.findById(id);
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }

    // Update voter details
    voter.name = name;
    voter.gender = gender; // Use default if undefined
    voter.class = className;
    voter.year = year;
    voter.house = house;

    // Only update voterId if the forceVoterIdUpdate flag is present and true
    if (forceVoterIdUpdate === true && voterId) {
      console.log(
        `Force updating voter ID from ${voter.voterId} to ${voterId}`
      );
      voter.voterId = voterId;

      // This will tell the pre-save hook not to generate a new ID
      voter._skipVoterIdGeneration = true;
    }

    await voter.save();
    res.status(200).json(voter);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update voter (mark as voted)
export const markVoterAsVoted = async (req, res) => {
  try {
    const { id } = req.params;

    // Get current election
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(404).json({ message: "No active election found" });
    }

    // Find voter
    const voter = await Voter.findById(id);
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }

    // Check if already voted
    if (voter.hasVoted) {
      return res.status(400).json({ message: "Voter has already voted" });
    }

    // Mark as voted
    voter.hasVoted = true;
    voter.votedAt = new Date();
    await voter.save();

    // Update election stats
    currentElection.votedCount++;
    await currentElection.save();

    res.status(200).json(voter);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete voter
export const deleteVoter = async (req, res) => {
  try {
    const { id } = req.params;

    const voter = await Voter.findById(id);
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }

    // Get current election
    const currentElection = await Election.findOne({ isCurrent: true });

    // Delete voter
    await Voter.findByIdAndDelete(id);

    // Update election stats if found
    if (currentElection) {
      currentElection.totalVoters--;
      if (voter.hasVoted) {
        currentElection.votedCount--;
      }
      await currentElection.save();
    }

    res.status(200).json({ message: "Voter deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update bulkAddVoters function to properly handle client-generated IDs
export const bulkAddVoters = async (req, res) => {
  try {
    const { voters } = req.body;

    if (!voters || !Array.isArray(voters)) {
      return res.status(400).json({
        message: "Invalid request format - missing voters array",
        success: 0,
        failed: 0,
        errors: ["Request must include a voters array"],
      });
    }

    const Class = mongoose.model("Class");
    const House = mongoose.model("House");
    const Year = mongoose.model("Year");

    const existingClasses = await Class.find().lean();
    const existingHouses = await House.find().lean();
    const existingYears = await Year.find().lean();

    const findMatchingRecord = (value, records, fieldName = "name") => {
      if (!value) return null;
      const trimmedValue = value.trim().toLowerCase();
      return records.find(
        (record) => record[fieldName]?.trim().toLowerCase() === trimmedValue
      );
    };

    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    // Track processed IDs to prevent duplicates within the batch
    const processedVoterIds = new Set();
    const processedStudentIds = new Set();

    // Generate a 6-character alphanumeric ID that matches the manual entry format
    const generateClientStyleId = () => {
      const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Excluding confusing chars like I, O
      const numbers = "23456789"; // Excluding confusing numbers like 0, 1
      const allCharacters = letters + numbers;

      let result = "";
      for (let i = 0; i < 6; i++) {
        result += allCharacters.charAt(
          Math.floor(Math.random() * allCharacters.length)
        );
      }

      // Ensure at least one number is included
      if (!/[0-9]/.test(result)) {
        const randomPosition = Math.floor(Math.random() * 6);
        const randomNumber = numbers.charAt(
          Math.floor(Math.random() * numbers.length)
        );
        result =
          result.substring(0, randomPosition) +
          randomNumber +
          result.substring(randomPosition + 1);
      }

      return result;
    };

    for (const voter of voters) {
      try {
        // Preserve electionId from request
        const electionId = voter.electionId || req.body.electionId;

        // Get client-generated voterId from the request or generate one
        let voterId = voter.voterId || voter.VoterId; // Handle different casing

        // If no voterId provided in the CSV, generate a client-style ID
        if (!voterId) {
          // Generate IDs until we find one not in the batch and not in the database
          let isUnique = false;
          let attempts = 0;

          while (!isUnique && attempts < 5) {
            voterId = generateClientStyleId();

            // Check if this ID is already in our processed set
            if (!processedVoterIds.has(voterId.toUpperCase())) {
              // Check if it exists in the database
              const existingVoterId = await Voter.findOne({
                voterId: new RegExp(`^${voterId}$`, "i"),
              });

              if (!existingVoterId) isUnique = true;
            }
            attempts++;
          }

          if (!isUnique) {
            // As a last resort, add a timestamp suffix
            const timestamp = Date.now().toString().slice(-4);
            voterId = voterId.substring(0, 2) + timestamp;
          }
        }

        // Check for duplicate voterId within this batch
        if (processedVoterIds.has(voterId.toUpperCase())) {
          throw new Error(
            `Duplicate Voter ID ${voterId} found within import batch`
          );
        }

        // Get studentId with fallback for different casing
        const studentId = voter.studentid || voter.studentId;
        if (!studentId) {
          throw new Error("Missing student ID");
        }

        // Check for duplicate studentId within this batch
        if (processedStudentIds.has(studentId.trim().toLowerCase())) {
          throw new Error(
            `Duplicate Student ID ${studentId} found within import batch`
          );
        }

        // Check for existing records in database
        const existing = await Voter.findOne({
          $or: [
            { voterId: new RegExp(`^${voterId}$`, "i") },
            { studentId: new RegExp(`^${studentId}$`, "i") },
          ],
        });

        if (existing) {
          throw new Error(
            `Duplicate found: ${
              existing.voterId === voterId
                ? "Voter ID " + voterId
                : "Student ID " + studentId
            } already exists in database`
          );
        }

        const classMatch = findMatchingRecord(voter.class, existingClasses);
        const yearMatch = findMatchingRecord(voter.year, existingYears);
        const houseMatch = findMatchingRecord(voter.house, existingHouses);

        if (!classMatch || !yearMatch || !houseMatch) {
          throw new Error(
            `Invalid class/year/house combination: ${voter.class}/${voter.year}/${voter.house}`
          );
        }

        // Create voter with ALL client-provided data including the voterId
        const newVoter = new Voter({
          name: voter.name.trim(),
          studentId: studentId.trim(),
          gender: (voter.gender || "Male").trim(), // Default gender
          class: classMatch.name,
          year: yearMatch.name,
          house: houseMatch.name,
          electionId: electionId,
          voterId: voterId, // Use client-provided or generated ID
          hasVoted: false,
          _skipVoterIdGeneration: true, // CRITICAL: Prevent server-side ID generation
        });

        await newVoter.save();

        // Add to processed sets to prevent duplicates
        processedVoterIds.add(voterId.toUpperCase());
        processedStudentIds.add(studentId.trim().toLowerCase());

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Error processing voter ${voter.name || "unnamed"}: ${error.message}`
        );
      }
    }

    // Update election stats
    if (results.success > 0) {
      const currentElection = await Election.findOne({ isCurrent: true });
      if (currentElection) {
        currentElection.totalVoters += results.success;
        await currentElection.save();
      }
    }

    res.status(200).json({
      message: `Imported ${results.success} voters successfully with ${results.failed} failures`,
      success: results.success,
      failed: results.failed,
      errors: results.errors,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error during import",
      error: error.message,
    });
  }
};

// Get recent voters who have voted
export const getRecentVoters = async (req, res) => {
  try {
    // First find current election to filter voters by
    const currentElection = await Election.findOne({ isCurrent: true });

    if (!currentElection) {
      return res.status(200).json([]); // Return empty array if no current election
    }

    // Now get recent voters filtered by current election
    const recentVoters = await Voter.find({
      hasVoted: true,
      electionId: currentElection._id, // Add this filter to get only voters for current election
      votedAt: { $exists: true },
    })
      .sort({ votedAt: -1 })
      .limit(10) // Increased from 5 to 10 for a better sliding effect
      .select("name voterId votedAt");

    res.status(200).json(recentVoters);
  } catch (error) {
    console.error("Error fetching recent voters:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Validate voter for voting process
export const validateVoter = async (req, res) => {
  try {
    const { voterId, currentElectionId } = req.body;

    if (!voterId) {
      return res.status(400).json({
        success: false,
        message: "Voter ID is required",
      });
    }

    // Convert voterId to uppercase for case-insensitive comparison
    const normalizedVoterId = voterId.toUpperCase();

    // Find voter with case-insensitive search
    const voter = await Voter.findOne({
      $or: [
        { voterId: normalizedVoterId },
        { voterId: { $regex: new RegExp(`^${normalizedVoterId}$`, "i") } },
      ],
    }).lean();

    if (!voter) {
      return res.status(404).json({
        success: false,
        message: "Voter not found",
      });
    }

    // Get settings to check maxVotesPerVoter
    const settings = await Setting.findOne();
    const maxVotesPerVoter = settings?.maxVotesPerVoter || 1;

    // Check if voter belongs to the current election
    if (
      currentElectionId &&
      voter.electionId &&
      voter.electionId.toString() !== currentElectionId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "This voter ID is not registered for the current election",
        errorCode: "WRONG_ELECTION",
      });
    }

    // Check if voter has already used all their votes
    if ((voter.voteCount || 0) >= maxVotesPerVoter) {
      // Format a nice response with voter info for the VoteSuccess component
      return res.status(200).json({
        success: false,
        errorCode: "ALREADY_VOTED",
        message: `This voter has already cast ${
          voter.voteCount || 1
        } of ${maxVotesPerVoter} allowed vote(s)`,
        voter: {
          id: voter._id,
          name: voter.name,
          voterId: voter.voterId,
          votedAt: voter.votedAt,
          voteToken: voter.voteToken,
          voteCount: voter.voteCount || 1,
          maxVotes: maxVotesPerVoter,
          voteTokens: voter.voteTokens || [],
          hasVoted: true,
        },
      });
    }

    // Return the voter data on success with helpful metadata
    return res.status(200).json({
      success: true,
      message: "Voter validated successfully",
      voter: {
        id: voter._id,
        name: voter.name,
        voterId: voter.voterId,
        votedAt: voter.votedAt,
        voteToken: voter.voteToken,
        voteCount: voter.voteCount || 0,
        maxVotes: maxVotesPerVoter,
        hasVoted: false,
      },
    });
  } catch (error) {
    console.error("Error validating voter:", error);
    res.status(500).json({
      success: false,
      message: "Server error during validation",
      error: error.message,
    });
  }
};

// Get voter statistics
export const getVoterStats = async (req, res) => {
  try {
    // Find current election (or use a default one)
    const currentElection = await Election.findOne({ isCurrent: true });

    if (!currentElection) {
      return res.status(200).json({
        totalVoters: 0,
        activeVoters: 0,
        votedVoters: 0,
        votingPercentage: 0,
      });
    }

    // Count voters
    const totalVoters = await Voter.countDocuments();
    const activeVoters = await Voter.countDocuments({ active: true });
    const votedVoters = await Voter.countDocuments({ hasVoted: true });

    // Calculate percentage
    const votingPercentage =
      totalVoters > 0 ? Math.round((votedVoters / totalVoters) * 100) : 0;

    res.status(200).json({
      totalVoters,
      activeVoters,
      votedVoters,
      votingPercentage,
    });
  } catch (error) {
    console.error("Error fetching voter stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
