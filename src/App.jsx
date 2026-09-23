import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header.jsx';
import { Controls } from './components/Controls.jsx';
import { OIChart } from './components/OIChart.jsx';
import { SignalTable } from './components/SignalTable.jsx';
import { fetchMarketData, DATA_SOURCES } from './services/apiService.js';
import { AlertCircle, CheckCircle, BarChart3, Zap } from 'lucide-react';

export function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [priceTrend, setPriceTrend] = useState('UP');
  const [source, setSource] = useState(DATA_SOURCES.LIVE);
  const [allowedStrikes, setAllowedStrikes] = useState(4);
  const [expiry, setExpiry] = useState('');
  const [availableExpiries, setAvailableExpiries] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [layoutMode, setLayoutMode] = useState('auto');

  const refreshTimeoutRef = useRef(null);

  const loadData = useCallback(async (
    selectedSource = source,
    strikesCount = allowedStrikes,
    selectedExpiry = expiry
  ) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchMarketData({
        source: selectedSource,
        allowedStrikesCount: strikesCount,
        expiry: selectedExpiry
      });

      setSnapshot(result.snapshot);
      setPriceTrend(result.priceTrend || 'UP');
      setLastUpdated(result.timestamp);
      if (result.availableExpiries && result.availableExpiries.length > 0) {
        setAvailableExpiries(result.availableExpiries);
      }
      if (result.currentExpiry && !selectedExpiry) {
        setExpiry(result.currentExpiry);
      }
      setStatusMessage(
        result.isLive
          ? 'Live data successfully synced with NSE'
          : 'Loaded simulation data (ready for testing)'
      );
    } catch (err) {
      console.error('Data load error:', err);
      setError(`Failed to fetch live data: ${err.message}. Showing simulation data.`);
      // Auto fallback to sample data if live fetch failed
      try {
        const fallback = await fetchMarketData({
          source: DATA_SOURCES.SAMPLE,
          allowedStrikesCount: strikesCount
        });
        setSnapshot(fallback.snapshot);
        setPriceTrend(fallback.priceTrend);
        setLastUpdated(fallback.timestamp);
        setAvailableExpiries(fallback.availableExpiries || []);
        setSource(DATA_SOURCES.SAMPLE);
      } catch (fallbackErr) {
        setError(`Critical error loading data: ${fallbackErr.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [source, allowedStrikes, expiry]);

  // Initial load
  useEffect(() => {
    loadData(source, allowedStrikes, expiry);
  }, []);

  // Handlers
  const handleSourceChange = (newSource) => {
    setSource(newSource);
    loadData(newSource, allowedStrikes, expiry);
  };

  const handleStrikesChange = (newStrikes) => {
    setAllowedStrikes(newStrikes);
    loadData(source, newStrikes, expiry);
  };

  const handleExpiryChange = (newExpiry) => {
    setExpiry(newExpiry);
    loadData(source, allowedStrikes, newExpiry);
  };

  // Auto-refresh timer matching 5-minute boundaries during trading hours (9:05 - 16:00 IST)
  // or 3-minute interval matching SnapshotScheduler.java
  useEffect(() => {
    if (!autoRefresh) {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      return;
    }

    const scheduleNextRefresh = () => {
      const now = new Date();
      // Calculate IST time
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istDate = new Date(utc + (3600000 * 5.5));
      const istMinutes = istDate.getHours() * 60 + istDate.getMinutes();

      const startTradingMin = 9 * 60 + 5;  // 09:05 IST
      const endTradingMin = 16 * 60;       // 16:00 IST

      let delayMs = 180000; // Default 3 minutes

      if (istMinutes >= startTradingMin && istMinutes < endTradingMin) {
        // Find next 5-minute clock boundary (e.g. :05, :10, :15, ...)
        const nextBoundaryMin = (Math.floor(istMinutes / 5) + 1) * 5;
        const diffMinutes = nextBoundaryMin - istMinutes;
        delayMs = Math.max(30000, (diffMinutes * 60 - istDate.getSeconds()) * 1000);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        loadData(source, allowedStrikes);
        scheduleNextRefresh();
      }, delayMs);
    };

    scheduleNextRefresh();

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [autoRefresh, loadData, source, allowedStrikes]);

  const layoutClass =
    layoutMode === 'chart'
      ? 'layout-chart-only'
      : layoutMode === 'table'
      ? 'layout-table-only'
      : layoutMode === 'split'
      ? 'layout-split'
      : layoutMode === 'stacked'
      ? 'layout-stacked'
      : 'layout-auto';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', flexGrow: 1 }}>
      <Header
        snapshot={snapshot}
        isLive={source === DATA_SOURCES.LIVE}
        lastUpdated={lastUpdated}
      />

      <Controls
        source={source}
        setSource={handleSourceChange}
        allowedStrikes={allowedStrikes}
        setAllowedStrikes={handleStrikesChange}
        expiry={expiry}
        setExpiry={handleExpiryChange}
        availableExpiries={availableExpiries}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        onRefresh={() => loadData(source, allowedStrikes, expiry)}
        loading={loading}
        lastUpdated={lastUpdated}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
      />

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          padding: '8px 14px',
          borderRadius: 8,
          marginBottom: 12,
          fontSize: 12,
          fontWeight: 500
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <main className={`main-container ${layoutClass}`}>
        <div className="card card-chart">
          <div className="card-header">
            <h2>
              <BarChart3 size={18} color="#0066ff" />
              <span>Open Interest Analysis</span>
            </h2>
          </div>
          <OIChart snapshot={snapshot} />
        </div>

        <div className="card card-table">
          <div className="card-header">
            <h2>
              <Zap size={18} color="#f59e0b" />
              <span>Signal Intelligence</span>
            </h2>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Trend: <strong style={{ color: priceTrend === 'UP' ? '#10b981' : '#ef4444' }}>{priceTrend}</strong>
            </div>
          </div>
          <SignalTable snapshot={snapshot} priceTrend={priceTrend} />
        </div>
      </main>
    </div>
  );
}
