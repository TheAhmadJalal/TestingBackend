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

import Candidate from "../models/Candidate.js";
import Position from "../models/Position.js";
import Election from "../models/Election.js";
import Voter from "../models/Voter.js";

// Simple in-memory cache implementation
const cache = {
  data: new Map(),
  timeouts: new Map(),

  set(key, value, ttlMs = 5 * 60 * 1000) {
    // 5 minute default TTL
    // Clear existing timeout if present
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
    }

    // Set cache data
    this.data.set(key, {
      value,
      timestamp: Date.now(),
    });

    // Set expiration
    const timeout = setTimeout(() => {
      this.data.delete(key);
      this.timeouts.delete(key);
    }, ttlMs);

    this.timeouts.set(key, timeout);
  },

  get(key, maxAge = null) {
    const entry = this.data.get(key);
    if (!entry) return null;

    // Check if cache entry is still valid based on maxAge
    if (maxAge && Date.now() - entry.timestamp > maxAge) {
      return null;
    }

    return entry.value;
  },

  invalidate(keyPattern) {
    // Delete all cache entries that include keyPattern
    for (const key of this.data.keys()) {
      if (key.includes(keyPattern)) {
        if (this.timeouts.has(key)) {
          clearTimeout(this.timeouts.get(key));
          this.timeouts.delete(key);
        }
        this.data.delete(key);
      }
    }
  },
};

// Helper function to escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Cache keys
const POSITION_CACHE_KEY = "positions";
const CANDIDATE_CACHE_PREFIX = "candidates:voter:";

