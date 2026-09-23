const express = require("express");
const router = express.Router();
const multer = require("multer");
const { GoogleGenAI } = require("@google/genai");
const authMiddleware = require("../middleware/authMiddleware");

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Memory storage for uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(
        new Error("Only images (PNG, JPEG, WEBP) and PDFs are allowed!"),
        false,
      );
    }
  },
});

router.use(authMiddleware);

// Helper delay function for backoff
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

router.post("/parse", upload.single("prescription"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a prescription image or PDF file.",
      });
    }

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const prompt = `
You are an expert medical OCR assistant. Analyze this prescription image or document carefully.
Extract all medications mentioned and output them strictly as a JSON array of objects.

Output Example:
[
  {
    "name": "Paracetamol",
    "dosage": "500 mg",
    "form": "Tablet",
    "instructions": "After Food",
    "frequency": "Daily",
    "schedules": [
      { "time": "08:00", "dose": "1 tablet" },
      { "time": "20:00", "dose": "1 tablet" }
    ],
    "currentStock": 20,
    "reorderLevel": 5,
    "notes": "Take for fever or body ache"
  }
]

Field Rules:
1. 'name': Medication name (string).
2. 'dosage': Strength or concentration (e.g., '500 mg', '10 ml').
3. 'form': Allowed values: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops', 'Ointment', 'Other']. Default: 'Tablet'.
4. 'instructions': Allowed values: ['Before Food', 'After Food', 'With Food', 'Anytime']. Default: 'After Food'.
5. 'frequency': Allowed values: ['Daily', 'Specific Days', 'As Needed (PRN)']. Default: 'Daily'.
6. 'schedules': Map doctor shorthand/timing to 24-hour time strings:
   - 1-0-1 or BD -> [{"time": "08:00", "dose": "1 dose"}, {"time": "20:00", "dose": "1 dose"}]
   - 1-1-1 or TDS -> [{"time": "08:00", "dose": "1 dose"}, {"time": "14:00", "dose": "1 dose"}, {"time": "20:00", "dose": "1 dose"}]
   - 1-0-0 or OD Morning -> [{"time": "08:00", "dose": "1 dose"}]
   - 0-0-1 or OD Night -> [{"time": "21:00", "dose": "1 dose"}]
7. 'currentStock': Total estimated count based on dosage duration. Default to 10 if unspecified.
8. 'reorderLevel': Default to 5.
9. 'notes': Any special advice (e.g., 'Take with warm water', 'Finish course').

Return ONLY raw JSON with no Markdown, ticks, or explanatory text.
    `;

    // 1. Fetch live available models for your API key dynamically
    let discoveredModels = [];
    try {
      const listRes = await ai.models.list();
      const rawList = listRes.models || listRes;

      if (Array.isArray(rawList)) {
        discoveredModels = rawList
          .map((m) => (m.name ? m.name.replace("models/", "") : m))
          .filter(
            (name) =>
              typeof name === "string" &&
              (name.includes("flash") || name.includes("pro")) &&
              !name.includes("experimental"),
          );
      }
    } catch (e) {
      console.warn("Dynamic model discovery failed:", e.message);
    }

    // Modern supported models list
    const fallbackModels = [
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-2.5-flash",
    ];

    // Merge dynamically discovered models with fallback
    const modelsToTry = [...new Set([...discoveredModels, ...fallbackModels])];

    let response = null;
    let lastError = null;

    // Iterate through model candidates
    for (const modelName of modelsToTry) {
      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(
            `Attempting OCR with model: ${modelName} (Attempt ${attempts})...`,
          );

          response = await ai.models.generateContent({
            model: modelName,
            contents: [prompt, imagePart],
            config: {
              responseMimeType: "application/json",
            },
          });

          if (response && response.text) {
            console.log(
              `✅ Successfully parsed prescription using model: ${modelName}`,
            );
            break;
          }
        } catch (err) {
          lastError = err;
          const status = err.status || err.code || err.statusCode;
          const errorMessage = err.message || "";

          console.warn(
            `Model ${modelName} returned status ${status || "Error"}: ${errorMessage}`,
          );

          if (
            status === 503 ||
            status === 429 ||
            errorMessage.includes("503") ||
            errorMessage.includes("UNAVAILABLE")
          ) {
            if (attempts < maxAttempts) {
              console.log(
                `Server busy (503). Retrying ${modelName} in 1.5s...`,
              );
              await sleep(1500);
              continue;
            }
          }

          // If 404, move immediately to next model
          break;
        }
      }

      if (response && response.text) {
        break;
      }
    }

    if (!response || !response.text) {
      throw (
        lastError ||
        new Error("All Gemini OCR models are currently busy or unavailable.")
      );
    }

    // Clean markdown tick markers
    let cleanJsonText = response.text.trim();
    if (cleanJsonText.startsWith("```json")) {
      cleanJsonText = cleanJsonText
        .replace(/^```json\s*/, "")
        .replace(/\s*```$/, "");
    } else if (cleanJsonText.startsWith("```")) {
      cleanJsonText = cleanJsonText
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");
    }

    // Parse returned JSON string
    const parsedMedicines = JSON.parse(cleanJsonText);

    return res.status(200).json({
      success: true,
      message: "Prescription parsed successfully",
      count: Array.isArray(parsedMedicines) ? parsedMedicines.length : 1,
      data: parsedMedicines,
    });
  } catch (error) {
    console.error("Prescription Parsing Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process prescription image",
    });
  }
});

module.exports = router;
