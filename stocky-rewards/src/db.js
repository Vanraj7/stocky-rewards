// src/db.js
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: +process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',  // ✅ FIXED
  database: process.env.DB_NAME || 'stocky',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z'
});

module.exports = pool;
