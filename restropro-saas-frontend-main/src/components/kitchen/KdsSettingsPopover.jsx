import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { IconMinus, IconPlus, IconKeyboard } from "@tabler/icons-react";

function Stepper({ value, onChange, min, max, suffix, t }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-[42px] h-[42px] rounded-xl bg-[var(--kds-soft)] hover:bg-[var(--kds-soft-2)] text-[color:var(--kds-text-2)] flex items-center justify-center transition active:scale-95"
        aria-label={t("kitchen.kds.decrease", "Decrease")}
      >
        <IconMinus size={16} stroke={2.4} />
      </button>
      <span className="w-14 text-center font-black text-[color:var(--kds-text)] tabular-nums">
        {value}
        <span className="text-xs font-semibold text-[color:var(--kds-muted)] ml-0.5">{suffix}</span>
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-[42px] h-[42px] rounded-xl bg-[var(--kds-soft)] hover:bg-[var(--kds-soft-2)] text-[color:var(--kds-text-2)] flex items-center justify-center transition active:scale-95"
        aria-label={t("kitchen.kds.increase", "Increase")}
      >
        <IconPlus size={16} stroke={2.4} />
      </button>
    </div>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="flex p-1 rounded-xl bg-[var(--kds-well)] border border-[color:var(--kds-line)]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={clsx(
            "flex-1 h-[42px] px-3 rounded-lg text-xs font-bold transition active:scale-95",
            value === o.id
              ? "bg-[var(--kds-invert-bg)] text-[color:var(--kds-invert-text)]"
              : "text-[color:var(--kds-text-2)] hover:text-[color:var(--kds-text)]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SHORTCUTS = [
  ["1–9", "key_select", "Select ticket"],
  ["← →", "key_move", "Move selection"],
  ["Enter", "key_bump", "Bump selected"],
  ["Space", "key_start", "Start all on selected"],
  ["U", "key_undo", "Undo last bump"],
  ["R", "key_recall", "Open recall"],
];

export default function KdsSettingsPopover({ open, onClose, settings, onChange, theme, onThemeChange }) {
  const { t } = useTranslation();
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
    <div ref={ref} className="absolute right-0 top-[calc(100%+8px)] z-40 w-[340px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-120px)] overflow-y-auto no-scrollbar rounded-2xl bg-[var(--kds-panel)] border border-[color:var(--kds-line)] shadow-[var(--kds-pop-shadow)] p-4 text-[color:var(--kds-text)]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--kds-faint)]">{t("kitchen.kds.ticket_timers", "Ticket timers")}</p>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> {t("kitchen.kds.warning_after", "Warning after")}
          </p>
        </div>
        <Stepper
          value={settings.warnMinutes}
          min={1}
          max={Math.max(1, settings.lateMinutes - 1)}
          suffix={t("kitchen.kds.minutes_suffix", "m")}
          t={t}
          onChange={(v) => set({ warnMinutes: v })}
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm font-bold flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> {t("kitchen.kds.late_after", "Late after")}
        </p>
        <Stepper
          value={settings.lateMinutes}
          min={settings.warnMinutes + 1}
          max={90}
          suffix={t("kitchen.kds.minutes_suffix", "m")}
          t={t}
          onChange={(v) => set({ lateMinutes: v })}
        />
      </div>

      <div className="my-4 h-px bg-[var(--kds-line)]" />

      <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--kds-faint)] mb-2">{t("kitchen.kds.display", "Display")}</p>
      <div className="flex flex-col gap-2.5">
        <div>
          <p className="text-xs font-semibold text-[color:var(--kds-muted)] mb-1.5">{t("kitchen.kds.theme", "Theme")}</p>
          <Segmented
            value={theme}
            onChange={onThemeChange}
            options={[
              { id: "dark", label: t("kitchen.kds.theme_dark", "Dark") },
              { id: "light", label: t("kitchen.kds.theme_light", "Light") },
            ]}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-[color:var(--kds-muted)] mb-1.5">{t("kitchen.kds.text_size", "Text size")}</p>
          <Segmented
            value={settings.textSize}
            onChange={(v) => set({ textSize: v })}
            options={[
              { id: "sm", label: t("kitchen.kds.size_compact", "Compact") },
              { id: "md", label: t("kitchen.kds.size_regular", "Regular") },
              { id: "lg", label: t("kitchen.kds.size_large", "Large") },
            ]}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-[color:var(--kds-muted)] mb-1.5">{t("pos_ops.all_day_bar", "All-day counts")}</p>
          <Segmented
            value={settings.showAllDay === false ? "off" : "on"}
            onChange={(v) => set({ showAllDay: v === "on" })}
            options={[
              { id: "on", label: t("pos_ops.show", "Show") },
              { id: "off", label: t("pos_ops.hide", "Hide") },
            ]}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-[color:var(--kds-muted)] mb-1.5">{t("kitchen.kds.ticket_order", "Ticket order")}</p>
          <Segmented
            value={settings.sortOrder}
            onChange={(v) => set({ sortOrder: v })}
            options={[
              { id: "oldest", label: t("kitchen.kds.oldest_first", "Oldest first") },
              { id: "newest", label: t("kitchen.kds.newest_first", "Newest first") },
            ]}
          />
        </div>
      </div>

      <div className="my-4 h-px bg-[var(--kds-line)]" />

      <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--kds-faint)] mb-2 flex items-center gap-1.5">
        <IconKeyboard size={14} stroke={2} /> {t("kitchen.kds.keyboard", "Bump bar / keyboard")}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {SHORTCUTS.map(([k, key, label]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <kbd className="min-w-[38px] h-6 px-1.5 rounded-md bg-[var(--kds-kbd)] border border-[color:var(--kds-line-2)] text-[11px] font-bold text-[color:var(--kds-text-2)] flex items-center justify-center">
              {k}
            </kbd>
            <span className="text-[color:var(--kds-muted)]">{t(`kitchen.kds.${key}`, label)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
