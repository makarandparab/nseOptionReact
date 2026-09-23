import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

export function OIChart({ snapshot }) {
  const chartDataAndOptions = useMemo(() => {
    if (!snapshot || !snapshot.body || !snapshot.body.overallData || !snapshot.body.oiData) {
      return null;
    }

    const overallData = snapshot.body.overallData;
    const oiDataMap = snapshot.body.oiData;
    const strikePrices = overallData.strikePriceList || Object.keys(oiDataMap).map(Number).sort((a, b) => a - b);
    const targetValue = parseFloat(snapshot.niftyData) || overallData.spotPrice || 0;

    const stablePutOi = [];
    const changePutOi = [];
    const changePutColors = [];
    const stableCallOi = [];
    const changeCallOi = [];
    const changeCallColors = [];
    const customLabels = [];
    const customLabelColors = [];

    strikePrices.forEach((strike) => {
      const strikeKey = String(strike);
      const sData = oiDataMap[strikeKey];

      if (sData) {
        const pOi = sData.putOi || 0;
        const pChange = sData.putOiChange || 0;
        if (pChange >= 0) {
          stablePutOi.push(Math.max(0, pOi - pChange));
          changePutOi.push(pChange);
          changePutColors.push('rgba(16, 185, 129, 0.85)');
        } else {
          stablePutOi.push(pOi);
          changePutOi.push(Math.abs(pChange));
          changePutColors.push('rgba(251, 191, 36, 0.9)'); // Yellow for negative change
        }

        const cOi = sData.callOi || 0;
        const cChange = sData.callOiChange || 0;
        if (cChange >= 0) {
          stableCallOi.push(Math.max(0, cOi - cChange));
          changeCallOi.push(cChange);
          changeCallColors.push('rgba(239, 68, 68, 0.85)');
        } else {
          stableCallOi.push(cOi);
          changeCallOi.push(Math.abs(cChange));
          changeCallColors.push('rgba(251, 191, 36, 0.9)'); // Yellow for negative change
        }

        const pcr = cOi > 0 ? (pOi / cOi) : 0;
        let color = '#475569';
        if (pcr < 0.7) color = '#ef4444';
        else if (pcr > 1.2) color = '#2563eb';

        // 2-line tick: Strike on top, PCR below for clean, compact display
        customLabels.push([strikeKey, `PCR ${pcr.toFixed(2)}`]);
        customLabelColors.push(color);
      } else {
        stablePutOi.push(0);
        changePutOi.push(0);
        changePutColors.push('rgba(0,0,0,0)');
        stableCallOi.push(0);
        changeCallOi.push(0);
        changeCallColors.push('rgba(0,0,0,0)');
        customLabels.push([strikeKey, '-']);
        customLabelColors.push('#94a3b8');
      }
    });

    // Calculate vertical line annotation index for spot price
    let annotationX = null;
    if (!isNaN(targetValue) && targetValue > 0) {
      for (let i = 0; i < strikePrices.length - 1; i++) {
        if (strikePrices[i] <= targetValue && targetValue <= strikePrices[i + 1]) {
          const denominator = strikePrices[i + 1] - strikePrices[i];
          annotationX = denominator > 0 ? i + (targetValue - strikePrices[i]) / denominator : i;
          break;
        }
      }
    }

    const annotations = {};
    if (annotationX !== null) {
      annotations.line1 = {
        type: 'line',
        xMin: annotationX,
        xMax: annotationX,
        borderColor: 'rgba(15, 23, 42, 0.85)',
        borderWidth: 2,
        borderDash: [5, 4],
        label: {
          display: true,
          content: 'Nifty: ' + targetValue.toFixed(1),
          position: 'start',
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          color: '#ffffff',
          font: { size: 11, weight: 'bold' },
          padding: { top: 4, bottom: 4, left: 6, right: 6 },
          borderRadius: 4
        }
      };
    }

    const data = {
      labels: customLabels,
      datasets: [
        {
          label: 'Put OI (Stable)',
          data: stablePutOi,
          backgroundColor: 'rgba(16, 185, 129, 0.4)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
          stack: 'Stack 0',
          barPercentage: 0.65,
          categoryPercentage: 0.82
        },
        {
          label: 'Put OI Change',
          data: changePutOi,
          backgroundColor: changePutColors,
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
          stack: 'Stack 0',
          barPercentage: 0.65,
          categoryPercentage: 0.82
        },
        {
          label: 'Call OI (Stable)',
          data: stableCallOi,
          backgroundColor: 'rgba(239, 68, 68, 0.4)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1,
          stack: 'Stack 1',
          barPercentage: 0.65,
          categoryPercentage: 0.82
        },
        {
          label: 'Call OI Change',
          data: changeCallOi,
          backgroundColor: changeCallColors,
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1,
          stack: 'Stack 1',
          barPercentage: 0.65,
          categoryPercentage: 0.82
        }
      ]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 24, // Generous spacing so legend never collides with bars
          bottom: 6,
          left: 4,
          right: 8
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: (c) => customLabelColors[c.index] || '#475569',
            font: { weight: 'bold', size: 11 },
            maxRotation: 20,
            minRotation: 0,
            padding: 6,
            autoSkip: false
          }
        },
        y: {
          beginAtZero: true,
          grid: { borderDash: [2, 4], color: '#e2e8f0' },
          ticks: {
            font: { size: 11 },
            padding: 6,
            callback: function (val) {
              if (val >= 10000000) return (val / 10000000).toFixed(1) + ' Cr';
              if (val >= 100000) return (val / 100000).toFixed(1) + ' L';
              if (val >= 1000) return (val / 1000).toFixed(0) + ' k';
              return val;
            }
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'center',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
            padding: 16,
            font: { size: 11, weight: '600' }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          titleColor: '#1e293b',
          bodyColor: '#475569',
          borderColor: '#cbd5e1',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          callbacks: {
            label: function (context) {
              const val = context.parsed.y || 0;
              return ` ${context.dataset.label}: ${val.toLocaleString()}`;
            }
          }
        },
        annotation: {
          annotations: annotations
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    };

    return { data, options };
  }, [snapshot]);

  if (!chartDataAndOptions) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        No chart data available
      </div>
    );
  }

  return (
    <div className="chart-container">
      <Bar data={chartDataAndOptions.data} options={chartDataAndOptions.options} />
    </div>
  );
}
