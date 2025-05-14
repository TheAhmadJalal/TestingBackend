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

const LogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    trim: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Change to Mixed type to allow objects
    default: {},
    trim: true,
  },
  resourceId: {
    type: String,
  },
  resourceType: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  electionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Election",
    default: null,
  },
  ipAddress: {
    type: String,
    default: "",
  },
  userAgent: {
    type: String,
    default: "",
  },
});

const Log = mongoose.model("Log", LogSchema);
export default Log;
