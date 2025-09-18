const express = require("express");
const dotenv = require("dotenv");
const routes = require("./routes");
const db = require("./db"); // just to initialize DB pool

dotenv.config();

const app = express();
app.use(express.json());

// Use routes
app.use("/api", routes);

// Health check endpoint
app.get("/", (req, res) => {
  res.send("✅ Stocky API is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});


const { startScheduler } = require("./scheduler");

// Start hourly price updater
startScheduler();
