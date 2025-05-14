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
import Vote from "../models/Vote.js";
import Voter from "../models/Voter.js";
import Candidate from "../models/Candidate.js";
import Position from "../models/Position.js";
import mongoose from "mongoose";

// Get voting patterns analysis
export const getVotingPatterns = async (req, res) => {
  try {
    console.log("Generating voting patterns analysis...");
    console.log("Query parameters:", req.query);

    // Get current election
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(404).json({ message: "No active election found" });
    }

    // Build date filters
    const dateFilters = {};
    if (req.query.from) {
      dateFilters.timestamp = { $gte: new Date(req.query.from) };
    }
    if (req.query.to) {
      if (dateFilters.timestamp) {
        // Add end time to include the entire day
        dateFilters.timestamp.$lte = new Date(req.query.to + "T23:59:59.999Z");
      } else {
        dateFilters.timestamp = {
          $lte: new Date(req.query.to + "T23:59:59.999Z"),
        };
      }
    }

    console.log("Date filters:", dateFilters);

    // Position filter
    const positionFilter = {};
    if (req.query.position && req.query.position !== "all") {
      const position = await Position.findById(req.query.position);
      if (position) {
        positionFilter.position = position.title;
        console.log("Position filter applied:", position.title);
      }
    }

    // Get all votes for the current election with filters
    const votes = await Vote.find({
      election: currentElection._id,
      ...dateFilters,
      ...positionFilter,
    })
      .populate("voter")
      .populate("candidate")
      .lean();

    console.log(`Found ${votes.length} votes for analysis after filtering`);

    if (!votes.length) {
      return res.status(200).json({
        totalVotes: 0,
        totalEligibleVoters: 0,
        turnoutPercentage: 0,
        averageVotesPerPosition: 0,
        byClass: [],
        byHouse: [],
        byYear: [],
        votingTimeline: [],
        positions: [],
      });
    }

    // Get all voters to calculate totals
    const allVoters = await Voter.find({
      electionId: currentElection._id,
    }).lean();

    // Add thorough logging and null checking for debugging
    console.log(`Processing ${allVoters.length} voters for demographic data`);

    // Handle missing voter data safely by adding default values
    const processedVoters = allVoters.map((voter) => ({
      year: voter?.year || "Unknown",
      class: voter?.class || "Unknown",
      house: voter?.house || "Unknown",
      gender: voter?.gender || "Unknown",
      hasVoted: voter?.hasVoted || false,
    }));

    // Group voters by demographics
    const votersByYear = groupBy(processedVoters, "year");
    const votersByClass = groupBy(processedVoters, "class");
    const votersByHouse = groupBy(processedVoters, "house");
    const votersByGender = groupBy(processedVoters, "gender");

    // Safely process votes - map only if voter exists and has the required field
    const votesWithSafeFields = votes.map((vote) => {
      // Safely access voter properties with fallbacks
      const voter = vote.voter || {};
      return {
        ...vote,
        safeYear: voter?.year || "Unknown",
        safeClass: voter?.class || "Unknown",
        safeHouse: voter?.house || "Unknown",
        safeGender: voter?.gender || "Unknown",
        safePosition: vote.position || "Unknown Position",
        // Only convert to string if the value exists
        safeCandidateId: vote.candidate?._id
          ? vote.candidate._id.toString()
          : null,
      };
    });

    // Group votes by demographics
    const votesByYear = groupBy(votesWithSafeFields, "safeYear");
    const votesByClass = groupBy(votesWithSafeFields, "safeClass");
    const votesByHouse = groupBy(votesWithSafeFields, "safeHouse");
    const votesByGender = groupBy(votesWithSafeFields, "safeGender");

    // Calculate voting percentages
    const yearLabels = Object.keys(votersByYear);
    const yearData = yearLabels.map((year) => {
      const totalInYear = votersByYear[year].length;
      const votedInYear = votesByYear[year] ? votesByYear[year].length : 0;
      return totalInYear > 0
        ? Math.round((votedInYear / totalInYear) * 100)
        : 0;
    });

    const classLabels = Object.keys(votersByClass);
    const classData = classLabels.map((cls) => {
      const totalInClass = votersByClass[cls].length;
      const votedInClass = votesByClass[cls] ? votesByClass[cls].length : 0;
      return totalInClass > 0
        ? Math.round((votedInClass / totalInClass) * 100)
        : 0;
    });

    const houseLabels = Object.keys(votersByHouse);
    const houseData = houseLabels.map((house) => {
      const totalInHouse = votersByHouse[house].length;
      const votedInHouse = votesByHouse[house] ? votesByHouse[house].length : 0;
      return totalInHouse > 0
        ? Math.round((votedInHouse / totalInHouse) * 100)
        : 0;
    });

    const genderLabels = Object.keys(votersByGender);
    const genderData = genderLabels.map((gender) => {
      const totalInGender = votersByGender[gender].length;
      const votedInGender = votesByGender[gender]
        ? votesByGender[gender].length
        : 0;
      return totalInGender > 0
        ? Math.round((votedInGender / totalInGender) * 100)
        : 0;
    });

    // Process positions and candidates
    const positions = await Position.find({ isActive: true }).lean();
    const positionsData = await Promise.all(
      positions.map(async (position) => {
        try {
          // Get candidates for this position
          const candidates = await Candidate.find({
            positionId: position._id,
            electionId: currentElection._id,
            isActive: true,
          }).lean();

          // Get votes for this position
          const positionVotes = votesWithSafeFields.filter(
            (v) =>
              v.safePosition === position.title ||
              v.safePosition === position.name
          );

          // Count votes per candidate (with null checking)
          const candidateVotes = candidates.map((candidate) => {
            // Only try to match if we have a valid candidate ID
            const candidateId = candidate._id ? candidate._id.toString() : null;

            if (!candidateId) {
              console.log("Warning: Candidate without valid ID:", candidate);
              return { ...candidate, voteCount: 0 };
            }

            // Count votes for this candidate
            const voteCount = positionVotes.filter(
              (vote) => vote.safeCandidateId === candidateId
            ).length;

            return {
              ...candidate,
              voteCount,
            };
          });

          // Count abstentions
          const abstentionCount = positionVotes.filter(
            (v) => v.isAbstention || !v.safeCandidateId
          ).length;

          return {
            position: position.title || position.name || "Unnamed Position",
            candidates: candidateVotes,
            abstentions: abstentionCount,
            totalVotes: positionVotes.length,
          };
        } catch (error) {
          console.error(
            `Error processing position ${position.title || position._id}:`,
            error
          );
          return {
            position: position.title || position.name || "Unnamed Position",
            candidates: [],
            abstentions: 0,
            totalVotes: 0,
            error: error.message,
          };
        }
      })
    );

    // Calculate voter turnout over time
    const votedVoters = allVoters
      .filter((v) => v.hasVoted)
      .sort((a, b) => new Date(a.votedAt || 0) - new Date(b.votedAt || 0));

    const turnoutLabels = [];
    const turnoutData = [];

    if (votedVoters.length > 0) {
      // Get the first and last voting times
      const firstVoteTime = new Date(votedVoters[0].votedAt || Date.now());
      const lastVoteTime = new Date(
        votedVoters[votedVoters.length - 1].votedAt || Date.now()
      );

      // Create hourly intervals
      const intervals = Math.max(
        1,
        Math.ceil((lastVoteTime - firstVoteTime) / (60 * 60 * 1000))
      );

      for (let i = 0; i <= intervals; i++) {
        const intervalTime = new Date(firstVoteTime);
        intervalTime.setHours(firstVoteTime.getHours() + i);

        turnoutLabels.push(
          intervalTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        );

        // Count voters who voted before or at this time
        const votedByThisTime = votedVoters.filter(
          (v) => v.votedAt && new Date(v.votedAt) <= intervalTime
        ).length;

        const percentage = Math.round(
          (votedByThisTime / allVoters.length) * 100
        );
        turnoutData.push(percentage);
      }
    }

    console.log("Successfully generated voting patterns analysis");

    // Add calculation for average votes per position
    const averageVotesPerPosition =
      positions.length > 0 ? votes.length / positions.length : 0;

    // Transform data to match UI expectations
    const responseData = {
      totalVotes: votes.length,
      totalEligibleVoters: allVoters.length,
      turnoutPercentage:
        allVoters.length > 0
          ? Math.round((votes.length / allVoters.length) * 100)
          : 0,
      averageVotesPerPosition: averageVotesPerPosition,
      // Format data for UI charts - transform from {labels, data} to array of objects
      byClass: classLabels.map((cls, index) => ({
        class: cls,
        count: votesByClass[cls] ? votesByClass[cls].length : 0,
        percentage: classData[index] || 0,
      })),
      byHouse: houseLabels.map((house, index) => ({
        house: house,
        count: votesByHouse[house] ? votesByHouse[house].length : 0,
        percentage: houseData[index] || 0,
      })),
      byYear: yearLabels.map((year, index) => ({
        year: year,
        count: votesByYear[year] ? votesByYear[year].length : 0,
        percentage: yearData[index] || 0,
      })),
      votingTimeline: turnoutLabels.map((label, index) => ({
        hour: parseInt(label.split(":")[0]) || index,
        count: votedVoters.filter(
          (v) =>
            v.votedAt &&
            new Date(v.votedAt).getHours() === parseInt(label.split(":")[0])
        ).length,
      })),
      // Include the original data for debugging
      _raw: {
        byYear: { labels: yearLabels, data: yearData },
        byClass: { labels: classLabels, data: classData },
        byHouse: { labels: houseLabels, data: houseData },
        byGender: { labels: genderLabels, data: genderData },
        voterTurnout: { labels: turnoutLabels, data: turnoutData },
      },
      positions: positionsData,
    };

    console.log(
      "Sending formatted analytics response:",
      JSON.stringify(responseData, null, 2).substring(0, 200) + "..."
    );

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error generating voting patterns:", error);
    res.status(500).json({
      message: "Error generating voting patterns",
      error: error.message,
      // Return default data structure to prevent UI errors
      totalVotes: 0,
      totalEligibleVoters: 0,
      turnoutPercentage: 0,
      averageVotesPerPosition: 0,
      byClass: [],
      byHouse: [],
      byYear: [],
      votingTimeline: [],
      positions: [],
    });
  }
};

