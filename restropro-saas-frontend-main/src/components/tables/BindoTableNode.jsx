import React, { memo } from "react";
import { IconRotate, IconTrash, IconPencil } from "@tabler/icons-react";

// Bindo Labs Color Palette configuration
export const BINDO_STATUS_CONFIG = {
  seated: {
    label: "SEATED",
    bg: "bg-[#0ea5e9]", // Cyan-Blue
    text: "text-white",
    border: "border-[#0284c7]",
    chair: "bg-[#0ea5e9]",
    badgeBg: "bg-white/90 text-[#0369a1]",
  },
  ordered: {
    label: "ORDERED",
    bg: "bg-[#1e293b]", // Deep Slate Navy
    text: "text-white",
    border: "border-[#0f172a]",
    chair: "bg-[#1e293b]",
    badgeBg: "bg-white/90 text-[#0f172a]",
  },
  ck_dropped: {
    label: "CK DROPPED",
    bg: "bg-[#f97316]", // Orange
    text: "text-white",
    border: "border-[#ea580c]",
    chair: "bg-[#f97316]",
    badgeBg: "bg-white/90 text-[#c2410c]",
  },
  paid: {
    label: "PAID",
    bg: "bg-[#4ade80]", // Vibrant Green
    text: "text-[#064e3b]",
    border: "border-[#22c55e]",
    chair: "bg-[#4ade80]",
    badgeBg: "bg-white/90 text-[#15803d]",
  },
  unsent: {
    label: "UNSENT ITEMS",
    bg: "bg-[#facc15]", // Yellow
    text: "text-[#713f12]",
    border: "border-[#eab308]",
    chair: "bg-[#facc15]",
    badgeBg: "bg-white/90 text-[#854d0e]",
  },
  alert: {
    label: "ALERT",
    bg: "bg-[#d946ef]", // Magenta
    text: "text-white",
    border: "border-[#c026d3]",
    chair: "bg-[#d946ef]",
    badgeBg: "bg-white/90 text-[#a21caf]",
  },
  over_time: {
    label: "OVER TIME",
    bg: "bg-[#f87171]", // Coral Red
    text: "text-white",
    border: "border-[#ef4444]",
    chair: "bg-[#f87171]",
    badgeBg: "bg-white/90 text-[#b91c1c]",
  },
  reserved: {
    label: "RESERVED",
    bg: "bg-[#c084fc]", // Violet Purple
    text: "text-white",
    border: "border-[#a855f7]",
    chair: "bg-[#c084fc]",
    badgeBg: "bg-white/90 text-[#7e22ce]",
  },
  multiple: {
    label: "MULTIPLE",
    bg: "bg-[#f472b6]", // Pink
    text: "text-white",
    border: "border-[#ec4899]",
    chair: "bg-[#f472b6]",
    badgeBg: "bg-white/90 text-[#be185d]",
  },
  available: {
    label: "AVAILABLE",
    bg: "bg-[#475569]", // Sleek Dark Charcoal Grey
    text: "text-white",
    border: "border-[#334155]",
    chair: "bg-[#64748b]",
    badgeBg: "bg-white/90 text-slate-800",
  },
  blocked: {
    label: "BLOCKED",
    bg: "bg-[#94a3b8]", // Light Grey
    text: "text-white",
    border: "border-[#64748b]",
    chair: "bg-[#cbd5e1]",
    badgeBg: "bg-white/90 text-slate-700",
  },
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
  if (status === "ordered" || status === "preparing") return "ordered";

  return "seated";
}

function renderChairs(shape, capacity, chairClass) {
  const cap = Math.max(1, capacity || 2);
  const chairStyle = `absolute rounded-full shadow-xs transition-transform ${chairClass}`;

  if (shape === "round") {
    const count = Math.min(cap, 12);
    const radius = count > 6 ? 48 : 42;
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
            width: count > 6 ? "14px" : "18px",
            height: count > 6 ? "8px" : "10px",
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
            width: "22px",
            height: "9px",
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
            width: "22px",
            height: "9px",
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
          width: "9px",
          height: "22px",
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
          width: "9px",
          height: "22px",
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
        width: "20px",
        height: "9px",
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
        width: "20px",
        height: "9px",
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
          width: "9px",
          height: "20px",
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
          width: "9px",
          height: "20px",
          right: "-11px",
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
    );
  }
  return chairs;
}

