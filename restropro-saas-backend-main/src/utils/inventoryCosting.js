/**
 * Weighted-average unit cost after receiving stock.
 *
 *   new cost = (on-hand qty × current cost + received qty × received cost)
 *              ÷ (on-hand qty + received qty)
 *
 * Rules that keep the figure honest:
 * - A receipt without a cost (0 / missing) never changes the cost: free-text
 *   POs and legacy POs carry no price, and averaging them in as "free" stock
 *   would silently understate food cost.
 * - Negative on-hand stock (sold before it was received) counts as zero, so
 *   the new batch's price is not distorted by a phantom negative balance.
 * - With no usable current cost, the received cost is taken as-is.
 */
const weightedAverageUnitCost = (onHandQty, currentCost, receivedQty, receivedCost) => {
  const cost = Number(currentCost) || 0;
  const inCost = Number(receivedCost) || 0;
  const inQty = Number(receivedQty) || 0;
  if (inCost <= 0 || inQty <= 0) return cost;

  const onHand = Math.max(Number(onHandQty) || 0, 0);
  if (cost <= 0 || onHand === 0) return round4(inCost);

  return round4((onHand * cost + inQty * inCost) / (onHand + inQty));
};

const round4 = (value) => Math.round(value * 10000) / 10000;

module.exports = { weightedAverageUnitCost };
