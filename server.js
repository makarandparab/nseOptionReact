import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8081;

app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nseindia.com/option-chain',
  'X-Requested-With': 'XMLHttpRequest'
};

let cachedExpiries = [];
let lastOptionChainResponse = null;
let lastOptionChainFetch = 0;

function getUpcomingCandidateExpiries() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const candidates = [];

  for (let i = 0; i <= 21; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const day = d.getDay(); // 2: Tuesday, 4: Thursday
    if (day === 2 || day === 4) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mmm = months[d.getMonth()];
      const yyyy = d.getFullYear();
      candidates.push(`${dd}-${mmm}-${yyyy}`);
    }
  }
  return candidates;
}

async function fetchLiveIndexSpot() {
  try {
    const url = 'https://www.nseindia.com/api/NextApi/apiClient?functionName=getIndexData&type=NIFTY%2050';
    const res = await axios.get(url, { headers: NSE_HEADERS, timeout: 8000 });
    if (res.data?.data?.[0]?.last) {
      return parseFloat(res.data.data[0].last);
    }
  } catch (e) {
    console.warn('Could not fetch index spot for option chain enrichment:', e.message);
  }
  return 0;
}

// Proxy endpoint for Nifty Option Chain
app.get('/api/nse/option-chain', async (req, res) => {
  try {
    const requestedExpiry = req.query.expiry;
    let targetExpiries = [];

    if (requestedExpiry) {
      targetExpiries = [requestedExpiry];
    } else if (cachedExpiries.length > 0) {
      targetExpiries = [cachedExpiries[0], ...cachedExpiries.slice(1, 3)];
    } else {
      targetExpiries = getUpcomingCandidateExpiries();
    }

    let successfulData = null;

    for (const exp of targetExpiries) {
      try {
        const url = `https://www.nseindia.com/api/option-chain-v3?type=Indices&symbol=NIFTY&expiry=${exp}`;
        const response = await axios.get(url, {
          headers: NSE_HEADERS,
          timeout: 8000
        });

        if (response.data?.records?.data && response.data.records.data.length > 0) {
          successfulData = response.data;
          if (response.data.records.expiryDates?.length > 0) {
            cachedExpiries = response.data.records.expiryDates;
          }
          break;
        }
      } catch (err) {
        console.warn(`Failed fetching option chain for expiry ${exp}:`, err.message);
      }
    }

    if (!successfulData) {
      // If we have recent cached data, return that instead of 502
      if (lastOptionChainResponse) {
        console.log('Serving last cached option chain snapshot');
        return res.json(lastOptionChainResponse);
      }
      throw new Error('No active option chain data returned from NSE for current expiries');
    }

    // Ensure underlying spot price is populated
    if (!successfulData.records.underlyingValue || successfulData.records.underlyingValue === 0) {
      const spot = await fetchLiveIndexSpot();
      if (spot > 0) {
        successfulData.records.underlyingValue = spot;
      }
    }

    lastOptionChainResponse = successfulData;
    lastOptionChainFetch = Date.now();

    res.json(successfulData);
  } catch (error) {
    console.error('NSE Option Chain request failed completely:', error.message);
    res.status(502).json({
      error: 'Failed to fetch option chain from NSE',
      message: error.message
    });
  }
});

// Proxy endpoint for Nifty Index spot data
app.get('/api/nse/index-data', async (req, res) => {
  try {
    const url = 'https://www.nseindia.com/api/NextApi/apiClient?functionName=getIndexData&type=NIFTY%2050';
    const response = await axios.get(url, {
      headers: NSE_HEADERS,
      timeout: 8000
    });
    res.json(response.data);
  } catch (error) {
    console.warn('NSE Index Data request failed:', error.message);
    res.status(502).json({
      error: 'Failed to fetch index data from NSE',
      message: error.message
    });
  }
});

// Expiry dates helper endpoint
app.get('/api/nse/expiries', (req, res) => {
  res.json({
    expiries: cachedExpiries.length > 0 ? cachedExpiries : getUpcomingCandidateExpiries()
  });
});

// Serve static React build files
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback all other routes to index.html
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>OI Analyzr Pro</title></head>
          <body style="font-family:sans-serif;padding:2rem;text-align:center;">
            <h2>OI Analyzr Pro Server Active on Port ${PORT}</h2>
            <p>React application build files not yet found in <code>/dist</code>.</p>
            <p>Run <code>npm run build</code> or use <code>npm run dev</code> for development mode.</p>
          </body>
        </html>
      `);
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🚀 OI Analyzr Pro Server running on http://localhost:${PORT}`);
  console.log(`📊 Mode: Production-ready React + NSE Proxy`);
  console.log(`=================================================\n`);
});
