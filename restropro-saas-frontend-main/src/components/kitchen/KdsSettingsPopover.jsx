import React, { useEffect, useRef } from "react";
import clsx from "clsx";
import { IconMinus, IconPlus, IconKeyboard } from "@tabler/icons-react";

function Stepper({ value, onChange, min, max, suffix }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 flex items-center justify-center transition active:scale-95"
        aria-label="Decrease"
      >
        <IconMinus size={16} stroke={2.4} />
      </button>
      <span className="w-14 text-center font-black text-white tabular-nums">
        {value}
        <span className="text-xs font-semibold text-slate-400 ml-0.5">{suffix}</span>
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 flex items-center justify-center transition active:scale-95"
        aria-label="Increase"
      >
        <IconPlus size={16} stroke={2.4} />
      </button>
    </div>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="flex p-1 rounded-xl bg-black/30 border border-white/[0.06]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={clsx(
            "flex-1 h-9 px-3 rounded-lg text-xs font-bold transition",
            value === o.id ? "bg-white text-slate-950" : "text-slate-300 hover:text-white"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SHORTCUTS = [
  ["1–9", "Select ticket"],
  ["← →", "Move selection"],
  ["Enter", "Bump selected"],
  ["Space", "Start all on selected"],
  ["U", "Undo last bump"],
  ["R", "Open recall"],
];

export default function KdsSettingsPopover({ open, onClose, settings, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest?.("[data-kds-settings-toggle]")) onClose();
    };
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const set = (patch) => onChange({ ...settings, ...patch });

  return (
    <div ref={ref} className="absolute right-0 top-[calc(100%+8px)] z-40 w-[340px] rounded-2xl bg-[#171a22] border border-white/[0.08] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)] p-4 text-slate-100">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ticket timers</p>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Warning after
          </p>
        </div>
        <Stepper
          value={settings.warnMinutes}
          min={1}
          max={Math.max(1, settings.lateMinutes - 1)}
          suffix="m"
          onChange={(v) => set({ warnMinutes: v })}
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm font-bold flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Late after
        </p>
        <Stepper
          value={settings.lateMinutes}
          min={settings.warnMinutes + 1}
          max={90}
          suffix="m"
          onChange={(v) => set({ lateMinutes: v })}
        />
      </div>

      <div className="my-4 h-px bg-white/[0.06]" />

      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Display</p>
      <div className="flex flex-col gap-2.5">
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5">Text size</p>
          <Segmented
            value={settings.textSize}
            onChange={(v) => set({ textSize: v })}
            options={[
              { id: "sm", label: "Compact" },
              { id: "md", label: "Regular" },
              { id: "lg", label: "Large" },
            ]}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-1.5">Ticket order</p>
          <Segmented
            value={settings.sortOrder}
            onChange={(v) => set({ sortOrder: v })}
            options={[
              { id: "oldest", label: "Oldest first" },
              { id: "newest", label: "Newest first" },
            ]}
          />
        </div>
      </div>

      <div className="my-4 h-px bg-white/[0.06]" />

      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
        <IconKeyboard size={14} stroke={2} /> Bump bar / keyboard
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {SHORTCUTS.map(([k, label]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <kbd className="min-w-[38px] h-6 px-1.5 rounded-md bg-black/40 border border-white/[0.1] text-[11px] font-bold text-slate-200 flex items-center justify-center">
              {k}
            </kbd>
            <span className="text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
