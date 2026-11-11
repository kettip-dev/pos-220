import React from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { useMenuLanguage } from "../../helpers/MenuLanguageHelper";
import {
  IconArmchair,
  IconBoxSeam,
  IconMotorbike,
  IconCheck,
  IconClock,
  IconAlertTriangle,
  IconArrowBackUp,
  IconPlayerPlayFilled,
  IconFlame,
  IconBan,
  IconClockPlus,
} from "@tabler/icons-react";
import {
  diningLabel,
  formatDuration,
  getOrderTitle,
  isAddedLater,
  itemOverTarget,
  allDayKey,
  isItemDone,
  delayReasonLabel,
} from "./kdsUtils";

const SIZE = {
  sm: { item: "text-[13px]", meta: "text-[11px]", qty: "w-8 h-8 text-sm", token: "text-xl", timer: "text-lg", row: "min-h-[48px]" },
  md: { item: "text-[15px]", meta: "text-xs", qty: "w-10 h-10 text-base", token: "text-2xl", timer: "text-xl", row: "min-h-[54px]" },
  lg: { item: "text-[18px]", meta: "text-sm", qty: "w-12 h-12 text-lg", token: "text-3xl", timer: "text-2xl", row: "min-h-[62px]" },
};

const HEADER_TONE = {
  ontime: "bg-[var(--kds-header)] text-[color:var(--kds-text)]",
  warning: "bg-amber-400 text-slate-950",
  late: "bg-rose-600 text-white",
};

const DiningIcon = ({ type, size = 16 }) => {
  if (type === "dinein") return <IconArmchair size={size} stroke={2} />;
  if (type === "delivery") return <IconMotorbike size={size} stroke={2} />;
  return <IconBoxSeam size={size} stroke={2} />;
};

function StatusMark({ status, t }) {
  if (status === "cancelled") {
    return (
      <span className="h-8 px-2 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
        <IconBan size={14} stroke={2.2} /> {t("kitchen.kds.void", "Void")}
      </span>
    );
  }
  if (isItemDoneStatus(status)) {
    return (
      <span className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
        <IconCheck size={18} stroke={3} />
      </span>
    );
  }
  if (status === "preparing") {
    return (
      <span className="h-8 px-2.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/40 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
        <span className="relative flex w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-60" />
          <span className="relative w-2 h-2 rounded-full bg-amber-400" />
        </span>
        {t("kitchen.kds.cooking", "Cooking")}
      </span>
    );
  }
  return (
    <span className="h-8 px-2.5 rounded-full border-2 border-dashed border-[color:var(--kds-dim)] text-[color:var(--kds-muted)] text-[11px] font-black uppercase tracking-wider flex items-center">
      {t("kitchen.kds.new", "New")}
    </span>
  );
}

const isItemDoneStatus = (s) => s === "completed" || s === "delivered";

