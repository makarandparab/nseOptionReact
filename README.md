# OI Analyzr Pro — Nifty Live Option Chain & Signal Intelligence

A modern, production-ready React.js application that ports 100% of the business logic and user interface from the Spring Boot / JSP NSE Option project.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+ recommended, verified on v26)
- npm (v9+)

### Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Production Mode (Builds React app and serves on port 8081 with NSE Proxy)
npm start

# 3. Development Mode (Vite Hot-Reload on port 5173 with proxy)
npm run dev
```

The application will be accessible at:
- **Production URL:** [http://localhost:8081](http://localhost:8081)
- **Dev URL:** [http://localhost:5173](http://localhost:5173)

---

## 📊 Preserved Business Features & Logic

| Original Java / JSP Feature | React Implementation | Description |
|-----------------------------|----------------------|-------------|
| `OptionUtil.getAllowedList` | `src/services/optionLogic.js` | Filters strikes centered around ATM spot price (`±N` strikes at 50-pt intervals). |
| `OptionUtil.determineSetup` | `src/services/optionLogic.js` | Classifies derivative structure into **LBU** (Long Buildup), **SBU** (Short Buildup), **SC** (Short Covering), and **LU** (Long Unwinding). |
| `OptionUtil.updateMarketSnapshot` | `src/services/optionLogic.js` | Specialist matching matrix mapping setups & PCR to Dominant Side and Net Sentiment (e.g., *Double Buyer Force*, *Balanced Tug of War*). |
| `OptionController.calculateMaxPain` | `src/services/optionLogic.js` | Iterates all strikes to find the strike minimizing total call + put expiry pain. |
| `calculateResistanceSupport` | `src/services/optionLogic.js` | PCR-based Extreme Resistance and Extreme Support level calculations with neighbor interpolation. |
| `dashboard.jsp` Chart.js | `src/components/OIChart.jsx` | Stacked bar chart for Call/Put OI (Stable vs Change) with dynamic spot line annotation and colored PCR strike ticks. |
| `dashboard.jsp` Signal Table | `src/components/SignalTable.jsx` | Full Signal Intelligence table with conditional row highlights (`highlight-orange`, `highlight-green`, etc.) and Action signals. |
| `dashboard.jsp` Trading Rules | `src/services/optionLogic.js` | Evaluates 5-minute and 15-minute relative OI change thresholds (`BUY CALL @ price`, `BUY PUT @ price`, PCR Unbalance alerts). |
| `SnapshotScheduler` | `src/services/historyCache.js` & `App.jsx` | 5-minute market boundary synchronization (9:05 - 16:00 IST) and historical snapshot caching. |
| NSE Cookie & CORS Bypass | `server.js` | Express proxy with automated cookie session management for `/api/nse/*`. |
| Offline / Market Simulation | `src/data/sampleData.js` | Toggleable simulation dataset so the app can be verified outside trading hours or offline. |

---

## 🛠 Project Structure

```
valiant-bose/
├── dist/                     # Production build artifacts
├── src/
│   ├── components/
│   │   ├── Controls.jsx      # Bandwidth, refresh, and data source controls
│   │   ├── Header.jsx        # Live IST clock, Spot price, Max Pain, and PCR badges
│   │   ├── OIChart.jsx       # Chart.js stacked bar chart with spot annotations
│   │   └── SignalTable.jsx   # Signal Intelligence table with conditional styling
│   ├── data/
│   │   └── sampleData.js     # High-fidelity sample snapshot data from OI.json
│   ├── services/
│   │   ├── apiService.js     # API client for live NSE and simulation modes
│   │   ├── historyCache.js   # 5m/15m snapshot cache and enrichment
│   │   └── optionLogic.js    # Complete port of all Java calculations
│   ├── App.jsx               # Main application container and auto-refresh timer
│   ├── index.css             # Polished CSS preserving dashboard.jsp visual identity
│   └── main.jsx              # React DOM entry point
├── server.js                 # Express proxy and production static server
├── vite.config.js            # Vite bundler configuration
├── package.json              # Project scripts and dependencies
└── test_option_logic.js      # Automated unit test suite verifying all 7 logic modules
```

---

## 🧪 Verification

Run the test suite anytime:
```bash
node test_option_logic.js
```
All 7 unit and logic test suites verify 100% equivalence with the Java implementation.
