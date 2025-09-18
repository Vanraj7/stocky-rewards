const cron = require("node-cron");
const pool = require("./db");

// List of stocks we want to track
const STOCKS = ["RELIANCE", "TCS", "INFY", "HDFC", "ICICI"];

// Generate a random price between 1000 and 5000
function generateRandomPrice() {
  return (Math.random() * (5000 - 1000) + 1000).toFixed(2);
}

function startScheduler() {
  // Run every minute
  cron.schedule("*/1 * * * *", async () => {

    console.log("⏰ Running hourly stock price updater...");

    try {
      for (let symbol of STOCKS) {
        const price = generateRandomPrice();

        await pool.query(
          `INSERT INTO price_history (symbol, price_inr, recorded_at)
           VALUES (?, ?, NOW())`,
          [symbol, price]
        );

        console.log(`💰 Inserted price for ${symbol}: ₹${price}`);
      }
    } catch (err) {
      console.error("❌ Error updating prices:", err);
    }
  });

  console.log("✅ Scheduler started (updates every hour).");
}

module.exports = { startScheduler };
