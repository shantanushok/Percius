import express from "express";
import Indicator from "../validators/indicatorSchema.js";

const router = express.Router();
router.get("/", async (req, res) => {
  try {
    const indicators = await Indicator.find();
    res.json(indicators);
  } catch (err) {
    console.error("❌ Error fetching all indicators:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET indicators by SDG goal number
router.get("/goal/:goal", async (req, res) => {
  try {
    const goal = parseInt(req.params.goal, 10);
    const indicators = await Indicator.find({ sdg_goal: goal });
    res.json(indicators);
  } catch (err) {
    console.error("❌ Error fetching indicators by goal:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET indicator by name (exact match)
router.get("/name/:name", async (req, res) => {
  try {
    // Express already decodes the URL parameter, so we don't need decodeURIComponent
    // unless it's double-encoded
    const name = req.params.name;
    
    console.log(`🔍 Searching for indicator: "${name}"`);
    
    const indicator = await Indicator.findOne({ indicator_name: name });
    
    if (!indicator) {
      console.log(`⚠️ Indicator not found: "${name}"`);
      return res.status(404).json({ message: "Indicator not found" });
    }
    
    console.log(`✅ Found indicator: "${indicator.indicator_name}"`);
    res.json(indicator);
  } catch (err) {
    console.error("❌ Error fetching indicator by name:", err);
    console.error("Stack trace:", err.stack);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

export default router;
