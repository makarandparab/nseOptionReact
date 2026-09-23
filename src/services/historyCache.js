/**
 * HistoryCache - In-memory and persistent time-based snapshot storage
 * Replicates SnapshotHistoryService.java and SnapshotCacheServiceImpl.java
 */

const STORAGE_KEY = 'nse_option_snapshot_history';
const MAX_HISTORY_ITEMS = 50;

class SnapshotHistoryStore {
  constructor() {
    this.history = [];
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not read snapshot history from sessionStorage', e);
      this.history = [];
    }
  }

  saveToStorage() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.history.slice(-MAX_HISTORY_ITEMS)));
    } catch (e) {
      console.warn('Could not save snapshot history to sessionStorage', e);
    }
  }

  /**
   * Adds a new market snapshot with timestamp
   */
  addSnapshot(snapshot) {
    if (!snapshot || !snapshot.body || !snapshot.body.oiData) return;

    // Compact the snapshot to save memory
    const entry = {
      timestamp: Date.now(),
      niftyData: snapshot.niftyData,
      oiData: {}
    };

    for (const [strike, data] of Object.entries(snapshot.body.oiData)) {
      entry.oiData[strike] = {
        callOiChangeP: data.callOiChangeP || 0,
        putOiChangeP: data.putOiChangeP || 0,
        callOi: data.callOi || 0,
        putOi: data.putOi || 0
      };
    }

    this.history.push(entry);
    if (this.history.length > MAX_HISTORY_ITEMS) {
      this.history.shift();
    }
    this.saveToStorage();
  }

  /**
   * Finds the closest snapshot within [targetMin - tolerance, targetMin + tolerance] minutes
   */
  findHistoricalSnapshot(targetMinutesAgo, toleranceMinutes = 3) {
    if (this.history.length < 2) return null;

    const now = Date.now();
    const targetTime = now - (targetMinutesAgo * 60 * 1000);
    const maxToleranceMs = toleranceMinutes * 60 * 1000;

    let closest = null;
    let minDiff = Infinity;

    for (const item of this.history) {
      const diff = Math.abs(item.timestamp - targetTime);
      if (diff <= maxToleranceMs && diff < minDiff) {
        minDiff = diff;
        closest = item;
      }
    }

    return closest;
  }

  /**
   * Enriches current snapshot with 5-minute and 15-minute historical OI change percent
   * Replicates MarketSnapshotService.enrichSnapshot
   */
  enrichSnapshot(snapshot) {
    if (!snapshot || !snapshot.body || !snapshot.body.oiData) return snapshot;

    const snap5m = this.findHistoricalSnapshot(5, 3);
    const snap15m = this.findHistoricalSnapshot(15, 5);

    const oiData = snapshot.body.oiData;

    for (const [strike, data] of Object.entries(oiData)) {
      if (snap5m && snap5m.oiData[strike]) {
        if (data.callInfo) {
          data.callInfo.last_5min_oi_change_percent = snap5m.oiData[strike].callOiChangeP;
        }
        if (data.putInfo) {
          data.putInfo.last_5min_oi_change_percent = snap5m.oiData[strike].putOiChangeP;
        }
      }

      if (snap15m && snap15m.oiData[strike]) {
        if (data.callInfo) {
          data.callInfo.last_15min_oi_change_percent = snap15m.oiData[strike].callOiChangeP;
        }
        if (data.putInfo) {
          data.putInfo.last_15min_oi_change_percent = snap15m.oiData[strike].putOiChangeP;
        }
      }
    }

    return snapshot;
  }

  clear() {
    this.history = [];
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }
}

export const historyStore = new SnapshotHistoryStore();
