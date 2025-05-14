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

const VoterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  voterId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  studentId: {
    type: String,
    required: true,
    trim: true,
    // Add index but not unique as there could be legacy records without this field
    index: true,
  },
  gender: {
    type: String,
    enum: ["Male", "Female"],
    required: true,
  },
  class: {
    type: String,
    required: true,
    trim: true,
  },
  year: {
    type: String, // String type allows for alphanumeric values
    required: true,
    trim: true,
  },
  house: {
    type: String,
    required: true,
    trim: true,
  },
  electionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Election",
    required: true,
  },
  // Add voteCount field to track the number of votes cast by this voter
  voteCount: {
    type: Number,
    default: 0,
  },
  hasVoted: {
    type: Boolean,
    default: false,
  },
  votedAt: {
    type: Date,
    default: null,
  },
  voteToken: {
    type: String,
    default: null,
  },
  // Add voteTokens array to store all voting history
  voteTokens: [
    {
      token: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add a pre-save hook to normalize the studentId for consistency
VoterSchema.pre("save", function (next) {
  // Trim the studentId to ensure no whitespace issues
  if (this.studentId) {
    this.studentId = this.studentId.trim();
  }

  // Normalize voterId to uppercase for more efficient lookups
  if (this.voterId) {
    this.voterId = this.voterId.toUpperCase();
  }

  next();
});

// Create a compound index for more efficient voter lookup
VoterSchema.index({ voterId: 1, electionId: 1 });

// Add text index on name and studentId for faster searches
VoterSchema.index({ name: "text", studentId: "text" });

// Add a pre-save middleware to ensure voterId is uppercase
VoterSchema.pre("save", function (next) {
  // Only modify voterId if this isn't being skipped
  if (this.voterId && !this._skipVoterIdGeneration) {
    // Ensure voterId is uppercase for consistency
    this.voterId = this.voterId.toUpperCase();

    // Only generate ID for new documents when not skipped and voterId isn't already set
    if (this.isNew && !this.voterId) {
      // Server-side generation fallback (used only if no ID provided)
      this.voterId = `VOTER${Math.floor(10000 + Math.random() * 90000)}`;
    }
  }

  // Reset the skip flag after use
  this._skipVoterIdGeneration = false;

  next();
});

const Voter = mongoose.model("Voter", VoterSchema);
export default Voter;
