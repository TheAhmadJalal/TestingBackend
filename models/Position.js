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

const positionSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    priority: {
      type: Number,
      default: 0,
    },
    order: {
      type: Number,
      default: 0,
    },
    maxCandidates: {
      type: Number,
      default: 1,
    },
    maxSelections: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election",
      required: true,
      index: true, // Add index for better query performance
    },
  },
  { timestamps: true }
);

// Add compound index for efficient lookups
positionSchema.index({ electionId: 1, isActive: 1 });
positionSchema.index({ electionId: 1, title: 1 }, { unique: true });

export default mongoose.model("Position", positionSchema);
