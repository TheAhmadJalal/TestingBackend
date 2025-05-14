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
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Role from "../models/Role.js"; // Add missing Role import

// Enhanced authenticateToken middleware to better handle role permissions
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(401)
        .json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Enhanced role handling
    console.log(`User ${user.username} has role: ${user.role}`);
    if (typeof user.role === "string") {
      console.log(`User ${user.username} has string role: ${user.role}`);
      try {
        // Try to find role by name
        const role = await Role.findOne({ name: user.role });
        if (role) {
          // Convert to plain JavaScript object using lean()
          const roleObj = role.toObject();

          // Now handle permissions
          const permissions = {};
          if (roleObj.permissions) {
            for (const [resource, actions] of Object.entries(
              roleObj.permissions
            )) {
              // Clean the actions object by removing MongoDB-specific fields
              const { _id, __v, ...cleanActions } = actions;
              permissions[resource] = cleanActions;
            }
          }

          // Update user object
          user.role = {
            _id: roleObj._id,
            name: roleObj.name,
            permissions,
          };

          // Explicitly set permissions at root level
          user.permissions = permissions;

          console.log(`Permissions attached:`, Object.keys(permissions));
        } else {
          console.warn(`Role "${user.role}" not found!`);
          user.permissions = {};
        }
      } catch (roleError) {
        console.error("Error resolving role permissions:", roleError);
        // Still continue - just with empty permissions
        user.permissions = {};
      }
    } else if (typeof user.role === "object") {
      // If role is already an object, ensure it has permissions
      if (!user.permissions) {
        if (user.role.permissions) {
          // Make a clean copy to avoid reference issues and remove MongoDB fields
          const cleanPermissions = {};
          for (const [resource, actions] of Object.entries(
            user.role.permissions
          )) {
            const { _id, __v, ...cleanActions } = actions;
            cleanPermissions[resource] = cleanActions;
          }
          user.permissions = cleanPermissions;
        } else {
          user.permissions = {};
        }
      }
    }

    // Log the final permissions for debugging
    console.log(
      `Final permissions for ${user.username}:`,
      Object.keys(user.permissions || {}).length > 0
        ? Object.keys(user.permissions)
        : "No permissions found"
    );

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res
      .status(403)
      .json({ message: "Invalid or expired token", error: error.message });
  }
};

// Helper function to get standardized role name
const getUserRoleName = (roleData) => {
  if (!roleData) return "";

  if (typeof roleData === "string") {
    return roleData.toLowerCase();
  }

  if (typeof roleData === "object" && roleData.name) {
    return roleData.name.toLowerCase();
  }

  return "";
};

// Updated checkPermission middleware to log detailed permission checks
export const checkPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      const roleName = getUserRoleName(req.user?.role);
      const resourceStr =
        typeof resource === "string" ? resource : resource.page;
      const actionStr = typeof action === "string" ? action : resource.action;

      console.log(`[PERMISSION CHECK] ${roleName}/${resourceStr}/${actionStr}`);

      // Special case for admin users - they can do everything
      if (roleName === "admin") {
        console.log("Admin user detected - bypassing permission check");
        return next();
      }

      // Special case for viewer role - they can view everything
      if (roleName === "viewer" && actionStr === "view") {
        console.log("Viewer role detected - allowing view access");
        return next();
      }

      // For other roles or actions, perform normal permission check
      let userRole;

      // Get the user's role object
      if (typeof req.user.role === "string") {
        userRole = await Role.findOne({ name: req.user.role });
        console.log(
          `User ${req.user.username} has string role: ${req.user.role}`
        );
      } else {
        userRole = req.user.role;
      }

      if (!userRole) {
        return res.status(403).json({ message: "Invalid role" });
      }

      // Enhanced permission check with better logging
      let hasPermission = false;
      if (typeof resource === "object" && resource.page) {
        // Handle object-style permission params
        hasPermission =
          userRole.permissions &&
          userRole.permissions.get(resource.page) &&
          userRole.permissions.get(resource.page)[resource.action];

        console.log(
          `Checking ${resource.page}/${resource.action}: ${
            hasPermission ? "GRANTED" : "DENIED"
          }`
        );
      } else {
        // Handle string-style permission params
        hasPermission =
          userRole.permissions &&
          userRole.permissions.get(resource) &&
          userRole.permissions.get(resource)[action];

        console.log(
          `Checking ${resource}/${action}: ${
            hasPermission ? "GRANTED" : "DENIED"
          }`
        );
      }

      if (hasPermission) {
        return next();
      } else {
        return res.status(403).json({
          message: "Access denied",
          details: `You don't have permission to ${actionStr} ${resourceStr}`,
        });
      }
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({
        message: "Error checking permissions",
        error: error.message,
      });
    }
  };
};
