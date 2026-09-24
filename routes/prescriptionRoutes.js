const express = require("express");
const router = express.Router();
const multer = require("multer");
const { GoogleGenAI } = require("@google/genai");
const authMiddleware = require("../middleware/authMiddleware");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only images and PDF files are allowed!"), false);
    }
  },
});

router.use(authMiddleware);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PRESCRIPTION_PROMPT = `
You are a medical prescription OCR and data extraction assistant.

Analyze the provided prescription image or PDF carefully.

Extract ONLY medications that are clearly visible in the prescription.

Return a JSON array.

For every medicine, return:

{
  "name": "Medication name",
  "dosage": "Strength/concentration",
  "form": "Tablet | Capsule | Syrup | Injection | Drops | Ointment | Other",
  "instructions": "Before Food | After Food | With Food | Anytime",
  "frequency": "Daily | Specific Days | As Needed (PRN)",
  "schedules": [
    {
      "time": "HH:MM",
      "dose": "1 tablet"
    }
  ],
  "currentStock": 10,
  "reorderLevel": 5,
  "notes": "Additional instructions"
}

Rules:

1. Do NOT invent medicine names.
2. If a medicine name is unclear, use the closest readable text.
3. If dosage is unclear, return an empty string.
4. If form is unclear, use "Other".
5. If instructions are not mentioned, use "After Food".
6. If frequency is not mentioned, use "Daily".
7. If schedule is not explicitly available, infer it ONLY from standard shorthand:
   - 1-0-1 / BD → 08:00 and 20:00
   - 1-1-1 / TDS → 08:00, 14:00 and 20:00
   - 1-0-0 / OD Morning → 08:00
   - 0-0-1 / OD Night → 21:00
8. Never invent duration or stock information.
9. If duration/stock is not present, currentStock = 10.
10. reorderLevel = 5.
11. Return ONLY valid JSON.
12. No markdown.
13. No explanation.
`;

router.post("/parse", upload.single("prescription"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a prescription image or PDF file.",
      });
    }

    const filePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    // Models to try in order
    const models = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];

    let response = null;
    let lastError = null;

    for (const model of models) {
      try {
        console.log(`🔍 Trying prescription OCR: ${model}`);

        response = await ai.models.generateContent({
          model,

          contents: [
            {
              role: "user",
              parts: [
                {
                  text: PRESCRIPTION_PROMPT,
                },
                filePart,
              ],
            },
          ],

          config: {
            responseMimeType: "application/json",
          },
        });

        if (response?.text) {
          console.log(`✅ Prescription parsed using ${model}`);

          break;
        }
      } catch (error) {
        lastError = error;

        const status = error.status || error.code || error.statusCode;

        const message = error.message || "";

        console.error(`${model} failed:`, status, message);

        // Quota exhausted:
        // DO NOT retry immediately.
        if (
          status === 429 ||
          message.includes("RESOURCE_EXHAUSTED") ||
          message.includes("quota")
        ) {
          console.log(`Quota exhausted for ${model}`);

          continue;
        }

        // Temporary Google server issue
        if (status === 503 || message.includes("UNAVAILABLE")) {
          console.log(`${model} temporarily unavailable`);

          await sleep(2000);
          continue;
        }

        // Other errors
        continue;
      }
    }

    if (!response?.text) {
      throw (
        lastError || new Error("Unable to process prescription at the moment.")
      );
    }

    let cleanJson = response.text.trim();

    // Remove markdown fences if model adds them
    cleanJson = cleanJson
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsedMedicines;

    try {
      parsedMedicines = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("Invalid JSON returned by Gemini:", cleanJson);

      return res.status(502).json({
        success: false,
        message: "AI returned an invalid prescription response.",
      });
    }

    if (!Array.isArray(parsedMedicines)) {
      parsedMedicines = [parsedMedicines];
    }

    return res.status(200).json({
      success: true,
      message: "Prescription parsed successfully",
      count: parsedMedicines.length,
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
