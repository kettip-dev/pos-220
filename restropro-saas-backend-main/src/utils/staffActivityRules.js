/**
 * Rules for spotting unusual staff activity (possible theft or mistakes).
 * Pure functions: no DB, so they are easy to test and reuse in the report and
 * the Telegram alert.
 *
 * "Exceptions" are money taken off sales by a staff member: voided bills,
 * refunds, bill discounts, and item comps / discounts / voids.
 */

const DEFAULT_STAFF_ALERT_SETTINGS = {
  isEnabled: true,
  maxRatePercent: 5, // exceptions above this % of the person's own sales
  minAmount: 10, // ignore anything smaller than this (currency units)
  peerMultiple: 2.5, // exception rate this many times the team's rate
  maxNoSales: 5, // drawer opens with no sale in the period
};

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/** Fill totals for one staff row. */
function withTotals(row) {
  const exceptionAmount = round2(
    Number(row.void_amount || 0) +
      Number(row.refund_amount || 0) +
      Number(row.discount_amount || 0) +
      Number(row.comp_amount || 0) +
      Number(row.item_discount_amount || 0) +
      Number(row.item_void_amount || 0)
  );
  // Voided bills were sales before they were voided, so they count in the base.
  const base = Number(row.sales || 0) + Number(row.void_amount || 0);
  const ratePercent = base > 0 ? round2((exceptionAmount / base) * 100) : exceptionAmount > 0 ? null : 0;
  return { ...row, exception_amount: exceptionAmount, gross_base: round2(base), exception_rate: ratePercent };
}

/**
 * Apply the rules to every staff row.
 * Returns { rows, teamRate, flaggedCount } where each row gains `flags`
 * (array of { code, text }) and `flag_text` (joined, for tables / messages).
 */
function flagStaffActivity(rawRows, settings = DEFAULT_STAFF_ALERT_SETTINGS, fmtMoney = (n) => round2(n).toFixed(2)) {
  const s = { ...DEFAULT_STAFF_ALERT_SETTINGS, ...(settings || {}) };
  const rows = (rawRows || []).map(withTotals);

  const teamExceptions = rows.reduce((sum, r) => sum + r.exception_amount, 0);
  const teamBase = rows.reduce((sum, r) => sum + r.gross_base, 0);
  const teamRate = teamBase > 0 ? round2((teamExceptions / teamBase) * 100) : 0;
  const sellers = rows.filter((r) => r.gross_base > 0).length;

  const flagged = rows.map((r) => {
    const flags = [];
    const bigEnough = r.exception_amount >= Number(s.minAmount || 0) && r.exception_amount > 0;
    // e.g. a manager voiding other people's bills: a "% of their sales" would mislead
    const hasOwnSales = Number(r.sales || 0) > 0;

    if (bigEnough && !hasOwnSales) {
      flags.push({ code: "no_sales_of_own", text: `${fmtMoney(r.exception_amount)} taken off with no sales of their own` });
    } else if (bigEnough && r.exception_rate > Number(s.maxRatePercent)) {
      flags.push({ code: "rate", text: `${r.exception_rate}% of their sales taken off (limit ${Number(s.maxRatePercent)}%)` });
    }
    if (
      bigEnough &&
      hasOwnSales &&
      sellers >= 2 &&
      teamRate > 0 &&
      r.exception_rate !== null &&
      r.exception_rate >= teamRate * Number(s.peerMultiple)
    ) {
      flags.push({ code: "peers", text: `${round2(r.exception_rate / teamRate)}× the team average (${teamRate}%)` });
    }
    if (Number(s.maxNoSales) > 0 && Number(r.no_sales || 0) >= Number(s.maxNoSales)) {
      flags.push({ code: "no_sale_drawer", text: `${r.no_sales} drawer opens with no sale` });
    }
    return { ...r, flags, flag_text: flags.map((f) => f.text).join("; ") };
  });

  flagged.sort(
    (a, b) => b.flags.length - a.flags.length || b.exception_amount - a.exception_amount
  );
  return { rows: flagged, teamRate, flaggedCount: flagged.filter((r) => r.flags.length > 0).length };
}

module.exports = { DEFAULT_STAFF_ALERT_SETTINGS, flagStaffActivity };
