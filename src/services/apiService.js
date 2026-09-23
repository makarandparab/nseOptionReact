import axios from 'axios';
import { mapNseToMarketSnapshot, getAllowedList } from './optionLogic.js';
import { historyStore } from './historyCache.js';
import { SAMPLE_NIFTY_SNAPSHOT } from '../data/sampleData.js';

export const DATA_SOURCES = {
  LIVE: 'live',
  SAMPLE: 'sample'
};

/**
 * Fetches option chain and index data from proxy or fallback
 */
export async function fetchMarketData({
  source = DATA_SOURCES.LIVE,
  allowedStrikesCount = 4,
  expiry = '',
  recalculateLevels = true
} = {}) {
  if (source === DATA_SOURCES.SAMPLE) {
    // Return sample snapshot with filtered strikes and fresh timestamp
    const sample = JSON.parse(JSON.stringify(SAMPLE_NIFTY_SNAPSHOT));
    const allowed = getAllowedList(sample.niftyData, allowedStrikesCount);
    sample.body.overallData.strikePriceList = allowed;

    // Filter oiData to allowed strikes
    const filteredOi = {};
    for (const st of allowed) {
      if (sample.body.oiData[String(st)]) {
        filteredOi[String(st)] = sample.body.oiData[String(st)];
      }
    }
    sample.body.oiData = filteredOi;

    // Enrich with history
    historyStore.addSnapshot(sample);
    historyStore.enrichSnapshot(sample);

    return {
      snapshot: sample,
      priceTrend: sample.priceTrend || 'UP',
      isLive: false,
      availableExpiries: ['22-Sep-2026', '29-Sep-2026', '06-Oct-2026'],
      currentExpiry: '22-Sep-2026',
      timestamp: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })
    };
  }

  // Live fetch
  try {
    // 1. Fetch Nifty Index Data
    let niftySpot = 0;
    let priceTrend = 'UP';

    try {
      const indexRes = await axios.get('/api/nse/index-data', { timeout: 8000 });
      if (indexRes.data && indexRes.data.data && indexRes.data.data.length > 0) {
        const item = indexRes.data.data[0];
        niftySpot = parseFloat(item.last) || 0;
        const open = parseFloat(item.open) || 0;
        priceTrend = niftySpot >= open ? 'UP' : 'DOWN';
      }
    } catch (e) {
      console.warn('Index data fetch failed, using option chain underlying value', e.message);
    }

    // 2. Fetch Option Chain Data
    const url = expiry
      ? `/api/nse/option-chain?expiry=${encodeURIComponent(expiry)}`
      : '/api/nse/option-chain';
    const ocRes = await axios.get(url, { timeout: 10000 });

    if (!ocRes.data || !ocRes.data.records) {
      throw new Error('Invalid response structure from Option Chain API');
    }

    if (niftySpot <= 0 && ocRes.data.records.underlyingValue) {
      niftySpot = parseFloat(ocRes.data.records.underlyingValue);
    }

    // Process using our pure JS implementation
    const snapshot = mapNseToMarketSnapshot(ocRes.data, niftySpot, allowedStrikesCount);
    snapshot.priceTrend = priceTrend;

    // History tracking and enrichment
    historyStore.addSnapshot(snapshot);
    historyStore.enrichSnapshot(snapshot);

    const availableExpiries = ocRes.data?.records?.expiryDates || [];

    return {
      snapshot,
      priceTrend,
      isLive: true,
      availableExpiries,
      currentExpiry: expiry || availableExpiries[0] || '',
      timestamp: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })
    };
  } catch (error) {
    console.error('Failed to fetch live data from NSE API:', error.message);
    throw error;
  }
}
