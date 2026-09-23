const express = require("express");
const router = express.Router();
const Medicine = require("../models/Medicine");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.post("/", async (req, res) => {
  try {
    const {
      name,
      dosage,
      form,
      instructions,
      frequency,
      schedules,
      startDate,
      endDate,
      currentStock,
      reorderLevel,
      notes,
    } = req.body;

    if (!name || !dosage) {
      return res.status(400).json({
        success: false,
        message: "Medicine name and dosage are required.",
      });
    }

    const medicine = await Medicine.create({
      userId: req.user, // Set by authMiddleware
      name,
      dosage,
      form,
      instructions,
      frequency,
      schedules: schedules || [],
      startDate,
      endDate,
      currentStock,
      reorderLevel,
      notes,
      source: "manual",
    });

    return res.status(201).json({
      success: true,
      message: "Medicine added successfully",
      data: medicine,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/bulk", async (req, res) => {
  try {
    const { medicines } = req.body; // Expects array of medicine objects

    if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of medicines to add.",
      });
    }

    // Map medicines to attach user ID and default source
    const medicinesToInsert = medicines.map((med) => ({
      ...med,
      userId: req.user,
      source: med.source || "prescription_scan",
    }));

    const savedMedicines = await Medicine.insertMany(medicinesToInsert);

    return res.status(201).json({
      success: true,
      message: `${savedMedicines.length} medicines saved successfully.`,
      data: savedMedicines,
    });
  } catch (error) {
    console.error("Bulk Save Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const medicines = await Medicine.find({
      userId: req.user,
      isActive: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: medicines.length,
      data: medicines,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/low-stock", async (req, res) => {
  try {
    const lowStockMedicines = await Medicine.find({
      userId: req.user,
      isActive: true,
      $expr: { $lte: ["$currentStock", "$reorderLevel"] },
    });

    return res.status(200).json({
      success: true,
      count: lowStockMedicines.length,
      data: lowStockMedicines,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const medicine = await Medicine.findOne({
      _id: req.params.id,
      userId: req.user,
      isActive: true,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: medicine,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    let medicine = await Medicine.findOne({
      _id: req.params.id,
      userId: req.user,
      isActive: true,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found or unauthorized",
      });
    }

    medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: "Medicine updated successfully",
      data: medicine,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const medicine = await Medicine.findOne({
      _id: req.params.id,
      userId: req.user,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found or unauthorized",
      });
    }

    medicine.isActive = false;
    await medicine.save();

    return res.status(200).json({
      success: true,
      message: "Medicine deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch("/:id/schedule/:scheduleId/status", async (req, res) => {
  try {
    const { status, date } = req.body; // status: "taken" | "skipped" | "missed", date: "YYYY-MM-DD"
    const targetDate = date || new Date().toISOString().split("T")[0];

    if (!["taken", "skipped", "missed", "pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const medicine = await Medicine.findOne({
      _id: req.params.id,
      userId: req.user,
      isActive: true,
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine not found",
      });
    }

    // Find schedule subdocument by scheduleId
    const schedule = medicine.schedules.id(req.params.scheduleId);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule time slot not found",
      });
    }

    // Find or create takenStatus record for targetDate
    const existingStatusIndex = schedule.takenStatus.findIndex(
      (entry) => entry.date === targetDate,
    );

    const previousStatus =
      existingStatusIndex !== -1
        ? schedule.takenStatus[existingStatusIndex].status
        : "pending";

    if (existingStatusIndex !== -1) {
      schedule.takenStatus[existingStatusIndex].status = status;
    } else {
      schedule.takenStatus.push({ date: targetDate, status });
    }

    // Inventory management: Adjust stock based on status transition
    if (status === "taken" && previousStatus !== "taken") {
      medicine.currentStock = Math.max(0, medicine.currentStock - 1);
    } else if (previousStatus === "taken" && status !== "taken") {
      medicine.currentStock += 1; // Restock if reverting a taken dose
    }

    await medicine.save();

    return res.status(200).json({
      success: true,
      message: `Dose marked as ${status}`,
      data: medicine,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/today", async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

    const medicines = await Medicine.find({
      userId: req.user,
      isActive: true,
    });

    const todayTimeline = [];

    medicines.forEach((med) => {
      med.schedules.forEach((sched) => {
        // Find existing record for today or default to "pending"
        const statusRecord = sched.takenStatus.find(
          (entry) => entry.date === todayStr
        );

        todayTimeline.push({
          medicineId: med._id,
          medicineName: med.name,
          dosage: med.dosage,
          form: med.form,
          instructions: med.instructions,
          scheduleId: sched._id,
          time: sched.time, // e.g. "08:00"
          dose: sched.dose,
          status: statusRecord ? statusRecord.status : "pending",
          currentStock: med.currentStock,
        });
      });
    });

    // Sort timeline chronologically by time
    todayTimeline.sort((a, b) => a.time.localeCompare(b.time));

    return res.status(200).json({
      success: true,
      date: todayStr,
      count: todayTimeline.length,
      data: todayTimeline,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
