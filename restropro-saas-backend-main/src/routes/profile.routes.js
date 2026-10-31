const { Router } = require("express");
const { isLoggedIn, isAuthenticated } = require("../middlewares/auth.middleware");
const {
  getProfile,
  updateProfile,
  uploadPhoto,
  removePhoto,
  changePassword,
} = require("../controllers/profile.controller");

const router = Router();

// Profile operations are self-service for the currently authenticated user
router.get("/", isLoggedIn, isAuthenticated, getProfile);
router.post("/update", isLoggedIn, isAuthenticated, updateProfile);
router.post("/upload-photo", isLoggedIn, isAuthenticated, uploadPhoto);
router.delete("/photo", isLoggedIn, isAuthenticated, removePhoto);
router.post("/change-password", isLoggedIn, isAuthenticated, changePassword);

module.exports = router;
