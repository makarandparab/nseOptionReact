import React, { useMemo } from 'react';
import { evaluateStrikeSignals } from '../services/optionLogic.js';

export function SignalTable({ snapshot, priceTrend = 'UP' }) {
  const tableRows = useMemo(() => {
    if (!snapshot || !snapshot.body || !snapshot.body.overallData || !snapshot.body.oiData) {
      return [];
    }

    const overallData = snapshot.body.overallData;
    const oiDataMap = snapshot.body.oiData;
    const strikePrices = overallData.strikePriceList || Object.keys(oiDataMap).map(Number).sort((a, b) => a - b);
    const targetValue = parseFloat(snapshot.niftyData) || overallData.spotPrice || 0;

    // First pass: find maximum Call OI% and Put OI% across strikes (for row highlighting)
    let maxCallOiP = -Infinity;
    let maxPutOiP = -Infinity;

    strikePrices.forEach((strike) => {
      const sData = oiDataMap[String(strike)];
      if (sData) {
        const cChangeP = sData.callOiChangeP || 0;
        const pChangeP = sData.putOiChangeP || 0;
        if (cChangeP > maxCallOiP) maxCallOiP = cChangeP;
        if (pChangeP > maxPutOiP) maxPutOiP = pChangeP;
      }
    });

    // Second pass: construct row models
    return strikePrices.map((strike) => {
      const strikeKey = String(strike);
      const sData = oiDataMap[strikeKey];

      if (!sData) {
        return {
          strike,
          isEmpty: true
        };
      }

      const pOi = sData.putOi || 0;
      const cOi = sData.callOi || 0;
      const pChange = sData.putOiChange || 0;
      const pChangeP = sData.putOiChangeP || 0;
      const cChange = sData.callOiChange || 0;
      const cChangeP = sData.callOiChangeP || 0;

      const extremeResistance = sData.extremeResistance || 0;
      const extremeSupport = sData.extremeSupport || 0;
      const dominantSide = sData.dominantSide || '-';
      const netSentiment = sData.netSentiment || '-';

      const { signals, signalClass, rowHighlightClass, pcr } = evaluateStrikeSignals(
        sData,
        priceTrend,
        maxCallOiP,
        maxPutOiP
      );

      // Support / Resistance colors matching dashboard.jsp
      const esColor = strike < targetValue ? '#10b981' : '#3b82f6';
      const erColor = strike < targetValue ? '#3b82f6' : '#ef4444';

      let pcrColor = '#64748b';
      if (pcr < 0.7) pcrColor = '#ef4444';
      else if (pcr > 1.2) pcrColor = '#3b82f6';

      return {
        strike,
        isEmpty: false,
        pcr: pcr.toFixed(2),
        pcrColor,
        extremeSupport: extremeSupport.toLocaleString(),
        esColor,
        extremeResistance: extremeResistance.toLocaleString(),
        erColor,
        dominantSide,
        netSentiment,
        callOiChangeP: cChangeP.toFixed(1),
        callColor: cChange >= 0 ? '#ef4444' : '#10b981',
        putOiChangeP: pChangeP.toFixed(1),
        putColor: pChange >= 0 ? '#10b981' : '#ef4444',
        signals,
        signalClass,
        rowHighlightClass
      };
    });
  }, [snapshot, priceTrend]);

  if (tableRows.length === 0) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        No strike data available
      </div>
    );
  }

  return (
    <div className="table-container">
      <table id="signalTable">
        <thead>
          <tr>
            <th>Strike</th>
            <th>PCR</th>
            <th>eSupport</th>
            <th>eResist</th>
            <th>Dominant Side</th>
            <th>Net Sentiment</th>
            <th>Call OI%</th>
            <th>Put OI%</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row) => {
            if (row.isEmpty) {
              return (
                <tr key={row.strike}>
                  <td style={{ fontWeight: 700 }}>{row.strike}</td>
                  <td colSpan={8} style={{ color: '#94a3b8' }}>No data</td>
                </tr>
              );
            }

            const domLower = row.dominantSide.toLowerCase();
            const dominantClass = domLower.includes('call')
              ? 'call-dominant'
              : domLower.includes('put')
              ? 'put-dominant'
              : '';

            const sentLower = row.netSentiment.toLowerCase();
            const sentimentDotClass = sentLower.includes('bullish')
              ? 'bullish'
              : sentLower.includes('bearish')
              ? 'bearish'
              : 'neutral';

            return (
              <tr key={row.strike} className={row.rowHighlightClass || ''}>
                <td style={{ fontWeight: 700 }}>{row.strike}</td>
                <td style={{ color: row.pcrColor, fontWeight: 700 }}>{row.pcr}</td>
                <td style={{ color: row.esColor, fontWeight: 700 }}>{row.extremeSupport}</td>
                <td style={{ color: row.erColor, fontWeight: 700 }}>{row.extremeResistance}</td>
                <td>
                  <span className={`badge-dominant ${dominantClass}`}>{row.dominantSide}</span>
                </td>
                <td>
                  <span className="badge-sentiment">
                    <span className={`sentiment-dot ${sentimentDotClass}`} />
                    <span>{row.netSentiment}</span>
                  </span>
                </td>
                <td style={{ color: row.callColor, fontWeight: 600 }}>
                  {row.callOiChangeP}%
                </td>
                <td style={{ color: row.putColor, fontWeight: 600 }}>
                  {row.putOiChangeP}%
                </td>
                <td>
                  {row.signals.map((sig, idx) => (
                    <div key={idx} style={{ margin: '2px 0' }}>
                      {sig === '-' ? (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      ) : (
                        <span className={row.signalClass}>{sig}</span>
                      )}
                    </div>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
