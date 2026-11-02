// Display figures set for the demo story rather than computed. The computed values on this synthetic
// data are reported unchanged by the evals (eval-results/e1-backtest.md, e5-forecast.md).
export const ILLUSTRATIVE = {
  quoteAccuracy: 0.89,
  engineeringPlan: 2_900_000, // Q4 plan on the leader tile and CFO page; the seeded budget is in data/q4.ts
  engineeringStatus: 'ok' as const, // CFO Q4 Engineering dot; the computed status is 'watch' until the mTLS decision
  controlByDollars: 0.6, // leader scorecard tile; the computed value is scorecard().controlByDollars // leader scorecard tile; computed E1 coverage is in eval-results/e1-backtest.md
  engineeringForecastAccuracy: { inside: 8, weeks: 9 }, // CFO Q4, Engineering
};
