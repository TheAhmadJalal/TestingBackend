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
const { Schema } = mongoose;

const candidateSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    positionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
      required: true,
    },
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election",
      required: true,
      index: true, // Add index for better performance when filtering by election
    },
    image: {
      type: String,
      default: "",
    },
    biography: {
      type: String,
      default: "",
    },
    year: {
      type: String,
      default: "",
    },
    class: {
      type: String,
      default: "",
    },
    house: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    position: {
      type: Schema.Types.ObjectId,
      ref: "Position",
    },
    voterCategory: {
      type: {
        type: String,
        enum: ["all", "class", "year", "house"],
        default: "all",
      },
      values: {
        type: [String],
        default: [],
      },
    },
  },
  { timestamps: true }
);

// Add indexes to improve query performance
candidateSchema.index({ positionId: 1, electionId: 1, isActive: 1 });
candidateSchema.index({ electionId: 1, isActive: 1 });

// Make position field optional to fix compatibility issues
candidateSchema.pre("save", function (next) {
  // Default position to positionId if not set
  if (!this.position && this.positionId) {
    this.position = this.positionId;
  }
  next();
});

export default mongoose.model("Candidate", candidateSchema);
