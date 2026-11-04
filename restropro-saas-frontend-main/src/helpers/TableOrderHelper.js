/**
 * Every open order on a table. Each POS submit to an occupied table creates
 * its own order, so a table can hold several at once (e.g. #5, #6, #7, #8).
 * Falls back to the single latest order for older API responses.
 */
export const getTableOrderIds = (table) => {
  if (!table) return [];
  if (Array.isArray(table.active_order_ids) && table.active_order_ids.length > 0) {
    return table.active_order_ids;
  }
  return table.active_order_id ? [table.active_order_id] : [];
};

/** "#5, #6, #7, #8" — tokens for every open order on the table. */
export const getTableOrderTokensLabel = (table) => {
  if (!table) return "";
  const tokens =
    Array.isArray(table.active_order_tokens) && table.active_order_tokens.length > 0
      ? table.active_order_tokens
      : [table.active_order_token || table.active_order_id].filter(Boolean);
  return tokens.map((tok) => `#${tok}`).join(", ");
};
