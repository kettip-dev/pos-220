import React from "react";
import { useTranslation } from "react-i18next";
import {
  IconLayoutGrid,
  IconGridDots,
  IconColumns,
  IconPlus,
  IconPencil,
  IconDeviceFloppy,
  IconX,
  IconAdjustmentsHorizontal,
  IconWifi,
  IconWifiOff,
  IconTrash,
  IconArmchair,
  IconShoppingBag,
} from "@tabler/icons-react";

export default function BindoTopBar({
  zones = [],
  currentZone = "0",
  onSelectZone = () => {},
  onAddZone,
  isEditMode = false,
  onEnterEditMode = () => {},
  onSaveEditMode = () => {},
  onCancelEditMode = () => {},
  isDrawingWall = false,
  onToggleDrawingWall = () => {},
  hasWalls = false,
  onClearWalls = () => {},
  showCashier = true,
  onToggleCashier = () => {},
  dineInCount = 0,
  pickUpCount = 0,
  isSocketConnected = true,
  isSaving = false,
  onToggleDrawer = () => {},
  isDrawerOpen = true,
  drawerMode = "actions", // "actions" | "list"
  viewMode = "canvas", // "canvas" | "grid"
  onToggleViewMode = () => {},
}) {
  const { t } = useTranslation();

  const displayZones = zones.length > 0 ? zones : ["0"];

  const normalizeFloor = (f) => {
    if (f === null || f === undefined) return "";
    return String(f)
      .trim()
      .replace(/[០-៩]/g, (d) => "0123456789"["០១២៣៤៥៦៧៨៩".indexOf(d)]);
  };

  const formatZoneLabel = (zone) => {
    const s = String(zone).trim();
    if (/^(zone|floor)\b/i.test(s)) return s;
    return `${t("tables.zone", "Zone")} ${s}`;
  };

  return (
    <header
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b backdrop-blur-md select-none shrink-0 z-20 transition-colors duration-200 ${
        isEditMode
          ? "bg-amber-50/95 dark:bg-amber-950/30 border-b-amber-200 dark:border-b-amber-800/60"
          : "bg-white/95 dark:bg-zinc-900/95 border-b-slate-200 dark:border-b-zinc-800"
      }`}
    >
      {/* Left: View Mode Toggle + Zone Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {/* View Mode Toggle: Canvas ↔ Grid */}
        <button
          type="button"
          onClick={onToggleViewMode}
          title={viewMode === "grid" ? t("tables.floor_plan_view", "Floor Plan View") : t("tables.grid_view", "Grid View")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shrink-0 ${
            viewMode === "grid"
              ? "border-[#0ea5e9] bg-[#0ea5e9]/10 text-[#0ea5e9]"
              : "border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:border-[#0ea5e9] hover:text-[#0ea5e9]"
          }`}
        >
          {viewMode === "grid" ? <IconColumns size={16} /> : <IconGridDots size={16} />}
          <span className="hidden sm:inline">
            {viewMode === "grid" ? t("tables.floor_plan", "Floor Plan") : t("tables.grid", "Grid")}
          </span>
        </button>

        {/* Zone Pills (e.g. Zone 0) — only shown in canvas mode */}
        {viewMode === "canvas" && (
          <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-zinc-800/90 p-1 rounded-xl">
            {displayZones.map((zone) => {
              const isActive = normalizeFloor(currentZone) === normalizeFloor(zone);
              return (
                <button
                  key={zone}
                  type="button"
                  onClick={() => onSelectZone(zone)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-[#0ea5e9] text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-zinc-700/60"
                  }`}
                >
                  {formatZoneLabel(zone)}
                </button>
              );
            })}

            {/* Add Zone Button */}
            {onAddZone && (
              <button
                type="button"
                onClick={onAddZone}
                title={t("tables.add_zone", "Add Zone")}
                className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                <IconPlus size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: Live Order Counters, Socket Status & Edit Mode Controls */}
      <div className="flex items-center gap-3">
        {/* Live Order Stats (Dine-in, Pick-up) — pill chip style */}
        {!isEditMode && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/40 text-sky-700 dark:text-sky-300 text-xs font-bold">
              <IconArmchair size={13} />
              {dineInCount}
              <span className="font-medium opacity-70 hidden md:inline">{t("tables.dine_in", "Dine-in")}</span>
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
              <IconShoppingBag size={13} />
              {pickUpCount}
              <span className="font-medium opacity-70 hidden md:inline">{t("tables.pick_up", "Pick-up")}</span>
            </span>
          </div>
        )}

        {/* Separator */}
        {!isEditMode && <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-zinc-700" />}

        {/* Live Socket Connection indicator */}
        <div
          title={isSocketConnected ? "Live Status Connected" : "Connecting..."}
          className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400"
        >
          {isSocketConnected ? (
            <>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="hidden lg:inline text-emerald-600 dark:text-emerald-400">Live</span>
            </>
          ) : (
            <>
              <IconWifiOff size={14} className="text-amber-500" />
              <span className="hidden lg:inline text-amber-600 dark:text-amber-400">Offline</span>
            </>
          )}
        </div>

        {/* Edit Layout vs Normal Mode Actions */}
        {isEditMode ? (
          <div className="flex items-center gap-2">
            {/* Draw Wall Tool Toggle */}
            <button
              type="button"
              onClick={onToggleDrawingWall}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                isDrawingWall
                  ? "bg-amber-500 border-amber-600 text-white shadow-sm"
                  : "border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
              title={t("tables.draw_wall_tooltip", "Click and drag on floor to draw partition walls")}
            >
              <IconPencil size={14} />
              <span>{isDrawingWall ? t("tables.drawing_wall", "Drawing...") : t("tables.draw_wall", "Draw Wall")}</span>
            </button>

            {/* Clear All Walls button */}
            {hasWalls && (
              <button
                type="button"
                onClick={onClearWalls}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                title={t("tables.clear_walls", "Clear All Walls")}
              >
                <IconTrash size={14} />
                <span className="hidden xl:inline">{t("tables.clear_walls", "Clear Walls")}</span>
              </button>
            )}

            {/* Cashier Station Toggle */}
            <button
              type="button"
              onClick={onToggleCashier}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                showCashier
                  ? "border-[#0ea5e9]/50 bg-sky-50 dark:bg-sky-950/40 text-[#0ea5e9]"
                  : "border-slate-300 dark:border-zinc-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
              title={showCashier ? t("tables.hide_cashier", "Hide Cashier Desk") : t("tables.show_cashier", "Show Cashier Desk")}
            >
              <span>{t("tables.cashier", "Cashier")}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono leading-none ${showCashier ? "bg-[#0ea5e9] text-white" : "bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-300"}`}>
                {showCashier ? "ON" : "OFF"}
              </span>
            </button>

            <div className="w-px h-5 bg-amber-300 dark:bg-amber-700/60 mx-0.5" />

            <button
              type="button"
              onClick={onCancelEditMode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <IconX size={14} />
              <span>{t("common.cancel", "Cancel")}</span>
            </button>
            <button
              type="button"
              onClick={onSaveEditMode}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0ea5e9] text-white text-xs font-bold shadow-sm hover:bg-[#0284c7] transition cursor-pointer disabled:opacity-50"
            >
              <IconDeviceFloppy size={14} />
              <span>{isSaving ? t("common.saving", "Saving...") : t("tables.save_layout", "Save Layout")}</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEnterEditMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            <IconPencil size={14} />
            <span className="hidden md:inline">{t("tables.edit_layout", "Edit Layout")}</span>
          </button>
        )}
      </div>
    </header>
  );
}
