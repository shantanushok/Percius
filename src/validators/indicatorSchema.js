import mongoose from "mongoose";

// Define schema
const indicatorSchema = new mongoose.Schema({
  sdg_goal: { type: Number, required: true },
  sdg_name: { type: String, required: true },
  indicator_name: { type: String, required: true },
  description: { type: String },
  significance: { type: String },
  inverse_scale: { type: Boolean, default: false },
});

// Use your actual collection name "Shantanu"
export default mongoose.model("Indicator", indicatorSchema, "Shantanu");
