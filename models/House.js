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

const HouseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
  },
  color: {
    type: String,
    required: true,
    default: "#ef4444", // Default to red
  },
  active: {
    type: Boolean,
    default: true,
  },
  electionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Election",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add an index on the name field for faster lookups
HouseSchema.index({ name: 1 });
// Add an index on the electionId field for faster filtering
HouseSchema.index({ electionId: 1 });

const House = mongoose.model("House", HouseSchema);
export default House;
