import React, { useState, useEffect } from "react";
import {
  IconX,
  IconUser,
  IconCalendar,
  IconClock,
  IconArmchair,
  IconFriends,
  IconNotes,
  IconAlertTriangle,
  IconPlus,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useTranslation } from "react-i18next";
import AsyncCreatableSelect from "react-select/async-creatable";
import { searchCustomer } from "../controllers/customers.controller";
import { addReservation, updateReservation } from "../controllers/reservations.controller";
import { toast } from "react-hot-toast";
import { useTheme } from "../contexts/ThemeContext";

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

  // Helper to format ISO or SQL date to HTML datetime-local format (YYYY-MM-DDTHH:mm)
  const formatForDateTimeInput = (dateVal) => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-zinc-800">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {isEditMode
                  ? t("reservations.update_reservation") || "Update Reservation"
                  : t("reservations.add_reservation") || "New Reservation"}
              </h3>
              <p className="text-xs text-gray-500">
                {isEditMode
                  ? `Editing reservation #${initialData?.unique_code || initialData?.id}`
                  : "Book a table for upcoming restaurant dining"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
            >
              <IconX size={20} stroke={iconStroke} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Customer Picker */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                {t("reservations.select_customer") || "Guest / Customer"}{" "}
                <span className="text-rose-500">*</span>
              </label>

              {isEditMode ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/60">
                  <div className="flex items-center gap-2">
                    <IconUser size={18} stroke={iconStroke} className="text-restro-green" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {initialData?.customer_name || "Guest Customer"}
                      </p>
                      <p className="text-xs text-gray-500">{initialData?.customer_id}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <AsyncCreatableSelect
                    menuPlacement="auto"
                    loadOptions={searchCustomersAsync}
                    isClearable
                    placeholder="Search name or phone..."
                    noOptionsMessage={() => "Type customer phone or name..."}
                    value={customer}
                    onChange={(val) => setCustomer(val)}
                    onCreateOption={(inputValue) => {
                      if (openAddCustomerModal) {
                        openAddCustomerModal(inputValue);
                      }
                    }}
                    styles={{
                      control: (base) => ({
                        ...base,
                        backgroundColor: theme === "black" ? "#18181b" : "#f9fafb",
                        borderRadius: "0.75rem",
                        borderColor: theme === "black" ? "#27272a" : "#e5e7eb",
                        minHeight: 44,
                        boxShadow: "none",
                        color: theme === "black" ? "#ffffff" : "#111827",
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: theme === "black" ? "#18181b" : "#ffffff",
                        borderRadius: "0.75rem",
                        zIndex: 9999,
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isFocused
                          ? theme === "black"
                            ? "#27272a"
                            : "#f3f4f6"
                          : "transparent",
                        color: theme === "black" ? "#f9fafb" : "#111827",
                      }),
                    }}
                  />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Select an existing customer or type to add.</span>
                    <button
                      type="button"
                      onClick={() => openAddCustomerModal && openAddCustomerModal("")}
                      className="inline-flex items-center gap-1 font-semibold text-restro-green hover:underline"
                    >
                      <IconPlus size={13} stroke={iconStroke} /> Add New
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Date and Time Picker */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                {t("reservations.date") || "Reservation Date & Time"}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-restro-border-green focus:bg-white dark:border-zinc-800 dark:bg-zinc-850 dark:text-white dark:focus:border-restro-border-green"
                />
              </div>
            </div>

            {/* Party Size & Quick Steppers */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                {t("reservations.people_count") || "Party Size (Guests)"}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(e.target.value)}
                  className="w-24 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-sm font-bold text-gray-900 outline-none focus:border-restro-border-green dark:border-zinc-800 dark:bg-zinc-850 dark:text-white"
                />
                <div className="flex flex-1 gap-1.5">
                  {[2, 4, 6, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPeopleCount(n)}
                      className={`flex-1 min-h-[40px] rounded-xl text-xs font-semibold transition active:scale-95 ${
                        Number(peopleCount) === n
                          ? "bg-restro-green text-white shadow-sm"
                          : "border border-gray-200 bg-restro-gray text-restro-text hover:bg-gray-200 dark:border-zinc-700 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {n}p
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table Selection */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                {t("reservations.table") || "Table Assignment"}
              </label>
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-restro-border-green focus:bg-white dark:border-zinc-800 dark:bg-zinc-850 dark:text-white dark:focus:border-restro-border-green"
              >
                <option value="">{t("reservations.no_table_assigned") || "-- No Table (Unassigned) --"}</option>
                {storeTables.map((tbl) => (
                  <option key={tbl.id} value={tbl.id}>
                    {tbl.table_title} ({tbl.floor || "Main"}) — Cap: {tbl.seating_capacity || 4}
                  </option>
                ))}
              </select>

              {/* Seating Capacity Warning */}
              {capacityWarning && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <IconAlertTriangle size={16} stroke={iconStroke} className="flex-shrink-0" />
                  <span>
                    Warning: Party size ({peopleCount}) exceeds table capacity ({selectedTable.seating_capacity}).
                  </span>
                </div>
              )}
            </div>

            {/* Status Selection */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                {t("reservations.status") || "Reservation Status"}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "booked", label: "Booked", color: "hover:border-amber-400" },
                  { key: "seated", label: "Seated", color: "hover:border-emerald-400" },
                  { key: "completed", label: "Completed", color: "hover:border-blue-400" },
                  { key: "no_show", label: "No-Show", color: "hover:border-purple-400" },
                  { key: "cancelled", label: "Cancelled", color: "hover:border-rose-400" },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatus(s.key)}
                    className={`min-h-[40px] rounded-xl border px-2 py-1.5 text-xs font-semibold transition active:scale-95 ${
                      status === s.key
                        ? "border-restro-green bg-restro-green text-white shadow-sm"
                        : `border-gray-200 bg-restro-gray text-restro-text dark:border-zinc-700 ${s.color}`
                    }`}
                  >
                    {t(`reservations.status_${s.key}`) || s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Special Operational / Dietary Notes */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                {t("reservations.special_notes") || t("reservations.notes") || "Special Requests & Notes"}
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("reservations.notes_placeholder") || "Dietary allergies, high chair, birthday, window preference..."}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm text-gray-900 outline-none transition focus:border-restro-border-green focus:bg-white dark:border-zinc-800 dark:bg-zinc-850 dark:text-white dark:focus:border-restro-border-green"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-xl border border-gray-200 bg-restro-gray px-4 py-2 text-sm font-semibold text-restro-text transition active:scale-95 hover:bg-gray-200 dark:border-zinc-700 dark:hover:bg-zinc-700"
              >
                {t("reservations.close") || "Cancel"}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-restro-green px-6 py-2 text-sm font-bold text-white shadow-md transition active:scale-95 hover:bg-restro-green-button-hover disabled:opacity-50"
              >
                {isSubmitting
                  ? (t("reservations.saving") || "Saving...")
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
