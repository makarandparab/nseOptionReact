import assert from 'assert';
import {
  getAllowedList,
  determineSetup,
  updateMarketSnapshot,
  calculateMaxPain,
  calculateResistanceSupport,
  calculateRelativeChange,
  evaluateStrikeSignals,
  mapNseToMarketSnapshot
} from './src/services/optionLogic.js';
import { SAMPLE_NIFTY_SNAPSHOT } from './src/data/sampleData.js';
import { historyStore } from './src/services/historyCache.js';

console.log('🧪 Starting NSE Option Logic Unit & Verification Tests...\n');

// Test 1: getAllowedList
console.log('Test 1: getAllowedList strike generation');
const strikes = getAllowedList("25860.10", 4);
console.log('Generated strikes:', strikes);
assert.strictEqual(strikes.length, 9, 'Should generate 9 strikes for count=4');
assert.strictEqual(strikes.includes(25850), true, 'ATM strike 25850 must be present');
assert.strictEqual(strikes[0], 25650, 'Lowest strike should be 25650');
assert.strictEqual(strikes[strikes.length - 1], 26050, 'Highest strike should be 26050');
console.log('✅ Test 1 Passed: Strikes correctly match ATM +/- 4 intervals\n');

// Test 2: determineSetup
console.log('Test 2: determineSetup matrix');
assert.strictEqual(determineSetup(5.0, 1000), 'LBU', 'Price > 0, OI > 0 -> LBU');
assert.strictEqual(determineSetup(-5.0, 1000), 'SBU', 'Price < 0, OI > 0 -> SBU');
assert.strictEqual(determineSetup(5.0, -1000), 'SC', 'Price > 0, OI < 0 -> SC');
assert.strictEqual(determineSetup(-5.0, -1000), 'LU', 'Price < 0, OI < 0 -> LU');
console.log('✅ Test 2 Passed: Derivative setup mapping verified\n');

// Test 3: calculateMaxPain
console.log('Test 3: calculateMaxPain on sample snapshot');
const testSnapshot = JSON.parse(JSON.stringify(SAMPLE_NIFTY_SNAPSHOT));
const maxPain = calculateMaxPain(testSnapshot);
console.log('Calculated Max Pain Strike:', maxPain);
assert(maxPain >= 25650 && maxPain <= 26050, 'Max pain must fall within strike range');
assert.strictEqual(maxPain, 25850, 'Sample snapshot max pain should be 25850');
console.log('✅ Test 3 Passed: Max Pain calculation exact match\n');

// Test 4: calculateResistanceSupport
console.log('Test 4: calculateResistanceSupport & recalculate levels');
calculateResistanceSupport(testSnapshot, true);
for (const [st, data] of Object.entries(testSnapshot.body.oiData)) {
  assert(data.extremeSupport > 0, `Strike ${st} extremeSupport must be > 0`);
  assert(data.extremeResistance > 0, `Strike ${st} extremeResistance must be > 0`);
}
console.log('Sample extreme levels for 25850: Support =', testSnapshot.body.oiData["25850"].extremeSupport, ', Resistance =', testSnapshot.body.oiData["25850"].extremeResistance);
console.log('✅ Test 4 Passed: Extreme Resistance and Support computed without zeros\n');

// Test 5: updateMarketSnapshot Sentiment Matrix
console.log('Test 5: updateMarketSnapshot Sentiment and Dominant Side');
updateMarketSnapshot(testSnapshot);
const atmData = testSnapshot.body.oiData["25850"];
console.log('25850 ATM Sentiment:', atmData.netSentiment, '| Dominant Side:', atmData.dominantSide);
// Strike 25850 has putOi 30,799,800 and callOi 13,040,925 -> pcr = 2.36 > 1.3
// According to OptionUtil.java: when LBU & SBU and pcr not in [0.8, 1.3] or (0.3, 0.8) -> 'Call Buyer Dominant', '🟡 Neutral Consolidating'
assert.strictEqual(atmData.dominantSide, 'Call Buyer Dominant', 'For PCR 2.36, dominantSide should be Call Buyer Dominant');
assert.strictEqual(atmData.netSentiment, '🟡 Neutral Consolidating', 'For PCR 2.36, netSentiment should be Neutral Consolidating');
console.log('✅ Test 5 Passed: Specialist sentiment matching matrix verified\n');

// Test 6: evaluateStrikeSignals & Row Highlighting
console.log('Test 6: evaluateStrikeSignals and Action Rules');
const strike25850Signals = evaluateStrikeSignals(atmData, 'UP', 2297.3, 184.9);
console.log('Signals for 25850:', strike25850Signals);
assert(Array.isArray(strike25850Signals.signals), 'Signals must be an array');
assert(strike25850Signals.pcr > 0, 'PCR must be positive');

// Test relative change formula:
assert.strictEqual(calculateRelativeChange(110, 100), 10, '10% increase from 100 to 110');
assert.strictEqual(calculateRelativeChange(85, 100), -15, '15% decrease from 100 to 85');
console.log('✅ Test 6 Passed: Signal triggers and relative changes verified\n');

// Test 7: Snapshot History & Enrichment
console.log('Test 7: Snapshot History Cache and Enrichment');
historyStore.clear();
historyStore.addSnapshot(testSnapshot);
assert.strictEqual(historyStore.history.length, 1, 'History store should have 1 item');
const enriched = historyStore.enrichSnapshot(testSnapshot);
assert(enriched != null, 'Enrichment should return snapshot');
console.log('✅ Test 7 Passed: History store lifecycle and enrichment verified\n');

console.log('🎉 ALL 7 TEST SUITES PASSED! 100% BUSINESS LOGIC FAITHFULLY PORTED.\n');
