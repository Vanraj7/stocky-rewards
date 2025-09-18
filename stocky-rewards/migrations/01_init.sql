-- migrations/01_init.sql
CREATE DATABASE IF NOT EXISTS stocky;
USE stocky;

-- Users table (minimal)
CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  external_id VARCHAR(128) UNIQUE, -- optional external user id
  name VARCHAR(255)
);

-- Reward events (idempotent events)
CREATE TABLE IF NOT EXISTS reward_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(128) UNIQUE NOT NULL, -- idempotency token from source
  user_id BIGINT NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  quantity DECIMAL(18,6) NOT NULL, -- fractional shares allowed
  price_per_share_inr DECIMAL(18,4) NOT NULL, -- price at time of reward
  fees_inr DECIMAL(18,4) NOT NULL, -- fees company incurred (sum of brokerage+taxes)
  total_inr DECIMAL(18,4) NOT NULL, -- price*quantity + fees
  rewarded_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Price history (hourly snapshots)
CREATE TABLE IF NOT EXISTS price_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(32) NOT NULL,
  price_inr DECIMAL(18,4) NOT NULL,
  recorded_at TIMESTAMP NOT NULL, -- when price fetched
  UNIQUE KEY (symbol, recorded_at)
);

-- User holdings (current aggregated)
CREATE TABLE IF NOT EXISTS user_holdings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  quantity DECIMAL(18,6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY (user_id, symbol),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Double-entry ledger for INR amounts
CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  entry_id VARCHAR(128) UNIQUE NOT NULL, -- idempotency reference
  date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  debit_account VARCHAR(128) NOT NULL,
  credit_account VARCHAR(128) NOT NULL,
  amount_inr DECIMAL(18,4) NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock ledger tracking stock unit movements (double-entry for quantity)
CREATE TABLE IF NOT EXISTS stock_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  entry_id VARCHAR(128) UNIQUE NOT NULL,
  date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id BIGINT,
  symbol VARCHAR(32) NOT NULL,
  quantity DECIMAL(18,6) NOT NULL, -- positive = credit to user, negative = debit
  source VARCHAR(128), -- e.g., 'reward', 'adjustment', 'split'
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Idempotency tokens to avoid replayed reward events
CREATE TABLE IF NOT EXISTS idempotency_tokens (
  token VARCHAR(128) PRIMARY KEY,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
