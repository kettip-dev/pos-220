import React from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { DIETARY_TAGS, parseDietaryTags, dietaryTagLabel } from "../config/dietaryTags";

/**
 * Allergen / dietary badges.
 *  - variant "marks": tiny round marks (emoji or letters), for item tiles. Hover/long-press title gives the name.
 *  - variant "chips": mark + name, for menus and tickets.
 * `only` limits to "allergen" or "diet".
 */
export default function DietaryTagBadges({ tags, variant = "marks", only, max, className, onDark = false }) {
  const { t } = useTranslation();
  let list = parseDietaryTags(tags);
  if (only) list = list.filter((tag) => tag.kind === only);
  if (list.length === 0) return null;
  const shown = max ? list.slice(0, max) : list;
  const hidden = list.length - shown.length;

  if (variant === "chips") {
    return (
      <div className={clsx("flex flex-wrap gap-1", className)}>
        {shown.map((tag) => (
          <span
            key={tag.code}
            className={clsx(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold leading-tight",
              tag.kind === "allergen"
                ? "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
                : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
            )}
          >
            <Mark tag={tag} />
            {dietaryTagLabel(t, tag)}
          </span>
        ))}
        {hidden > 0 && <span className="text-[11px] font-bold text-gray-500">+{hidden}</span>}
      </div>
    );
  }

  const names = list.map((tag) => dietaryTagLabel(t, tag)).join(", ");
  return (
    <div className={clsx("flex items-center gap-0.5", className)} title={names} aria-label={names}>
      {shown.map((tag) => (
        <span
          key={tag.code}
          className={clsx(
            "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black leading-none",
            tag.kind === "allergen"
              ? onDark ? "bg-white/90 text-red-700" : "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-500/20 dark:text-red-200 dark:ring-0"
              : onDark ? "bg-emerald-500/90 text-white" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-0"
          )}
        >
          <Mark tag={tag} />
        </span>
      ))}
      {hidden > 0 && (
        <span className={clsx("text-[10px] font-bold", onDark ? "text-white/90" : "text-gray-500")}>+{hidden}</span>
      )}
    </div>
  );
}

function Mark({ tag }) {
  const isEmoji = /\p{Extended_Pictographic}/u.test(tag.mark);
  return <span className={isEmoji ? "text-[12px]" : ""}>{tag.mark}</span>;
}

/** Toggle chips for choosing tags on a menu item. */
export function DietaryTagPicker({ value, onChange }) {
  const { t } = useTranslation();
  const selected = new Set(parseDietaryTags(value).map((tag) => tag.code));
  const toggle = (code) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(DIETARY_TAGS.filter((tag) => next.has(tag.code)).map((tag) => tag.code));
  };

  const group = (kind, title) => (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</p>
      <div className="flex flex-wrap gap-2">
        {DIETARY_TAGS.filter((tag) => tag.kind === kind).map((tag) => {
          const on = selected.has(tag.code);
          return (
            <button
              type="button"
              key={tag.code}
              onClick={() => toggle(tag.code)}
              aria-pressed={on}
              className={clsx(
                "inline-flex min-h-[42px] items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition active:scale-95",
                on
                  ? kind === "allergen"
                    ? "bg-red-600 text-white shadow-sm"
                    : "bg-emerald-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700"
              )}
            >
              <Mark tag={tag} />
              {dietaryTagLabel(t, tag)}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {group("allergen", t("dietary.contains", "Contains"))}
      {group("diet", t("dietary.diet", "Dietary"))}
    </div>
  );
}
