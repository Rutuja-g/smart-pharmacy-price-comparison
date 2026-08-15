/**
 * Prescription routes.
 *
 * Handles prescription upload, OCR processing, candidate medicine review,
 * user confirmation, and multi-medicine price/availability comparison.
 */

const express = require("express");
const prescriptionController = require("../controllers/prescriptionController");
const { handlePrescriptionUpload } = require("../utils/upload");

const router = express.Router();

// GET /prescription/upload - show upload form
router.get("/upload", prescriptionController.getUpload);

// POST /prescription/process - upload image & process OCR
router.post(
  "/process",
  handlePrescriptionUpload,
  prescriptionController.processUpload,
);

// GET /prescription/review - review candidate terms & select database medicines
router.get("/review", prescriptionController.getReview);

// POST /prescription/confirm - confirm selected medicine IDs
router.post("/confirm", prescriptionController.postConfirm);

// GET /prescription/compare - multi-medicine price and availability comparison
router.get("/compare", prescriptionController.getCompare);

// POST /prescription/reset - reset prescription workflow state
router.post("/reset", prescriptionController.postReset);

module.exports = router;
