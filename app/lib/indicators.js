export function ema(values, period) {
  if (!values.length || period <= 0) return [];
  const k = 2 / (period + 1);
  const result = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

export function computeMacd(history, { fast = 12, slow = 26, signal = 9 } = {}) {
  if (!history || history.length < slow + signal) return [];
  const values = history.map((point) => point.value);
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macd = emaFast.map((value, index) => value - emaSlow[index]);
  const signalLine = ema(macd, signal);
  const hist = macd.map((value, index) => value - signalLine[index]);
  return history.map((point, index) => ({
    timestamp: point.timestamp,
    macd: macd[index],
    signal: signalLine[index],
    hist: hist[index]
  }));
}
