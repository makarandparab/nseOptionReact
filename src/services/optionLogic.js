/**
 * OptionLogic - Faithfully replicates 100% of the Java business logic from:
 * - OptionUtil.java
 * - OptionController.java
 * - MarketSnapshotImpl.java
 * - dashboard.jsp signal rules
 */

/**
 * Calculates the allowed strikes list centered at ATM +/- allowedStrikesCount
 * Replicates OptionUtil.getAllowedList
 */
export function getAllowedList(niftyValue, allowedStrikesCount = 4) {
  const niftyClose = parseFloat(niftyValue);
  if (isNaN(niftyClose) || niftyClose <= 0) {
    return [];
  }
  const interval = 50;
  const nearestStrike = Math.round(niftyClose / interval) * interval;

  const allowedStrikes = new Set();

  // Previous N strikes
  for (let i = 1; i <= allowedStrikesCount; i++) {
    const strike = nearestStrike - (i * interval);
    allowedStrikes.add(strike);
  }

  // Next N strikes and ATM
  for (let i = 1; i <= allowedStrikesCount; i++) {
    const strike = nearestStrike + (i * interval);
    allowedStrikes.add(strike);
    if (i === 1) {
      const keyStrike = strike - 50; // nearestStrike (ATM)
      allowedStrikes.add(keyStrike);
    }
  }

  return Array.from(allowedStrikes).sort((a, b) => a - b);
}

/**
 * Determines derivative structural setup (LBU, SBU, SC, LU)
 * Replicates OptionUtil.determineSetup
 */
export function determineSetup(priceChangeP, oiChange) {
  if (priceChangeP > 0 && oiChange > 0) return "LBU"; // Long Buildup (Aggressive buying)
  if (priceChangeP < 0 && oiChange > 0) return "SBU"; // Short Buildup (Institutional selling)
  if (priceChangeP > 0 && oiChange < 0) return "SC";  // Short Covering (Sellers escaping)
  return "LU";                                        // Long Unwinding (Buyers liquidating)
}

/**
 * Updates dominantSide and netSentiment for each strike
 * Replicates OptionUtil.updateMarketSnapshot
 */
export function updateMarketSnapshot(marketSnapshot) {
  if (!marketSnapshot || !marketSnapshot.body || !marketSnapshot.body.oiData) {
    return marketSnapshot;
  }

  const oiData = marketSnapshot.body.oiData;
  const strikeList = marketSnapshot.body.overallData?.strikePriceList || Object.keys(oiData).map(Number);

  for (const strikePrice of strikeList) {
    const strikePriceStr = String(strikePrice);
    const oiStrikeData = oiData[strikePriceStr];
    if (!oiStrikeData) continue;

    const putoi = oiStrikeData.putOi || 0;
    const calloi = oiStrikeData.callOi || 0;
    const pcr = calloi > 0 ? parseFloat((putoi / calloi).toFixed(2)) : 0;

    const callOiChg = oiStrikeData.callOiChange || 0;
    const callPriceChgP = oiStrikeData.callInfo?.day_change_percent || 0;

    const putOiChg = oiStrikeData.putOiChange || 0;
    const putPriceChgP = oiStrikeData.putInfo?.day_change_percent || 0;

    const callSetup = determineSetup(callPriceChgP, callOiChg);
    const putSetup = determineSetup(putPriceChgP, putOiChg);

    let dominantSide = "";
    let netSentiment = "";

    if (callSetup === "SC" && putSetup === "SBU") {
      dominantSide = "Double Buyer Force";
      netSentiment = (pcr > 1.0) ? "🟢 Extremely Bullish (Floor)" : "🟢 Strong Support Zone";
    } else if (callSetup === "LBU" && putSetup === "SBU") {
      if (pcr >= 0.8 && pcr <= 1.3) {
        dominantSide = "Balanced Tug of War";
        netSentiment = "🟡 Pivot Point / Max Pain Level";
      } else if (pcr > 0.3 && pcr < 0.8) {
        dominantSide = "Mixed Churn";
        const isMajorRoundStrike = (parseInt(strikePriceStr, 10) % 500 === 0);
        netSentiment = isMajorRoundStrike ? "🟢 Bullish Charge Upward" : "🟡 Mildly Bullish Volatility Zone";
      } else {
        dominantSide = "Call Buyer Dominant";
        netSentiment = "🟡 Neutral Consolidating";
      }
    } else if (callSetup === "SBU" && putSetup === "SBU") {
      dominantSide = "Double Seller Force";
      netSentiment = "🔴 Bearish Trap (Hard Ceiling)";
    } else {
      dominantSide = "Mixed Churn / Volume Swap";
      netSentiment = "🟡 Neutral Range Zone";
    }

    oiStrikeData.callSetup = callSetup;
    oiStrikeData.putSetup = putSetup;
    oiStrikeData.dominantSide = dominantSide;
    oiStrikeData.netSentiment = netSentiment;
  }

  return marketSnapshot;
}

