export function summarizeUsage(events: { meta: string }[]) {
  let totalTokens = 0;
  let totalCost = 0;
  let pricedCalls = 0;
  let measuredCalls = 0;
  for (const event of events) {
    let meta;
    try { meta = JSON.parse(event.meta); } catch { continue; }
    const usage = meta?.usage;
    const tokens = usage?.totalTokens ?? meta?.tokensUsed;
    if (typeof tokens === 'number' && Number.isFinite(tokens) && tokens >= 0) {
      totalTokens += tokens;
      measuredCalls++;
    }
    if (typeof meta?.cost === 'number' && Number.isFinite(meta.cost) && meta.cost >= 0) {
      totalCost += meta.cost;
      pricedCalls++;
    }
  }
  return { totalTokens, measuredCalls, totalCost: pricedCalls ? totalCost : null, pricedCalls };
}
