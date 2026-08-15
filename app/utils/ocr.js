/**
 * OCR helper for prescription image text extraction using Tesseract.js.
 *
 * Processes in-memory image buffers directly.
 * Parses and filters OCR text to extract candidate medicine terms.
 * IMPORTANT: Raw OCR text and patient information are NEVER logged or saved.
 */

const { createWorker } = require("tesseract.js");

// Common prescription stop-words to exclude from medicine candidates
const STOP_WORDS = new Set([
  "rx",
  "dr",
  "doctor",
  "patient",
  "pharmacy",
  "date",
  "address",
  "phone",
  "tel",
  "sig",
  "take",
  "tabs",
  "tablet",
  "tablets",
  "capsule",
  "capsules",
  "syrup",
  "mg",
  "ml",
  "mcg",
  "daily",
  "times",
  "day",
  "night",
  "oral",
  "refill",
  "qty",
  "quantity",
  "signature",
  "lic",
  "license",
  "clinic",
  "hospital",
  "name",
  "age",
  "sex",
  "gender",
]);

/**
 * Clean a single line of OCR text.
 * Strips special characters, collapses whitespace, and trims.
 * @param {string} line
 * @returns {string}
 */
function sanitizeLine(line) {
  return String(line || "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Determine if a term is a plausible medicine candidate.
 * Excludes pure numbers, stop words, and terms that are too short or too long.
 * @param {string} term
 * @returns {boolean}
 */
function isPlausibleCandidate(term) {
  if (!term || term.length < 3 || term.length > 50) return false;

  // Reject pure numbers
  if (/^\d+$/.test(term)) return false;

  const lower = term.toLowerCase();

  // Reject single stop words
  if (STOP_WORDS.has(lower)) return false;

  // Reject terms consisting solely of numbers and dosage units (e.g., "500mg", "10ml")
  if (/^\d+\s*(mg|ml|mcg|g)$/i.test(lower)) return false;

  return true;
}

/**
 * Process an in-memory image buffer and extract candidate medicine search terms.
 * @param {Buffer} imageBuffer
 * @returns {Promise<Array<string>>} Array of unique candidate strings.
 */
async function extractMedicineCandidates(imageBuffer) {
  if (!imageBuffer || Buffer.isBuffer(imageBuffer) === false) {
    return [];
  }

  let worker;
  try {
    worker = await createWorker("eng");
    const {
      data: { text },
    } = await worker.recognize(imageBuffer);

    await worker.terminate();

    if (!text || typeof text !== "string") {
      return [];
    }

    // Split text into lines
    const lines = text.split(/[\r\n]+/);
    const candidateSet = new Set();

    for (const rawLine of lines) {
      const sanitized = sanitizeLine(rawLine);
      if (!sanitized) continue;

      // Check full sanitized line if reasonably short (e.g., "Advil 200mg")
      if (isPlausibleCandidate(sanitized)) {
        candidateSet.add(sanitized);
      }

      // Also split line into individual words to catch standalone medicine names
      const words = sanitized.split(" ");
      for (const word of words) {
        if (isPlausibleCandidate(word)) {
          candidateSet.add(word);
        }
      }
    }

    return Array.from(candidateSet);
  } catch (err) {
    console.error("OCR extraction processing error:", err.message);
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        // ignore cleanup error
      }
    }
    return [];
  }
}

module.exports = {
  extractMedicineCandidates,
};
