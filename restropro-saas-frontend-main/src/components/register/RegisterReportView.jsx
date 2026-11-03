import React from "react";
import clsx from "clsx";
import { formatCurrencyAmount } from "../../helpers/RegisterPrintHelper";

const Row = ({ label, value, tone, bold }) => (
  <div className={clsx("flex items-center justify-between gap-3 py-1.5 text-sm", bold && "font-bold")}>
    <span className="text-slate-600 dark:text-slate-300 truncate">{label}</span>
    <span
      className={clsx(
        "tabular-nums shrink-0",
        tone === "bad" && "text-rose-600 dark:text-rose-400",
        tone === "good" && "text-emerald-600 dark:text-emerald-400",
        !tone && "text-slate-900 dark:text-white"
      )}
    >
      {value}
    </span>
  </div>
);

const Card = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">{title}</h4>
    <div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
  </div>
);

/** On-screen X / Z report. The thermal version is built from the same summary. */
export default function RegisterReportView({ summary }) {
  if (!summary) return null;
  const p = summary.primary_currency;
  const s = summary.secondary_currency;
  const fp = (v) => formatCurrencyAmount(v, p);
  const fs = (v) => formatCurrencyAmount(v, s);
  const both = (a, b) => (s && Number(b || 0) !== 0 ? `${fp(a)} + ${fs(b)}` : fp(a));
  const sales = summary.sales || {};
  const cash = summary.cash || {};
  const isZ = summary.status === "CLOSED";
  const variance = Number(cash.variance_base || 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Net sales", value: fp(sales.net_sales) },
          { label: "Bills", value: sales.bill_count || 0 },
          { label: "Average bill", value: fp(sales.average_bill) },
          isZ
            ? { label: "Over / short", value: fp(variance), tone: variance < 0 ? "bad" : variance > 0 ? "good" : null }
            : { label: "Expected cash", value: cash.expected_primary === null ? "Hidden (blind close)" : fp(cash.expected_primary) },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{tile.label}</div>
            <div
              className={clsx(
                "text-lg font-bold tabular-nums mt-0.5",
                tile.tone === "bad" ? "text-rose-600 dark:text-rose-400" : tile.tone === "good" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"
              )}
            >
              {tile.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card title="Sales">
          <Row label="Gross sales" value={fp(sales.gross_sales)} />
          <Row label={`Voids (${sales.void_count || 0})`} value={fp(sales.void_total)} tone={sales.void_total ? "bad" : null} />
          <Row label={`Refunds (${sales.refund_count || 0})`} value={fp(sales.refund_total)} tone={sales.refund_total ? "bad" : null} />
          <Row label="Net sales" value={fp(sales.net_sales)} bold />
          {Number(sales.tips_total) > 0 && <Row label="Tips" value={fp(sales.tips_total)} />}
          {Number(summary.invoices?.discount_total) > 0 && <Row label="Manual discounts" value={fp(summary.invoices.discount_total)} />}
          {Number(summary.invoices?.tax_total) > 0 && <Row label="Tax collected" value={fp(summary.invoices.tax_total)} />}
        </Card>

        <Card title="Payments">
          {(summary.payments || []).length === 0 && <Row label="No payments yet" value="—" />}
          {(summary.payments || []).map((pay) => (
            <Row key={pay.title} label={`${pay.title} (${pay.count})`} value={fp(pay.net)} />
          ))}
        </Card>

        <Card title="Cash drawer">
          <Row label="Opening float" value={both(cash.opening_float_primary, cash.opening_float_secondary)} />
          <Row label="Cash sales (net of change)" value={both(cash.cash_sales_primary, cash.cash_sales_secondary)} />
          {Number(cash.cash_reversals_primary) !== 0 && <Row label="Cash refunds / voids" value={fp(cash.cash_reversals_primary)} tone="bad" />}
          {(Number(cash.pay_in_primary) || Number(cash.pay_in_secondary)) ? <Row label="Paid in" value={both(cash.pay_in_primary, cash.pay_in_secondary)} /> : null}
          {(Number(cash.pay_out_primary) || Number(cash.pay_out_secondary)) ? <Row label="Paid out" value={`-${both(cash.pay_out_primary, cash.pay_out_secondary)}`} /> : null}
          {(Number(cash.drop_primary) || Number(cash.drop_secondary)) ? <Row label="Safe drops" value={`-${both(cash.drop_primary, cash.drop_secondary)}`} /> : null}
          {(Number(cash.tip_payout_primary) || Number(cash.tip_payout_secondary)) ? <Row label="Tip payouts" value={`-${both(cash.tip_payout_primary, cash.tip_payout_secondary)}`} /> : null}
          {cash.expected_primary !== null && <Row label="Expected in drawer" value={both(cash.expected_primary, cash.expected_secondary)} bold />}
          {isZ && <Row label="Counted" value={both(cash.counted_primary, cash.counted_secondary)} />}
          {isZ && <Row label="Over / short" value={fp(variance)} tone={variance < 0 ? "bad" : variance > 0 ? "good" : null} bold />}
          <Row label="No-sale drawer opens" value={summary.no_sale_count || 0} />
        </Card>

        <Card title="Staff">
          {(summary.by_cashier || []).map((c) => (
            <Row key={c.cashier} label={`${c.cashier} (${c.count})`} value={fp(Number(c.sales) + Number(c.reversals))} />
          ))}
          {(summary.tips_by_server || []).map((t) => (
            <Row
              key={`tip-${t.server}`}
              label={`Tips · ${t.server}`}
              value={`${fp(Number(t.cash_tips || 0) + Number(t.non_cash_tips || 0))}${t.paid_out ? ` (paid ${fp(t.paid_out)})` : ""}`}
            />
          ))}
          {(summary.by_cashier || []).length === 0 && <Row label="No activity yet" value="—" />}
        </Card>
      </div>

      {(summary.movements || []).length > 0 && (
        <Card title="Cash movements">
          {summary.movements.map((m) => (
            <Row
              key={m.id}
              label={`${new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${m.type.replace("_", " ")}${m.reason ? ` · ${m.reason}` : ""}${m.staff_username ? ` · ${m.staff_username}` : ""}`}
              value={m.type === "NO_SALE" ? "—" : both(m.amount_primary, m.amount_secondary)}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
