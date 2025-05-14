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
import dotenv from "dotenv";
import Election from "../models/Election.js";
import Voter from "../models/Voter.js";

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/eVotingSystem")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Sample data for voters
const sampleVoters = [
  {
    name: "John Doe",
    voterId: "V2025001",
    class: "Form 3A",
    year: "2025",
    house: "Red House",
    hasVoted: false,
  },
  {
    name: "Jane Smith",
    voterId: "V2025002",
    class: "Form 3B",
    year: "2025",
    house: "Blue House",
    hasVoted: true,
    votedAt: new Date(),
  },
  {
    name: "Michael Johnson",
    voterId: "V2025003",
    class: "Form 3C",
    year: "2025",
    house: "Green House",
    hasVoted: false,
  },
  {
    name: "Sarah Williams",
    voterId: "V2025004",
    class: "Form 3A",
    year: "2025",
    house: "Yellow House",
    hasVoted: true,
    votedAt: new Date(),
  },
  {
    name: "Robert Brown",
    voterId: "V2024001",
    class: "Form 2A",
    year: "2024",
    house: "Red House",
    hasVoted: false,
  },
  {
    name: "Lisa Davis",
    voterId: "V2024002",
    class: "Form 2B",
    year: "2024",
    house: "Blue House",
    hasVoted: true,
    votedAt: new Date(),
  },
  {
    name: "David Wilson",
    voterId: "V2024003",
    class: "Form 2C",
    year: "2024",
    house: "Green House",
    hasVoted: false,
  },
  {
    name: "Emma Martinez",
    voterId: "V2023001",
    class: "Form 1A",
    year: "2023",
    house: "Yellow House",
    hasVoted: true,
    votedAt: new Date(),
  },
  {
    name: "James Taylor",
    voterId: "V2023002",
    class: "Form 1B",
    year: "2023",
    house: "Red House",
    hasVoted: false,
  },
  {
    name: "Olivia Anderson",
    voterId: "V2023003",
    class: "Form 1C",
    year: "2023",
    house: "Blue House",
    hasVoted: true,
    votedAt: new Date(),
  },
];

const seedDatabase = async () => {
  try {
    // Clear existing data
    console.log("Clearing existing data...");
    await Voter.deleteMany({});
    await Election.deleteMany({});

    // Create default election
    console.log("Creating default election...");
    const defaultElection = new Election({
      title: "Student Council Election 2025",
      date: "2025-05-15",
      startTime: "08:00:00",
      endTime: "17:00:00",
      isCurrent: true,
      status: "active",
      totalVoters: sampleVoters.length,
      votedCount: sampleVoters.filter((v) => v.hasVoted).length,
    });

    await defaultElection.save();
    console.log(`Created election: ${defaultElection._id}`);

    // Create voters linked to the election
    console.log("Creating voters...");
    for (const voterData of sampleVoters) {
      const voter = new Voter({
        ...voterData,
        electionId: defaultElection._id,
      });
      await voter.save();
    }

    console.log(`Created ${sampleVoters.length} voters`);
    console.log("Database seeded successfully");

    // Disconnect from database
    mongoose.disconnect();
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

// Run the seeder
seedDatabase();
