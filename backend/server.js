require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const eventRoutes = require("./routes/events");
const aggregationRoutes = require("./routes/aggregations");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/events", eventRoutes);
app.use("/aggregations", aggregationRoutes);

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Connect to MongoDB and start server
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/fault_tolerant_db";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
