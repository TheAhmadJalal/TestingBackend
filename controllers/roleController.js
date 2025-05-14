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

import Role from "../models/Role.js";
import User from "../models/User.js";
import { logActivity } from "./logController.js";

// Get all roles
export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find();
    res.status(200).json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create a new role
export const createRole = async (req, res) => {
  try {
    const { name, description, active, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Role name is required" });
    }

    // Check if role already exists
    const roleExists = await Role.findOne({ name });
    if (roleExists) {
      return res.status(400).json({ message: "Role already exists" });
    }

    // Convert permissions from frontend format to Map for MongoDB
    const permissionsMap = new Map();
    if (permissions) {
      Object.entries(permissions).forEach(([key, value]) => {
        permissionsMap.set(key, value);
      });
    }

    const role = new Role({
      name,
      description: description || "",
      active: active !== undefined ? active : true,
      permissions: permissionsMap,
    });

    await role.save();

    // Log activity
    await logActivity(
      "Created new role",
      req.user?.name || "admin",
      `Role: ${name}`
    );

    res.status(201).json(role);
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update a role
export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, active, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Role name is required" });
    }

    // Check if trying to update to an existing name (excluding current role)
    const existingRole = await Role.findOne({ name, _id: { $ne: id } });
    if (existingRole) {
      return res.status(400).json({ message: "Role name already exists" });
    }

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Convert permissions from frontend format to Map for MongoDB
    if (permissions) {
      role.permissions.clear();
      Object.entries(permissions).forEach(([key, value]) => {
        role.permissions.set(key, value);
      });
    }

    role.name = name;
    role.description = description || "";
    role.active = active !== undefined ? active : role.active;
    role.updatedAt = new Date();

    await role.save();

    // Log activity
    await logActivity(
      "Updated role",
      req.user?.name || "admin",
      `Role: ${name}`
    );

    res.status(200).json(role);
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete a role
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Check if any users are assigned to this role
    const usersWithRole = await User.countDocuments({ role: role.name });
    if (usersWithRole > 0) {
      return res
        .status(400)
        .json({ message: "Cannot delete role with assigned users" });
    }

    await Role.deleteOne({ _id: id });

    // Log activity
    await logActivity(
      "Deleted role",
      req.user?.name || "admin",
      `Role: ${role.name}`
    );

    res.status(200).json({ message: "Role deleted successfully" });
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Toggle role status
export const toggleRoleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    role.active = !role.active;
    await role.save();

    // Log activity
    await logActivity(
      `${role.active ? "Activated" : "Deactivated"} role`,
      req.user?.name || "admin",
      `Role: ${role.name}`
    );

    res.status(200).json(role);
  } catch (error) {
    console.error("Error toggling role status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get users by role
export const getUsersByRole = async (req, res) => {
  try {
    const users = await User.find().select("name email role active");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users by role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Seed default roles
export const seedDefaultRoles = async (req, res) => {
  try {
    // Define the default roles
    const defaultRoles = [
      {
        name: "Admin",
        description: "Full system access",
        active: true,
        permissions: {
          dashboard: { view: true, edit: true, delete: true, add: true },
          positions: { view: true, edit: true, delete: true, add: true },
          candidates: { view: true, edit: true, delete: true, add: true },
          voters: { view: true, edit: true, delete: true, add: true },
          year: { view: true, edit: true, delete: true, add: true },
          class: { view: true, edit: true, delete: true, add: true },
          house: { view: true, edit: true, delete: true, add: true },
          results: { view: true, edit: true, delete: true, add: true },
          dva: { view: true, edit: true, delete: true, add: true },
          log: { view: true, edit: true, delete: true, add: true },
          settings: { view: true, edit: true, delete: true, add: true },
        },
      },
      {
        name: "Supervisor",
        description: "View and edit access, no deletion",
        active: true,
        permissions: {
          dashboard: { view: true, edit: true, delete: false, add: true },
          positions: { view: true, edit: true, delete: false, add: true },
          candidates: { view: true, edit: true, delete: false, add: true },
          voters: { view: true, edit: true, delete: false, add: true },
          year: { view: true, edit: true, delete: false, add: true },
          class: { view: true, edit: true, delete: false, add: true },
          house: { view: true, edit: true, delete: false, add: true },
          results: { view: true, edit: true, delete: false, add: true },
          dva: { view: true, edit: true, delete: false, add: true },
          log: { view: true, edit: true, delete: false, add: true },
          settings: { view: true, edit: true, delete: false, add: true },
        },
      },
      {
        name: "Viewer",
        description: "View-only access",
        active: true,
        permissions: {
          dashboard: { view: true, edit: false, delete: false, add: false },
          positions: { view: true, edit: false, delete: false, add: false },
          candidates: { view: true, edit: false, delete: false, add: false },
          voters: { view: true, edit: false, delete: false, add: false },
          year: { view: true, edit: false, delete: false, add: false },
          class: { view: true, edit: false, delete: false, add: false },
          house: { view: true, edit: false, delete: false, add: false },
          results: { view: true, edit: false, delete: false, add: false },
          dva: { view: true, edit: false, delete: false, add: false },
          log: { view: true, edit: false, delete: false, add: false },
          settings: { view: true, edit: false, delete: false, add: false },
        },
      },
    ];

    for (const roleData of defaultRoles) {
      const { name } = roleData;

      // Check if role exists
      const existingRole = await Role.findOne({ name });
      if (!existingRole) {
        // Convert permissions to Map for MongoDB
        const permissionsMap = new Map();
        Object.entries(roleData.permissions).forEach(([key, value]) => {
          permissionsMap.set(key, value);
        });

        const role = new Role({
          ...roleData,
          permissions: permissionsMap,
        });

        await role.save();
      }
    }

    // Log activity
    await logActivity("Seeded default roles", req.user?.name || "admin");

    res.status(201).json({ message: "Default roles seeded successfully" });
  } catch (error) {
    console.error("Error seeding default roles:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Ensure the createDefaultRoles function properly sets up viewer permissions
export const createDefaultRoles = async () => {
  try {
    // Check if roles already exist
    const count = await Role.countDocuments();
    if (count > 0) {
      console.log("Default roles already exist");
      return { message: "Roles already exist" };
    }

    const resources = [
      "dashboard",
      "positions",
      "candidates",
      "voters",
      "year",
      "class",
      "house",
      "results",
      "log",
      "roles",
      "users",
      "settings",
      "dva",
    ];

    // Create admin role with all permissions
    const adminPermissions = resources.map((resource) => ({
      resource,
      view: true,
      add: true,
      edit: true,
      delete: true,
    }));

    // Create viewer role with only view permissions
    const viewerPermissions = resources.map((resource) => ({
      resource,
      view: true,
      add: false,
      edit: false,
      delete: false,
    }));

    // Create editor role with view and edit permissions
    const editorPermissions = resources.map((resource) => ({
      resource,
      view: true,
      add: true,
      edit: true,
      delete: false,
    }));

    await Role.create([
      {
        name: "Admin",
        description: "Full system access",
        permissions: adminPermissions,
      },
      {
        name: "Viewer",
        description: "View-only access",
        permissions: viewerPermissions,
      },
      {
        name: "Editor",
        description: "Can edit but not delete",
        permissions: editorPermissions,
      },
    ]);

    console.log("Default roles created");
    return { message: "Default roles created successfully" };
  } catch (error) {
    console.error("Error creating default roles:", error);
    throw error;
  }
};
