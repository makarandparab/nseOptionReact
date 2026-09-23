import React from 'react';
import { RefreshCw, Sliders, Database, Zap, Columns, Rows, BarChart3, Table } from 'lucide-react';
import { DATA_SOURCES } from '../services/apiService.js';

export function Controls({
  source,
  setSource,
  allowedStrikes,
  setAllowedStrikes,
  expiry,
  setExpiry,
  availableExpiries,
  autoRefresh,
  setAutoRefresh,
  onRefresh,
  loading,
  lastUpdated,
  layoutMode = 'auto',
  setLayoutMode
}) {
  return (
    <div className="controls-bar">
      <div className="controls-group">
        <div className="control-item">
          <div className="control-label">
            <Database size={14} />
            <span>Data:</span>
          </div>
          <select
            className="control-select"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={loading}
          >
            <option value={DATA_SOURCES.LIVE}>Live NSE API (Proxy)</option>
            <option value={DATA_SOURCES.SAMPLE}>Sample / Simulation</option>
          </select>
          <span className={`badge-source ${source === DATA_SOURCES.LIVE ? 'live' : 'sample'}`}>
            {source === DATA_SOURCES.LIVE ? 'LIVE' : 'SIMULATION'}
          </span>
        </div>

        <div className="control-item">
          <div className="control-label">
            <Sliders size={14} />
            <span>Strikes:</span>
          </div>
          <select
            className="control-select"
            value={allowedStrikes}
            onChange={(e) => setAllowedStrikes(Number(e.target.value))}
            disabled={loading}
          >
            <option value={3}>±3 (7 strikes)</option>
            <option value={4}>±4 (9 strikes)</option>
            <option value={6}>±6 (13 strikes)</option>
            <option value={8}>±8 (17 strikes)</option>
            <option value={10}>±10 (21 strikes)</option>
          </select>
        </div>

        {availableExpiries && availableExpiries.length > 0 && (
          <div className="control-item">
            <div className="control-label">
              <Zap size={14} color="#0066ff" />
              <span>Expiry:</span>
            </div>
            <select
              className="control-select"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              disabled={loading}
            >
              {availableExpiries.map((exp) => (
                <option key={exp} value={exp}>
                  {exp}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="controls-group">
        {/* Responsive Layout Mode Switcher */}
        <div className="view-switcher" title="Adjust Dashboard Layout">
          <button
            type="button"
            className={`view-btn ${layoutMode === 'auto' ? 'active' : ''}`}
            onClick={() => setLayoutMode && setLayoutMode('auto')}
            title="Auto Responsive (Split on wide screens, Stacked on smaller screens)"
          >
            Auto
          </button>
          <button
            type="button"
            className={`view-btn ${layoutMode === 'split' ? 'active' : ''}`}
            onClick={() => setLayoutMode && setLayoutMode('split')}
            title="Side-by-Side Split View"
          >
            <Columns size={13} />
            <span>Split</span>
          </button>
          <button
            type="button"
            className={`view-btn ${layoutMode === 'stacked' ? 'active' : ''}`}
            onClick={() => setLayoutMode && setLayoutMode('stacked')}
            title="Full Width Stacked View"
          >
            <Rows size={13} />
            <span>Stacked</span>
          </button>
          <button
            type="button"
            className={`view-btn ${layoutMode === 'chart' ? 'active' : ''}`}
            onClick={() => setLayoutMode && setLayoutMode('chart')}
            title="Chart Only View"
          >
            <BarChart3 size={13} />
            <span>Chart</span>
          </button>
          <button
            type="button"
            className={`view-btn ${layoutMode === 'table' ? 'active' : ''}`}
            onClick={() => setLayoutMode && setLayoutMode('table')}
            title="Signal Table Only View"
          >
            <Table size={13} />
            <span>Table</span>
          </button>
        </div>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          <span>Auto-refresh (5m)</span>
        </label>

        {lastUpdated && (
          <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
            {lastUpdated}
          </span>
        )}

        <button
          className="btn-action btn-primary"
          onClick={onRefresh}
          disabled={loading}
          title="Fetch latest option chain snapshot"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
}
