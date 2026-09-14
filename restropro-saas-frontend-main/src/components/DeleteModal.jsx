import React, { useEffect } from "react";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import { useTranslation } from "react-i18next";

/**
 * Reusable Global Delete Confirmation Modal
 *
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Called on cancel / close request
 * @param {function} onConfirm - Called on confirmation button click
 * @param {string} [title] - Custom modal title (defaults to translated "Delete Item")
 * @param {string} [description] - Custom modal description / body text
 * @param {string} [itemName] - Name/Title of item being deleted to highlight in a badge
 * @param {string} [warningMessage] - Additional warning message callout box text
 * @param {string} [confirmText] - Text for delete button (defaults to "Yes, Delete!")
 * @param {string} [cancelText] - Text for cancel button (defaults to "Cancel")
 * @param {boolean} [isLoading=false] - Shows loading spinner on confirm button while deleting
 * @param {boolean} [requireReason=false] - Shows a mandatory reason textarea; confirm stays disabled until filled
 * @param {string} [reason] - Controlled value for the reason textarea
 * @param {function} [onReasonChange] - Called with the new reason text as it's typed
 * @param {string} [reasonLabel] - Label shown above the reason textarea
 * @param {string} [reasonPlaceholder] - Placeholder text for the reason textarea
 */
export default function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  warningMessage,
  confirmText,
  cancelText,
  isLoading = false,
  requireReason = false,
  reason = "",
  onReasonChange,
  reasonLabel,
  reasonPlaceholder,
}) {
  const { t } = useTranslation();
  const confirmDisabled = isLoading || (requireReason && !reason.trim());

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-[#1f1f1f] border border-restro-border-green rounded-2xl max-w-md w-full p-6 shadow-2xl transition-all transform scale-100 relative text-restro-text"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-50"
          type="button"
          aria-label="Close modal"
        >
          <IconX size={18} stroke={iconStroke} />
        </button>

        <div className="flex items-start gap-4 mb-3">
          <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center shrink-0 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400">
            <IconAlertTriangle stroke={iconStroke} size={24} />
          </div>
          <div className="pr-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-snug">
              {title || t("common.delete_title", "Delete Item")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {description ||
                t(
                  "common.delete_confirm_desc",
                  "Are you sure you want to delete this item? This action is irreversible."
                )}
            </p>
          </div>
        </div>

        {warningMessage && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 font-medium">
            {warningMessage}
          </div>
        )}

        {requireReason && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-restro-text mb-1.5">
              {reasonLabel || t("common.reason_label", "Reason")}
              <span className="text-red-500"> *</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange?.(e.target.value)}
              disabled={isLoading}
              rows={3}
              placeholder={reasonPlaceholder || t("common.reason_placeholder", "Enter a reason...")}
              className="w-full rounded-xl border border-restro-border-green bg-restro-card-bg px-3 py-2 text-sm text-restro-text placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:opacity-50"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-restro-border-green px-4 py-2.5 text-sm font-medium text-restro-text bg-restro-card-bg hover:bg-restro-button-hover transition active:scale-95 disabled:opacity-50"
          >
            {cancelText || t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="rounded-xl border border-red-500 dark:border-red-700 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-95 transition shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[100px]"
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              confirmText || t("common.yes_delete", "Yes, Delete!")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
