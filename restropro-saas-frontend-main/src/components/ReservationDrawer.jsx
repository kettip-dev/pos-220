import React, { useState, useEffect, useRef } from "react";
import {
  IconX,
  IconUser,
  IconCalendarEvent,
  IconClock,
  IconArmchair,
  IconFriends,
  IconNotes,
  IconAlertTriangle,
  IconPlus,
  IconMinus,
  IconUserPlus,
  IconCheck,
  IconCircleDot,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useTranslation } from "react-i18next";
import AsyncCreatableSelect from "react-select/async-creatable";
import { searchCustomer } from "../controllers/customers.controller";
import { addReservation, updateReservation } from "../controllers/reservations.controller";
import { toast } from "react-hot-toast";
import { useTheme } from "../contexts/ThemeContext";

const PARTY_PRESETS = [2, 4, 6, 8];
const MIN_PEOPLE = 1;
const MAX_PEOPLE = 100;

// Quick time slots every 30 minutes from 10:00 to 22:00
const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const mins = 10 * 60 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

// Full class strings so Tailwind can see them at build time
const STATUS_OPTIONS = [
  {
    key: "booked",
    label: "Booked",
    dot: "bg-amber-500",
    active: "border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-500 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    key: "seated",
    label: "Seated",
    dot: "bg-emerald-500",
    active: "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    key: "completed",
    label: "Completed",
    dot: "bg-blue-500",
    active: "border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500 dark:bg-blue-500/15 dark:text-blue-300",
  },
  {
    key: "no_show",
    label: "No-Show",
    dot: "bg-purple-500",
    active: "border-purple-500 bg-purple-50 text-purple-800 ring-1 ring-purple-500 dark:bg-purple-500/15 dark:text-purple-300",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    dot: "bg-rose-500",
    active: "border-rose-500 bg-rose-50 text-rose-800 ring-1 ring-rose-500 dark:bg-rose-500/15 dark:text-rose-300",
  },
];

