import React, { useEffect } from "react";
import { IconX } from "@tabler/icons-react";
import clsx from "clsx";
import { iconStroke } from "../../config/config";

/** Shared frame for the register dialogs: header, scrollable body, sticky footer. */
export default function RegisterModalShell({ isOpen, onClose, icon, title, subtitle, children, footer, size = "md", dismissable = true }) {
  useEffect(() => {
    if (!isOpen || !dismissable) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, dismissable, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div
        className={clsx(
          "w-full h-full sm:h-auto sm:max-h-[94vh] bg-white dark:bg-slate-900 sm:border border-slate-200 dark:border-slate-800 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-2xl",
          size === "lg" && "sm:max-w-4xl"
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          {dismissable && (
            <button
              type="button"
              onClick={onClose}
              className="w-[42px] h-[42px] rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
            >
              <IconX size={20} stroke={iconStroke} />
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ModalButton({ children, onClick, variant = "secondary", disabled = false, className, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "min-h-[48px] px-5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 active:scale-95 cursor-pointer select-none touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        variant === "primary" && "bg-restro-green hover:bg-restro-green-button-hover text-white shadow-sm",
        variant === "danger" && "bg-rose-600 hover:bg-rose-700 text-white shadow-sm",
        variant === "secondary" && "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800",
        className
      )}
    >
      {children}
    </button>
  );
}

export function FieldLabel({ children }) {
  return <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{children}</label>;
}

export const inputClass =
  "w-full h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500";
