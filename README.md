# 📌 Stocky Rewards Backend

A backend system for **Stocky**, a hypothetical company where users earn **shares of Indian stocks** (e.g., Reliance, TCS, Infosys) as rewards for onboarding, referrals, or trading milestones.  

The system ensures:  
- Users always receive full stock units (no deductions).  
- Company pays brokerage, STT, GST, and fees (tracked internally via ledger).  
- Hourly stock price updates for accurate INR portfolio valuation.  

---

## 🚀 Features
- **Reward API**: Assign shares of stocks to users.  
- **Today’s Rewards API**: Fetch all rewards given today.  
- **Historical INR API**: Show INR value of past rewards.  
- **Stats API**: Portfolio value + today’s rewards grouped by stock.  
- **Ledger**: Double-entry system to track stock purchases, expenses, and cash outflow.  
- **Scheduler**: Updates stock prices every hour.  

---

## 🛠️ Tech Stack
- **Node.js (Express.js)** – REST API framework  
- **MySQL** – Relational database  
- **node-cron** – Scheduler for hourly stock price updates  
- **dotenv** – Environment configuration  

---

## 📂 Project Structure

```

├── migrations/
│   └── 01_init.sql
├── src/
│   ├── db.js
│   ├── helpers.js
│   ├── priceService.js
│   ├── routes.js
│   ├── scheduler.js
│   └── server.js
├── .env.example
├── package.json
└── README.md
```

---

## ⚙️ Setup Instructions

## ⚙️ Setup
### 1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/<your-username>/stocky-rewards.git
   cd stocky-rewards
   npm install
``` 
### 2. Configure environment variables
Copy `.env.example` to `.env` and update database credentials.
### 3. Run migrations
```bash
mysql -u root -p stocky < migrations/01_init.sql
```
### 4.Start the server
```bash
node src/server.js

