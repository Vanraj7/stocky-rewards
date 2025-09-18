// src/priceService.js
const pool = require('./db');
const { v4: uuidv4 } = require('uuid');

/**
 * Fake price fetcher that returns a random price for a given symbol.
 * In production you'd call an external market data API.
 */
async function fetchPriceForSymbol(symbol) {
  // deterministic-ish "random" price by symbol hash + current hour
  const base = (symbol.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 2000) + 1000;
  const noise = Math.random() * 200 - 100;
  const price = Math.max(1, base + noise);
  return Number(price.toFixed(4));
}

async function recordPrice(symbol, price, recordedAt = new Date()) {
  const sql = `INSERT INTO price_history (symbol, price_inr, recorded_at)
               VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE price_inr = VALUES(price_inr)`;
  // We want uniqueness by (symbol, recorded_at). For simplicity we store hourly rounded time.
  // We'll round recordedAt to hour
  const rounded = new Date(recordedAt);
  rounded.setMinutes(0,0,0);
  const conn = await pool.getConnection();
  try {
    await conn.execute(sql, [symbol, price, rounded]);
  } finally {
    conn.release();
  }
}

/**
 * Returns latest price for a symbol (last recorded).
 */
async function getLatestPrice(symbol) {
  const sql = `SELECT price_inr, recorded_at FROM price_history
               WHERE symbol = ?
               ORDER BY recorded_at DESC
               LIMIT 1`;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(sql, [symbol]);
    if (rows.length === 0) return null;
    return { price_inr: Number(rows[0].price_inr), recorded_at: rows[0].recorded_at };
  } finally {
    conn.release();
  }
}

module.exports = { fetchPriceForSymbol, recordPrice, getLatestPrice };
