// Converts dollars of actual spend to AI tokens for the engineer and leader views.
// Synthetic assumption: one blended rate across input, output and cached tokens. The CFO view stays in dollars.
export const USD_PER_MILLION_TOKENS = 6;

export const tokensFor = (usd: number) => (usd / USD_PER_MILLION_TOKENS) * 1e6;
