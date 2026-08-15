/**
 * Multer upload utility for prescription images.
 *
 * Configures multer to store files in memory (RAM buffer) only.
 * Enforces a 5MB maximum file size limit and restricts file types
 * to JPEG, PNG, and WebP.
 */

const multer = require("multer");

// Configure in-memory storage — no files are written to disk.
const storage = multer.memoryStorage();

// Allowed MIME types whitelist
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// 5 MB file size limit in bytes
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      const err = new Error(
        "Invalid file type. Please upload a JPEG, PNG, or WebP image.",
      );
      err.code = "INVALID_FILE_TYPE";
      cb(err, false);
    }
  },
});

/**
 * Express middleware wrapper for single prescription image upload.
 * Catches Multer errors (e.g., file size limit exceeded, invalid type)
 * and formats user-friendly flash messages.
 */
function handlePrescriptionUpload(req, res, next) {
  const singleUpload = upload.single("prescriptionImage");

  singleUpload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        req.flash(
          "error",
          "File is too large. Maximum allowed image size is 5 MB.",
        );
      } else if (err.code === "INVALID_FILE_TYPE") {
        req.flash("error", err.message);
      } else {
        req.flash(
          "error",
          err.message || "Failed to upload image. Please try again.",
        );
      }
      return res.redirect("/prescription/upload");
    }
    next();
  });
}

module.exports = {
  handlePrescriptionUpload,
};
