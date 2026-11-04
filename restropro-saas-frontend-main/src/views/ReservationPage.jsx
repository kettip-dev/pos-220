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
  IconCalendarOff,
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
    { key: "all", value: t("reservations.filters.all") || "All Bookings" },
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
      {/* Header: title + new, then date range / search / view switch */}
      <div className="flex flex-col gap-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black leading-snug tracking-tight text-gray-900 dark:text-white">
              {t("reservations.title") || "Table Reservations"}
            </h2>
            <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-emerald-500/10 px-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {filteredReservations.length}
            </span>
          </div>

          {isManageAllowed && (
            <button
              onClick={handleOpenAdd}
              className="flex h-[42px] items-center gap-1.5 rounded-xl bg-restro-green px-4 text-sm font-bold text-white shadow-sm transition active:scale-95 hover:bg-restro-green-button-hover"
            >
              <IconPlus size={18} stroke={iconStroke} />
              <span>{t("reservations.new") || "New"}</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range segmented control */}
          <div className="flex items-center gap-1 rounded-2xl border border-gray-200 bg-gray-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            {filters.slice(0, 4).map((f) => {
              const isSelected = state.filter === f.key && !state.search;
              return (
                <button
                  key={f.key}
                  onClick={() => {
                    btnClearSearch();
                    setState((prev) => ({ ...prev, filter: f.key }));
                  }}
                  className={`min-h-[42px] whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold leading-snug transition active:scale-95 ${
                    isSelected
                      ? "bg-restro-green text-white shadow-sm"
                      : "text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {f.value}
                </button>
              );
            })}

            <div className="dropdown">
              <button
                tabIndex={0}
                className={`flex min-h-[42px] items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold leading-snug transition active:scale-95 ${
                  ["this_month", "last_month", "all", "custom"].includes(state.filter) && !state.search
                    ? "bg-restro-green text-white shadow-sm"
                    : "text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-zinc-800"
                }`}
              >
                <IconCalendar size={16} stroke={iconStroke} />
                <span>
                  {["this_month", "last_month", "all", "custom"].includes(state.filter)
                    ? filters.find((f) => f.key === state.filter)?.value
                    : (t("reservations.filters.more") || "More")}
                </span>
              </button>
              <ul
                tabIndex={0}
                className="dropdown-content menu z-30 mt-1 w-52 rounded-xl border border-gray-200 bg-white p-1 text-sm shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
              >
                {filters.slice(4).map((f) => (
                  <li key={f.key}>
                    <button
                      className="min-h-[42px]"
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

          {/* Search */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
            <input
              ref={searchRef}
              type="text"
              defaultValue={state.search}
              placeholder={t("reservations.search_placeholder") || "Search..."}
              onKeyDown={(e) => {
                if (e.key === "Enter") btnSearch();
              }}
              className="h-[42px] w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-900 outline-none transition focus:border-restro-border-green focus:ring-2 focus:ring-restro-green/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
            <IconSearch
              size={18}
              stroke={iconStroke}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            {state.search && (
              <button
                onClick={btnClearSearch}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 active:scale-95"
              >
                <IconX size={16} stroke={iconStroke} />
              </button>
            )}
          </div>

          {/* View switcher (icons; labels on wide screens) */}
          <div className="ml-auto flex items-center gap-1 rounded-2xl border border-gray-200 bg-gray-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            {[
              { key: "timeline", Icon: IconClockPlay, label: t("reservations.views.timeline") || "Timeline" },
              { key: "kanban", Icon: IconLayoutKanban, label: t("reservations.views.kanban") || "Kanban" },
              { key: "calendar", Icon: IconCalendar, label: t("reservations.views.calendar") || "Calendar" },
              { key: "table", Icon: IconTable, label: t("reservations.views.table") || "Table" },
              { key: "cards", Icon: IconLayoutGrid, label: t("reservations.views.cards") || "Cards" },
            ].map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => setState((prev) => ({ ...prev, viewMode: key }))}
                title={label}
                className={`flex min-h-[42px] min-w-[42px] items-center justify-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold transition active:scale-95 ${
                  state.viewMode === key
                    ? "bg-white text-gray-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                    : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                <Icon size={18} stroke={iconStroke} />
                <span className="hidden 2xl:inline">{label}</span>
              </button>
            ))}
          </div>
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
            {t("reservations.search_results_for", { search: state.search, count: filteredReservations.length }) || (
              <>Search results for: <strong>"{state.search}"</strong> ({filteredReservations.length} found)</>
            )}
          </span>
          <button
            onClick={btnClearSearch}
            className="font-bold underline hover:text-blue-900"
          >
            {t("reservations.clear_search") || "Clear Search"}
          </button>
        </div>
      )}

      {/* Main Content View Container - Smooth Full Scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoadingReservations ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2">
            <div className="h-7 w-7 animate-spin rounded-full border-3 border-restro-green border-t-transparent" />
            <p className="text-xs font-semibold text-gray-500">
              {t("reservations.loading_reservations") || "Loading reservations..."}
            </p>
          </div>
        ) : filteredReservations.length === 0 && state.viewMode !== "calendar" ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-restro-green/10 text-restro-green">
              <IconCalendarOff size={32} stroke={1.5} />
            </div>
            <h4 className="text-lg font-bold leading-snug text-gray-800 dark:text-gray-100">
              {t("reservations.no_reservation") || "No reservations found"}
            </h4>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {t("reservations.double_checked") || "There are no bookings matching your selected date or filters."}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {isManageAllowed && (
                <button
                  onClick={handleOpenAdd}
                  className="flex h-[42px] items-center gap-1.5 rounded-xl bg-restro-green px-4 text-sm font-bold text-white shadow-sm transition active:scale-95 hover:bg-restro-green-button-hover"
                >
                  <IconPlus size={18} stroke={iconStroke} />
                  <span>{t("reservations.book_first") || "Book First Reservation"}</span>
                </button>
              )}
              {(state.filter !== "all" || state.activeStatusFilter !== "all" || state.search) && (
                <button
                  onClick={() => {
                    btnClearSearch();
                    setState((prev) => ({ ...prev, filter: "all", activeStatusFilter: "all" }));
                  }}
                  className="flex h-[42px] items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition active:scale-95 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-200"
                >
                  {t("reservations.show_all_bookings") || "Show all bookings"}
                </button>
              )}
            </div>
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
        message={t("reservations.delete_message") || "This action will permanently remove the reservation record."}
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
            <IconFilter size={18} stroke={iconStroke} /> {t("reservations.custom_date_filter") || "Custom Date Filter"}
          </h3>
          <div className="my-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">
                {t("reservations.from_date") || "From Date"}
              </label>
              <input
                ref={fromDateRef}
                type="date"
                defaultValue={state.fromDate}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900 outline-none dark:border-zinc-800 dark:bg-zinc-850 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">
                {t("reservations.to_date") || "To Date"}
              </label>
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
              {t("reservations.cancel") || "Cancel"}
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
              {t("reservations.apply_range") || "Apply Range"}
            </button>
          </div>
        </div>
      </dialog>
    </Page>
  );
}
