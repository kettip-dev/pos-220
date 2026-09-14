import React, { useMemo } from "react";
import {
  IconCheck,
  IconPlus,
  IconShieldCheck,
  IconCashRegister,
  IconChefHat,
  IconCalendarEvent,
  IconPackages,
  IconAdjustmentsHorizontal,
  IconChartBar,
  IconUsersGroup,
  IconSettings,
  IconListCheck,
} from "@tabler/icons-react";
import { SCOPES } from "../config/scopes";
import {
  ROLE_PRESETS,
  SCOPE_METADATA,
  SCOPE_CATEGORIES,
} from "../config/permissionTemplates";

const ICON_MAP = {
  IconShieldCheck,
  IconCashRegister,
  IconChefHat,
  IconCalendarEvent,
  IconPackages,
  IconChartBar,
  IconUsersGroup,
  IconSettings,
};

export default function PermissionSelector({ selectedScopes = [], onChange }) {
  const selectedSet = useMemo(() => new Set(selectedScopes), [selectedScopes]);

  // List of all scope objects with metadata
  const allScopesList = useMemo(() => {
    return Object.values(SCOPES).map((key) => {
      const meta = SCOPE_METADATA[key] || {};
      const cat = SCOPE_CATEGORIES.find((c) => c.scopes.includes(key));
      return {
        key,
        title: meta.title || key,
        category: meta.category || cat?.id || "other",
        categoryTitle: cat?.title || "",
        description: meta.description || "",
      };
    });
  }, []);

  // Determine active preset (if current selection matches a preset's scopes exactly)
  const activePresetId = useMemo(() => {
    for (const preset of ROLE_PRESETS) {
      if (preset.scopes.length === selectedScopes.length) {
        const pSet = new Set(preset.scopes);
        if (selectedScopes.every((s) => pSet.has(s))) {
          return preset.id;
        }
      }
    }
    return "custom";
  }, [selectedScopes]);

  // Toggle individual scope
  const handleToggleScope = (scopeKey) => {
    if (selectedSet.has(scopeKey)) {
      onChange(selectedScopes.filter((s) => s !== scopeKey));
    } else {
      onChange([...selectedScopes, scopeKey]);
    }
  };

  // Select preset role
  const handleSelectPreset = (presetScopes) => {
    onChange([...new Set(presetScopes)]);
  };

  // Select all scopes
  const handleSelectAll = () => {
    onChange(Object.values(SCOPES));
  };

  // Deselect all scopes
  const handleDeselectAll = () => {
    onChange([]);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* 1. ROLE PRESET SEGMENTED CONTROL */}
      <div className="shrink-0 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <IconShieldCheck size={16} className="text-restro-green" />
            Role Assignment
          </label>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Select a role template or customize permissions below
          </span>
        </div>

        <div className="p-1.5 rounded-2xl border border-restro-border-green bg-restro-gray/60 dark:bg-zinc-950 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
          {ROLE_PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id;
            const IconComponent = ICON_MAP[preset.iconName] || IconShieldCheck;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.scopes)}
                className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 text-center select-none active:scale-95 ${
                  isActive
                    ? "bg-restro-green text-white shadow-xs font-bold border border-restro-green"
                    : "bg-white/80 dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border border-transparent hover:border-restro-border-green hover:bg-white dark:hover:bg-zinc-800"
                }`}
              >
                <IconComponent
                  size={15}
                  className={isActive ? "text-white" : "text-gray-500 dark:text-gray-400"}
                />
                <span className="truncate">{preset.title.split(" / ")[0]}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              if (activePresetId !== "custom") {
                onChange([...selectedScopes]);
              }
            }}
            className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 text-center select-none active:scale-95 ${
              activePresetId === "custom"
                ? "bg-restro-green text-white shadow-xs font-bold border border-restro-green"
                : "bg-white/80 dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border border-transparent hover:border-restro-border-green hover:bg-white dark:hover:bg-zinc-800"
            }`}
          >
            <IconAdjustmentsHorizontal
              size={15}
              className={activePresetId === "custom" ? "text-white" : "text-gray-500 dark:text-gray-400"}
            />
            <span>Custom</span>
          </button>
        </div>
      </div>

      {/* 2. PERMISSIONS & SCOPES CONTAINER */}
      <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-restro-border-green bg-restro-gray/30 dark:bg-zinc-950 p-3.5 sm:p-4 space-y-3">
        {/* Header & Controls */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-restro-border-green/50 pb-2.5">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <IconListCheck size={16} className="text-restro-green" />
              Permissions & Scopes
            </h4>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-restro-green/10 text-restro-green border border-restro-green/30">
              {selectedScopes.length} / {allScopesList.length} Selected
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-restro-green hover:underline cursor-pointer"
            >
              Select All
            </button>
            <span className="text-gray-300 dark:text-zinc-800">|</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-gray-400 hover:text-red-500 hover:underline cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Scope Cards Interactive Grid */}
        <div className="flex-1 min-h-[140px] max-h-[260px] overflow-y-auto p-1 custom-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {allScopesList.map((item) => {
            const isSelected = selectedSet.has(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleToggleScope(item.key)}
                title={`${item.title}: ${item.description}`}
                className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center justify-between gap-2 transition-all duration-150 select-none text-left active:scale-[0.98] ${
                  isSelected
                    ? "bg-restro-green/10 dark:bg-restro-green/20 text-restro-green border-restro-green shadow-2xs font-semibold"
                    : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border-restro-border-green hover:border-restro-green hover:bg-restro-green-10/30"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-restro-green text-white"
                        : "border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800"
                    }`}
                  >
                    {isSelected && <IconCheck size={12} stroke={3} />}
                  </div>
                  <span className="truncate">{item.title}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