/**
 * Calculates Max Pain strike by iterating over strikes and minimizing total option pain
 * Replicates OptionController.calculateMaxPain / SnapshotScheduler.calculateMaxPain
 */
export function calculateMaxPain(marketSnapshot) {
  if (!marketSnapshot || !marketSnapshot.body || !marketSnapshot.body.oiData) {
    return -1;
  }

  const oiData = marketSnapshot.body.oiData;
  const strikes = Object.keys(oiData).map(Number).filter(n => !isNaN(n));
  if (strikes.length === 0) return -1;

  let minTotalPain = Number.MAX_VALUE;
  let maxPainStrike = -1;

  for (const potentialExpiry of strikes) {
    let totalPain = 0;
    for (const strike of strikes) {
      const data = oiData[String(strike)];
      if (!data) continue;
      const callOi = data.callOi || 0;
      const putOi = data.putOi || 0;

      const callPain = Math.max(0, potentialExpiry - strike) * callOi;
      const putPain = Math.max(0, strike - potentialExpiry) * putOi;
      totalPain += callPain + putPain;
    }

    if (totalPain < minTotalPain) {
      minTotalPain = totalPain;
      maxPainStrike = potentialExpiry;
    }
  }

  marketSnapshot.maxPainStrike = maxPainStrike;
  return maxPainStrike;
}

/**
 * Calculates Extreme Resistance and Extreme Support per strike
 * Replicates OptionController.calculateResistanceSupport & reCalculateResistanceSupport
 */
export function calculateResistanceSupport(marketSnapshot, recalculateFlag = true) {
  if (!marketSnapshot || !marketSnapshot.body || !marketSnapshot.body.oiData) {
    return;
  }

  const oiData = marketSnapshot.body.oiData;
  const strikes = Object.keys(oiData).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);

  // Step 1: Base PCR-based Support/Resistance
  for (const strike of strikes) {
    const data = oiData[String(strike)];
    if (!data) continue;

    const callOi = data.callOi || 0;
    const putOi = data.putOi || 0;

    if (callOi === 0) {
      data.extremeResistance = 0;
      data.extremeSupport = 0;
      continue;
    }

    const pcr = putOi / callOi;
    const level = (pcr - 1) * 50 + strike;
    const rounded = Math.round(level);

    if (pcr > 1.0) {
      data.extremeSupport = rounded;
      data.extremeResistance = 0;
    } else if (pcr < 1.0) {
      data.extremeResistance = rounded;
      data.extremeSupport = 0;
    } else {
      data.extremeSupport = strike;
      data.extremeResistance = strike;
    }
  }

  // Step 2: Recalculate levels if flag is true (fill in 0s using neighbor strikes)
  if (recalculateFlag && strikes.length > 1) {
    for (let i = 0; i < strikes.length; i++) {
      const strike = strikes[i];
      const curr = oiData[String(strike)];

      if (curr.extremeSupport === 0) {
        // Look for nearest support above/below
        let filledSupport = 0;
        for (let j = i - 1; j >= 0; j--) {
          const prev = oiData[String(strikes[j])];
          if (prev && prev.extremeSupport > 0) {
            filledSupport = prev.extremeSupport + ((i - j) * 50);
            break;
          }
        }
        if (filledSupport === 0) {
          for (let j = i + 1; j < strikes.length; j++) {
            const next = oiData[String(strikes[j])];
            if (next && next.extremeSupport > 0) {
              filledSupport = next.extremeSupport - ((j - i) * 50);
              break;
            }
          }
        }
        curr.extremeSupport = filledSupport > 0 ? filledSupport : strike - 25;
      }

      if (curr.extremeResistance === 0) {
        let filledResistance = 0;
        for (let j = i + 1; j < strikes.length; j++) {
          const next = oiData[String(strikes[j])];
          if (next && next.extremeResistance > 0) {
            filledResistance = next.extremeResistance - ((j - i) * 50);
            break;
          }
        }
        if (filledResistance === 0) {
          for (let j = i - 1; j >= 0; j--) {
            const prev = oiData[String(strikes[j])];
            if (prev && prev.extremeResistance > 0) {
              filledResistance = prev.extremeResistance + ((i - j) * 50);
              break;
            }
          }
        }
        curr.extremeResistance = filledResistance > 0 ? filledResistance : strike + 25;
      }
    }
  }
}

