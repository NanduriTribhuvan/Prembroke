/**
 * Dollar-cost-averaging / scale-in entry math.
 *
 * @module calc/dca
 */

/** A single entry fill. */
export interface DcaFill {
  /** Fill price (> 0). */
  price: number
  /** Quantity filled at that price (>= 0). */
  qty: number
}

/** Aggregated DCA position. */
export interface DcaResult {
  /** Volume-weighted average entry price. */
  avgPrice: number
  /** Total quantity across all fills. */
  totalQty: number
  /** Total cost (sum of price * qty). */
  totalCost: number
}

/**
 * Volume-weighted average entry across multiple fills.
 *
 * `avgPrice = sum(price * qty) / sum(qty)`.
 *
 * @param fills Array of {@link DcaFill}. Non-finite fills are ignored.
 * @returns A {@link DcaResult}. `avgPrice` is `NaN` when total quantity is `0`.
 */
export function averageEntry(fills: DcaFill[]): DcaResult {
  let totalCost = 0
  let totalQty = 0
  for (const f of fills) {
    if (!Number.isFinite(f.price) || !Number.isFinite(f.qty) || f.qty < 0) continue
    totalCost += f.price * f.qty
    totalQty += f.qty
  }
  return {
    avgPrice: totalQty > 0 ? totalCost / totalQty : NaN,
    totalQty,
    totalCost
  }
}
