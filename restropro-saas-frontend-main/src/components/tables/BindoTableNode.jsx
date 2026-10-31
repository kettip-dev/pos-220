import React, { memo, useState, useEffect } from "react";
import { IconRotate, IconTrash, IconPencil, IconQrcode, IconClock, IconLink } from "@tabler/icons-react";
import { formatElapsedOrderTime } from "../../helpers/DateHelper";
export { formatElapsedOrderTime };

// Bindo Labs Color Palette configuration (Light table surfaces with status-colored borders & accents)
export const BINDO_STATUS_CONFIG = {
  seated: {
    label: "SEATED",
    bg: "bg-white dark:bg-zinc-900",
    accentBg: "bg-[#0ea5e9]",
    text: "text-slate-800 dark:text-zinc-100",
    subText: "text-slate-400 dark:text-zinc-400",
    border: "border-[#0ea5e9]",
    statusDot: "bg-[#0ea5e9]",
    chair: "bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600",
    badgeBg: "bg-sky-50 text-[#0369a1] border-sky-200 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800",
  },
  ordered: {
    label: "ORDERED",
    bg: "bg-white dark:bg-zinc-900",
    accentBg: "bg-[#2563eb]",
    text: "text-slate-800 dark:text-zinc-100",
    subText: "text-slate-400 dark:text-zinc-400",
    border: "border-[#2563eb]",
    statusDot: "bg-[#2563eb]",
    chair: "bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800",
  },
  ck_dropped: {
    label: "CK DROPPED",
    bg: "bg-white dark:bg-zinc-900",
    accentBg: "bg-[#ea580c]",
    text: "text-slate-800 dark:text-zinc-100",
    subText: "text-slate-400 dark:text-zinc-400",
    border: "border-[#ea580c]",
    statusDot: "bg-[#ea580c]",
    chair: "bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600",
    badgeBg: "bg-orange-50 text-[#c2410c] border-orange-200 dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-800",
  },
  paid: {
    label: "PAID",
    bg: "bg-white dark:bg-zinc-900",
    accentBg: "bg-[#16a34a]",
    text: "text-slate-800 dark:text-zinc-100",
    subText: "text-slate-400 dark:text-zinc-400",
    border: "border-[#16a34a]",
    statusDot: "bg-[#16a34a]",
    chair: "bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600",
    badgeBg: "bg-emerald-50 text-[#15803d] border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800",
  },
  unsent: {
    label: "UNSENT ITEMS",
    bg: "bg-white dark:bg-zinc-900",
    accentBg: "bg-[#eab308]",
    text: "text-slate-800 dark:text-zinc-100",
    subText: "text-slate-400 dark:text-zinc-400",
    border: "border-[#eab308]",
    statusDot: "bg-[#eab308]",
    chair: "bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600",
    badgeBg: "bg-amber-50 text-[#854d0e] border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
  },
  alert: {
    label: "ALERT",
    bg: "bg-white dark:bg-zinc-900",
    accentBg: "bg-[#c026d3]",
    text: "text-slate-800 dark:text-zinc-100",
    subText: "text-slate-400 dark:text-zinc-400",
    border: "border-[#c026d3]",
    statusDot: "bg-[#c026d3]",
    chair: "bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600",
    badgeBg: "bg-fuchsia-50 text-[#a21caf] border-fuchsia-200 dark:bg-fuchsia-950/70 dark:text-fuchsia-300 dark:border-fuchsia-800",
  },
  over_time: {
    label: "OVER TIME",
    bg: "bg-white dark:bg-zinc-900",
    accentBg: "bg-[#dc2626]",
    text: "text-slate-800 dark:text-zinc-100",
    subText: "text-slate-400 dark:text-zinc-400",
    border: "border-[#dc2626]",
    statusDot: "bg-[#dc2626]",
    chair: "bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600",
    badgeBg: "bg-red-50 text-[#b91c1c] border-red-200 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800",
  },
  reserved: {
    label: "RESERVED",
    bg: "bg-white dark:bg-zinc-900",
    accentBg: "bg-[#9333ea]",
    text: "text-slate-800 dark:text-zinc-100",
    subText: "text-slate-400 dark:text-zinc-400",
    border: "border-[#9333ea]",
    statusDot: "bg-[#9333ea]",
    chair: "bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600",
    badgeBg: "bg-purple-50 text-[#7e22ce] border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800",
  },
  multiple: {
    label: "MULTIPLE",
    bg: "bg-white dark:bg-zinc-900",
    accentBg: "bg-[#db2777]",
    text: "text-slate-800 dark:text-zinc-100",
    subText: "text-slate-400 dark:text-zinc-400",
    border: "border-[#db2777]",
    statusDot: "bg-[#db2777]",
    chair: "bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600",
    badgeBg: "bg-pink-50 text-[#be185d] border-pink-200 dark:bg-pink-950/70 dark:text-pink-300 dark:border-pink-800",
  },
  available: {
    label: "AVAILABLE",
    bg: "bg-white dark:bg-zinc-900",
    accentBg: "bg-slate-400",
    text: "text-slate-800 dark:text-zinc-100",
    subText: "text-slate-400 dark:text-zinc-400",
    border: "border-slate-300 dark:border-zinc-700",
    statusDot: "",
    chair: "bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600",
    badgeBg: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-slate-300 dark:border-zinc-700",
  },
  blocked: {
    label: "BLOCKED",
    bg: "bg-slate-100/90 dark:bg-zinc-800/80",
    accentBg: "bg-slate-400",
    text: "text-slate-400 dark:text-zinc-500",
    subText: "text-slate-400 dark:text-zinc-600",
    border: "border-dashed border-slate-300 dark:border-zinc-700",
    statusDot: "bg-slate-400",
    chair: "bg-slate-200/50 dark:bg-zinc-800/50 border border-dashed border-slate-300 dark:border-zinc-700",
    badgeBg: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  },
};

