import fs from "fs";
import csv from "csv-parser";
import XLSX from "xlsx";
import axios from "axios";
import fspromise from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const API_URL = "http://localhost:5000/api/sdg/upload"; // Express endpoint

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Year extraction will be handled per data file in parseFile()

const sdgGoalIdentifierMap = {
  "kachha houses": { goal: 1, name: "No Poverty" },
  "poverty index": { goal: 1, name: "No Poverty" },
  "poverty line": { goal: 1, name: "No Poverty" },
  "underweight": { goal: 2, name: "Zero Hunger" },
  "stunted": { goal: 2, name: "Zero Hunger" },
  "rice": { goal: 2, name: "Zero Hunger" },
  "maternal mortality": { goal: 3, name: "Good Health and Well-being" },
  "(GPI)": { goal: 4, name: "Quality Education" },
  "dropout": { goal: 4, name: "Quality Education" },
  "literate": { goal: 4, name: "Quality Education" },
  "(LFPR)": { goal: 5, name: "Gender Equality" },
  "sex ratio": { goal: 5, name: "Gender Equality" },
  "(PWS)":{goal: 6, name: "Clean Water and Sanitation"},
  "over-exploited":{goal: 6, name: "Clean Water and Sanitation"},
  "electrified": { goal: 7, name: "Affordable and Clean Energy" },
  "LPG": { goal: 7, name: "Affordable and Clean Energy" },
  "PNG": { goal: 7, name: "Affordable and Clean Energy" },
};

export async function detectSDGGoal(filePath) {
  return new Promise((resolve, reject) => {
    let headersChecked = false;
    let detected = null;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("headers", (headers) => {
        headersChecked = true;

        const lowerHeaders = headers.map((h) => h.toLowerCase());
        for (const header of lowerHeaders) {
          for (const key of Object.keys(sdgGoalIdentifierMap)) {
            if (header.includes(key)) {
              detected = sdgGoalIdentifierMap[key];
              break;
            }
          }
          if (detected) break;
        }
      })
      .on("data", () => {}) // just to advance the stream
      .on("end", () => {
        if (!headersChecked) {
          console.warn(`⚠️ No headers detected for file: ${filePath}`);
          return resolve({ goal: null, name: "Unknown Goal" });
        }

        if (detected) {
          console.log(`✅ Detected SDG Goal: ${detected.name} (SDG ${detected.goal})`);
          resolve(detected);
        } else {
          console.warn(`⚠️ Could not determine SDG goal for file: ${filePath}`);
          resolve({ goal: null, name: "Unknown Goal" });
        }
      })
      .on("error", reject);
  });
}

// 🧩 Auto-detect delimiter
function detectDelimiter(filePath) {
  const firstLine = fs.readFileSync(filePath, "utf8").split("\n")[0];
  if (firstLine.includes("\t")) return "\t";
  if (firstLine.includes(";")) return ";";
  return ","; // default to comma
}

// 🔄 Convert Excel → CSV
function convertExcelToCSV(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const csvData = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
  const tempCSVPath = filePath.replace(/\.xlsx$/i, ".csv");
  fs.writeFileSync(tempCSVPath, csvData);
  return tempCSVPath;
}

// 🧩 Normalize one row (narrow format)
function normalizeRow(row, sdgGoal, sdgName, parsedYear) {
  const lowerRow = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v])
  );

  const indicatorName =
    lowerRow["indicator"] ||
    lowerRow["indicator name"] ||
    lowerRow["indicator_name"] ||
    lowerRow["name of indicator"] ||
    lowerRow["indicators"] ||
    null;

  return {
    sdg_goal: sdgGoal,
    sdg_name: sdgName,
    state: lowerRow["area"] || lowerRow["state"] || lowerRow["ut"] || null,
    indicator_name: indicatorName,
    indicator_value: parseFloat(
      lowerRow["value"] || lowerRow["indicator value"] || "0"
    ),
    year: parsedYear,
    source_url: `https://ik.imagekit.io/sdg/`,
    data_source: "NITI Aayog",
  };
}

// 🧭 Detect if data is wide-format
function isWideFormat(headers) {
  const lower = headers.map((h) => h.toLowerCase());
  const hasIndicatorColumn = lower.some((h) => h.includes("indicator"));
  const likelyWide = !hasIndicatorColumn && lower.length > 3; //minimum columns are more than 3
  return likelyWide;
}

