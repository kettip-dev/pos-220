import React, { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Menu, Transition } from "@headlessui/react";
import {
  IconRefresh,
  IconList,
  IconDots,
  IconPlus,
  IconLayoutGrid,
  IconUsers,
  IconAlertTriangle,
} from "@tabler/icons-react";

export default function BindoBottomBar({
  metrics = {
    all: 0,
    seated: 0,
    ordered: 0,
    ck_dropped: 0,
    paid: 0,
    unsent: 0,
    alert: 0,
    over_time: 0,
    reserved: 0,
    multiple: 0,
    available: 0,
    blocked: 0,
    total_pax: 0,
  },
  activeFilter = null,
  onSelectFilter = () => {},
  onRefresh = () => {},
  isRefreshing = false,
  isDrawerOpen = true,
  onToggleDrawer = () => {},
  onAddTable = () => {},
  onOpenAllTables = () => {},
}) {
  const { t } = useTranslation();

  const totalTables =
    metrics.all ??
    ((metrics.available || 0) + (metrics.occupied || 0));

  const availableCount = metrics.available || 0;
  const occupiedCount =
    metrics.occupied ??
    ((metrics.seated || 0) +
      (metrics.ordered || 0) +
      (metrics.ck_dropped || 0) +
      (metrics.paid || 0));

  const billedCount = metrics.ck_dropped || 0;
  const attentionCount =
    (Number(metrics.over_time) || 0) + (Number(metrics.alert) || 0);
  const totalPax = metrics.total_pax || 0;

  const statusChips = [
    {
      key: "all",
      label: t("tables.all", "All"),
      count: totalTables,
      dotColor: "bg-slate-400",
      activeBg:
        "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs",
      defaultBg:
        "bg-white dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700/60",
    },
    {
      key: "available",
      label: t("tables.available", "Available"),
      count: availableCount,
      dotColor: "bg-emerald-500",
      activeBg: "bg-emerald-600 text-white border-emerald-600 shadow-xs",
      defaultBg:
        "bg-white dark:bg-zinc-800/80 text-emerald-700 dark:text-emerald-400 border-slate-200 dark:border-zinc-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30",
    },
    {
      key: "occupied",
      label: t("tables.occupied", "Occupied"),
      count: occupiedCount,
      dotColor: "bg-[#0ea5e9]",
      activeBg: "bg-[#0ea5e9] text-white border-[#0ea5e9] shadow-xs",
      defaultBg:
        "bg-white dark:bg-zinc-800/80 text-[#0284c7] dark:text-sky-400 border-slate-200 dark:border-zinc-700 hover:bg-sky-50/50 dark:hover:bg-sky-950/30",
    },
    {
      key: "ck_dropped",
      label: t("tables.billed", "Billed"),
      count: billedCount,
      dotColor: "bg-amber-500",
      activeBg: "bg-amber-500 text-white border-amber-500 shadow-xs",
      defaultBg:
        "bg-white dark:bg-zinc-800/80 text-amber-700 dark:text-amber-400 border-slate-200 dark:border-zinc-700 hover:bg-amber-50/50 dark:hover:bg-amber-950/30",
    },
  ];

  return (
    <footer className="flex items-center justify-between gap-2 md:gap-3 px-3 md:px-4 py-2 bg-white dark:bg-[#0f172a] text-slate-800 dark:text-white border-t border-slate-200 dark:border-zinc-700/80 shadow-md shrink-0 select-none z-20 min-h-[56px]">
      {/* Left / Center: Streamlined Live Status Filter Chips */}
      <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto no-scrollbar py-0.5">
        {statusChips.map((chip) => {
          const isSelected =
            chip.key === "all"
              ? !activeFilter || activeFilter === "all"
              : activeFilter === chip.key;

          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => {
                if (chip.key === "all") {
                  onSelectFilter(null);
                } else {
                  onSelectFilter(isSelected ? null : chip.key);
                }
              }}
              className={`
                flex items-center gap-2 h-[42px] px-3 md:px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 border active:scale-95
                ${
                  isSelected
                    ? chip.activeBg
                    : `${chip.defaultBg} ${
                        activeFilter && !isSelected
                          ? "opacity-60 hover:opacity-100"
                          : ""
                      }`
                }
              `}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${chip.dotColor}`} />
              <span className="whitespace-nowrap tracking-tight">{chip.label}</span>
              <span
                className={`
                  tabular-nums font-black text-xs px-1.5 py-0.5 rounded-md min-w-[20px] text-center
                  ${
                    isSelected
                      ? "bg-white/20 text-white dark:bg-black/20 dark:text-black"
                      : "bg-black/5 dark:bg-white/10"
                  }
                `}
              >
                {chip.count}
              </span>
            </button>
          );
        })}

        {/* Dynamic Attention Alert Chip (Visible ONLY when there are overtime/alert tables) */}
        {attentionCount > 0 && (
          <button
            type="button"
            onClick={() =>
              onSelectFilter(activeFilter === "attention" ? null : "attention")
            }
            className={`
              flex items-center gap-1.5 h-[42px] px-3 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 border active:scale-95
              ${
                activeFilter === "attention"
                  ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 animate-pulse"
              }
            `}
            title={t(
              "tables.attention_tooltip",
              "Tables requiring immediate attention (Overtime / Alerts)"
            )}
          >
            <IconAlertTriangle size={15} className="shrink-0" />
            <span className="tabular-nums font-black">{attentionCount}</span>
            <span className="whitespace-nowrap">
              {t("tables.attention", "Attention")}
            </span>
          </button>
        )}

        {/* Informational Guest / PAX Badge (Separated & non-clickable) */}
        <div
          title={t("tables.total_guests_seated", "Total seated guests")}
          className="flex items-center gap-1.5 h-[42px] px-3 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200/80 dark:border-zinc-700 shrink-0 select-none ml-1"
        >
          <IconUsers size={15} className="text-slate-400 dark:text-zinc-500 shrink-0" />
          <span className="whitespace-nowrap">
            <strong className="text-slate-900 dark:text-white tabular-nums">
              {totalPax}
            </strong>{" "}
            {t("tables.pax", "Guests")}
          </span>
        </div>
      </div>

      {/* Right: Quick Tool Buttons */}
      <div className="flex items-center gap-1 md:gap-1.5 shrink-0 pl-2 md:pl-3 border-l border-slate-200 dark:border-zinc-700/80">
        {/* Refresh button — labeled on md+ */}
        <button
          type="button"
          onClick={onRefresh}
          title={t("common.refresh", "Refresh Live Status")}
          className={`flex items-center gap-1.5 h-[42px] px-2.5 md:px-3 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-transparent transition cursor-pointer active:scale-95 ${
            isRefreshing ? "text-cyan-600 dark:text-cyan-400" : ""
          }`}
        >
          <IconRefresh size={16} className={isRefreshing ? "animate-spin" : ""} />
          <span className="hidden md:inline">{t("common.refresh", "Refresh")}</span>
        </button>

        {/* Sidebar toggle — labeled on md+ */}
        <button
          type="button"
          onClick={onToggleDrawer}
          title={
            isDrawerOpen
              ? t("tables.close_sidebar", "Close Sidebar")
              : t("tables.open_sidebar", "Open Sidebar")
          }
          className={`flex items-center gap-1.5 h-[42px] px-2.5 md:px-3 rounded-xl text-xs font-semibold border transition cursor-pointer active:scale-95 ${
            isDrawerOpen
              ? "bg-[#0ea5e9]/10 text-[#0284c7] dark:text-[#38bdf8] border-[#0ea5e9]/30 hover:bg-[#0ea5e9]/20"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 border-slate-200/80 dark:border-transparent"
          }`}
        >
          <IconList size={16} />
          <span className="hidden md:inline">{t("tables.sidebar", "Sidebar")}</span>
        </button>

        {/* Dropdown Menu */}
        <Menu as="div" className="relative inline-block text-left">
          <div>
            <Menu.Button
              title={t("common.options", "Options")}
              className="flex items-center justify-center h-[42px] w-[42px] rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-transparent transition cursor-pointer focus:outline-none active:scale-95"
            >
              <IconDots size={18} />
            </Menu.Button>
          </div>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute bottom-full right-0 mb-2 w-64 origin-bottom-right rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 shadow-2xl ring-1 ring-black/5 focus:outline-none p-1.5 z-50 divide-y divide-slate-100 dark:divide-zinc-800 text-left">
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={onAddTable}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        active
                          ? "bg-emerald-600 text-white"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <IconPlus size={16} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold leading-tight">
                          {t("tables.create_new_table", "Create New Table")}
                        </p>
                        <p className="text-[10px] opacity-70 font-normal mt-0.5">
                          {t("tables.add_table_hint", "Add a new table to this floor")}
                        </p>
                      </div>
                    </button>
                  )}
                </Menu.Item>

                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={onOpenAllTables}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer mt-1 ${
                        active
                          ? "bg-[#0ea5e9] text-white"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                        <IconLayoutGrid size={16} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold leading-tight">
                          {t(
                            "tables.list_all_tables",
                            "List All Tables (Card View)"
                          )}
                        </p>
                        <p className="text-[10px] opacity-70 font-normal mt-0.5">
                          {t(
                            "tables.cards_view_hint",
                            "View all tables with live status & orders"
                          )}
                        </p>
                      </div>
                    </button>
                  )}
                </Menu.Item>
              </div>

              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={onRefresh}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        active
                          ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <IconRefresh
                        size={15}
                        className={isRefreshing ? "animate-spin text-cyan-500" : ""}
                      />
                      <span>{t("common.refresh", "Refresh Live Status")}</span>
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </footer>
  );
}
