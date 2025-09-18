const express = require("express");
const pool = require("./db");

const router = express.Router();

// --- Users ---
router.get("/users", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/users", async (req, res) => {
  const { name, email, external_id } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO users (name, email, external_id) VALUES (?, ?, ?)",
      [name, email, external_id]
    );
    res.json({ id: result.insertId, name, email, external_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- User Holdings ---
router.get("/holdings/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query(
      "SELECT * FROM user_holdings WHERE user_id = ?",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/holdings", async (req, res) => {
  const { user_id, symbol, quantity } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO user_holdings (user_id, symbol, quantity) VALUES (?, ?, ?)",
      [user_id, symbol, quantity]
    );
    res.json({ id: result.insertId, user_id, symbol, quantity });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- Price History ---
router.get("/prices/:symbol", async (req, res) => {
  const { symbol } = req.params;
  try {
    const [rows] = await pool.query(
      "SELECT * FROM price_history WHERE symbol = ? ORDER BY recorded_at DESC",
      [symbol]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/prices", async (req, res) => {
  const { symbol, price_inr } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO price_history (symbol, price_inr, recorded_at) VALUES (?, ?, NOW())",
      [symbol, price_inr]
    );
    res.json({ id: result.insertId, symbol, price_inr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- Reward Events ---
// POST /api/reward (with double-entry ledger tracking)
router.post("/reward", async (req, res) => {
  const { user_id, symbol, quantity } = req.body;

  if (!user_id || !symbol || !quantity) {
    return res
      .status(400)
      .json({ error: "user_id, symbol, and quantity are required" });
  }

  try {
    // --- 1. Get latest stock price
    const [priceRows] = await pool.query(
      `SELECT price_inr FROM price_history
       WHERE symbol = ?
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [symbol]
    );

    if (!priceRows.length) {
      return res
        .status(400)
        .json({ error: "No price available for this stock" });
    }

    const price = parseFloat(priceRows[0].price_inr);
    const totalValue = price * quantity;

    // Example fees
    const brokerage = totalValue * 0.001; // 0.1%
    const stt = totalValue * 0.001;       // 0.1%
    const gst = brokerage * 0.18;         // 18% of brokerage
    const totalFees = brokerage + stt + gst;
    const netOutflow = totalValue + totalFees;

    // --- 2. Insert reward event
    const [rewardResult] = await pool.query(
      `INSERT INTO reward_events (event_id, user_id, symbol, quantity, price_per_share_inr, fees_inr, total_inr, rewarded_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW())`,
      [user_id, symbol, quantity, price, totalFees, netOutflow]
    );

    // --- 3. Update user holdings
    await pool.query(
      `INSERT INTO user_holdings (user_id, symbol, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [user_id, symbol, quantity]
    );

    // --- 4. Ledger entries (double-entry accounting)

    // a) Stock purchase: Debit "Stock Assets", Credit "Cash"
    await pool.query(
      `INSERT INTO ledger_entries (entry_id, debit_account, credit_account, amount_inr, metadata)
       VALUES (UUID(), 'StockAssets', 'Cash', ?, JSON_OBJECT('symbol', ?, 'quantity', ?))`,
      [totalValue, symbol, quantity]
    );

    // b) Fees: Debit "Expenses", Credit "Cash"
    await pool.query(
      `INSERT INTO ledger_entries (entry_id, debit_account, credit_account, amount_inr, metadata)
       VALUES (UUID(), 'Expenses', 'Cash', ?, JSON_OBJECT('symbol', ?, 'brokerage', ?, 'stt', ?, 'gst', ?))`,
      [totalFees, symbol, brokerage.toFixed(2), stt.toFixed(2), gst.toFixed(2)]
    );

    res.json({
      success: true,
      reward_id: rewardResult.insertId,
      symbol,
      quantity,
      price,
      totalValue: totalValue.toFixed(2),
      totalFees: totalFees.toFixed(2),
      netOutflow: netOutflow.toFixed(2),
      message: "Reward recorded successfully with ledger entries"
    });
  } catch (err) {
    console.error("❌ Error inserting reward with ledger:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- Today’s Stocks ---
router.get("/today-stocks/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT symbol, quantity, rewarded_at
       FROM reward_events
       WHERE user_id = ? AND DATE(rewarded_at) = CURDATE()`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching today’s rewards:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- Historical INR (now includes today) ---
router.get("/historical-inr/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT DATE(rewarded_at) AS reward_date, symbol, SUM(quantity) AS total_quantity
       FROM reward_events
       WHERE user_id = ?
       GROUP BY reward_date, symbol
       ORDER BY reward_date DESC`,
      [userId]
    );

    const results = [];
    for (let row of rows) {
      const [priceRows] = await pool.query(
        `SELECT price_inr
         FROM price_history
         WHERE symbol = ?
         ORDER BY recorded_at DESC
         LIMIT 1`,
        [row.symbol]
      );

      const price = priceRows.length ? priceRows[0].price_inr : 0;
      results.push({
        date: row.reward_date,
        symbol: row.symbol,
        quantity: row.total_quantity,
        inr_value: (row.total_quantity * price).toFixed(2),
      });
    }

    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching INR history:", err);
    res.status(500).json({ error: "Database error" });
  }
});


// --- Portfolio (current holdings with INR value) ---
router.get("/portfolio/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // Get user holdings
    const [holdings] = await pool.query(
      `SELECT symbol, quantity
       FROM user_holdings
       WHERE user_id = ?`,
      [userId]
    );

    const results = [];

    for (let h of holdings) {
      // Get latest price for each stock
      const [priceRows] = await pool.query(
        `SELECT price_inr
         FROM price_history
         WHERE symbol = ?
         ORDER BY recorded_at DESC
         LIMIT 1`,
        [h.symbol]
      );

      const price = priceRows.length ? priceRows[0].price_inr : 0;
      results.push({
        symbol: h.symbol,
        quantity: h.quantity,
        latest_price: price,
        total_value_inr: (h.quantity * price).toFixed(2),
      });
    }

    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching portfolio:", err);
    res.status(500).json({ error: "Database error" });
  }
});


// --- Stats: Today's totals + current portfolio value ---
router.get("/stats/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // --- 1. Get today's rewards grouped by stock ---
    const [todayRewards] = await pool.query(
      `SELECT symbol, SUM(quantity) AS total_quantity
       FROM reward_events
       WHERE user_id = ? AND DATE(rewarded_at) = CURDATE()
       GROUP BY symbol`,
      [userId]
    );

    // --- 2. Get current portfolio holdings ---
    const [holdings] = await pool.query(
      `SELECT symbol, quantity
       FROM user_holdings
       WHERE user_id = ?`,
      [userId]
    );

    let portfolioValue = 0;
    const portfolio = [];

    for (let h of holdings) {
      const [priceRows] = await pool.query(
        `SELECT price_inr
         FROM price_history
         WHERE symbol = ?
         ORDER BY recorded_at DESC
         LIMIT 1`,
        [h.symbol]
      );

      const price = priceRows.length ? priceRows[0].price_inr : 0;
      const totalValue = h.quantity * price;
      portfolioValue += totalValue;

      portfolio.push({
        symbol: h.symbol,
        quantity: h.quantity,
        latest_price: price,
        total_value_inr: totalValue.toFixed(2),
      });
    }

    res.json({
      today: todayRewards,
      portfolio_value_inr: portfolioValue.toFixed(2),
      portfolio: portfolio,
    });
  } catch (err) {
    console.error("❌ Error fetching stats:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