export default function KdsTicketCard({
  order,
  index,
  displayItems,
  companionItems,
  elapsedSec,
  urgency,
  isSelected,
  isExpo,
  size = "md",
  onSelect,
  onAdvanceItem,
  onUndoItem,
  onStartAll,
  onBump,
  highlightKey = null,
  nowMs = null,
  dueMs = null,
  delayMinutes = 0,
  delayReason = null,
  onDelay,
}) {
  const { t } = useTranslation();
  const { displayOrderItem } = useMenuLanguage();
  const S = SIZE[size] || SIZE.md;
  const liveItems = displayItems.filter((i) => i.status !== "cancelled");
  const doneCount = liveItems.filter(isItemDone).length;
  const totalCount = liveItems.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const hasNew = displayItems.some((i) => i.status === "created");
  const hasActive = displayItems.some((i) => i.status === "created" || i.status === "preparing");
  const isFresh = elapsedSec < 60;
  const unitCount = liveItems.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
  // Ticket countdown from the slowest item's cooking time (+ any delay).
  const dueSec = dueMs && hasActive ? Math.round((dueMs - (nowMs || Date.now())) / 1000) : null;

  // Group companion items by station for the "other stations" strip
  const companionGroups = {};
  (companionItems || []).forEach((it) => {
    if (it.status === "cancelled") return;
    const key = it.station_name || t("kitchen.kds.unassigned", "Unassigned");
    if (!companionGroups[key]) companionGroups[key] = { color: it.station_color || "#64748b", total: 0, done: 0 };
    companionGroups[key].total += Number(it.quantity) || 1;
    if (isItemDone(it)) companionGroups[key].done += Number(it.quantity) || 1;
  });

  return (
    <article
      aria-label={`Ticket ${order.token_no}`}
      onClick={onSelect}
      className={clsx(
        "flex flex-col rounded-2xl overflow-hidden bg-[var(--kds-surface)] border transition-all duration-150",
        urgency === "late"
          ? "border-rose-500/70 shadow-[0_0_0_1px_rgba(244,63,94,0.35),0_18px_40px_-18px_rgba(244,63,94,0.45)]"
          : "border-[color:var(--kds-line)] shadow-[var(--kds-card-shadow)]",
        isSelected && "ring-2 ring-sky-400 ring-offset-2 ring-offset-[var(--kds-bg)]",
        isFresh && urgency === "ontime" && "kds-fresh"
      )}
    >
      {/* ── Header band: urgency colour carries at a glance ── */}
      <header className={clsx("px-3.5 pt-3 pb-2.5", HEADER_TONE[urgency])}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={clsx("font-black tabular-nums leading-none tracking-tight", S.token)}>
                #{order.token_no ?? order.id}
              </span>
              {index < 9 && (
                <span
                  className={clsx(
                    "w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center",
                    urgency === "ontime" ? "bg-[var(--kds-soft-2)] text-[color:var(--kds-text-2)]" : "bg-black/15"
                  )}
                  title={t("kitchen.kds.press_to_select", "Press {{n}} to select", { n: index + 1 })}
                >
                  {index + 1}
                </span>
              )}
              {isFresh && (
                <span className="px-1.5 py-0.5 rounded-md bg-sky-500 text-white text-[10px] font-black uppercase tracking-wider">
                  {t("kitchen.kds.new", "New")}
                </span>
              )}
            </div>
            <div className={clsx("mt-1.5 flex items-center gap-1.5 font-bold truncate", S.meta, urgency === "ontime" ? "text-[color:var(--kds-text-2)]" : "opacity-90")}>
              <DiningIcon type={order.delivery_type} size={15} />
              <span className="truncate">
                {getOrderTitle(order, t)}
                {order.table_id && order.floor ? ` · ${order.floor}` : ""}
                {order.table_id ? "" : ` · ${diningLabel(order.delivery_type, t)}`}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div
              className={clsx(
                "flex items-center justify-end gap-1 font-black tabular-nums leading-none",
                S.timer,
                urgency === "ontime" && "text-emerald-400",
                urgency === "late" && "animate-pulse"
              )}
            >
              {urgency === "late" ? <IconFlame size={18} stroke={2.4} /> : <IconClock size={17} stroke={2.4} />}
              {formatDuration(elapsedSec)}
            </div>
            <div className={clsx("mt-1.5 font-semibold tabular-nums", S.meta, urgency === "ontime" ? "text-[color:var(--kds-muted)]" : "opacity-90")}>
              {dueSec !== null
                ? dueSec >= 0
                  ? t("kitchen.prep.due_in", "Due in {{time}}", { time: formatDuration(dueSec) })
                  : t("kitchen.prep.overdue", "{{time}} late", { time: formatDuration(-dueSec) })
                : t("kitchen.kds.items", "{{count}} items", { count: unitCount })}
            </div>
          </div>
        </div>
        {delayMinutes > 0 && hasActive && (
          <div
            className={clsx(
              "mt-2 inline-flex max-w-full items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-black",
              urgency === "ontime" ? "bg-amber-400/15 text-amber-300 border border-amber-400/30" : "bg-black/20"
            )}
          >
            <IconClockPlus size={14} stroke={2.4} className="shrink-0" />
            <span className="truncate">
              +{delayMinutes} {t("kitchen.prep.min_unit", "min")}
              {delayReason ? ` · ${delayReasonLabel(delayReason, null, t)}` : ""}
            </span>
          </div>
        )}
      </header>

      {/* Progress */}
      <div className="h-1 bg-[var(--kds-soft)]">
        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* ── Items ── */}
      <ul className="flex-1 divide-y divide-[color:var(--kds-line)]">
        {displayItems.map((item) => {
          const done = isItemDone(item);
          const voided = item.status === "cancelled";
          const view = displayOrderItem(item);
          const addonsText = Array.isArray(view.addons) && view.addons.length > 0 ? view.addons.map((a) => a.title).filter(Boolean).join(", ") : null;
          const addedLater = isAddedLater(order, item);
          const overSec = itemOverTarget(item, nowMs || Date.now());
          const isFocused = Boolean(highlightKey) && allDayKey(item) === highlightKey;

          return (
            <li key={item.id}>
              <div
                role="button"
                tabIndex={done ? -1 : 0}
                aria-disabled={done}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!done) onAdvanceItem(item);
                }}
                className={clsx(
                  "w-full flex items-start gap-3 px-3.5 py-2.5 text-left transition-colors duration-150",
                  S.row,
                  !done && "hover:bg-[var(--kds-chip-hover)] active:bg-[var(--kds-soft)]",
                  item.status === "preparing" && "bg-amber-400/[0.05]",
                  isFocused && "ring-2 ring-inset ring-amber-400 bg-amber-400/[0.12]",
                  done ? "cursor-default" : "cursor-pointer"
                )}
                title={
                  item.status === "created"
                    ? t("kitchen.kds.tap_to_start", "Tap to start")
                    : item.status === "preparing"
                    ? t("kitchen.kds.tap_to_ready", "Tap to mark ready")
                    : undefined
                }
              >
                <span
                  className={clsx(
                    "shrink-0 rounded-xl font-black tabular-nums flex items-center justify-center",
                    S.qty,
                    done
                      ? "bg-[var(--kds-soft)] text-[color:var(--kds-faint)]"
                      : Number(item.quantity) > 1
                      ? "bg-amber-400 text-slate-950"
                      : "bg-[var(--kds-soft-2)] text-[color:var(--kds-text)]"
                  )}
                >
                  {item.quantity}
                </span>

                <span className="flex-1 min-w-0 pt-0.5">
                  <span
                    className={clsx(
                      "block font-bold leading-snug",
                      S.item,
                      done ? "text-[color:var(--kds-faint)] line-through decoration-[color:var(--kds-faint)]" : "text-[color:var(--kds-text)]",
                      voided && "decoration-rose-500/70"
                    )}
                  >
                    {view.item_title}
                    {view.variant_title && <span className={clsx("font-semibold", done ? "" : "text-[color:var(--kds-text-2)]")}> · {view.variant_title}</span>}
                  </span>

                  {addonsText && (
                    <span className={clsx("block mt-0.5 font-medium", S.meta, done ? "text-[color:var(--kds-faint)]" : "text-sky-300")}>+ {addonsText}</span>
                  )}

                  {item.notes && (
                    <span
                      className={clsx(
                        "mt-1 inline-flex items-start gap-1 px-2 py-1 rounded-md font-bold",
                        S.meta,
                        done ? "bg-[var(--kds-soft)] text-[color:var(--kds-faint)]" : "bg-amber-400/15 text-amber-200 border border-amber-400/30"
                      )}
                    >
                      <IconAlertTriangle size={13} stroke={2.4} className="mt-[1px] shrink-0" />
                      <span>{item.notes}</span>
                    </span>
                  )}

                  {(isExpo && item.station_name) || addedLater || item.seat_no || Number(item.course) > 1 || overSec !== null ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {overSec !== null && (
                        <span
                          className={clsx(
                            "inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black border",
                            overSec > 0 ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-[var(--kds-soft)] text-[color:var(--kds-muted)] border-[color:var(--kds-line)]"
                          )}
                        >
                          {overSec > 0
                            ? t("pos_ops.over_target", "+{{time}} over", { time: formatDuration(overSec) })
                            : t("pos_ops.target_left", "{{time}} left", { time: formatDuration(-overSec) })}
                        </span>
                      )}
                      {item.seat_no ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          S{item.seat_no}
                        </span>
                      ) : null}
                      {Number(item.course) > 1 ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          C{item.course}
                        </span>
                      ) : null}
                      {isExpo && item.station_name && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border"
                          style={{
                            color: item.station_color || "#94a3b8",
                            borderColor: `${item.station_color || "#94a3b8"}55`,
                            backgroundColor: `${item.station_color || "#94a3b8"}1a`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.station_color || "#94a3b8" }} />
                          {item.station_name}
                        </span>
                      )}
                      {addedLater && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          {t("kitchen.kds.added", "Added")}
                        </span>
                      )}
                    </span>
                  ) : null}
                </span>

                <span className="shrink-0 flex items-center gap-1">
                  {isItemDoneStatus(item.status) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUndoItem(item);
                      }}
                      className="w-[42px] h-[42px] -my-1 rounded-xl text-[color:var(--kds-faint)] hover:text-[color:var(--kds-text)] hover:bg-[var(--kds-soft-2)] flex items-center justify-center transition active:scale-95"
                      title={t("kitchen.kds.undo_item", "Undo — send back to cooking")}
                      aria-label={t("kitchen.kds.undo_item", "Undo — send back to cooking")}
                    >
                      <IconArrowBackUp size={18} stroke={2} />
                    </button>
                  )}
                  <StatusMark status={item.status} t={t} />
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* ── Courses still on hold for this ticket ── */}
      {Array.isArray(order.heldItems) && order.heldItems.length > 0 && (
        <div className="px-3.5 py-2 border-t border-dashed border-[color:var(--kds-line)] flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--kds-faint)] mr-0.5">
            {t("pos_ops.on_hold", "On hold")}
          </span>
          {Object.entries(
            order.heldItems.reduce((acc, i) => {
              const key = `C${i.course || "?"}`;
              acc[key] = (acc[key] || 0) + Number(i.quantity || 1);
              return acc;
            }, {})
          ).map(([course, qty]) => (
            <span
              key={course}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-bold border bg-sky-500/10 border-sky-500/30 text-sky-300"
            >
              {course}
              <span className="tabular-nums opacity-80">· {qty}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Other stations on this ticket ── */}
      {Object.keys(companionGroups).length > 0 && (
        <div className="px-3.5 py-2 border-t border-[color:var(--kds-line)] flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--kds-faint)] mr-0.5">
            {t("kitchen.kds.also_on_ticket", "Also on ticket")}
          </span>
          {Object.entries(companionGroups).map(([name, g]) => (
            <span
              key={name}
              className={clsx(
                "inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-semibold border",
                g.done === g.total ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-[var(--kds-chip)] border-[color:var(--kds-line)] text-[color:var(--kds-text-2)]"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color }} />
              {name}
              <span className="tabular-nums opacity-70">
                {g.done}/{g.total}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* ── Bump bar ── */}
      <footer className="p-2.5 bg-[var(--kds-well)] border-t border-[color:var(--kds-line)] flex gap-2">
        {hasNew && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartAll();
            }}
            className="h-12 px-4 rounded-xl bg-[var(--kds-soft)] hover:bg-[var(--kds-soft-2)] border border-[color:var(--kds-line)] text-[color:var(--kds-text)] font-bold text-sm flex items-center gap-2 transition active:scale-95"
          >
            <IconPlayerPlayFilled size={15} />
            {t("kitchen.kds.start_all", "Start all")}
          </button>
        )}
        {hasActive && onDelay && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelay();
            }}
            title={t("kitchen.delay.title", "Add cooking time")}
            aria-label={t("kitchen.delay.title", "Add cooking time")}
            className="h-12 px-3 rounded-xl bg-[var(--kds-soft)] hover:bg-[var(--kds-soft-2)] border border-[color:var(--kds-line)] text-amber-300 font-bold text-sm flex items-center gap-1.5 transition active:scale-95"
          >
            <IconClockPlus size={18} stroke={2.2} />
            <span className="hidden sm:inline">{t("kitchen.delay.short", "Time")}</span>
          </button>
        )}
        <button
          type="button"
          disabled={!hasActive}
          onClick={(e) => {
            e.stopPropagation();
            onBump();
          }}
          className={clsx(
            "flex-1 h-12 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-[0.98]",
            hasActive ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950" : "bg-[var(--kds-soft)] text-[color:var(--kds-faint)]"
          )}
        >
          <IconCheck size={19} stroke={3} />
          {hasActive ? t("kitchen.kds.bump", "Bump") : t("kitchen.kds.done", "Done")}
          {hasActive && totalCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-black/15 text-[11px] tabular-nums normal-case tracking-normal">
              {doneCount}/{totalCount}
            </span>
          )}
        </button>
      </footer>
    </article>
  );
}
