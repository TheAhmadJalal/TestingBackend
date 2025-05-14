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

import Class from "../models/Class.js";
import Election from "../models/Election.js";

// Get all classes
export const getAllClasses = async (req, res) => {
  try {
    // Find current election first
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(200).json([]); // Return empty array if no current election
    }

    // Filter classes by current election
    const classes = await Class.find({ electionId: currentElection._id }).sort({
      name: 1,
    });
    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create a new class
export const createClass = async (req, res) => {
  try {
    const { name, description, active } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ message: "Class name is required" });
    }

    // Find current election
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(400).json({ message: "No active election found" });
    }

    // Check if class already exists in this election
    const existingClass = await Class.findOne({
      name,
      electionId: currentElection._id,
    });

    if (existingClass) {
      return res
        .status(400)
        .json({ message: "Class already exists in this election" });
    }

    // Create new class with current election ID
    const newClass = new Class({
      name,
      description,
      active: active !== undefined ? active : true,
      electionId: currentElection._id,
    });

    await newClass.save();
    res.status(201).json(newClass);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update a class
export const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, active } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ message: "Class name is required" });
    }

    // Get the class to verify its election
    const classObj = await Class.findById(id);
    if (!classObj) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Check if name already exists in the same election (excluding this class)
    const existingClass = await Class.findOne({
      name,
      _id: { $ne: id },
      electionId: classObj.electionId,
    });

    if (existingClass) {
      return res
        .status(400)
        .json({ message: "Class name already exists in this election" });
    }

    // Update class
    const updatedClass = await Class.findByIdAndUpdate(
      id,
      { name, description, active },
      { new: true }
    );

    res.status(200).json(updatedClass);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete a class
export const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedClass = await Class.findByIdAndDelete(id);
    if (!deletedClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.status(200).json({ message: "Class deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Toggle class active status
export const toggleClassStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const classObj = await Class.findById(id);
    if (!classObj) {
      return res.status(404).json({ message: "Class not found" });
    }

    classObj.active = !classObj.active;
    await classObj.save();

    res.status(200).json(classObj);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add a function to migrate existing classes to an election
export const migrateClassesToCurrentElection = async (req, res) => {
  try {
    const currentElection = await Election.findOne({ isCurrent: true });
    if (!currentElection) {
      return res.status(400).json({ message: "No active election found" });
    }

    // Find classes without electionId
    const unmappedClasses = await Class.find({
      electionId: { $exists: false },
    });

    // Update each class with current election ID
    for (const classObj of unmappedClasses) {
      classObj.electionId = currentElection._id;
      await classObj.save();
    }

    res.status(200).json({
      message: `Successfully migrated ${unmappedClasses.length} classes to the current election`,
      migratedCount: unmappedClasses.length,
    });
  } catch (error) {
    console.error("Error migrating classes:", error);
    res
      .status(500)
      .json({ message: "Failed to migrate classes", error: error.message });
  }
};
