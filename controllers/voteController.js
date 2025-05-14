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
import Vote from "../models/Vote.js";
import Election from "../models/Election.js";
import Position from "../models/Position.js";
import Candidate from "../models/Candidate.js";
import mongoose from "mongoose";
import crypto from "crypto";
// Add proper import for ActivityLog
import ActivityLog from "../models/ActivityLog.js";
import Setting from "../models/Setting.js"; // Add import for Setting model

// Submit a vote
export const submitVote = async (req, res) => {
  try {
    const { voterId, selections, abstentions } = req.body;

    // Validate request
    if (!voterId) {
      return res.status(400).json({ message: "Voter ID is required" });
    }

    // Log the request for debugging
    console.log("Vote submission request:", {
      voterId,
      selectionsCount: selections?.length || 0,
      abstentionsCount: abstentions?.length || 0,
    });

    // Find the voter
    const voter = await Voter.findOne({ voterId });
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }

    // Get system settings for maxVotesPerVoter
    const settings = await Setting.findOne();
    const maxVotesPerVoter = settings?.maxVotesPerVoter || 1;

    // Check if voter has already voted the maximum allowed times
    if ((voter.voteCount || 0) >= maxVotesPerVoter) {
      return res.status(400).json({
        message: `Voter has already cast ${
          voter.voteCount || 0
        } of ${maxVotesPerVoter} allowed vote(s)`,
        voteCount: voter.voteCount || 0,
        maxVotes: maxVotesPerVoter,
      });
    }

    // Get the current election
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(404).json({ message: "No active election found" });
    }

    // Get all positions for proper reference
    const positions = await Position.find({
      electionId: currentElection._id,
    }).lean();

    // Create position maps
    const positionIdMap = {};
    const positionNameMap = {};

    positions.forEach((position) => {
      // ID -> Name mapping
      if (position._id) {
        positionIdMap[position._id.toString()] = position.title;

        // Also add without quotes if it might be stored that way
        if (typeof position._id === "string") {
          const cleanId = position._id.replace(/"/g, "");
          positionIdMap[cleanId] = position.title;
        }
      }

      // Name -> ID mapping for lookups (NEW)
      if (position.title) {
        positionNameMap[position.title] = position._id.toString();
      }
    });

    console.log("Position name map:", positionNameMap);

    // Generate a vote token as a receipt
    const voteToken = crypto.randomBytes(3).toString("hex").toUpperCase();

    // Get current timestamp for the vote
    const voteTimestamp = new Date();

    // REMOVE THIS CODE - This is causing the issue by deleting previous votes
    // First delete any existing votes for this voter in the current election
    // This helps avoid the duplicate key error
    // await Vote.deleteMany({
    //   voter: voter._id,
    //   election: currentElection._id,
    // });
    // console.log(`Cleared any existing votes for voter ${voter._id}`);

    // Instead, add a new query parameter to distinguish between voting sessions
    const votingSession = Date.now(); // Use timestamp to create unique voting session ID

    // Track positions already voted for to avoid duplicates
    const positionsVotedFor = new Set();

    // Process selections
    const votes = [];
    if (selections && selections.length > 0) {
      for (const selection of selections) {
        // Find the position to get both ID and name
        const position = await Position.findById(selection.positionId).lean();

        if (!position) {
          console.warn(
            `Position not found for ID: ${selection.positionId}. Skipping.`
          );
          continue;
        }

        // Skip if we've already voted for this position
        const positionKey = position.title;
        if (positionsVotedFor.has(positionKey)) {
          console.warn(
            `Duplicate vote for position: ${positionKey}. Skipping.`
          );
          continue;
        }

        // Mark this position as voted for
        positionsVotedFor.add(positionKey);

        votes.push({
          election: currentElection._id,
          position: position.title, // Store position name
          positionId: position._id, // Also store position ID
          candidate: selection.candidateId,
          voter: voter._id,
          timestamp: voteTimestamp,
          isAbstention: false,
          votingSession: votingSession, // Add voting session to differentiate multiple votes
        });
      }
    }

    // Process abstentions separately
    if (abstentions && abstentions.length > 0) {
      console.log(`Processing ${abstentions.length} abstentions:`, abstentions);

      for (const positionIdOrName of abstentions) {
        let positionId = null;
        let positionTitle = null;

        // Check if this is a position name rather than an ID
        if (positionNameMap[positionIdOrName]) {
          // If this is a position name/title, get the ID
          positionId = positionNameMap[positionIdOrName];
          positionTitle = positionIdOrName;
          console.log(
            `Converted position name "${positionIdOrName}" to ID "${positionId}"`
          );
        } else if (positionIdMap[positionIdOrName]) {
          // If this is a position ID, get the title
          positionId = positionIdOrName;
          positionTitle = positionIdMap[positionIdOrName];
        } else {
          // Try to look up the position directly
          try {
            const position = await Position.findById(positionIdOrName);
            if (position) {
              positionId = position._id.toString();
              positionTitle = position.title;
              console.log(`Found position by ID lookup: ${positionTitle}`);
            } else {
              console.warn(
                `Unknown position identifier: ${positionIdOrName}. Skipping abstention.`
              );
              continue; // Skip this abstention if we can't identify the position
            }
          } catch (err) {
            console.warn(
              `Error looking up position: ${positionIdOrName}. Skipping abstention.`
            );
            continue;
          }
        }

        // Skip if we've already voted for this position through selections
        if (positionsVotedFor.has(positionTitle)) {
          console.warn(
            `Already voted for position "${positionTitle}". Skipping abstention.`
          );
          continue;
        }

        // Mark this position as voted for
        positionsVotedFor.add(positionTitle);

        const voteObj = {
          election: currentElection._id,
          position: positionTitle,
          positionId: positionId,
          voter: voter._id,
          isAbstention: true,
          timestamp: voteTimestamp,
          votingSession: votingSession, // Add voting session to differentiate multiple votes
        };

        console.log(`Creating abstention vote for position: ${positionTitle}`);
        votes.push(voteObj);
      }
    }

    // Insert all votes at once (if any)
    if (votes.length > 0) {
      // Use insertMany with ordered:false to continue even if some insertions fail
      const result = await Vote.insertMany(votes, { ordered: false });
      console.log(`Successfully inserted ${result.length} votes`);

      // Create an activity log for the vote submission - fixed implementation
      try {
        await ActivityLog.create({
          action: "vote:submit",
          userId: voter._id,
          user: voter._id,
          entity: "voter",
          entityId: voter._id,
          details: {
            voterId: voter.voterId,
            name: voter.name,
            selections: selections?.length || 0,
            positions: votes.length,
            timestamp: voteTimestamp,
          },
          ipAddress: req.ip || "",
          timestamp: voteTimestamp,
        });

        console.log("Created activity log for vote submission");
      } catch (logError) {
        console.error("Error creating activity log:", logError);
        // Continue execution even if logging fails
      }
    }

    // Increment the vote count instead of just setting hasVoted to true
    voter.voteCount = (voter.voteCount || 0) + 1;

    // Set hasVoted to true regardless (keeps backward compatibility)
    voter.hasVoted = true;
    voter.votedAt = voteTimestamp;

    // Keep the single voteToken field for backward compatibility
    voter.voteToken = voteToken;

    // Also add to the voteTokens array for multi-token tracking
    if (!voter.voteTokens) {
      voter.voteTokens = [];
    }

    voter.voteTokens.push({
      token: voteToken,
      timestamp: voteTimestamp,
    });

    await voter.save();

    // Return success response with token AND timestamp
    res.status(200).json({
      success: true,
      message: "Vote submitted successfully",
      voteToken,
      votedAt: voteTimestamp.toISOString(),
      votesRemaining: maxVotesPerVoter - voter.voteCount,
      // Include the full voteTokens array for multi-vote display
      voteTokens: voter.voteTokens || [
        {
          token: voteToken,
          timestamp: voteTimestamp,
        },
      ],
    });
  } catch (error) {
    console.error("Vote submission error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all votes
export const getVotes = async (req, res) => {
  try {
    const votes = await Vote.find().populate("voter").populate("candidate");
    res.status(200).json(votes);
  } catch (error) {
    console.error("Error getting votes:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving votes",
      error: error.message,
    });
  }
};
