import React, { useState, useEffect } from 'react';
import { Activity, Clock } from 'lucide-react';

export function Header({ snapshot, isLive, lastUpdated }) {
  const [istTime, setIstTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        setIstTime(formatter.format(now) + ' IST');
      } catch (e) {
        setIstTime(new Date().toLocaleTimeString());
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const spotPrice = snapshot?.body?.overallData?.spotPrice 
    ? Number(snapshot.body.overallData.spotPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    : snapshot?.niftyData || 'Loading...';

  const totalPCR = snapshot?.body?.overallData?.totalPCR != null
    ? Number(snapshot.body.overallData.totalPCR).toFixed(2)
    : '-';

  const maxPain = snapshot?.maxPainStrike 
    ? Number(snapshot.maxPainStrike).toLocaleString() 
    : '-';

  const priceTrend = snapshot?.priceTrend || 'UP';

  return (
    <header>
      <div className="brand-title">
        <Activity size={24} color="#0066ff" />
        <span>OI Analyzr Pro</span>
      </div>

      <div className="header-badges">
        <div className="live-badge">
          <Clock size={14} style={{ marginRight: 6, color: '#64748b' }} />
          <span>{istTime || 'Loading time...'}</span>
        </div>

        <div className="live-badge">
          <span className={`dot ${isLive ? '' : 'dot-amber'}`}></span>
          <span>Nifty: <strong>{spotPrice}</strong></span>
          <span style={{ 
            marginLeft: 8, 
            fontSize: 11, 
            fontWeight: 700, 
            color: priceTrend === 'UP' ? '#10b981' : '#ef4444' 
          }}>
            ({priceTrend})
          </span>
        </div>

        <div className="live-badge">
          <span style={{ color: '#64748b', marginRight: 4 }}>PCR:</span>
          <strong style={{ color: totalPCR > 1.2 ? '#3b82f6' : totalPCR < 0.7 ? '#ef4444' : '#1e293b' }}>
            {totalPCR}
          </strong>
        </div>

        <div className="live-badge">
          <span style={{ color: '#64748b', marginRight: 4 }}>Max Pain:</span>
          <strong style={{ color: '#ef4444' }}>{maxPain}</strong>
        </div>
      </div>
    </header>
  );
}