// Get all candidates
export const getAllCandidates = async (req, res) => {
  try {
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(404).json({ message: "No active election found" });
    }

    const candidates = await Candidate.find({
      electionId: currentElection._id,
    });

    // Set cache headers for browser caching
    res.set("Cache-Control", "private, max-age=60"); // 1 minute cache
    res.status(200).json(candidates);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create candidate
export const createCandidate = async (req, res) => {
  try {
    const {
      name,
      positionId,
      image,
      biography,
      year,
      class: className,
      house,
      isActive,
      voterCategory, // Add voterCategory
    } = req.body;

    if (!name || !positionId) {
      return res
        .status(400)
        .json({ message: "Name and position are required" });
    }

    // Check current election
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(404).json({ message: "No active election found" });
    }

    // Check if position exists
    const position = await Position.findById(positionId);
    if (!position) {
      return res.status(404).json({ message: "Position not found" });
    }

    const candidate = new Candidate({
      name,
      positionId,
      electionId: currentElection._id, // Always link to current election
      image: image || "",
      biography: biography || "",
      year: year || "",
      class: className || "",
      house: house || "",
      isActive: isActive === undefined ? true : isActive,
      voterCategory: voterCategory || { type: "all", values: [] }, // Default voterCategory
    });

    await candidate.save();

    // Invalidate caches when a candidate is added
    cache.invalidate(POSITION_CACHE_KEY);
    cache.invalidate(CANDIDATE_CACHE_PREFIX);

    res.status(201).json(candidate);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update candidate
export const updateCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      positionId,
      image,
      biography,
      year,
      class: className,
      house,
      isActive,
      voterCategory, // Add voterCategory
    } = req.body;

    if (!name || !positionId) {
      return res
        .status(400)
        .json({ message: "Name and position are required" });
    }

    // Check if candidate exists
    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    // Check if position exists
    const position = await Position.findById(positionId);
    if (!position) {
      return res.status(404).json({ message: "Position not found" });
    }

    candidate.name = name;
    candidate.positionId = positionId;
    candidate.image = image !== undefined ? image : candidate.image;
    candidate.biography =
      biography !== undefined ? biography : candidate.biography;
    candidate.year = year !== undefined ? year : candidate.year;
    candidate.class = className !== undefined ? className : candidate.class;
    candidate.house = house !== undefined ? house : candidate.house;
    candidate.isActive = isActive !== undefined ? isActive : candidate.isActive;
    candidate.voterCategory =
      voterCategory !== undefined ? voterCategory : candidate.voterCategory;

    await candidate.save();

    // Invalidate caches when a candidate is updated
    cache.invalidate(POSITION_CACHE_KEY);
    cache.invalidate(CANDIDATE_CACHE_PREFIX);

    res.status(200).json(candidate);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete candidate
export const deleteCandidate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if candidate exists
    const candidate = await Candidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    await Candidate.findByIdAndDelete(id);

    // Invalidate caches when a candidate is deleted
    cache.invalidate(POSITION_CACHE_KEY);
    cache.invalidate(CANDIDATE_CACHE_PREFIX);

    res.status(200).json({ message: "Candidate deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all candidates grouped by position
export const getCandidatesByPosition = async (req, res) => {
  try {
    console.log("getCandidatesByPosition endpoint called");

    // Get current election
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      console.log("No active election found");
      return res.status(404).json({ message: "No active election found" });
    }

    console.log(`Current election ID: ${currentElection._id}`);

    // Get all positions in a single query
    const positions = await Position.find({ isActive: true });
    console.log(`Found ${positions.length} active positions`);

    // Create a map of position IDs to position names for quick lookup
    const positionMap = {};
    positions.forEach((position) => {
      const positionName =
        position.title || position.name || `Position ${position._id}`;
      positionMap[position._id.toString()] = positionName;
      console.log(`Mapped position: ${position._id} to ${positionName}`);
    });

    // Fetch all candidates with a single query
    const allCandidates = await Candidate.find({
      electionId: currentElection._id,
      isActive: true,
    }).lean();

    console.log(`Found ${allCandidates.length} total candidates`);

    // Add debug information for each candidate
    allCandidates.forEach((candidate) => {
      console.log(
        `Candidate ${candidate._id}: name=${candidate.name}, positionId=${candidate.positionId}`
      );
    });

    // Group candidates by position in memory
    const candidatesByPosition = {};

    allCandidates.forEach((candidate) => {
      if (!candidate.positionId) {
        console.log(`Candidate ${candidate._id} has no positionId, skipping`);
        return;
      }

      const positionId = candidate.positionId.toString();
      const positionName = positionMap[positionId] || "Unknown Position";

      if (!candidatesByPosition[positionName]) {
        candidatesByPosition[positionName] = [];
      }

      candidatesByPosition[positionName].push({
        id: candidate._id,
        name: candidate.name || "Unnamed Candidate",
        imageUrl: candidate.image || null,
        bio: candidate.biography || "",
        position: positionName,
        positionId: positionId,
      });

      console.log(
        `Mapped candidate ${candidate.name} to position ${positionName}`
      );
    });

    // Log the final structure before sending
    console.log(
      "Final candidatesByPosition structure:",
      Object.entries(candidatesByPosition).map(
        ([key, value]) => `${key}: ${value.length} candidates`
      )
    );

    // Return the actual data from database - no fallback data
    // Add cache headers for the response
    res.set("Cache-Control", "private, max-age=300"); // 5 minutes
    return res.status(200).json(candidatesByPosition);
  } catch (error) {
    console.error("Error in getCandidatesByPosition:", error);
    // Return an empty object instead of fallback data
    return res.status(500).json({
      message: "Error fetching candidates",
      error: error.message,
    });
  }
};

// Get candidates for voter - OPTIMIZED VERSION
export const getCandidatesForVoter = async (req, res) => {
  try {
    const { voterId } = req.query;
    const bypassCache = req.query.refresh === "true";

    if (!voterId) {
      return res.status(400).json({ message: "Voter ID is required" });
    }

    // Check cache first unless bypassing
    const cacheKey = `${CANDIDATE_CACHE_PREFIX}${voterId}`;
    if (!bypassCache) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        // Set cache headers
        res.set({
          "Cache-Control": "private, max-age=300", // 5 minutes
          "X-Cache": "HIT",
        });
        return res.status(200).json(cachedData);
      }
    }

    // Cache miss, fetch data from database
    const voter = await Voter.findOne({ voterId });
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }

    console.log(`Voter found: ${JSON.stringify(voter)}`);

    // Store original (non-normalized) values for matching exact format in DB
    const voterClass = voter.class;
    const voterYear = voter.year;
    const voterHouse = voter.house;

    // Normalize voter's attributes for debugging
    const normalizedClass = voter.class.trim().toLowerCase();
    const normalizedYear = voter.year.trim().toLowerCase();
    const normalizedHouse = voter.house.trim().toLowerCase();

    console.log("Normalized voter attributes:", {
      class: normalizedClass,
      year: normalizedYear,
      house: normalizedHouse,
    });

    console.log("Original voter attributes:", {
      class: voterClass,
      year: voterYear,
      house: voterHouse,
    });

    // Get positions, using cache if available
    let positions;
    const positionsCache = cache.get(POSITION_CACHE_KEY);
    if (positionsCache) {
      positions = positionsCache;
    } else {
      positions = await Position.find({ isActive: true }).lean();
      // Cache the positions for future requests
      cache.set(POSITION_CACHE_KEY, positions);
    }

    // Create a map of position IDs to position names for quick lookup
    const positionMap = {};
    positions.forEach((position) => {
      const positionName =
        position.title || position.name || `Position ${position._id}`;
      positionMap[position._id.toString()] = positionName;
    });

    // Build an optimized query - ensuring we filter by the election ID from the voter
    const query = {
      electionId: voter.electionId, // Use voter's electionId to ensure consistency
      isActive: true, // Only get active candidates
      $or: [
        { "voterCategory.type": "all" },
        { voterCategory: { $exists: false } },
        { "voterCategory.type": { $exists: false } },
        { "voterCategory.values": { $exists: false } },
        { "voterCategory.values": { $size: 0 } },
      ],
    };

    // Add class matching
    if (voterClass) {
      query.$or.push({
        "voterCategory.type": "class",
        "voterCategory.values": {
          $elemMatch: {
            $regex: new RegExp(`^${escapeRegExp(voterClass)}$`, "i"),
          },
        },
      });
    }

    // Add year matching
    if (voterYear) {
      query.$or.push({
        "voterCategory.type": "year",
        "voterCategory.values": {
          $elemMatch: {
            $regex: new RegExp(`^${escapeRegExp(voterYear)}$`, "i"),
          },
        },
      });
    }

    // Add house matching
    if (voterHouse) {
      query.$or.push({
        "voterCategory.type": "house",
        "voterCategory.values": {
          $elemMatch: {
            $regex: new RegExp(`^${escapeRegExp(voterHouse)}$`, "i"),
          },
        },
      });
    }

    // Fetch candidates with optimized fields projection
    const candidates = await Candidate.find(query)
      .select("_id name image biography positionId")
      .lean();

    if (!candidates.length) {
      return res.status(404).json({ message: "No candidates found" });
    }

    // Group candidates by position title - optimized transformation
    const candidatesByPosition = {};

    for (const candidate of candidates) {
      const positionId = candidate.positionId
        ? candidate.positionId.toString()
        : null;
      const positionName = positionMap[positionId] || "General Position";

      if (!candidatesByPosition[positionName]) {
        candidatesByPosition[positionName] = [];
      }

      candidatesByPosition[positionName].push({
        id: candidate._id,
        name: candidate.name,
        imageUrl: candidate.image || null,
        bio: candidate.biography || "",
        position: positionName,
        positionId: candidate.positionId,
      });
    }

    // Cache the results
    cache.set(cacheKey, candidatesByPosition);

    // Set cache headers
    res.set({
      "Cache-Control": "private, max-age=300", // 5 minutes
      "X-Cache": "MISS",
    });

    res.status(200).json(candidatesByPosition);
  } catch (error) {
    console.error("Error fetching candidates for voter:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