const DIMMED_STATUS_STYLE = {
  bg: "bg-slate-100 dark:bg-zinc-800/80",
  accentBg: "bg-slate-300",
  text: "text-slate-400 dark:text-zinc-500",
  subText: "text-slate-400 dark:text-zinc-600",
  border: "border-slate-300 dark:border-zinc-700",
  statusDot: "bg-slate-300 dark:bg-zinc-600",
  chair: "bg-slate-200/60 dark:bg-zinc-800/60 border border-slate-300/60 dark:border-zinc-700",
  badgeBg: "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-700",
};

export function getTableBindoStatus(table) {
  if (table.is_blocked) return "blocked";
  if (table.has_reservation && !table.active_order_id) return "reserved";
  if (!table.active_order_id) return "available";

  const status = table.order_status || table.active_order_status;
  const paymentStatus = table.payment_status || table.active_payment_status;

  if (paymentStatus === "paid") return "paid";
  if (status === "check_dropped" || status === "billed") return "ck_dropped";
  if (table.is_alert) return "alert";
  if (table.is_over_time) return "over_time";
  if (table.is_multiple_orders) return "multiple";
  if (status === "unsent" || table.has_unsent_items) return "unsent";
  if (
    status === "ordered" ||
    status === "preparing" ||
    status === "created" ||
    Number(table.order_items_count || 0) > 0
  ) {
    return "ordered";
  }

  return "seated";
}