// 📊 Transform wide-format data into row-based records
function transformWideData(rows, headers, sdgGoal, sdgName, parsedYear) {
  const indicatorCols = headers.filter(
    (h) => !["sno", "area", "state", "ut", "district"].includes(h.toLowerCase())
  );

  const data = [];

  for (const row of rows) {
    for (const col of indicatorCols) {
      const value = parseFloat(row[col]);
      if (isNaN(value)) continue;
      data.push({
        sdg_goal: sdgGoal,
        sdg_name: sdgName,
        state: row["Area"] || row["State"] || row["UT"] || null,
        indicator_name: col.trim(),
        indicator_value: value,
        year: parsedYear,
        source_url: "https://ik.imagekit.io/sdg/",
        data_source: "NITI Aayog",
      });
    }
  }

  return data;
}

// 🚀 Parse one file → send in batches
async function parseFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📂 Processing file: ${fileName}`);

  // Extract year from file name (e.g., "data_2022-23.csv")
  const yearMatch = fileName.match(/(\d{4}-\d{2})/);
  console.log("Year Match:", yearMatch);
  let fileYear = yearMatch ? yearMatch[1] : null;
  const parsedYear = fileYear
    ? parseInt(fileYear.split("-")[0])
    : new Date().getFullYear();

  let csvFile = filePath;
  if (filePath.endsWith(".xlsx")) {
    console.log("🔄 Converting Excel → CSV");
    csvFile = convertExcelToCSV(filePath);
  }

  const sep = detectDelimiter(csvFile);
  console.log(`🧩 Using detected delimiter: "${sep}"`);

  // Detect SDG goal
  const match = fileName.match(/sdg_(\d+)_([\w-]+)/i);
  let sdgGoal = match ? parseInt(match[1]) : null;
  let sdgName = match
    ? match[2].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  if (!sdgGoal) {
    console.log("📑 Checking headers to detect SDG goal...");
    try {
      const detected = await detectSDGGoal(csvFile);
      sdgGoal = detected.goal;
      sdgName = detected.name;
    } catch (err) {
      console.error("❌ SDG detection failed:", err.message);
      sdgGoal = null;
      sdgName = "Unknown Goal";
    }
  }

  const rows = [];
  let headers = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(csvFile)
      .pipe(csv({ separator: sep }))
      .on("headers", (h) => (headers = h))
      .on("data", (row) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  let data = [];
  if (isWideFormat(headers)) {
    console.log("📈 Wide-format detected — pivoting columns → rows...");
    data = transformWideData(rows, headers, sdgGoal, sdgName, parsedYear);
  } else {
    data = rows.map((r) => normalizeRow(r, sdgGoal, sdgName, parsedYear));
  }

  console.log(`✅ Prepared ${data.length} records for upload`);

  const valid = data.filter((d) => d.indicator_name);
  if (valid.length < data.length) {
    console.warn(`⚠️ Skipped ${data.length - valid.length} rows (missing indicator_name)`);
  }

  // Upload in chunks
  const chunkSize = 1000;
  for (let i = 0; i < valid.length; i += chunkSize) {
    const chunk = valid.slice(i, i + chunkSize);
    try {
      const response = await axios.post(API_URL, chunk);
      console.log(`📤 Uploaded batch ${i / chunkSize + 1}: ${response.data.inserted} rows`);
    } catch (err) {
      console.error(`❌ Failed to upload batch ${i / chunkSize + 1}:`, err.message);
    }
  }
  
}


async function cleanupDataFolderAsync() {
const dataFolder = path.join(__dirname, "/data");
  try {
    const files = await fspromise.readdir(dataFolder);
    await Promise.all(
      files.map(file => fspromise.unlink(path.join(dataFolder, file)))
    );
    console.log("✅ All data files deleted successfully.");
  } catch (err) {
    console.error("❌ Error cleaning data folder:", err);
  }
}


// 🏁 Main entry — process all files in /data
async function main() {
  const dataDir = path.join(__dirname, "/data");
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith(".csv") || f.endsWith(".xlsx"));

  for (const file of files) {
    await parseFile(path.join(dataDir, file));
  }

  console.log("\n🎯 All files processed successfully.");
  await cleanupDataFolderAsync();
}

main().catch((err) => console.error("💥 Parser failed:", err.message));
