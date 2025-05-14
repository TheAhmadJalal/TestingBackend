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

import Year from "../models/Year.js";
import Election from "../models/Election.js";
import mongoose from "mongoose";

// Get all years
export const getAllYears = async (req, res) => {
  try {
    // Find current election first
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(200).json([]); // Return empty array if no current election
    }

    // Filter years by current election
    const years = await Year.find({ electionId: currentElection._id }).sort({
      name: 1,
    });
    res.status(200).json(years);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create a new year
export const createYear = async (req, res) => {
  try {
    const { name, description, active } = req.body;

    // Find current election
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(400).json({ message: "No active election found" });
    }

    // Create year with current election ID
    const newYear = new Year({
      name,
      description,
      active,
      electionId: currentElection._id,
    });

    await newYear.save();
    res.status(201).json(newYear);
  } catch (error) {
    console.error("Error creating year:", error);
    res
      .status(500)
      .json({ message: "Failed to create year", error: error.message });
  }
};

// Update a year
export const updateYear = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, active } = req.body;

    const updatedYear = await Year.findByIdAndUpdate(
      id,
      { name, description, active },
      { new: true }
    );

    if (!updatedYear) {
      return res.status(404).json({ message: "Year not found" });
    }

    res.status(200).json(updatedYear);
  } catch (error) {
    console.error("Error updating year:", error);
    res
      .status(500)
      .json({ message: "Failed to update year", error: error.message });
  }
};

// Delete a year
export const deleteYear = async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deleting active year
    const year = await Year.findById(id);

    if (!year) {
      return res.status(404).json({ message: "Year not found" });
    }

    if (year.active) {
      return res.status(400).json({ message: "Cannot delete the active year" });
    }

    await Year.findByIdAndDelete(id);
    res.status(200).json({ message: "Year deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Set a year as active
export const setActiveYear = async (req, res) => {
  try {
    const { id } = req.params;

    const year = await Year.findById(id);
    if (!year) {
      return res.status(404).json({ message: "Year not found" });
    }

    year.active = true;
    await year.save();

    res.status(200).json(year);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add a function to migrate existing years to an election
export const migrateYearsToCurrentElection = async (req, res) => {
  try {
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(400).json({ message: "No active election found" });
    }

    // Find years without electionId
    const unmappedYears = await Year.find({ electionId: { $exists: false } });

    // Update each year with current election ID
    for (const year of unmappedYears) {
      year.electionId = currentElection._id;
      await year.save();
    }

    res.status(200).json({
      message: `Successfully migrated ${unmappedYears.length} years to the current election`,
      migratedCount: unmappedYears.length,
    });
  } catch (error) {
    console.error("Error migrating years:", error);
    res
      .status(500)
      .json({ message: "Failed to migrate years", error: error.message });
  }
};
