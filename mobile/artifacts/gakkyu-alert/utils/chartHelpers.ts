export function computeDateLabels(lastUpdated: string, count: number): string[] {
  const [y, m, d] = lastUpdated.replace(/-/g, "/").split("/").map(Number);
  const base = new Date(y, m - 1, d);
  return Array.from({ length: count }, (_, i) => {
    const daysAgo = (count - 1 - i) * 7;
    const dt = new Date(base.getTime() - daysAgo * 86_400_000);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  });
}

export function linReg(history: number[]): { value: number; low: number; high: number } {
  const recent = history.slice(-6);
  const m = recent.length;
  if (m < 2) return { value: recent[0] ?? 0, low: 0, high: recent[0] ?? 0 };

  const xs = recent.map((_, i) => i);
  const xMean = (m - 1) / 2;
  const yMean = recent.reduce((s, v) => s + v, 0) / m;
  const ssxy  = xs.reduce((s, x, i) => s + (x - xMean) * (recent[i] - yMean), 0);
  const ssxx  = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const b     = ssxx === 0 ? 0 : ssxy / ssxx;
  const a     = yMean - b * xMean;
  const pred  = a + b * m; // slot "m" = one week ahead

  // RMSE of fit as CI half-width
  const rmse = Math.sqrt(
    xs.reduce((s, x, i) => s + (recent[i] - (a + b * x)) ** 2, 0) / m
  );

  return {
    value: Math.max(0, Math.round(pred)),
    low:   Math.max(0, Math.round(pred - rmse)),
    high:  Math.round(pred + rmse),
  };
}
