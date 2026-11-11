import React from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

export const PREP_PRESETS = [3, 5, 10, 15, 20, 30];

/**
 * Cooking-time picker for settings forms: one-tap preset chips plus a custom
 * minutes box. `value` is a string ("" = no time set).
 * `inheritedMinutes` shows what applies when nothing is set here (e.g. the category default).
 */
export default function PrepTimePresets({ value, onChange, inheritedMinutes = null, inheritedLabel = null, id }) {
  const { t } = useTranslation();
  const current = value === "" || value === null || value === undefined ? "" : String(value);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange("")}
          className={clsx(
            "min-h-[42px] px-3 rounded-xl border text-sm font-semibold transition active:scale-95",
            current === ""
              ? "bg-restro-green text-white border-restro-green"
              : "bg-restro-gray border-restro-border-green text-restro-text hover:bg-restro-button-hover"
          )}
        >
          {t("kitchen.prep.none", "None")}
        </button>
        {PREP_PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(String(m))}
            className={clsx(
              "min-h-[42px] min-w-[54px] px-3 rounded-xl border text-sm font-semibold tabular-nums transition active:scale-95",
              current === String(m)
                ? "bg-restro-green text-white border-restro-green"
                : "bg-restro-gray border-restro-border-green text-restro-text hover:bg-restro-button-hover"
            )}
          >
            {t("kitchen.prep.min_short", "{{m}} min", { m })}
          </button>
        ))}
        <input
          id={id}
          value={current}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
          type="text"
          inputMode="numeric"
          aria-label={t("kitchen.prep.custom", "Custom minutes")}
          placeholder={t("kitchen.prep.custom_ph", "Other")}
          className="min-h-[42px] w-[84px] text-sm rounded-xl px-3 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green tabular-nums"
        />
      </div>
      {current === "" && inheritedMinutes ? (
        <p className="text-[11px] text-gray-400 mt-1.5">
          {t("kitchen.prep.inherited", "Uses {{m}} min from {{source}}", {
            m: inheritedMinutes,
            source: inheritedLabel || t("kitchen.prep.category", "category"),
          })}
        </p>
      ) : null}
    </div>
  );
}

/** "" or a whole number 1-240; anything else is treated as invalid by callers. */
export const isValidPrepInput = (value) => {
  if (value === "" || value === null || value === undefined) return true;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 240;
};