/**
 * Relative change percentage helper
 */
export function calculateRelativeChange(current, previous) {
  if (previous === undefined || previous === null || previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Safe price formatter
 */
export function safePrice(info) {
  if (info && info.current_price != null && !isNaN(info.current_price)) {
    return Number(info.current_price).toFixed(2);
  }
  return 'N/A';
}

/**
 * Evaluates Action signals and row highlight classes based on dashboard.jsp rules
 */
export function evaluateStrikeSignals(sData, priceTrend = 'UP', maxCallOiP = 0, maxPutOiP = 0) {
  const cInfo = sData.callInfo || {};
  const pInfo = sData.putInfo || {};

  const pOi = sData.putOi || 0;
  const cOi = sData.callOi || 0;
  const pChangeP = sData.putOiChangeP || 0;
  const cChangeP = sData.callOiChangeP || 0;

  const pcr = cOi > 0 ? (pOi / cOi) : 0;

  const last5MinCallOiChgP = cInfo.last_5min_oi_change_percent || 0;
  const last5MinPutOiChgP = pInfo.last_5min_oi_change_percent || 0;
  const last15MinCallOiChgP = cInfo.last_15min_oi_change_percent || 0;
  const last15MinPutOiChgP = pInfo.last_15min_oi_change_percent || 0;

  const relCChange5 = calculateRelativeChange(cChangeP, last5MinCallOiChgP);
  const relPChange5 = calculateRelativeChange(pChangeP, last5MinPutOiChgP);
  const relCChange15 = calculateRelativeChange(cChangeP, last15MinCallOiChgP);
  const relPChange15 = calculateRelativeChange(pChangeP, last15MinPutOiChgP);

  const signals = [];
  let signalClass = "";

  if (priceTrend === 'UP') {
    if (relCChange5 <= -15 && (relPChange5 >= 5 || relPChange5 <= 10)) {
      signals.push('5m: BUY CALL @ ' + safePrice(cInfo));
      signalClass = "signal-call";
    }
    if (relCChange15 <= -15 && (relPChange15 >= 5 || relPChange15 <= 10)) {
      signals.push('15m: BUY CALL @ ' + safePrice(cInfo));
      signalClass = "signal-call";
    }
    if (relCChange5 >= -5 && (relPChange5 >= 10 || relPChange5 <= 15) && pcr > 1) {
      signals.push('5m: BUY CALL @ ' + safePrice(cInfo));
      signalClass = "signal-call";
    }
    if (relCChange15 >= -5 && (relPChange15 >= 10 || relPChange15 <= 15) && pcr > 1) {
      signals.push('15m: BUY CALL @ ' + safePrice(cInfo));
      signalClass = "signal-call";
    }
    if (pcr >= 1.6 && (relPChange5 <= -10 && (relCChange5 >= 5 || relCChange5 >= 10))) {
      signals.push('PCR UB - 5m: BUY CALL @ ' + safePrice(pInfo));
      signalClass = "signal-put";
    }
    if (pcr >= 1.6 && (relPChange15 <= -10 && (relCChange15 >= 5 || relCChange15 >= 10))) {
      signals.push('PCR UB - 15m: BUY CALL @ ' + safePrice(pInfo));
      signalClass = "signal-put";
    }
  } else if (priceTrend === 'DOWN') {
    if (relPChange5 <= -15 && (relCChange5 >= 5 || relCChange5 >= 10)) {
      signals.push('5m: BUY PUT @ ' + safePrice(pInfo));
      signalClass = "signal-put";
    }
    if (relPChange15 <= -15 && (relCChange15 >= 5 || relCChange15 >= 10)) {
      signals.push('15m: BUY PUT @ ' + safePrice(pInfo));
      signalClass = "signal-put";
    }
    if ((relCChange5 >= 10 || relCChange5 >= 15) && relPChange5 >= -5 && pcr < 1) {
      signals.push('5m: BUY PUT @ ' + safePrice(pInfo));
      signalClass = "signal-put";
    }
    if ((relCChange15 >= 10 || relCChange15 >= 15) && relPChange15 >= -5 && pcr < 1) {
      signals.push('15m: BUY PUT @ ' + safePrice(pInfo));
      signalClass = "signal-put";
    }
    if (pcr <= 0.6 && (relCChange5 <= -10 && (relPChange5 >= 5 || relPChange5 >= 10))) {
      signals.push('PCR UB - 5m: BUY PUT @ ' + safePrice(cInfo));
      signalClass = "signal-call";
    }
    if (pcr <= 0.6 && (relCChange15 <= -10 && (relPChange5 >= 5 || relPChange5 >= 10))) {
      signals.push('PCR UB - 15m: BUY PUT @ ' + safePrice(cInfo));
      signalClass = "signal-call";
    }
  }

  // Row highlight logic matching dashboard.jsp
  const isHighestCall = (cChangeP === maxCallOiP && maxCallOiP > 0);
  const isHighestPut = (pChangeP === maxPutOiP && maxPutOiP > 0);

  const isCallIncreasing = (cChangeP > last5MinCallOiChgP);
  const isCallDecreasing = (cChangeP < last5MinCallOiChgP);
  const isPutIncreasing = (pChangeP > last5MinPutOiChgP);
  const isPutDecreasing = (pChangeP < last5MinPutOiChgP);

  let rowHighlightClass = "";
  if (isHighestCall || isHighestPut) {
    if (isHighestCall && isHighestPut) {
      rowHighlightClass = "highlight-orange";
    } else if (isHighestCall) {
      rowHighlightClass = "highlight-orange";
    } else if (isHighestPut) {
      rowHighlightClass = "highlight-light-pink";
    }

    if (isCallIncreasing && isPutDecreasing) {
      rowHighlightClass = "highlight-light-red";
    } else if (isCallDecreasing && isPutIncreasing) {
      rowHighlightClass = "highlight-green";
    }
  }

  return {
    signals: signals.length > 0 ? signals : ['-'],
    signalClass: signals.length > 0 ? signalClass : '',
    rowHighlightClass,
    pcr
  };
}

/**
 * Maps raw NSE option chain API records to the internal MarketSnapshot model
 * Replicates MarketSnapshotImpl.mapNseToMarketSnapshot
 */
export function mapNseToMarketSnapshot(nseResponse, niftySpot = 0, allowedCount = 4) {
  if (!nseResponse || !nseResponse.records || !nseResponse.records.data) {
    return null;
  }

  const records = nseResponse.records;
  const underlyingValue = niftySpot > 0 ? niftySpot : (records.underlyingValue || 0);
  const niftyValueStr = String(underlyingValue);

  const allowedStrikes = getAllowedList(niftyValueStr, allowedCount);
  const allowedSet = new Set(allowedStrikes);

  const oiData = {};
  let totalCallOi = 0;
  let totalPutOi = 0;
  let totalCallOiChange = 0;
  let totalPutOiChange = 0;
  let totalVol = 0;

  for (const item of records.data) {
    const strike = item.strikePrice;
    if (!allowedSet.has(strike)) continue;

    const strikeStr = String(strike);
    const ce = item.CE || {};
    const pe = item.PE || {};

    const callOi = ce.openInterest || 0;
    const callOiChange = ce.changeinOpenInterest || 0;
    const callOiChangeP = ce.pchangeinOpenInterest || 0;

    const putOi = pe.openInterest || 0;
    const putOiChange = pe.changeinOpenInterest || 0;
    const putOiChangeP = pe.pchangeinOpenInterest || 0;

    totalCallOi += callOi;
    totalPutOi += putOi;
    totalCallOiChange += callOiChange;
    totalPutOiChange += putOiChange;
    totalVol += (ce.totalTradedVolume || 0) + (pe.totalTradedVolume || 0);

    oiData[strikeStr] = {
      strikePrice: strike,
      putOi,
      putPrevOi: putOi - putOiChange,
      putOiChange,
      putOiChangeP,
      callOi,
      callPrevOi: callOi - callOiChange,
      callOiChange,
      callOiChangeP,
      extremeResistance: 0,
      extremeSupport: 0,
      callSetup: "",
      putSetup: "",
      dominantSide: "",
      netSentiment: "",
      callInfo: {
        strike_price: strike,
        current_price: ce.lastPrice || 0,
        day_change_percent: ce.pChange || 0,
        volume: ce.totalTradedVolume || 0,
        open_interest: callOi,
        open_interest_chg: callOiChange,
        oi_change_percent: callOiChangeP,
        implied_volatility: ce.impliedVolatility || 0,
        last_5min_oi_change_percent: 0,
        last_15min_oi_change_percent: 0
      },
      putInfo: {
        strike_price: strike,
        current_price: pe.lastPrice || 0,
        day_change_percent: pe.pChange || 0,
        volume: pe.totalTradedVolume || 0,
        open_interest: putOi,
        open_interest_chg: putOiChange,
        oi_change_percent: putOiChangeP,
        implied_volatility: pe.impliedVolatility || 0,
        last_5min_oi_change_percent: 0,
        last_15min_oi_change_percent: 0
      }
    };
  }

  const totalPCR = totalCallOi > 0 ? parseFloat((totalPutOi / totalCallOi).toFixed(2)) : 0;
  const atm = Math.round(underlyingValue / 50) * 50;

  const snapshot = {
    head: { status: "0", statusDescription: "Success", responseCode: null },
    niftyData: String(underlyingValue),
    niftyValue: `${underlyingValue.toFixed(2)} - (${totalPCR.toFixed(2)})`,
    spotStrikePrice: String(atm),
    maxPainStrike: 0,
    priceTrend: "UP",
    body: {
      overallData: {
        totalVol,
        totalCallOi,
        totalCallOiChange,
        totalCallOiChangeP: totalCallOi > 0 ? (totalCallOiChange / totalCallOi) * 100 : 0,
        totalPutOi,
        totalPutOiChange,
        totalPutOiChangeP: totalPutOi > 0 ? (totalPutOiChange / totalPutOi) * 100 : 0,
        totalPCR,
        spotPrice: underlyingValue,
        spotChange: 0,
        spotChangeP: 0,
        atm,
        hideTimeSlider: false,
        strikePriceList: allowedStrikes
      },
      oiData
    }
  };

  // Run business calculations
  calculateMaxPain(snapshot);
  calculateResistanceSupport(snapshot, true);
  updateMarketSnapshot(snapshot);

  return snapshot;
}