// Get detailed results for a specific position
export const getPositionResults = async (req, res) => {
  try {
    const { positionId } = req.params;

    if (!positionId || !mongoose.Types.ObjectId.isValid(positionId)) {
      return res.status(400).json({ message: "Valid position ID is required" });
    }

    // Get current election
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(404).json({ message: "No active election found" });
    }

    // Get the position
    const position = await Position.findById(positionId);
    if (!position) {
      return res.status(404).json({ message: "Position not found" });
    }

    // Get candidates for this position
    const candidates = await Candidate.find({
      positionId,
      electionId: currentElection._id,
      isActive: true,
    }).lean();

    // Get votes for this position
    const votes = await Vote.find({
      election: currentElection._id,
      position: position.title || position.name,
    })
      .populate("voter")
      .lean();

    // Process vote data safely
    const candidateResults = candidates.map((candidate) => {
      // Safely convert ID to string with null check
      const candidateId = candidate._id ? candidate._id.toString() : null;

      // Count votes for this candidate (only if we have a valid ID)
      const voteCount = candidateId
        ? votes.filter(
            (vote) =>
              vote.candidate && vote.candidate.toString() === candidateId
          ).length
        : 0;

      return {
        id: candidateId,
        name: candidate.name || "Unnamed Candidate",
        imageUrl: candidate.image || null,
        voteCount,
        percentage:
          votes.length > 0 ? Math.round((voteCount / votes.length) * 100) : 0,
      };
    });

    // Count abstentions
    const abstentionCount = votes.filter((v) => v.isAbstention).length;
    const abstentionPercentage =
      votes.length > 0 ? Math.round((abstentionCount / votes.length) * 100) : 0;

    res.status(200).json({
      position: position.title || position.name,
      totalVotes: votes.length,
      candidates: candidateResults,
      abstentions: {
        count: abstentionCount,
        percentage: abstentionPercentage,
      },
    });
  } catch (error) {
    console.error("Error getting position results:", error);
    res.status(500).json({
      message: "Error getting position results",
      error: error.message,
    });
  }
};

// Helper function to group arrays by a key
function groupBy(array, key) {
  return array.reduce((result, item) => {
    // Use a safe default value if the key doesn't exist
    const keyValue = item[key] || "Unknown";

    // Initialize array if needed
    if (!result[keyValue]) {
      result[keyValue] = [];
    }

    // Add item to array
    result[keyValue].push(item);

    return result;
  }, {});
}