const BindoTableNode = memo(function BindoTableNode({
  table,
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
  const shape = table.shape || (table.seating_capacity > 4 ? "rectangle" : table.seating_capacity > 2 ? "square" : "round");
  const rotation = table.rotation || 0;
  const statusKey = getTableBindoStatus(table);
  const status = BINDO_STATUS_CONFIG[statusKey] || BINDO_STATUS_CONFIG.available;

  let dimensions = "w-[72px] h-[72px] rounded-xl";
  if (shape === "round") {
    const isLarge = (table.seating_capacity || 2) >= 8;
    dimensions = isLarge ? "w-[96px] h-[96px] rounded-full" : "w-[80px] h-[80px] rounded-full";
  } else if (shape === "rectangle") {
    dimensions = "w-[124px] h-[74px] rounded-xl";
  }

  const timerText = table.elapsed_time || table.timer_badge || (table.active_order_id ? "-00:33" : null);
  const serverOrGuest = table.customer_name || table.server_name || table.assigned_waiter;

  return (
    <div
      onPointerDown={(e) => onPointerDown && onPointerDown(e, table)}
      onClick={(e) => {
        e.stopPropagation();
        onClick && onClick(table);
      }}
      className={`absolute select-none transition-all duration-150 group ${
        isEditMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${isDimmed ? "opacity-30 pointer-events-none" : "opacity-100"}`}
      style={{
        left: `${table.pos_x}px`,
        top: `${table.pos_y}px`,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      {/* Surrounding realistic chairs */}
      <div className="absolute inset-0 pointer-events-none">
        {renderChairs(shape, table.seating_capacity || 2, status.chair)}
      </div>

      {/* Main Table Surface */}
      <div
        className={`relative flex flex-col items-center justify-center border-2 ${dimensions} ${status.bg} ${status.border} shadow-md transition-all ${
          isSelected
            ? "ring-4 ring-cyan-400 ring-offset-2 scale-105 z-30"
            : isMergeSource
            ? "ring-4 ring-amber-400 ring-offset-2 animate-pulse z-30"
            : isMergeTarget
            ? "ring-4 ring-emerald-400 ring-offset-2 z-30"
            : "hover:scale-102 hover:shadow-lg z-10"
        }`}
      >
        {/* Elapsed Timer Badge at Top Edge */}
        {timerText && (
          <div
            className={`absolute -top-2.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-tight shadow-xs border border-black/10 z-10 ${status.badgeBg}`}
            style={{ transform: `rotate(${-rotation}deg)` }}
          >
            {timerText}
          </div>
        )}

        {/* Big Bold Table Number */}
        <span
          className={`text-xl md:text-2xl font-black tracking-tight leading-none ${status.text}`}
          style={{ transform: `rotate(${-rotation}deg)` }}
        >
          {table.table_title}
        </span>

        {/* Capacity indicator in corner */}
        <div
          className="absolute bottom-1 right-1.5 text-[9px] font-bold opacity-60 pointer-events-none"
          style={{ transform: `rotate(${-rotation}deg)` }}
        >
          {table.seating_capacity || 2}p
        </div>
      </div>

      {/* Guest / Server Name beneath table */}
      {serverOrGuest && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 text-center pointer-events-none whitespace-nowrap z-10"
          style={{ transform: `translateX(-50%) rotate(${-rotation}deg)` }}
        >
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded shadow-2xs backdrop-blur-xs">
            {serverOrGuest}
          </span>
        </div>
      )}

      {/* Edit Mode Quick Action Floating Controls */}
      {isEditMode && isSelected && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute -top-11 left-1/2 flex items-center gap-1 bg-slate-900/95 backdrop-blur-md text-white px-2 py-1 rounded-xl shadow-2xl z-40 ring-1 ring-white/15"
          style={{ transform: `translateX(-50%) rotate(${-rotation}deg)` }}
        >
          <button
            type="button"
            onClick={(e) => onRotate && onRotate(e, table)}
            title="Rotate 45°"
            className="p-1 hover:bg-slate-700 rounded-lg text-slate-200 transition"
          >
            <IconRotate size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => onEdit && onEdit(table)}
            title="Edit Table"
            className="p-1 hover:bg-slate-700 rounded-lg text-slate-200 transition"
          >
            <IconPencil size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => onDelete && onDelete(table)}
            title="Delete Table"
            className="p-1 hover:bg-red-500/30 text-red-400 rounded-lg transition"
          >
            <IconTrash size={14} />
          </button>
        </div>
      )}
    </div>
  );
});

export default BindoTableNode;
