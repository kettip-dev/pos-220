import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import clsx from "clsx";
import { IconArrowDown, IconArrowUp, IconClockPlus, IconPlus, IconTrash } from "@tabler/icons-react";
import { getKitchenDelayReasons, saveKitchenDelayReasons } from "../../controllers/kitchen.controller";
import { delayReasonLabel } from "./kdsUtils";

const ICON_SUGGESTIONS = ["🛒", "🔥", "👨‍🍳", "♻️", "🍽️", "⚡", "💧", "🧊", "🚚", "⏱"];

let tempId = 0;
const nextKey = () => `new-${++tempId}`;

/**
 * Settings card: the delay reasons the kitchen can pick on the KDS
 * (waiting for ingredients, no gas, ...) with a default extra time each.
 */
export default function KitchenDelayReasonsCard() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const fromServer = (list) =>
    (Array.isArray(list) ? list : []).map((r) => {
      // Stock reasons are shown in the user's language. If the owner leaves the
      // text alone we save the original label, so it stays translatable.
      const shown = delayReasonLabel(r.label, r.code, t);
      return {
        key: `id-${r.id}`,
        id: r.id,
        icon: r.icon || "",
        label: shown,
        shownLabel: shown,
        rawLabel: r.label,
        default_minutes: String(r.default_minutes ?? 5),
      };
    });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getKitchenDelayReasons();
        if (alive && res.status === 200) setRows(fromServer(res.data));
      } catch (error) {
        console.error(error);
        if (alive) toast.error(t("kitchen.delay.load_failed", "Could not load delay reasons"));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key, patch) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setIsDirty(true);
  };

  const move = (index, dir) => {
    setRows((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setIsDirty(true);
  };

  const remove = (key) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setIsDirty(true);
  };

  const add = () => {
    setRows((prev) => [...prev, { key: nextKey(), id: null, icon: "⏱", label: "", default_minutes: "5" }]);
    setIsDirty(true);
  };

  const save = async () => {
    const cleaned = rows.map((r) => ({
      ...r,
      label: r.rawLabel && r.label === r.shownLabel ? r.rawLabel : r.label.trim(),
    }));
    if (cleaned.some((r) => !r.label)) {
      toast.error(t("kitchen.delay.label_required", "Every reason needs a name"));
      return;
    }
    const bad = cleaned.find((r) => {
      const n = Number(r.default_minutes);
      return !Number.isInteger(n) || n < 0 || n > 240;
    });
    if (bad) {
      toast.error(t("kitchen.delay.minutes_invalid", "Extra time must be 0-240 minutes"));
      return;
    }
    setIsSaving(true);
    try {
      const res = await saveKitchenDelayReasons(
        cleaned.map((r) => ({ id: r.id, icon: r.icon || null, label: r.label, default_minutes: Number(r.default_minutes) }))
      );
      setRows(fromServer(res.data?.reasons));
      setIsDirty(false);
      toast.success(t("kitchen.delay.saved", "Delay reasons saved"));
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || t("kitchen.delay.save_failed", "Could not save delay reasons"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl border border-slate-200 dark:border-[#333] bg-white dark:bg-[#1e1e1e] shadow-sm overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 dark:border-[#2a2a2a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center shrink-0">
            <IconClockPlus size={22} stroke={1.8} />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900 dark:text-white">{t("kitchen.delay.settings_title", "Delay reasons")}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
              {t(
                "kitchen.delay.settings_desc",
                "The cook taps one on the kitchen screen to add time to a ticket. The cashier and waiters get an alert."
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!isDirty || isSaving}
          className={clsx(
            "min-h-[42px] px-4 rounded-xl text-sm font-semibold transition active:scale-95 shrink-0",
            isDirty && !isSaving ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-100 dark:bg-[#2a2a2a] text-slate-400"
          )}
        >
          {isSaving ? t("kitchen.delay.saving", "Saving...") : t("kitchen.delay.save", "Save reasons")}
        </button>
      </header>

      <div className="p-4 sm:p-5 flex flex-col gap-2.5">
        {isLoading ? (
          <div className="text-sm text-slate-500 py-4">{t("kitchen.delay.loading", "Loading...")}</div>
        ) : (
          <>
            {rows.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                {t("kitchen.delay.empty", "No reasons. The kitchen can still add time without one.")}
              </p>
            )}
            {rows.map((r, index) => (
              <div
                key={r.key}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#181818]"
              >
                <div className="dropdown">
                  <button
                    type="button"
                    tabIndex={0}
                    className="w-[46px] h-[46px] rounded-xl bg-white dark:bg-black border border-slate-200 dark:border-[#333] text-xl flex items-center justify-center active:scale-95"
                    aria-label={t("kitchen.delay.icon", "Icon")}
                  >
                    {r.icon || "⏱"}
                  </button>
                  <div tabIndex={0} className="dropdown-content z-20 mt-1 p-2 rounded-xl bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#333] shadow-xl grid grid-cols-5 gap-1 w-[240px]">
                    {ICON_SUGGESTIONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => update(r.key, { icon: ic })}
                        className="w-[42px] h-[42px] rounded-lg text-xl hover:bg-slate-100 dark:hover:bg-[#2a2a2a] active:scale-95"
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  value={r.label}
                  maxLength={80}
                  onChange={(e) => update(r.key, { label: e.target.value })}
                  placeholder={t("kitchen.delay.label_ph", "e.g. Waiting for ingredients")}
                  className="flex-1 min-w-[160px] min-h-[46px] text-sm rounded-xl px-3 border border-slate-200 dark:border-[#333] bg-white dark:bg-black"
                />
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  +
                  <input
                    value={r.default_minutes}
                    onChange={(e) => update(r.key, { default_minutes: e.target.value.replace(/[^0-9]/g, "").slice(0, 3) })}
                    inputMode="numeric"
                    aria-label={t("kitchen.delay.default_minutes", "Default extra minutes")}
                    className="w-[64px] min-h-[46px] text-sm text-center tabular-nums rounded-xl px-2 border border-slate-200 dark:border-[#333] bg-white dark:bg-black"
                  />
                  {t("kitchen.prep.min_unit", "min")}
                </label>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-[#2a2a2a] disabled:opacity-30 active:scale-95"
                    aria-label={t("kitchen.delay.move_up", "Move up")}
                  >
                    <IconArrowUp size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                    className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-[#2a2a2a] disabled:opacity-30 active:scale-95"
                    aria-label={t("kitchen.delay.move_down", "Move down")}
                  >
                    <IconArrowDown size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r.key)}
                    className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-95"
                    aria-label={t("kitchen.delay.remove", "Remove")}
                  >
                    <IconTrash size={18} />
                  </button>
                </div>
              </div>
            ))}
            {rows.length < 30 && (
              <button
                type="button"
                onClick={add}
                className="mt-1 min-h-[46px] rounded-xl border-2 border-dashed border-slate-200 dark:border-[#333] text-sm font-semibold text-slate-500 hover:text-emerald-600 hover:border-emerald-300 flex items-center justify-center gap-1.5 active:scale-[0.99]"
              >
                <IconPlus size={17} /> {t("kitchen.delay.add_reason", "Add reason")}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
