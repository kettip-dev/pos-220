import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { IconAlertTriangle, IconCheck, IconMoon, IconPlus, IconTrash, IconX, IconSearch } from "@tabler/icons-react";
import { bulkAssignRoster, updateRosterShift, removeRosterShift } from "../../controllers/shift_roster.controller";
import { findOverlaps, formatHours, shiftDurationMinutes, initials } from "./rosterUtils";

/**
 * Assign mode: pick one shift and apply it to any combination of staff x days in the week.
 * Edit mode: change the shift, staff, day or notes of one existing assignment (or delete it).
 */
export default function RosterAssignModal({
  open,
  assignment,
  initialUsername,
  initialDate,
  shifts,
  staffList,
  weekInfo,
  roster,
  onClose,
  onSaved,
  onCreateShift,
}) {
  const { t } = useTranslation();
  const isEdit = !!assignment;
  const activeShifts = useMemo(() => shifts.filter((s) => s.is_active || s.id === assignment?.shift_id), [shifts, assignment]);

  const [shiftId, setShiftId] = useState("");
  const [usernames, setUsernames] = useState([]);
  const [dates, setDates] = useState([]);
  const [notes, setNotes] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [showAllStaff, setShowAllStaff] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (assignment) {
      setShiftId(assignment.shift_id);
      setUsernames([assignment.username]);
      setDates([assignment.roster_date]);
      setNotes(assignment.notes || "");
    } else {
      setShiftId(activeShifts[0]?.id || "");
      setUsernames(initialUsername ? [initialUsername] : []);
      setDates(initialDate ? [initialDate] : []);
      setNotes("");
    }
    setStaffSearch("");
    setShowAllStaff(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assignment, initialUsername, initialDate]);

  const selectedShift = shifts.find((s) => s.id === Number(shiftId));
  const staffByUsername = useMemo(() => Object.fromEntries(staffList.map((s) => [s.username, s])), [staffList]);

  // Pairs that will be written, with duplicate + overlap detection
  const plan = useMemo(() => {
    if (!selectedShift) return { entries: [], duplicates: 0, conflicts: [] };
    const entries = [];
    const conflicts = [];
    let duplicates = 0;
    for (const username of usernames) {
      const userRoster = roster.filter((r) => r.username === username);
      for (const date of dates) {
        const exact = userRoster.find((r) => r.roster_date === date && r.shift_id === selectedShift.id && r.id !== assignment?.id);
        if (exact) {
          duplicates++;
          continue;
        }
        const overlaps = findOverlaps(
          { ...selectedShift, id: assignment?.id },
          date,
          userRoster.filter((r) => r.id !== assignment?.id)
        );
        overlaps.forEach((o) => conflicts.push({ username, date, other: o }));
        entries.push({ username, shiftId: selectedShift.id, rosterDate: date, notes: notes.trim() || null });
      }
    }
    return { entries, duplicates, conflicts };
  }, [selectedShift, usernames, dates, roster, notes, assignment]);

  if (!open) return null;

  const toggle = (list, setList, value, single = false) => {
    if (single) return setList([value]);
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const dayLabel = (date) => weekInfo.days.find((d) => d.date === date)?.dayName || date;

  const visibleStaff = staffList.filter((s) => {
    if (!showAllStaff && !usernames.includes(s.username)) return false;
    if (!staffSearch) return true;
    const q = staffSearch.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.username?.toLowerCase().includes(q);
  });

  const handleSave = async () => {
    if (!selectedShift) {
      toast.error(t("shift_roster.select_shift_error", "Please select a shift"));
      return;
    }
    if (usernames.length === 0 || dates.length === 0) {
      toast.error(t("shift_roster.select_staff_days", "Select at least one staff member and one day"));
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateRosterShift(assignment.id, {
          username: usernames[0],
          shiftId: selectedShift.id,
          rosterDate: dates[0],
          notes: notes.trim(),
        });
        toast.success(t("shift_roster.assignment_updated", "Shift updated"));
      } else {
        if (plan.entries.length === 0) {
          toast(t("shift_roster.nothing_to_assign", "Already scheduled — nothing to add"));
          setSaving(false);
          return;
        }
        await bulkAssignRoster(plan.entries);
        toast.success(
          t("shift_roster.shifts_assigned_count", "{{count}} shift(s) assigned", { count: plan.entries.length })
        );
      }
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "Failed to assign shift"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await removeRosterShift(assignment.id);
      toast.success(t("shift_roster.assignment_removed", "Assignment removed"));
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("common.error_occurred", "Failed to remove assignment"));
    } finally {
      setSaving(false);
    }
  };

  const headerStaff = staffByUsername[usernames[0]];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isEdit ? t("shift_roster.edit_assignment", "Edit Shift") : t("shift_roster.assign_shift_modal_title", "Assign Shift")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {usernames.length === 1 && headerStaff ? headerStaff.name : t("shift_roster.n_staff", "{{count}} staff", { count: usernames.length })}
              {" • "}
              {dates.length === 1 ? weekInfo.days.find((d) => d.date === dates[0])?.formattedDate || dates[0] : t("shift_roster.n_days", "{{count}} days", { count: dates.length })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[42px] h-[42px] -mr-2 shrink-0 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white active:scale-95 cursor-pointer"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Shift picker */}
          <section className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("shift_roster.select_shift_template", "Select Shift")}
            </label>
            {activeShifts.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("shift_roster.no_shifts_yet", "No shift templates created yet.")}</p>
                <button
                  type="button"
                  onClick={onCreateShift}
                  className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl text-sm font-bold text-restro-green bg-restro-green-10 hover:bg-restro-green hover:text-white transition active:scale-95 cursor-pointer"
                >
                  <IconPlus size={16} />
                  {t("shift_roster.create_shift_first", "Create Shift Template")}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeShifts.map((s) => {
                  const selected = Number(shiftId) === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setShiftId(s.id)}
                      style={selected ? { borderColor: s.color, backgroundColor: `${s.color}14` } : undefined}
                      className={clsx(
                        "min-h-[56px] p-3 rounded-2xl border-2 text-left transition active:scale-[0.98] cursor-pointer flex items-center gap-3",
                        !selected && "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <span className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{s.name}</span>
                        <span className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {s.start_time}–{s.end_time}
                          {!!s.is_overnight && <IconMoon size={11} className="text-purple-500" />}
                          <span className="font-sans">· {formatHours(shiftDurationMinutes(s.start_time, s.end_time, s.is_overnight))}</span>
                        </span>
                      </span>
                      {selected && <IconCheck size={18} style={{ color: s.color }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Day picker */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isEdit ? t("shift_roster.day", "Day") : t("shift_roster.repeat_on_days", "Days")}
              </label>
              {!isEdit && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setDates(weekInfo.days.filter((d) => !d.isWeekend).map((d) => d.date))}
                    className="px-2.5 min-h-[32px] rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {t("shift_roster.weekdays", "Mon–Fri")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDates(weekInfo.days.map((d) => d.date))}
                    className="px-2.5 min-h-[32px] rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {t("shift_roster.all_week", "All week")}
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {weekInfo.days.map((d) => {
                const selected = dates.includes(d.date);
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => toggle(dates, setDates, d.date, isEdit)}
                    className={clsx(
                      "min-h-[52px] rounded-xl border flex flex-col items-center justify-center transition active:scale-95 cursor-pointer",
                      selected
                        ? "bg-restro-green border-restro-green text-white"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase">{d.dayName}</span>
                    <span className="text-sm font-extrabold">{d.dayNum}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Staff picker */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("shift_roster.staff_member", "Staff Member")}
              </label>
              <button
                type="button"
                onClick={() => setShowAllStaff((v) => !v)}
                className="px-2.5 min-h-[32px] rounded-lg text-[11px] font-bold text-restro-green hover:bg-restro-green-10 cursor-pointer"
              >
                {showAllStaff
                  ? t("shift_roster.show_selected", "Show selected")
                  : isEdit
                  ? t("shift_roster.move_to_staff", "Move to other staff")
                  : t("shift_roster.add_more_staff", "+ Add more staff")}
              </button>
            </div>
            {showAllStaff && staffList.length > 6 && (
              <div className="relative">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder={t("shift_roster.search_staff", "Search staff...")}
                  className="w-full h-[42px] pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green"
                />
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {visibleStaff.map((s) => {
                const selected = usernames.includes(s.username);
                return (
                  <button
                    key={s.username}
                    type="button"
                    onClick={() => toggle(usernames, setUsernames, s.username, isEdit)}
                    className={clsx(
                      "min-h-[42px] pl-1.5 pr-3 rounded-full border flex items-center gap-2 transition active:scale-95 cursor-pointer",
                      selected
                        ? "bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900"
                        : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <span
                      className={clsx(
                        "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold",
                        selected ? "bg-white/20 dark:bg-slate-900/10" : "bg-slate-100 dark:bg-slate-800"
                      )}
                    >
                      {selected ? <IconCheck size={14} /> : initials(s.name)}
                    </span>
                    <span className="text-xs font-bold max-w-[140px] truncate">{s.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Notes */}
          <section className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("shift_roster.notes_optional", "Notes (Optional)")}
            </label>
            <input
              type="text"
              maxLength={255}
              placeholder={t("shift_roster.notes_placeholder", "e.g. Cashier station 1")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-restro-green"
            />
          </section>

          {/* Conflicts */}
          {plan.conflicts.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                <IconAlertTriangle size={16} />
                {t("shift_roster.overlap_warning", "Overlapping shifts")}
              </div>
              <ul className="text-xs text-amber-800/90 dark:text-amber-300/90 space-y-0.5 max-h-24 overflow-y-auto">
                {plan.conflicts.slice(0, 8).map((c, i) => (
                  <li key={i}>
                    {staffByUsername[c.username]?.name || c.username} · {dayLabel(c.date)} — {c.other.shift_name} {c.other.start_time}–{c.other.end_time}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!isEdit && plan.duplicates > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("shift_roster.duplicates_skipped", "{{count}} already scheduled — will be skipped.", { count: plan.duplicates })}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="min-h-[42px] px-4 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <IconTrash size={16} />
              {t("common.delete", "Delete")}
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || activeShifts.length === 0}
            className="min-h-[42px] px-6 rounded-xl bg-restro-green hover:bg-restro-green-button-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition active:scale-95 cursor-pointer shadow-sm"
          >
            {isEdit
              ? t("common.save", "Save")
              : plan.entries.length > 1
              ? t("shift_roster.assign_n", "Assign {{count}}", { count: plan.entries.length })
              : t("common.assign", "Assign")}
          </button>
        </div>
      </div>
    </div>
  );
}
