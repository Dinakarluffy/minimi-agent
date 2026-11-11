# minimi Agent — Chat Agent with Web Search & Temporal Memory

> A smart, reliable AI chat assistant that remembers past conversations across days, searches the live internet, and tracks pricing and feature changes over time.

---

## 💡 What is this project? (The Simple Explanation)

If you have ever used ChatGPT or other AI chatbots, you have probably noticed three big problems:
1. **They forget:** If you discussed 5 software tools last week and ask *"Did any of them change pricing?"*, regular AI has no idea what you talked about last week.
2. **They don't know what "Today" means:** If you say *"What did I ask you last Tuesday?"*, normal AI gets confused because it does not have a real-world calendar attached.
3. **Their data is outdated:** Standard AI relies on training data from months or years ago. It cannot tell you what a software plan costs *right now*.

**minimi Agent solves all three problems:**
* 🧠 **It has long-term memory:** It saves past conversations in a lightweight local database, stamping every chat with the exact day and time.
* 🗓️ **It understands real dates:** When you say *"last Tuesday"*, *"since Monday"*, or *"on 3 November"*, it knows the exact date on the calendar.
* 🌐 **It searches the live internet:** When you ask about prices or news, it checks the live web today and tells you what changed compared to your past discussions.

---

## ⚡ Quick Start (Get it running in 2 minutes)

### 1. Install Dependencies
Make sure you have [Node.js](https://nodejs.org/) installed, then run:
```bash
npm install
```

### 2. Add your Free Google Gemini API Key
Copy the example settings file:
```bash
cp .env.example .env
```
Open `.env` in any text editor and paste your **Gemini API Key**:
```env
GEMINI_API_KEY=your_actual_key_here
```
*(Need a key? You can get a free key in 30 seconds at [Google AI Studio](https://aistudio.google.com/app/apikey) — zero credit card required).*

> **Note on Web Search:** Zero extra setup needed! Unlike other tools that require paid search subscriptions, this agent uses a built-in search pipeline (DuckDuckGo $\rightarrow$ Bing $\rightarrow$ Google Grounding) out of the box for free.

### 3. Start the Chat App
To launch the modern web interface:
```bash
npm run dev
```
Open your browser and visit: **[http://localhost:3000](http://localhost:3000)**.

To chat directly in your command line / terminal instead:
```bash
npm run dev:cli
```

---

## 🧪 Testing & Verification

The project includes an automated test suite verifying all code logic, memory recall, and search tools:
```bash
npm test
```
*(Runs 49 automated tests in ~2 seconds with a 100% pass rate).*

---

## 🎯 The 3 Core Challenge Scenarios (How to test it yourself)

You can click any of the starter suggestion buttons in the web UI to test these real-world scenarios:

### 1. Tracking Pricing Changes (The CRM Test)
> *"On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"*
* **What happens behind the scenes:**
  1. The agent checks its memory for Monday's chat to find the 5 tools you shortlisted (HubSpot, Pipedrive, Close, Zoho, Salesforce).
  2. It searches the live web for their latest prices and updates today.
  3. It compares the two and gives you a summary: *"None of the base prices changed, but HubSpot shipped new AI features."*

### 2. Verifying Past Facts (The 3 November Test)
> *"What did I ask you on 3 November? Is your answer still correct today?"*
* **What happens behind the scenes:**
  1. It finds the exact chat you had on 3 November.
  2. It checks the live web today to see if software versions or facts have changed.
  3. It confirms whether the previous answer remains accurate.

### 3. Relative Date Questions (The Last Tuesday Test)
> *"Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"*
* **What happens behind the scenes:**
  1. It calculates which day was "last Tuesday" on the calendar.
  2. It pulls up your past Postgres hosting discussion.
  3. It searches current provider prices (like Supabase and Neon) and highlights any diffs.

---

## 🛠️ How It's Built

* **Language:** TypeScript & Node.js (fast, type-safe, and modern).
* **AI Model:** Google Gemini (`gemini-flash-lite-latest` for high daily limits and fast responses).
* **Database:** Embedded SQLite with Write-Ahead Logging (`better-sqlite3`). No external database servers to set up or configure.
* **Search:** Autonomous multi-tier fallback (DuckDuckGo $\rightarrow$ Bing $\rightarrow$ Google Grounding).
* **Design & UI:** Responsive ChatGPT-inspired dark interface with custom pop-up dialogs and dynamic chat auto-naming.

---

## 📖 Deep-Dive Architecture & Design

For a full technical breakdown, system flow diagrams, trade-off analysis, and rejected alternatives, read **[`DESIGN.md`](./DESIGN.md)**.
