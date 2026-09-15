import React, { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Menu, Transition } from "@headlessui/react";
import {
  IconRefresh,
  IconList,
  IconDots,
  IconPlus,
  IconLayoutGrid,
} from "@tabler/icons-react";

export default function BindoBottomBar({
  metrics = {
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
  onOpenOptionsMenu = () => {},
}) {
  const { t } = useTranslation();

  const statusChips = [
    { key: "seated", label: t("tables.seated", "SEATED"), count: metrics.seated, bg: "bg-[#0ea5e9]", text: "text-white" },
    { key: "ordered", label: t("tables.ordered", "ORDERED"), count: metrics.ordered, bg: "bg-[#1e293b]", text: "text-white" },
    { key: "ck_dropped", label: t("tables.ck_dropped", "CK DROPPED"), count: metrics.ck_dropped, bg: "bg-[#f97316]", text: "text-white" },
    { key: "paid", label: t("tables.paid", "PAID"), count: metrics.paid, bg: "bg-[#4ade80]", text: "text-[#064e3b]" },
    { key: "unsent", label: t("tables.unsent_items", "UNSENT ITEMS"), count: metrics.unsent, bg: "bg-[#facc15]", text: "text-[#713f12]" },
    { key: "alert", label: t("tables.alert", "ALERT"), count: metrics.alert, bg: "bg-[#d946ef]", text: "text-white" },
    { key: "over_time", label: t("tables.over_time", "OVER TIME"), count: metrics.over_time, bg: "bg-[#f87171]", text: "text-white" },
    { key: "reserved", label: t("tables.reserved", "RESERVED"), count: metrics.reserved, bg: "bg-[#c084fc]", text: "text-white" },
    { key: "multiple", label: t("tables.multiple", "MULTIPLE"), count: metrics.multiple, bg: "bg-[#f472b6]", text: "text-white" },
    { key: "available", label: t("tables.available", "AVAILABLE"), count: metrics.available, bg: "bg-[#475569]", text: "text-white" },
    { key: "blocked", label: t("tables.blocked", "BLOCKED"), count: metrics.blocked, bg: "bg-[#94a3b8]", text: "text-white" },
    { key: "pax", label: t("tables.pax", "PAX"), count: metrics.total_pax, bg: "bg-[#334155]", text: "text-white" },
  ];

  return (
    <footer className="flex items-center justify-between gap-2 md:gap-4 px-3 md:px-5 py-2 md:py-2.5 bg-[#0f172a] text-white border-t border-slate-800 shadow-2xl shrink-0 select-none z-20 min-h-[56px] md:min-h-[66px] lg:min-h-[72px]">
      {/* Center: Scrollable Live Status KPI Chips */}
      <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto no-scrollbar py-0.5 px-1">
        {statusChips.map((chip) => {
          const isSelected = activeFilter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onSelectFilter(isSelected ? null : chip.key)}
              className={`flex flex-col items-center justify-center min-w-[54px] md:min-w-[76px] lg:min-w-[84px] px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl text-center transition-all cursor-pointer ${
                chip.bg
              } ${chip.text} ${
                isSelected
                  ? "ring-2 ring-white scale-105 shadow-md brightness-110"
                  : activeFilter
                  ? "opacity-40 hover:opacity-100"
                  : "hover:scale-102 hover:brightness-105"
              }`}
            >
              <span className="text-xs md:text-sm lg:text-base font-black leading-none">{chip.count}</span>
              <span className="text-[8px] md:text-[9.5px] lg:text-[10px] font-bold tracking-tight uppercase whitespace-nowrap leading-tight opacity-90 mt-0.5 md:mt-1">
                {chip.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Quick Tool Buttons (Add Table, Refresh, Drawer Toggle, Menu) */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0 pl-1 md:pl-2 border-l border-slate-800">

        <button
          type="button"
          onClick={onRefresh}
          title={t("common.refresh", "Refresh Live Status")}
          className={`p-2 md:p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ${
            isRefreshing ? "animate-spin text-cyan-400" : ""
          }`}
        >
          <IconRefresh size={18} />
        </button>

        <button
          type="button"
          onClick={onToggleDrawer}
          title={isDrawerOpen ? t("tables.close_sidebar", "Close Sidebar") : t("tables.open_sidebar", "Open Sidebar")}
          className={`p-2 md:p-2.5 rounded-xl transition cursor-pointer ${
            isDrawerOpen
              ? "bg-[#0ea5e9] text-white shadow-xs"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <IconList size={18} />
        </button>

        {/* Dropdown Menu (Options: Create New Table, List All Tables, Refresh) */}
        <Menu as="div" className="relative inline-block text-left">
          <div>
            <Menu.Button
              title={t("common.options", "Options")}
              className="p-2 md:p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center justify-center focus:outline-none"
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
            <Menu.Items className="absolute bottom-full right-0 mb-2 w-64 origin-bottom-right rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl ring-1 ring-black/10 focus:outline-none p-1.5 z-50 divide-y divide-slate-800 text-left">
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={onAddTable}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        active
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <IconPlus size={16} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold leading-tight">{t("tables.create_new_table", "Create New Table")}</p>
                        <p className="text-[10px] opacity-70 font-normal mt-0.5">{t("tables.add_table_hint", "Add a new table to this floor")}</p>
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
                          ? "bg-[#0ea5e9] text-white shadow-xs"
                          : "text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                        <IconLayoutGrid size={16} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold leading-tight">{t("tables.list_all_tables", "List All Tables (Card View)")}</p>
                        <p className="text-[10px] opacity-70 font-normal mt-0.5">{t("tables.cards_view_hint", "View all tables with live status & orders")}</p>
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
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        active
                          ? "bg-slate-800 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      }`}
                    >
                      <IconRefresh size={15} className={isRefreshing ? "animate-spin text-cyan-400" : ""} />
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
