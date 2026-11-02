import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { IconLock, IconX, IconBackspace, IconCheck } from "@tabler/icons-react";
import { verifyManagerPin } from "../../controllers/shift_roster.controller";
import clsx from "clsx";

export default function ManagerPinModal({
  isOpen,
  onClose,
  onSuccess,
  title,
  description,
}) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError("");
      setIsLoading(false);
    }
  }, [isOpen]);

  // Physical keyboard support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key >= "0" && e.key <= "9") {
        if (pin.length < 6) {
          setPin((prev) => (prev.length < 6 ? prev + e.key : prev));
          setError("");
        }
      } else if (e.key === "Backspace") {
        setPin((prev) => prev.slice(0, -1));
        setError("");
      } else if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && pin.length >= 4) {
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, pin]);

  if (!isOpen) return null;

  const handleDigit = (digit) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setError("");
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  };

  const handleClear = () => {
    setPin("");
    setError("");
  };

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError(t("shift_roster.pin_min_digits", "PIN must be at least 4 digits"));
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      const res = await verifyManagerPin(pin);
      if (res.data?.success) {
        onSuccess(pin, res.data?.manager);
        onClose();
      } else {
        setError(res.data?.message || t("shift_roster.invalid_manager_pin", "Invalid Manager PIN"));
        setPin("");
      }
    } catch (err) {
      setError(err?.response?.data?.message || t("shift_roster.invalid_manager_pin", "Invalid Manager PIN"));
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <IconLock size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {title || t("shift_roster.manager_auth_title", "Manager Authorization")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {description || t("shift_roster.manager_auth_desc", "Enter 4-6 digit Manager Quick PIN")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* PIN Display Dots */}
        <div className="py-6 flex flex-col items-center justify-center bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className={clsx(
                  "w-4 h-4 rounded-full transition-all duration-150 border-2",
                  idx < pin.length
                    ? "bg-amber-500 border-amber-500 scale-110 shadow-xs shadow-amber-500/50"
                    : "border-slate-300 dark:border-slate-700 bg-transparent"
                )}
              />
            ))}
          </div>

          {error && (
            <div className="mt-3 text-xs font-semibold text-rose-500 dark:text-rose-400 text-center px-4 animate-shake">
              {error}
            </div>
          )}
        </div>

        {/* Touch Numpad */}
        <div className="p-4 grid grid-cols-3 gap-2 bg-white dark:bg-slate-900">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-13 rounded-2xl bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-2xl font-mono font-bold border border-slate-200/80 dark:border-slate-700/80 transition active:scale-95 flex items-center justify-center cursor-pointer select-none touch-manipulation shadow-2xs"
            >
              {digit}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClear}
            className="h-13 rounded-2xl bg-slate-100/60 hover:bg-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border border-slate-200/80 dark:border-slate-700/80 transition active:scale-95 flex items-center justify-center cursor-pointer select-none touch-manipulation"
          >
            {t("common.clear", "Clear")}
          </button>

          {/* 0 Button */}
          <button
            type="button"
            onClick={() => handleDigit("0")}
            className="h-13 rounded-2xl bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-2xl font-mono font-bold border border-slate-200/80 dark:border-slate-700/80 transition active:scale-95 flex items-center justify-center cursor-pointer select-none touch-manipulation shadow-2xs"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-13 rounded-2xl bg-slate-100/60 hover:bg-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 transition active:scale-95 flex items-center justify-center cursor-pointer select-none touch-manipulation"
          >
            <IconBackspace size={22} />
          </button>
        </div>

        {/* Action Button */}
        <div className="p-4 pt-1 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            disabled={pin.length < 4 || isLoading}
            onClick={handleSubmit}
            className="flex-1 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-bold transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/20"
          >
            <IconCheck size={18} />
            <span>{isLoading ? t("common.verifying", "Verifying...") : t("common.authorize", "Authorize")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