function renderChairs(shape, capacity, chairClass) {
  const cap = Math.max(1, capacity || 2);
  const chairStyle = `absolute rounded-full shadow-2xs transition-colors ${chairClass}`;

  if (shape === "round") {
    const count = Math.min(cap, 12);
    const isLarge = cap >= 8;
    const radius = isLarge ? 54 : 46;
    const chairs = [];
    for (let i = 0; i < count; i++) {
      const angle = (i * 360) / count - 90;
      const rad = (angle * Math.PI) / 180;
      const x = Math.round(radius * Math.cos(rad));
      const y = Math.round(radius * Math.sin(rad));
      chairs.push(
        <div
          key={i}
          className={chairStyle}
          style={{
            width: count > 6 ? "16px" : "20px",
            height: count > 6 ? "7px" : "8px",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${angle + 90}deg)`,
          }}
        />
      );
    }
    return chairs;
  }

  if (shape === "rectangle") {
    const chairs = [];
    const topBottomCount = Math.max(2, Math.floor((cap - 2) / 2));
    // Top chairs
    for (let i = 0; i < topBottomCount; i++) {
      const leftPct = ((i + 1) * 100) / (topBottomCount + 1);
      chairs.push(
        <div
          key={`t-${i}`}
          className={chairStyle}
          style={{
            width: "24px",
            height: "8px",
            top: "-11px",
            left: `${leftPct}%`,
            transform: "translateX(-50%)",
          }}
        />
      );
    }
    // Bottom chairs
    for (let i = 0; i < topBottomCount; i++) {
      const leftPct = ((i + 1) * 100) / (topBottomCount + 1);
      chairs.push(
        <div
          key={`b-${i}`}
          className={chairStyle}
          style={{
            width: "24px",
            height: "8px",
            bottom: "-11px",
            left: `${leftPct}%`,
            transform: "translateX(-50%)",
          }}
        />
      );
    }
    // Left & Right chairs
    chairs.push(
      <div
        key="l-0"
        className={chairStyle}
        style={{
          width: "8px",
          height: "24px",
          left: "-11px",
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
    );
    chairs.push(
      <div
        key="r-0"
        className={chairStyle}
        style={{
          width: "8px",
          height: "24px",
          right: "-11px",
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
    );
    return chairs;
  }

  // Square table (default)
  const chairs = [];
  chairs.push(
    <div
      key="sq-top"
      className={chairStyle}
      style={{
        width: "22px",
        height: "8px",
        top: "-11px",
        left: "50%",
        transform: "translateX(-50%)",
      }}
    />
  );
  chairs.push(
    <div
      key="sq-bottom"
      className={chairStyle}
      style={{
        width: "22px",
        height: "8px",
        bottom: "-11px",
        left: "50%",
        transform: "translateX(-50%)",
      }}
    />
  );

  if (cap >= 3) {
    chairs.push(
      <div
        key="sq-left"
        className={chairStyle}
        style={{
          width: "8px",
          height: "22px",
          left: "-11px",
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
    );
  }
  if (cap >= 4) {
    chairs.push(
      <div
        key="sq-right"
        className={chairStyle}
        style={{
          width: "8px",
          height: "22px",
          right: "-11px",
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
    );
  }
  return chairs;
}

export function getTitleTypography(title = "", shape = "square") {
  const len = String(title || "").trim().length;
  if (shape === "rectangle") {
    if (len <= 4) return "text-sm md:text-base font-bold";
    if (len <= 8) return "text-xs md:text-sm font-bold";
    if (len <= 14) return "text-[11.5px] md:text-xs font-semibold";
    return "text-[10px] md:text-[10.5px] font-semibold leading-tight line-clamp-2";
  }
  // Square or Round
  if (len <= 3) return "text-sm md:text-base font-bold";
  if (len <= 6) return "text-xs md:text-sm font-bold";
  if (len <= 11) return "text-[11px] font-semibold leading-tight line-clamp-2";
  return "text-[10px] font-semibold leading-tight line-clamp-2";
}

const BindoTableNode = memo(function BindoTableNode({
  table,
  currency = "$",
  isSelected,
  isMergeTarget,
  isMergeSource,
  isEditMode,
  isDimmed,
  onPointerDown,
  onClick,
  onRotate,
  onDelete,
  onEdit,
}) {
  const shape =
    table.shape ||
    (table.seating_capacity > 4 ? "rectangle" : table.seating_capacity > 2 ? "square" : "round");
  const rotation = table.rotation || 0;
  const statusKey = getTableBindoStatus(table);
  const baseStatus = BINDO_STATUS_CONFIG[statusKey] || BINDO_STATUS_CONFIG.available;

  // Never dim a table that is currently selected, and use solid opaque colors when dimmed
  const effectiveDimmed = Boolean(isDimmed && !isSelected);
  const status = effectiveDimmed ? DIMMED_STATUS_STYLE : baseStatus;

  let dimensions = "w-[76px] h-[76px] rounded-2xl";
  if (shape === "round") {
    const isLarge = (table.seating_capacity || 2) >= 8;
    dimensions = isLarge ? "w-[96px] h-[96px] rounded-full" : "w-[82px] h-[82px] rounded-full";
  } else if (shape === "rectangle") {
    dimensions = "w-[128px] h-[76px] rounded-2xl";
  }

  // Live elapsed time ticker (updates every 30s)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!table.active_order_id || !table.active_order_date) return;
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, [table.active_order_id, table.active_order_date]);

  const timerText =
    table.elapsed_time ||
    table.timer_badge ||
    (table.active_order_id ? formatElapsedOrderTime(table.active_order_date) : null);

  const isOccupied = Boolean(table.active_order_id);
  const pendingQrCount = Number(table.pending_qr_orders_count || 0);
  const orderTotal = Number(table.order_total || table.active_order_total || 0);
  const guestLabel = table.customer_name || table.server_name || table.assigned_waiter || null;

  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown && onPointerDown(e, table);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick && onClick(table);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit && onEdit(table);
      }}
      className={`absolute select-none transition-transform duration-150 group pointer-events-auto ${
        isEditMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${isSelected ? "z-30" : isMergeSource || isMergeTarget ? "z-25" : "z-10 hover:z-20"}`}
      style={{
        left: `${table.pos_x}px`,
        top: `${table.pos_y}px`,
      }}
    >
      {/* Wrapper with dimensions matching table shape */}
      <div className={`relative flex items-center justify-center ${dimensions}`}>
        {/* 1. Rotated Physical Table Geometry + Chairs */}
        <div
          className="absolute inset-0 transition-transform duration-200"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Surrounding realistic chairs */}
          <div className="absolute inset-0 pointer-events-none">
            {renderChairs(shape, table.seating_capacity || 2, status.chair)}
          </div>

          {/* Physical Table Surface */}
          <div
            className={`w-full h-full border-2 ${dimensions} ${status.bg} ${status.border} shadow-xs shadow-slate-200/50 dark:shadow-zinc-950/40 transition-all duration-150 ${
              isSelected
                ? "ring-4 ring-[#0ea5e9] ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 scale-[1.04] shadow-md"
                : isMergeSource
                ? "ring-4 ring-amber-400 ring-offset-2 animate-pulse"
                : isMergeTarget
                ? "ring-4 ring-emerald-400 ring-offset-2"
                : "group-hover:scale-[1.02] group-hover:shadow-md"
            }`}
          />
        </div>

        {/* 2. Upright Centered Content Stack (Never Rotated -> Always Readable) */}
        <div
          className={`relative z-10 flex flex-col items-center justify-center pointer-events-none text-center px-1.5 ${
            shape === "rectangle" ? "max-w-[112px]" : "max-w-[68px]"
          }`}
        >
          <span
            title={table.table_title}
            className={`${getTitleTypography(table.table_title, shape)} tracking-tight leading-tight line-clamp-2 break-words ${status.text}`}
          >
            {table.table_title}
          </span>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            {(table.is_linked_secondary || table.is_linked_master) && (
              <IconLink size={10} className="shrink-0 text-[#0ea5e9] dark:text-sky-400" />
            )}
            {statusKey !== "available" && status.statusDot && (
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.statusDot}`} />
            )}
            <span
              className={`text-[9.5px] font-semibold tracking-tight leading-none ${status.subText}`}
            >
              {table.seating_capacity || 2}p
            </span>
          </div>
        </div>

        {/* 3. Upright Top Elapsed Time Pill (Occupied Tables) */}
        {timerText && (
          <div
            className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9.5px] font-bold tracking-tight shadow-xs border flex items-center gap-1 whitespace-nowrap z-20 pointer-events-none ${status.badgeBg}`}
          >
            <IconClock size={10} className="shrink-0 opacity-80" />
            <span>{timerText}</span>
          </div>
        )}

        {/* 4. Pending QR Order Alert Badge (Top Right Corner) */}
        {pendingQrCount > 0 && (
          <div
            title={`${pendingQrCount} Pending QR Order(s)`}
            className="absolute -top-2.5 -right-2.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white border-2 border-white dark:border-zinc-900 text-[9px] font-black shadow-md flex items-center gap-0.5 animate-bounce z-30 pointer-events-none"
          >
            <IconQrcode size={10} />
            <span>{pendingQrCount}</span>
          </div>
        )}

        {/* 5. Upright Bottom Info Pill (Customer Name & Live Order Total) */}
        {(isOccupied || guestLabel) && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2.5 flex flex-col items-center pointer-events-none whitespace-nowrap z-20">
            <div
              className={`px-2 py-0.5 rounded-full border shadow-xs flex items-center gap-1.5 text-[10px] font-bold ${
                effectiveDimmed
                  ? "bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-slate-500 dark:text-zinc-400"
                  : "bg-white/95 dark:bg-zinc-900/95 border-slate-200/90 dark:border-zinc-700 text-slate-800 dark:text-slate-100 backdrop-blur-xs"
              }`}
            >
              {guestLabel && (
                <span className="max-w-[84px] truncate font-semibold">
                  {guestLabel}
                </span>
              )}
              {guestLabel && isOccupied && orderTotal > 0 && (
                <span className="text-slate-300 dark:text-zinc-600">•</span>
              )}
              {isOccupied && orderTotal > 0 && (
                <span className={effectiveDimmed ? "" : "text-[#0284c7] dark:text-[#38bdf8] font-extrabold"}>
                  {currency}
                  {orderTotal % 1 === 0 ? orderTotal.toLocaleString() : orderTotal.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 6. Edit Mode Quick Action Floating Controls */}
        {isEditMode && isSelected && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/95 backdrop-blur-md text-white px-2 py-1 rounded-xl shadow-2xl z-40 ring-1 ring-white/15 pointer-events-auto"
          >
            <button
              type="button"
              onClick={(e) => onRotate && onRotate(e, table)}
              title="Rotate 45°"
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-200 transition cursor-pointer"
            >
              <IconRotate size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => onEdit && onEdit(table)}
              title="Edit Table"
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-200 transition cursor-pointer"
            >
              <IconPencil size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => onDelete && onDelete(table)}
              title="Delete Table"
              className="p-1.5 hover:bg-red-500/30 text-red-400 rounded-lg transition cursor-pointer"
            >
              <IconTrash size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default BindoTableNode;
