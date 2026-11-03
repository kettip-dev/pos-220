import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { IconCheck, IconMoon, IconX, IconClock } from "@tabler/icons-react";
import { addShift, updateShift } from "../../controllers/shift_roster.controller";
import { SHIFT_COLORS, shiftDurationMinutes, formatHours, timeToMinutes } from "./rosterUtils";

const PRESETS = [
  { key: "morning", name: "Morning", start_time: "07:00", end_time: "15:00", color: "#F59E0B" },
  { key: "afternoon", name: "Afternoon", start_time: "15:00", end_time: "23:00", color: "#3B82F6" },
  { key: "night", name: "Night", start_time: "23:00", end_time: "07:00", color: "#8B5CF6", is_overnight: true },
  { key: "full_day", name: "Full Day", start_time: "09:00", end_time: "21:00", color: "#10B981" },
];

const EMPTY_FORM = {
  name: "",
  start_time: "08:00",
  end_time: "16:00",
  is_overnight: false,
  color: "#3B82F6",
  is_active: true,
};

export default function ShiftTemplateModal({ open, shift, onClose, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      shift
        ? {
            name: shift.name,
            start_time: shift.start_time,
            end_time: shift.end_time,
            is_overnight: !!shift.is_overnight,
            color: shift.color || "#3B82F6",
            is_active: !!shift.is_active,
          }
        : EMPTY_FORM
    );
  }, [open, shift]);

  if (!open) return null;

  const endsBeforeStart = timeToMinutes(form.end_time) <= timeToMinutes(form.start_time);
  const duration = shiftDurationMinutes(form.start_time, form.end_time, form.is_overnight || endsBeforeStart);

  const setTime = (field, value) => {
    const next = { ...form, [field]: value };
    // Auto-flag overnight when the end time wraps past midnight
    next.is_overnight = timeToMinutes(next.end_time) <= timeToMinutes(next.start_time);
    setForm(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t("shift_roster.shift_name_required", "Shift name is required"));
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), is_overnight: form.is_overnight || endsBeforeStart };
      if (shift) {
        await updateShift(shift.id, payload);
        toast.success(t("shift_roster.shift_updated", "Shift updated successfully"));
      } else {
        await addShift(payload);
        toast.success(t("shift_roster.shift_created", "Shift created successfully"));
      }
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "An error occurred"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {shift ? t("shift_roster.edit_shift", "Edit Shift Template") : t("shift_roster.create_shift", "New Shift Template")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-[42px] h-[42px] -mr-2 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white active:scale-95 cursor-pointer"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {!shift && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t("shift_roster.quick_presets", "Quick presets")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setForm({ ...EMPTY_FORM, ...p, name: t(`shift_roster.preset_${p.key}`, p.name), is_overnight: !!p.is_overnight })}
                    className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-left flex items-center gap-2 active:scale-95 transition cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{t(`shift_roster.preset_${p.key}`, p.name)}</span>
                      <span className="block text-[10px] font-mono text-slate-500">{p.start_time}–{p.end_time}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t("shift_roster.shift_name", "Shift Name (e.g. Morning, Evening)")}
            </label>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="Morning"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {["start_time", "end_time"].map((field) => (
              <div key={field} className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {field === "start_time" ? t("shift_roster.start_time", "Start Time") : t("shift_roster.end_time", "End Time")}
                </label>
                <input
                  type="time"
                  required
                  value={form[field]}
                  onChange={(e) => setTime(field, e.target.value)}
                  className="w-full h-12 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: form.color }}>
              {form.is_overnight ? <IconMoon size={18} /> : <IconClock size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {formatHours(duration)} {t("shift_roster.per_shift", "per shift")}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {form.is_overnight
                  ? t("shift_roster.crosses_midnight_hint", "Shift ends the following morning (e.g. 18:00 - 02:00)")
                  : t("shift_roster.same_day", "Same-day Shift")}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t("shift_roster.shift_badge_color", "Badge Color")}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {SHIFT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  style={{ backgroundColor: c }}
                  className={clsx(
                    "w-[42px] h-[42px] rounded-full transition active:scale-90 cursor-pointer flex items-center justify-center text-white",
                    form.color === c && "ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900"
                  )}
                  aria-label={c}
                >
                  {form.color === c && <IconCheck size={16} />}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between min-h-[42px] p-3 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{t("common.active", "Active")}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {t("shift_roster.active_hint", "Inactive shifts are hidden when assigning and ignored for login checks.")}
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="toggle toggle-success"
            />
          </label>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] px-6 rounded-xl bg-restro-green hover:bg-restro-green-button-hover disabled:opacity-60 text-white text-sm font-bold transition active:scale-95 cursor-pointer shadow-sm"
            >
              {t("common.save", "Save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