const pad = (n) => String(n).padStart(2, "0");
const toDateString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 outline-none transition focus:border-restro-border-green focus:ring-2 focus:ring-[#2CA01C]/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-restro-border-green";

const chipBase =
  "min-h-[42px] rounded-xl border text-sm font-semibold transition-all duration-150 active:scale-95";
const chipActive = "border-restro-green bg-restro-green text-white shadow-sm";
const chipIdle =
  "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700";

function Section({ icon: Icon, title, required, aside, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-restro-green-10 text-restro-green">
            <Icon size={16} stroke={iconStroke} />
          </span>
          {title}
          {required && <span className="text-rose-500">*</span>}
        </h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default function ReservationDrawer({
  isOpen,
  onClose,
  isEditMode = false,
  initialData = null,
  storeTables = [],
  onSuccess,
  openAddCustomerModal,
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [customer, setCustomer] = useState(null);
  const [date, setDate] = useState("");
  const [tableId, setTableId] = useState("");
  const [peopleCount, setPeopleCount] = useState(2);
  const [status, setStatus] = useState("booked");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timeRailRef = useRef(null);

  // Helper to format ISO or SQL date to HTML datetime-local format (YYYY-MM-DDTHH:mm)
  const formatForDateTimeInput = (dateVal) => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    return `${toDateString(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && initialData) {
        setCustomer(
          initialData.customer_id
            ? {
                value: initialData.customer_id,
                label: `${initialData.customer_name || "Customer"} (${initialData.customer_id})`,
              }
            : null
        );
        setDate(formatForDateTimeInput(initialData.date));
        setTableId(initialData.table_id || "");
        setPeopleCount(initialData.people_count || 2);
        setStatus(initialData.status || "booked");
        setNotes(initialData.notes || "");
      } else {
        // Default new reservation: next whole hour today
        const now = new Date();
        now.setHours(now.getHours() + 1, 0, 0, 0);
        setDate(formatForDateTimeInput(now));
        setCustomer(null);
        setTableId("");
        setPeopleCount(2);
        setStatus("booked");
        setNotes("");
      }
    }
  }, [isOpen, isEditMode, initialData]);

  const datePart = date ? date.slice(0, 10) : "";
  const timePart = date ? date.slice(11, 16) : "";

  // Keep the selected time slot visible in the horizontal rail
  useEffect(() => {
    if (!isOpen || !timeRailRef.current) return;
    const active = timeRailRef.current.querySelector("[data-active='true']");
    if (active) {
      active.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [isOpen, timePart]);

  if (!isOpen) return null;

  const searchCustomersAsync = async (inputValue) => {
    try {
      if (!inputValue) return [];
      const resp = await searchCustomer(inputValue);
      if (resp.status === 200 && Array.isArray(resp.data)) {
        return resp.data.map((c) => ({
          label: `${c.name} - (${c.phone})`,
          value: c.phone,
          customerObj: c,
        }));
      }
      return [];
    } catch (err) {
      console.error("Failed to search customers:", err);
      return [];
    }
  };

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const todayStr = toDateString(today);
  const tomorrowStr = toDateString(tomorrow);

  const setDatePart = (d) => {
    if (!d) return;
    setDate(`${d}T${timePart || "19:00"}`);
  };
  const setTimePart = (tm) => {
    if (!tm) return;
    setDate(`${datePart || todayStr}T${tm}`);
  };

  // A slot is in the past only when booking for today
  const nowHHMM = `${pad(today.getHours())}:${pad(today.getMinutes())}`;
  const isPastSlot = (slot) => datePart === todayStr && slot < nowHHMM;

  const clampPeople = (n) => Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, n));
  const changePeople = (delta) => setPeopleCount((prev) => clampPeople((Number(prev) || 0) + delta));

  const selectedTable = storeTables.find((t) => String(t.id) === String(tableId));
  const capacityWarning =
    selectedTable &&
    selectedTable.seating_capacity &&
    Number(peopleCount) > Number(selectedTable.seating_capacity);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!isEditMode && (!customer || !customer.value)) {
      toast.error(t("reservations.select_customer_error") || "Please select or create a customer!");
      return;
    }

    if (!date) {
      toast.error(t("reservations.select_date_error") || "Please select reservation date and time!");
      return;
    }

    if (!peopleCount || Number(peopleCount) <= 0) {
      toast.error(t("reservations.enter_people_count") || "Please enter valid party size!");
      return;
    }

    try {
      setIsSubmitting(true);
      toast.loading(t("reservations.loading_message") || "Saving reservation...");

      if (isEditMode) {
        const res = await updateReservation(
          initialData.id,
          date,
          tableId || null,
          status,
          notes,
          Number(peopleCount)
        );
        toast.dismiss();
        if (res.status === 200) {
          toast.success(res.data.message || "Reservation updated!");
          onSuccess();
          onClose();
        }
      } else {
        const res = await addReservation(
          customer.value,
          date,
          tableId || null,
          status,
          notes,
          Number(peopleCount)
        );
        toast.dismiss();
        if (res.status === 200) {
          toast.success(res.data.message || "Reservation created!");
          onSuccess();
          onClose();
        }
      }
    } catch (error) {
      toast.dismiss();
      const msg = error?.response?.data?.message || t("reservations.error_message") || "Failed to save!";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDark = theme === "black";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="flex h-full w-screen max-w-md flex-col border-l border-gray-200 bg-gray-50 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-restro-green-10 text-restro-green">
                <IconCalendarEvent size={22} stroke={iconStroke} />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-gray-900 dark:text-white">
                  {isEditMode
                    ? t("reservations.update_reservation") || "Update Reservation"
                    : t("reservations.add_reservation") || "New Reservation"}
                </h3>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {isEditMode
                    ? t("reservations.drawer.editing_subtitle", {
                        code: initialData?.unique_code || initialData?.id,
                        defaultValue: "Editing reservation #{{code}}",
                      })
                    : t("reservations.drawer.subtitle", "Book a table for upcoming restaurant dining")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("reservations.close") || "Close"}
              className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-all duration-150 hover:bg-gray-100 hover:text-gray-700 active:scale-95 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
            >
              <IconX size={22} stroke={iconStroke} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            {/* Scrollable body */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {/* Customer */}
              <Section
                icon={IconUser}
                title={t("reservations.select_customer") || "Guest / Customer"}
                required
                aside={
                  !isEditMode && (
                    <button
                      type="button"
                      onClick={() => openAddCustomerModal && openAddCustomerModal("")}
                      className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-restro-green transition-all duration-150 hover:bg-restro-green-10 active:scale-95"
                    >
                      <IconUserPlus size={18} stroke={iconStroke} />
                      {t("reservations.drawer.add_new_customer", "Add New")}
                    </button>
                  )
                }
              >
                {isEditMode ? (
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-restro-green-10 text-restro-green">
                      <IconUser size={20} stroke={iconStroke} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {initialData?.customer_name || "Guest Customer"}
                      </p>
                      <p className="truncate text-xs text-gray-500">{initialData?.customer_id}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <AsyncCreatableSelect
                      menuPlacement="auto"
                      loadOptions={searchCustomersAsync}
                      isClearable
                      openMenuOnFocus={false}
                      openMenuOnClick={false}
                      placeholder={t("reservations.drawer.customer_placeholder", "Search name or phone...")}
                      // Returning null hides the empty menu until the user types something
                      noOptionsMessage={({ inputValue }) =>
                        inputValue ? t("reservations.no_result") || "No result found!" : null
                      }
                      loadingMessage={() => t("reservations.loading_message") || "Please wait..."}
                      formatCreateLabel={(inputValue) =>
                        t("reservations.drawer.create_customer", {
                          name: inputValue,
                          defaultValue: 'Add new customer "{{name}}"',
                        })
                      }
                      value={customer}
                      onChange={(val) => setCustomer(val)}
                      onCreateOption={(inputValue) => {
                        if (openAddCustomerModal) {
                          openAddCustomerModal(inputValue);
                        }
                      }}
                      components={{ DropdownIndicator: null, IndicatorSeparator: null }}
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          backgroundColor: isDark ? "#27272a" : "#ffffff",
                          borderRadius: "0.75rem",
                          borderColor: state.isFocused ? "#2CA01C" : isDark ? "#3f3f46" : "#e5e7eb",
                          minHeight: 48,
                          boxShadow: state.isFocused ? "0 0 0 3px rgba(44,160,28,0.15)" : "none",
                          paddingLeft: 4,
                          "&:hover": { borderColor: state.isFocused ? "#2CA01C" : isDark ? "#52525b" : "#d1d5db" },
                        }),
                        input: (base) => ({ ...base, color: isDark ? "#ffffff" : "#111827" }),
                        singleValue: (base) => ({ ...base, color: isDark ? "#ffffff" : "#111827", fontWeight: 600 }),
                        placeholder: (base) => ({ ...base, color: isDark ? "#71717a" : "#9ca3af" }),
                        menu: (base) => ({
                          ...base,
                          backgroundColor: isDark ? "#18181b" : "#ffffff",
                          borderRadius: "0.75rem",
                          overflow: "hidden",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                          zIndex: 9999,
                        }),
                        option: (base, state) => ({
                          ...base,
                          minHeight: 44,
                          display: "flex",
                          alignItems: "center",
                          backgroundColor: state.isFocused ? (isDark ? "#27272a" : "#f3f4f6") : "transparent",
                          color: isDark ? "#f9fafb" : "#111827",
                        }),
                      }}
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {t("reservations.drawer.customer_hint", "Select an existing customer or type to add.")}
                    </p>
                  </>
                )}
              </Section>

              {/* Date & time */}
              <Section icon={IconClock} title={t("reservations.date") || "Reservation Date & Time"} required>
                <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                  <button
                    type="button"
                    onClick={() => setDatePart(todayStr)}
                    className={`${chipBase} ${datePart === todayStr ? chipActive : chipIdle}`}
                  >
                    {t("reservations.filters.today") || "Today"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePart(tomorrowStr)}
                    className={`${chipBase} ${datePart === tomorrowStr ? chipActive : chipIdle}`}
                  >
                    {t("reservations.filters.tomorrow") || "Tomorrow"}
                  </button>
                  <input
                    type="date"
                    required
                    value={datePart}
                    onChange={(e) => setDatePart(e.target.value)}
                    aria-label={t("reservations.drawer.pick_date", "Pick a date")}
                    className={`${inputClass} h-[42px] px-2.5 font-semibold ${
                      datePart && datePart !== todayStr && datePart !== tomorrowStr
                        ? "border-restro-green ring-2 ring-[#2CA01C]/20"
                        : ""
                    }`}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("reservations.drawer.time", "Time")}
                  </span>
                  <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {t("reservations.drawer.other_time", "Other time")}
                    <input
                      type="time"
                      required
                      value={timePart}
                      onChange={(e) => setTimePart(e.target.value)}
                      className={`${inputClass} h-[42px] w-[120px] px-2.5 font-semibold`}
                    />
                  </label>
                </div>
                <div
                  ref={timeRailRef}
                  className="no-scrollbar -mx-4 mt-2 flex touch-pan-x gap-2 overflow-x-auto px-4 pb-1"
                >
                  {TIME_SLOTS.map((slot) => {
                    const active = timePart === slot;
                    const past = isPastSlot(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        data-active={active}
                        disabled={past}
                        onClick={() => setTimePart(slot)}
                        className={`${chipBase} min-w-[72px] flex-shrink-0 px-3 tabular-nums ${
                          active ? chipActive : chipIdle
                        } disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* Party size */}
              <Section icon={IconFriends} title={t("reservations.people_count") || "Party Size (Guests)"} required>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
                    <button
                      type="button"
                      onClick={() => changePeople(-1)}
                      disabled={Number(peopleCount) <= MIN_PEOPLE}
                      aria-label={t("reservations.drawer.decrease_guests", "Fewer guests")}
                      className="flex h-[44px] w-[44px] items-center justify-center rounded-lg bg-white text-gray-700 shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-40 dark:bg-zinc-700 dark:text-gray-100"
                    >
                      <IconMinus size={20} stroke={iconStroke} />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={MIN_PEOPLE}
                      max={MAX_PEOPLE}
                      required
                      value={peopleCount}
                      onChange={(e) => setPeopleCount(e.target.value)}
                      onBlur={() => setPeopleCount((prev) => clampPeople(Number(prev) || MIN_PEOPLE))}
                      aria-label={t("reservations.people_count") || "Party Size (Guests)"}
                      className="h-[44px] w-16 appearance-none bg-transparent text-center text-2xl font-bold tabular-nums text-gray-900 outline-none [appearance:textfield] dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => changePeople(1)}
                      disabled={Number(peopleCount) >= MAX_PEOPLE}
                      aria-label={t("reservations.drawer.increase_guests", "More guests")}
                      className="flex h-[44px] w-[44px] items-center justify-center rounded-lg bg-restro-green text-white shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-40"
                    >
                      <IconPlus size={20} stroke={iconStroke} />
                    </button>
                  </div>
                  <div className="grid flex-1 grid-cols-4 gap-1.5">
                    {PARTY_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPeopleCount(n)}
                        className={`${chipBase} px-1 ${Number(peopleCount) === n ? chipActive : chipIdle}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Table */}
              <Section
                icon={IconArmchair}
                title={t("reservations.table") || "Table Assignment"}
                aside={
                  selectedTable && (
                    <span className="truncate text-xs font-semibold text-restro-green">{selectedTable.table_title}</span>
                  )
                }
              >
                <div className="grid max-h-[232px] grid-cols-3 gap-2 overflow-y-auto pr-0.5">
                  <button
                    type="button"
                    onClick={() => setTableId("")}
                    className={`flex min-h-[64px] flex-col items-center justify-center rounded-xl border px-2 text-center text-xs font-semibold transition-all duration-150 active:scale-95 ${
                      !tableId
                        ? "border-restro-green bg-restro-green-10 text-restro-green ring-1 ring-restro-green"
                        : "border-dashed border-gray-300 bg-white text-gray-500 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {t("reservations.drawer.no_table", "No table yet")}
                  </button>
                  {storeTables.map((tbl) => {
                    const active = String(tbl.id) === String(tableId);
                    const capacity = tbl.seating_capacity || 4;
                    const tooSmall = Number(peopleCount) > Number(capacity);
                    return (
                      <button
                        key={tbl.id}
                        type="button"
                        onClick={() => setTableId(tbl.id)}
                        className={`relative flex min-h-[64px] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-all duration-150 active:scale-95 ${
                          active
                            ? "border-restro-green bg-restro-green-10 ring-1 ring-restro-green"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {active && (
                          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-restro-green text-white">
                            <IconCheck size={11} stroke={3} />
                          </span>
                        )}
                        <span className="w-full truncate pr-4 text-sm font-bold text-gray-900 dark:text-white">
                          {tbl.table_title}
                        </span>
                        <span className="flex w-full items-center justify-between gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                          <span className="truncate">{tbl.floor || "Main"}</span>
                          <span
                            className={`flex flex-shrink-0 items-center gap-0.5 font-semibold ${
                              tooSmall ? "text-amber-600 dark:text-amber-400" : ""
                            }`}
                          >
                            <IconFriends size={12} stroke={iconStroke} />
                            {capacity}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Seating Capacity Warning */}
                {capacityWarning && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                    <IconAlertTriangle size={16} stroke={iconStroke} className="flex-shrink-0" />
                    <span>
                      {t("reservations.drawer.capacity_warning", {
                        people: peopleCount,
                        capacity: selectedTable.seating_capacity,
                        defaultValue:
                          "Party size ({{people}}) exceeds table capacity ({{capacity}}).",
                      })}
                    </span>
                  </div>
                )}
              </Section>

              {/* Status */}
              <Section icon={IconCircleDot} title={t("reservations.status") || "Reservation Status"}>
                <div className="grid grid-cols-5 gap-1.5">
                  {STATUS_OPTIONS.map((s) => {
                    const active = status === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setStatus(s.key)}
                        className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border px-1 text-center text-[11px] font-semibold leading-tight transition-all duration-150 active:scale-95 ${
                          active ? s.active : chipIdle
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                        <span className="line-clamp-2 break-words">{t(`reservations.status_${s.key}`) || s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* Special Operational / Dietary Notes */}
              <Section
                icon={IconNotes}
                title={t("reservations.special_notes") || t("reservations.notes") || "Special Requests & Notes"}
              >
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    t("reservations.notes_placeholder") || "Dietary allergies, high chair, birthday, window preference..."
                  }
                  className={`${inputClass} resize-none py-2.5`}
                />
              </Section>
            </div>

            {/* Sticky footer */}
            <div className="sticky bottom-0 grid grid-cols-[1fr_2fr] gap-3 border-t border-gray-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
              <button
                type="button"
                onClick={onClose}
                className="h-[52px] rounded-xl border border-gray-200 bg-white text-base font-semibold text-gray-700 transition-all duration-150 hover:bg-gray-50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700"
              >
                {t("reservations.close") || "Cancel"}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-restro-green text-base font-bold text-white shadow-md transition-all duration-150 hover:bg-restro-green-button-hover active:scale-95 disabled:opacity-50"
              >
                <IconCheck size={20} stroke={iconStroke} />
                {isSubmitting
                  ? t("reservations.saving") || "Saving..."
                  : isEditMode
                  ? t("reservations.update_reservation") || "Update"
                  : t("reservations.save") || "Save Reservation"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
