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
import Election from "../models/Election.js";
import Year from "../models/Year.js";
import Class from "../models/Class.js";
import House from "../models/House.js";
import Candidate from "../models/Candidate.js";
import Position from "../models/Position.js";
import Voter from "../models/Voter.js";
import Vote from "../models/Vote.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/e-voting")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Migration function for all data
async function migrateDataToCurrentElection() {
  try {
    console.log("Starting data migration process...");

    // Find current election
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      console.error("No current election found");
      return;
    }

    console.log(
      `Current election: ${currentElection.title} (${currentElection._id})`
    );

    // Migrate Years
    const yearsCount = await migrateCollection(Year, currentElection._id);
    console.log(`Migrated ${yearsCount} years to current election`);

    // Migrate Classes
    const classesCount = await migrateCollection(Class, currentElection._id);
    console.log(`Migrated ${classesCount} classes to current election`);

    // Migrate Houses
    const housesCount = await migrateCollection(House, currentElection._id);
    console.log(`Migrated ${housesCount} houses to current election`);

    // Migrate Positions
    const positionsCount = await migrateCollection(
      Position,
      currentElection._id
    );
    console.log(`Migrated ${positionsCount} positions to current election`);

    // Migrate Candidates
    const candidatesCount = await migrateCollection(
      Candidate,
      currentElection._id
    );
    console.log(`Migrated ${candidatesCount} candidates to current election`);

    // Migrate Voters
    const votersCount = await migrateCollection(Voter, currentElection._id);
    console.log(`Migrated ${votersCount} voters to current election`);

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    // Close the connection
    mongoose.connection.close();
    console.log("Database connection closed");
  }
}

// Helper function to migrate a collection
async function migrateCollection(Model, electionId) {
  // Find items without electionId
  const items = await Model.find({
    $or: [{ electionId: { $exists: false } }, { electionId: null }],
  });

  console.log(
    `Found ${items.length} ${Model.modelName} items without election ID`
  );

  if (items.length === 0) return 0;

  // Update each item
  for (const item of items) {
    item.electionId = electionId;
    await item.save();
  }

  return items.length;
}

// Run the migration
migrateDataToCurrentElection();
