export interface StockThresholdEvaluation {
  shouldNotify: boolean;
  eventType: 'STOCK_LOW' | 'STOCK_OUT' | null;
}

export function evaluateStockThresholdTransition(
  previousQuantity: number,
  newQuantity: number,
  threshold: number
): StockThresholdEvaluation {
  // Case 1: Out of stock transition (had stock before, now 0 or less)
  if (previousQuantity > 0 && newQuantity <= 0) {
    return { shouldNotify: true, eventType: 'STOCK_OUT' };
  }

  // Case 2: Safe to Low stock transition (was above threshold, now at or below threshold but > 0)
  if (previousQuantity > threshold && newQuantity <= threshold && newQuantity > 0) {
    return { shouldNotify: true, eventType: 'STOCK_LOW' };
  }

  // Case 3: Already low or out, and further reduced: DO NOT NOTIFY (prevents alert spam)
  // Case 4: Stock replenished back above threshold: DO NOT NOTIFY
  return { shouldNotify: false, eventType: null };
}
