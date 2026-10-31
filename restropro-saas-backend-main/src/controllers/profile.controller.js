const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const { nanoid } = require("nanoid");
const CONFIG = require("../config");
const {
  getProfileDB,
  updateProfileDB,
  updatePhotoDB,
  getUserSecurityDetailsDB,
  changePasswordDB,
} = require("../services/profile.service");
const {
  validateImageFile,
  getActiveStorageConfig,
  getStorageProvider,
  buildObjectKey,
  detectStorageType,
} = require("../utils/imageStorage");

/**
 * Get current user profile details
 */
exports.getProfile = async (req, res) => {
  try {
    const { username, tenant_id: tenantId } = req.user;
    const profile = await getProfileDB(username, tenantId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: req.__("user_not_found") || "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("getProfile controller error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later") || "Something went wrong, please try later",
    });
  }
};

/**
 * Update personal details: name, phone, email, designation
 */
exports.updateProfile = async (req, res) => {
  try {
    const { username, tenant_id: tenantId } = req.user;
    const { name, phone, email, designation } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details") || "Please provide required details",
      });
    }

    await updateProfileDB(
      username,
      name.trim(),
      phone ? phone.trim() : null,
      email ? email.trim() : null,
      designation ? designation.trim() : null,
      tenantId
    );

    const updatedProfile = await getProfileDB(username, tenantId);

    return res.status(200).json({
      success: true,
      message: req.__("profile_updated_successfully") || "Profile updated successfully",
      user: updatedProfile,
    });
  } catch (error) {
    console.error("updateProfile controller error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later") || "Something went wrong, please try later",
    });
  }
};

/**
 * Upload profile avatar image
 */
exports.uploadPhoto = async (req, res) => {
  try {
    const { username, tenant_id: tenantId } = req.user;

    if (!req.files || (!req.files.image && !req.files.photo)) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const file = req.files.image || req.files.photo;

    // Validate file type, magic bytes, and size (up to 5MB)
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    // Get current photo to clean up previous file
    const securityDetails = await getUserSecurityDetailsDB(username, tenantId);
    const oldPhoto = securityDetails?.photo;

    const storageConfig = await getActiveStorageConfig();
    let photoURL;
    const uniqueId = nanoid();

    if (storageConfig.mode === "cloud") {
      const provider = getStorageProvider(storageConfig);
      const objectKey = buildObjectKey(tenantId, "avatars", uniqueId);

      // Clean up old cloud image if present
      if (oldPhoto && detectStorageType(oldPhoto) === "cloud") {
        try {
          await provider.delete(oldPhoto);
        } catch (e) {
          console.error("Old cloud avatar delete error:", e);
        }
      }

      await provider.upload(objectKey, file, file.mimetype);
      photoURL = objectKey;

      try {
        await updatePhotoDB(username, photoURL, tenantId);
      } catch (dbError) {
        try {
          await provider.delete(objectKey);
        } catch (e) {
          console.error("R2 rollback avatar delete failed:", e);
        }
        throw dbError;
      }
    } else {
      // Local storage
      const tenantPublicDir = path.join(__dirname, `../../public/${tenantId}/avatars/`);
      if (!fs.existsSync(tenantPublicDir)) {
        fs.mkdirSync(tenantPublicDir, { recursive: true });
      }

      // Delete old local avatar if present
      if (oldPhoto && detectStorageType(oldPhoto) === "local") {
        const oldPhotoPath = path.join(__dirname, "../../", oldPhoto);
        if (fs.existsSync(oldPhotoPath)) {
          try {
            fs.unlinkSync(oldPhotoPath);
          } catch (e) {
            console.error("Old local avatar unlink error:", e);
          }
        }
      }

      const fileExtension = path.extname(file.name) || ".jpg";
      const filename = `${uniqueId}${fileExtension}`;
      const imagePath = path.join(tenantPublicDir, filename);
      photoURL = `/public/${tenantId}/avatars/${filename}`;

      await file.mv(imagePath);
      await updatePhotoDB(username, photoURL, tenantId);
    }

    const updatedProfile = await getProfileDB(username, tenantId);

    return res.status(200).json({
      success: true,
      message: req.__("avatar_uploaded_successfully") || "Profile photo uploaded successfully",
      photo: photoURL,
      user: updatedProfile,
    });
  } catch (error) {
    console.error("uploadPhoto controller error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later") || "Something went wrong, please try later",
    });
  }
};

/**
 * Remove custom profile avatar and revert to default
 */
exports.removePhoto = async (req, res) => {
  try {
    const { username, tenant_id: tenantId } = req.user;
    const securityDetails = await getUserSecurityDetailsDB(username, tenantId);
    const oldPhoto = securityDetails?.photo;

    if (oldPhoto) {
      if (detectStorageType(oldPhoto) === "cloud") {
        const storageConfig = await getActiveStorageConfig();
        if (storageConfig.mode === "cloud") {
          const provider = getStorageProvider(storageConfig);
          try {
            await provider.delete(oldPhoto);
          } catch (e) {
            console.error("Cloud avatar delete error:", e);
          }
        }
      } else if (detectStorageType(oldPhoto) === "local") {
        const oldPhotoPath = path.join(__dirname, "../../", oldPhoto);
        if (fs.existsSync(oldPhotoPath)) {
          try {
            fs.unlinkSync(oldPhotoPath);
          } catch (e) {
            console.error("Local avatar unlink error:", e);
          }
        }
      }
    }

    await updatePhotoDB(username, null, tenantId);
    const updatedProfile = await getProfileDB(username, tenantId);

    return res.status(200).json({
      success: true,
      message: req.__("avatar_removed_successfully") || "Profile photo removed",
      user: updatedProfile,
    });
  } catch (error) {
    console.error("removePhoto controller error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later") || "Something went wrong, please try later",
    });
  }
};

/**
 * Change account password verifying current password first
 */
exports.changePassword = async (req, res) => {
  try {
    const { username, tenant_id: tenantId } = req.user;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: req.__("please_provide_required_details") || "Please provide current and new password",
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation do not match",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const securityDetails = await getUserSecurityDetailsDB(username, tenantId);
    if (!securityDetails || !securityDetails.password) {
      return res.status(404).json({
        success: false,
        message: req.__("user_not_found") || "User not found",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, securityDetails.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const encryptedPassword = await bcrypt.hash(newPassword, CONFIG.PASSWORD_SALT);
    const currentRefreshToken = req.cookies?.refreshToken || req.refreshToken || null;

    await changePasswordDB(username, encryptedPassword, tenantId, currentRefreshToken);

    return res.status(200).json({
      success: true,
      message: req.__("password_updated_successfully") || "Password updated successfully",
    });
  } catch (error) {
    console.error("changePassword controller error:", error);
    return res.status(500).json({
      success: false,
      message: req.__("something_went_wrong_try_later") || "Something went wrong, please try later",
    });
  }
};
