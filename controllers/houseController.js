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

import House from "../models/House.js";
import Election from "../models/Election.js";

// Get all houses
export const getAllHouses = async (req, res) => {
  try {
    // Find current election first
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(200).json([]); // Return empty array if no current election
    }

    // Filter houses by current election
    const houses = await House.find({ electionId: currentElection._id }).sort({
      name: 1,
    });
    res.status(200).json(houses);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create a new house
export const createHouse = async (req, res) => {
  try {
    const { name, description, color, active } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ message: "House name is required" });
    }

    if (!color) {
      return res.status(400).json({ message: "House color is required" });
    }

    // Find current election
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(400).json({ message: "No active election found" });
    }

    // Check if house already exists in this election
    const existingHouse = await House.findOne({
      name,
      electionId: currentElection._id,
    });

    if (existingHouse) {
      return res
        .status(400)
        .json({ message: "House already exists in this election" });
    }

    // Create new house with current election ID
    const newHouse = new House({
      name,
      description,
      color,
      active: active !== undefined ? active : true,
      electionId: currentElection._id,
    });

    await newHouse.save();
    res.status(201).json(newHouse);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update a house
export const updateHouse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, active } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ message: "House name is required" });
    }

    if (!color) {
      return res.status(400).json({ message: "House color is required" });
    }

    // Get the house to verify its election
    const house = await House.findById(id);
    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    // Check if name already exists in the same election (excluding this house)
    const existingHouse = await House.findOne({
      name,
      _id: { $ne: id },
      electionId: house.electionId,
    });

    if (existingHouse) {
      return res
        .status(400)
        .json({ message: "House name already exists in this election" });
    }

    // Update house
    const updatedHouse = await House.findByIdAndUpdate(
      id,
      { name, description, color, active },
      { new: true }
    );

    res.status(200).json(updatedHouse);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete a house
export const deleteHouse = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedHouse = await House.findByIdAndDelete(id);
    if (!deletedHouse) {
      return res.status(404).json({ message: "House not found" });
    }

    res.status(200).json({ message: "House deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Toggle house active status
export const toggleHouseStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const house = await House.findById(id);
    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    house.active = !house.active;
    await house.save();

    res.status(200).json(house);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add a function to migrate existing houses to an election
export const migrateHousesToCurrentElection = async (req, res) => {
  try {
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(400).json({ message: "No active election found" });
    }

    // Find houses without electionId
    const unmappedHouses = await House.find({ electionId: { $exists: false } });

    // Update each house with current election ID
    for (const house of unmappedHouses) {
      house.electionId = currentElection._id;
      await house.save();
    }

    res.status(200).json({
      message: `Successfully migrated ${unmappedHouses.length} houses to the current election`,
      migratedCount: unmappedHouses.length,
    });
  } catch (error) {
    console.error("Error migrating houses:", error);
    res
      .status(500)
      .json({ message: "Failed to migrate houses", error: error.message });
  }
};
