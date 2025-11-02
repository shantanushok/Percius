import express from "express";
import pool from "../config/db.js";

const router = express.Router();

router.post("/upload", async (req, res) => {
  const data = req.body;

  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: "Invalid or empty data array" });
  }

  try {
    const chunkSize = 1000; // process in chunks for performance
    let totalInserted = 0;

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);

      // 🔹 Flatten data into one big array of values
      const values = chunk.flatMap((row) => [
        row.sdg_goal,
        row.sdg_name,
        row.state,
        row.indicator_name,
        row.indicator_value,
        row.year,
        row.source_url,
        row.data_source,
      ]);

      // 🔹 8 columns per row → placeholders increase by 8 each time
      const placeholders = chunk
        .map(
          (_, idx) =>
            `($${idx * 8 + 1}, $${idx * 8 + 2}, $${idx * 8 + 3}, $${idx * 8 + 4}, $${idx * 8 + 5}, $${idx * 8 + 6}, $${idx * 8 + 7}, $${idx * 8 + 8})`
        )
        .join(", ");

      const query = `
        INSERT INTO sdg_data (
          sdg_goal, sdg_name, state, indicator_name, 
          indicator_value, year, source_url, data_source
        )
        VALUES ${placeholders}
        ON CONFLICT (sdg_goal, state, indicator_name, year)
        DO UPDATE SET
          indicator_value = EXCLUDED.indicator_value,
          data_source = EXCLUDED.data_source;
      `;

      const result = await pool.query(query, values);
      totalInserted += result.rowCount;
    }

    return res.json({
      message: "✅ Bulk import complete",
      inserted: totalInserted,
    });
  } catch (err) {
    console.error("❌ Bulk insert failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;


