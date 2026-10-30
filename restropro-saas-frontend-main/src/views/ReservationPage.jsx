import React, { useRef, useState } from "react";
import Page from "../components/Page";
import DeleteModal from "../components/DeleteModal";
import DialogAddCustomer from "../components/DialogAddCustomer";
import ReservationCard from "../components/ReservationCard";
import ReservationDrawer from "../components/ReservationDrawer";
import ReservationKPIHeader from "../components/ReservationKPIHeader";
import ReservationTimelineView from "../components/ReservationTimelineView";
import ReservationKanbanView from "../components/ReservationKanbanView";
import ReservationTableView from "../components/ReservationTableView";
import ReservationCalendarView from "../components/ReservationCalendarView";
import {
  IconFilter,
  IconPlus,
  IconSearch,
  IconX,
  IconCalendar,
  IconLayoutKanban,
  IconClockPlay,
  IconTable,
  IconLayoutGrid,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { toast } from "react-hot-toast";
import { mutate } from "swr";
import { useTranslation } from "react-i18next";
import {
  deleteReservation,
  searchReservations,
  updateReservationStatus,
  useReservations,
  useReservationsInit,
} from "../controllers/reservations.controller";
import { SCOPES, hasFullBusinessAccess } from "../config/scopes";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";

export default function ReservationPage() {
  const { t } = useTranslation();

  const { role, scope } = getUserDetailsInLocalStorage();
  const userScopes = scope?.split(",") || [];
  let isManageAllowed = false;
  if (hasFullBusinessAccess(role)) {
    isManageAllowed = true;
  } else {
    if (
      userScopes.includes(SCOPES.MANAGE_RESERVATIONS) ||
      userScopes.includes(SCOPES.RESERVATIONS)
    ) {
      isManageAllowed = true;
    }
  }

  const filters = [
    { key: "today", value: t("reservations.filters.today") || "Today" },
    { key: "tomorrow", value: t("reservations.filters.tomorrow") || "Tomorrow" },
    { key: "yesterday", value: t("reservations.filters.yesterday") || "Yesterday" },
    { key: "last_7days", value: t("reservations.filters.last_7days") || "Last 7 Days" },
    { key: "this_month", value: t("reservations.filters.this_month") || "This Month" },
    { key: "last_month", value: t("reservations.filters.last_month") || "Last Month" },
    { key: "all", value: "All Bookings" },
    { key: "custom", value: t("reservations.filters.custom") || "Custom Range" },
  ];

  const searchRef = useRef();
  const fromDateRef = useRef();
  const toDateRef = useRef();

  const now = new Date();
  const defaultDateFrom = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  const defaultDateTo = `${now.getFullYear()}-${(now.getMonth() + 2)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;

  const [state, setState] = useState({
    search: "",
    searchResults: [],
    filter: "today",
    fromDate: defaultDateFrom,
    toDate: defaultDateTo,
    activeStatusFilter: "all",
    viewMode: "timeline", // "timeline" | "kanban" | "calendar" | "table" | "cards"
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerEditMode, setDrawerEditMode] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [deleteReservationId, setDeleteReservationId] = useState(null);
  const [addCustomerDefaultValue, setAddCustomerDefaultValue] = useState("");

  const {
    data: storeTablesData,
    error: errorStoreTables,
    isLoading: isLoadingStoreTables,
  } = useReservationsInit();

  const {
    APIURL,
    data: reservationsData,
    error: errorReservations,
    isLoading: isLoadingReservations,
  } = useReservations({
    type: state.filter,
    from: state.fromDate,
    to: state.toDate,
  });

  const reservations = Array.isArray(reservationsData) ? reservationsData : [];
  const storeTables = Array.isArray(storeTablesData?.storeTables)
    ? storeTablesData.storeTables
    : [];
  const summary = storeTablesData?.summary || null;

  // Search execution
  const btnSearch = async () => {
    const searchQuery = searchRef.current?.value || "";
    if (!searchQuery.trim()) {
      btnClearSearch();
      return;
    }

    try {
      toast.loading(t("reservations.loading_message") || "Searching...");
      const res = await searchReservations(searchQuery.trim());
      toast.dismiss();
      if (res.status === 200 && Array.isArray(res.data)) {
        setState((prev) => ({
          ...prev,
          search: searchQuery.trim(),
          searchResults: res.data,
        }));
      } else {
        toast.error(t("reservations.no_result") || "No reservations found");
      }
    } catch (err) {
      toast.dismiss();
      const msg = err?.response?.data?.message || t("reservations.error_message");
      toast.error(msg);
    }
  };

  const btnClearSearch = () => {
    if (searchRef.current) searchRef.current.value = "";
    setState((prev) => ({
      ...prev,
      search: "",
      searchResults: [],
    }));
  };

  // Status Change
  const handleStatusChange = async (id, newStatus) => {
    try {
      toast.loading("Updating status...");
      const res = await updateReservationStatus(id, newStatus);
      toast.dismiss();
      if (res.status === 200) {
        toast.success(res.data.message || "Status updated!");
        await Promise.all([mutate(APIURL), mutate("/reservations/init")]);
      }
    } catch (err) {
      toast.dismiss();
      const msg = err?.response?.data?.message || "Failed to update status";
      toast.error(msg);
    }
  };

  // Delete
  const btnConfirmDelete = async () => {
    if (!deleteReservationId) return;
    try {
      toast.loading(t("reservations.loading_message") || "Deleting...");
      const res = await deleteReservation(deleteReservationId);
      toast.dismiss();
      if (res.status === 200) {
        toast.success(res.data.message || "Reservation deleted");
        setDeleteReservationId(null);
        await Promise.all([mutate(APIURL), mutate("/reservations/init")]);
        if (state.searchResults.length > 0) {
          setState((prev) => ({
            ...prev,
            searchResults: prev.searchResults.filter((s) => s.id !== deleteReservationId),
          }));
        }
      }
    } catch (err) {
      toast.dismiss();
      const msg = err?.response?.data?.message || t("reservations.error_message");
      toast.error(msg);
    }
  };

  // Open Drawer in Create mode
  const handleOpenAdd = () => {
    setSelectedReservation(null);
    setDrawerEditMode(false);
    setDrawerOpen(true);
  };

  // Open Drawer in Edit mode
  const handleOpenEdit = (resv) => {
    setSelectedReservation(resv);
    setDrawerEditMode(true);
    setDrawerOpen(true);
  };

  // Filter reservations based on active status filter & search
  const currentDataset = state.search ? state.searchResults : reservations;
  const filteredReservations = currentDataset.filter((r) => {
    if (state.activeStatusFilter === "all") return true;
    const s = (r.status || "booked").toLowerCase();
    if (state.activeStatusFilter === "booked") return s === "booked";
    if (state.activeStatusFilter === "seated") return s === "seated";
    if (state.activeStatusFilter === "completed") return s === "completed" || s === "paid";
    if (state.activeStatusFilter === "cancelled") return s === "cancelled";
    if (state.activeStatusFilter === "no_show") return s === "no_show";
    return true;
  });

  return (
    <Page className="flex flex-col h-full max-h-screen overflow-hidden p-3 md:p-4 gap-3 bg-background text-foreground">
      {/* Top Header: Title, Date Filter Pills, Search, View Switcher & Action */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 flex-shrink-0 border-b border-gray-100 pb-2.5 dark:border-zinc-800">
        {/* Left Section: Title + Date Filter Pills */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
              {t("reservations.title") || "Table Reservations"}
            </h2>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {filteredReservations.length}
            </span>
          </div>

          {/* Date Filter Pills moved up directly into header */}
          <div className="flex items-center gap-1 rounded-xl border border-gray-200/90 bg-gray-50/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            {filters.slice(0, 4).map((f) => {
              const isSelected = state.filter === f.key && !state.search;
              return (
                <button
                  key={f.key}
                  onClick={() => {
                    btnClearSearch();
                    setState((prev) => ({ ...prev, filter: f.key }));
                  }}
                  className={`h-7 rounded-lg px-2 text-[11px] font-bold transition active:scale-95 ${
                    isSelected
                      ? "bg-restro-green text-white shadow-xs"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  }`}
                >
                  {f.value}
                </button>
              );
            })}

            {/* Dropdown for extra date filters */}
            <div className="dropdown">
              <button
                tabIndex={0}
                className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-bold transition active:scale-95 ${
                  ["this_month", "last_month", "all", "custom"].includes(state.filter) && !state.search
                    ? "bg-restro-green text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                <IconCalendar size={13} stroke={iconStroke} />
                <span>
                  {["this_month", "last_month", "all", "custom"].includes(state.filter)
                    ? filters.find((f) => f.key === state.filter)?.value
                    : "More"}
                </span>
              </button>
              <ul
                tabIndex={0}
                className="dropdown-content menu z-30 mt-1 w-44 rounded-xl border border-gray-200 bg-white p-1 text-xs shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
              >
                {filters.slice(4).map((f) => (
                  <li key={f.key}>
                    <button
                      onClick={() => {
                        btnClearSearch();
                        if (f.key === "custom") {
                          document.getElementById("custom-date-modal")?.showModal();
                        } else {
                          setState((prev) => ({ ...prev, filter: f.key }));
                        }
                      }}
                    >
                      {f.value}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Section: Compact Search, View Switcher & New Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Header Search Input */}
          <div className="relative w-44 sm:w-52">
            <input
              ref={searchRef}
              type="text"
              defaultValue={state.search}
              placeholder={t("reservations.search_placeholder") || "Search..."}
              onKeyDown={(e) => {
                if (e.key === "Enter") btnSearch();
              }}
              className="h-8 w-full rounded-xl border border-gray-200 bg-white py-1 pl-7 pr-6 text-xs text-gray-900 outline-none transition focus:border-restro-border-green dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
            <IconSearch
              size={14}
              stroke={iconStroke}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
            />
            {state.search && (
              <button
                onClick={btnClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <IconX size={13} stroke={iconStroke} />
              </button>
            )}
          </div>

          {/* View Mode Toggle: Timeline, Kanban, Calendar, Table, Cards */}
          <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => setState((prev) => ({ ...prev, viewMode: "timeline" }))}
              title="Timeline View"
              className={`flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition ${
                state.viewMode === "timeline"
                  ? "bg-white text-gray-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <IconClockPlay size={14} stroke={iconStroke} />
              <span className="hidden xl:inline">Timeline</span>
            </button>

            <button
              onClick={() => setState((prev) => ({ ...prev, viewMode: "kanban" }))}
              title="Kanban Board View"
              className={`flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition ${
                state.viewMode === "kanban"
                  ? "bg-white text-gray-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <IconLayoutKanban size={14} stroke={iconStroke} />
              <span className="hidden xl:inline">Kanban</span>
            </button>

            <button
              onClick={() => setState((prev) => ({ ...prev, viewMode: "calendar" }))}
              title="Calendar View"
              className={`flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition ${
                state.viewMode === "calendar"
                  ? "bg-white text-gray-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <IconCalendar size={14} stroke={iconStroke} />
              <span className="hidden xl:inline">Calendar</span>
            </button>

            <button
              onClick={() => setState((prev) => ({ ...prev, viewMode: "table" }))}
              title="Table List View"
              className={`flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition ${
                state.viewMode === "table"
                  ? "bg-white text-gray-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <IconTable size={14} stroke={iconStroke} />
              <span className="hidden xl:inline">Table</span>
            </button>

            <button
              onClick={() => setState((prev) => ({ ...prev, viewMode: "cards" }))}
              title="Card Grid View"
              className={`flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition ${
                state.viewMode === "cards"
                  ? "bg-white text-gray-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <IconLayoutGrid size={14} stroke={iconStroke} />
              <span className="hidden xl:inline">Cards</span>
            </button>
          </div>

          {/* New Reservation Action */}
          {isManageAllowed && (
            <button
              onClick={handleOpenAdd}
              className="flex h-8 items-center gap-1 rounded-xl bg-restro-green px-3 text-xs font-bold text-white shadow-xs transition active:scale-95 hover:bg-restro-green-button-hover"
            >
              <IconPlus size={16} stroke={iconStroke} />
              <span>{t("reservations.new") || "New"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Slim Real-time KPI Stats Bar */}
      <ReservationKPIHeader
        summary={summary}
        reservations={reservations}
        activeStatusFilter={state.activeStatusFilter}
        onStatusFilterChange={(st) => setState((prev) => ({ ...prev, activeStatusFilter: st }))}
      />

      {/* Search Notice Banner if active */}
      {state.search && (
        <div className="flex items-center justify-between rounded-xl bg-blue-500/10 px-3.5 py-1.5 text-xs text-blue-700 dark:text-blue-300 flex-shrink-0">
          <span>
            Search results for: <strong>"{state.search}"</strong> ({filteredReservations.length} found)
          </span>
          <button
            onClick={btnClearSearch}
            className="font-bold underline hover:text-blue-900"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Main Content View Container - Smooth Full Scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoadingReservations ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2">
            <div className="h-7 w-7 animate-spin rounded-full border-3 border-restro-green border-t-transparent" />
            <p className="text-xs font-semibold text-gray-500">Loading reservations...</p>
          </div>
        ) : filteredReservations.length === 0 && state.viewMode !== "calendar" ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 p-8 text-center dark:border-zinc-800">
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {t("reservations.no_reservation") || "No reservations found"}
            </h4>
            <p className="mt-1 text-xs text-gray-400 max-w-sm">
              {t("reservations.double_checked") || "There are no bookings matching your selected date or filters."}
            </p>
            {isManageAllowed && (
              <button
                onClick={handleOpenAdd}
                className="mt-3 flex h-8 items-center gap-1 rounded-xl bg-restro-green px-3 py-1 text-xs font-bold text-white shadow-xs transition active:scale-95 hover:bg-restro-green-button-hover"
              >
                <IconPlus size={15} stroke={iconStroke} />
                <span>Book First Reservation</span>
              </button>
            )}
          </div>
        ) : (
          <div className="h-full">
            {state.viewMode === "timeline" && (
              <ReservationTimelineView
                reservations={filteredReservations}
                onUpdate={handleOpenEdit}
                onDelete={(id) => setDeleteReservationId(id)}
                onStatusChange={handleStatusChange}
              />
            )}

            {state.viewMode === "kanban" && (
              <ReservationKanbanView
                reservations={filteredReservations}
                onUpdate={handleOpenEdit}
                onDelete={(id) => setDeleteReservationId(id)}
                onStatusChange={handleStatusChange}
              />
            )}

            {state.viewMode === "calendar" && (
              <ReservationCalendarView
                reservations={reservations}
                onUpdate={handleOpenEdit}
                onDelete={(id) => setDeleteReservationId(id)}
                onStatusChange={handleStatusChange}
              />
            )}

            {state.viewMode === "table" && (
              <ReservationTableView
                reservations={filteredReservations}
                onUpdate={handleOpenEdit}
                onDelete={(id) => setDeleteReservationId(id)}
                onStatusChange={handleStatusChange}
              />
            )}

            {state.viewMode === "cards" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pb-6">
                {filteredReservations.map((r) => {
                  const dateObj = new Date(r.date);
                  const dateLocal = dateObj.toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  });
                  const timeLocal = dateObj.toLocaleTimeString("en", {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <ReservationCard
                      key={r.unique_code || r.id}
                      id={r.id}
                      unique_code={r.unique_code}
                      customer_id={r.customer_id}
                      customer_name={r.customer_name}
                      dateLocal={dateLocal}
                      timeLocal={timeLocal}
                      people_count={r.people_count}
                      table_id={r.table_id}
                      table_title={r.table_title}
                      seating_capacity={r.seating_capacity}
                      floor={r.floor}
                      notes={r.notes}
                      status={r.status}
                      business={r.business}
                      btnUpdate={() => handleOpenEdit(r)}
                      btnDelete={() => setDeleteReservationId(r.id)}
                      onStatusChange={(newStatus) => handleStatusChange(r.id, newStatus)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide-over Drawer for Add/Edit Reservation */}
      <ReservationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isEditMode={drawerEditMode}
        initialData={selectedReservation}
        storeTables={storeTables}
        onSuccess={() => {
          mutate(APIURL);
          mutate("/reservations/init");
        }}
        openAddCustomerModal={(val) => {
          setAddCustomerDefaultValue(val);
          document.getElementById("modal-add-customer")?.showModal();
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={deleteReservationId !== null}
        onClose={() => setDeleteReservationId(null)}
        onConfirm={btnConfirmDelete}
        title={t("reservations.delete_confirm") || "Delete Reservation?"}
        message="This action will permanently remove the reservation record."
      />

      {/* Add Customer Modal shortcut */}
      <DialogAddCustomer
        APIURL={APIURL}
        defaultValue={addCustomerDefaultValue}
        onSuccess={() => {
          toast.success("Customer added! You can now select them in the reservation.");
        }}
      />

      {/* Custom Date Range Dialog */}
      <dialog id="custom-date-modal" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IconFilter size={18} stroke={iconStroke} /> Custom Date Filter
          </h3>
          <div className="my-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">From Date</label>
              <input
                ref={fromDateRef}
                type="date"
                defaultValue={state.fromDate}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900 outline-none dark:border-zinc-800 dark:bg-zinc-850 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">To Date</label>
              <input
                ref={toDateRef}
                type="date"
                defaultValue={state.toDate}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900 outline-none dark:border-zinc-800 dark:bg-zinc-850 dark:text-white"
              />
            </div>
          </div>
          <div className="modal-action flex gap-2">
            <button
              type="button"
              onClick={() => document.getElementById("custom-date-modal")?.close()}
              className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 dark:border-zinc-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const from = fromDateRef.current?.value;
                const to = toDateRef.current?.value;
                if (!from || !to) {
                  toast.error("Please pick both from and to dates");
                  return;
                }
                setState((prev) => ({
                  ...prev,
                  filter: "custom",
                  fromDate: from,
                  toDate: to,
                }));
                document.getElementById("custom-date-modal")?.close();
              }}
              className="rounded-xl bg-restro-green px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-restro-green-button-hover"
            >
              Apply Range
            </button>
          </div>
        </div>
      </dialog>
    </Page>
  );
}
