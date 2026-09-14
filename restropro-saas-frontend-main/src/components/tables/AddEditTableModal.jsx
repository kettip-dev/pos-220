import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { IconInfoCircle } from "@tabler/icons-react";

export default function AddEditTableModal({
  isOpen,
  onClose,
  onSave,
  initialData = null,
  currentFloor = "1",
}) {
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [floor, setFloor] = useState(currentFloor || "1");
  const [shape, setShape] = useState("round");
  const [seatingCapacity, setSeatingCapacity] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.table_title || "");
      setFloor(initialData.floor || currentFloor || "1");
      setShape(initialData.shape || "round");
      setSeatingCapacity(initialData.seating_capacity || 2);
    } else {
      setTitle("");
      setFloor(currentFloor || "1");
      setShape("round");
      setSeatingCapacity(2);
    }
  }, [initialData, currentFloor, isOpen]);

  const handleShapeChange = (newShape) => {
    setShape(newShape);
    if (newShape === "round") setSeatingCapacity(2);
    else if (newShape === "square") setSeatingCapacity(4);
    else if (newShape === "rectangle") setSeatingCapacity(6);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setIsSubmitting(true);
      await onSave({
        id: initialData?.id,
        table_title: title.trim(),
        floor: floor.trim() || "1",
        seating_capacity: Number(seatingCapacity) || 2,
        shape,
        rotation: initialData?.rotation || 0,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 p-6">
        <h3 className="text-xl font-semibold text-center text-gray-900 dark:text-white mb-6">
          {initialData ? t("table_settings.update_table", "Edit Table") : t("table_settings.add_new_table", "Add Table")}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("table_settings.title", "Table Name / Number")} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 21"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm outline-none transition"
            />
            <p className="text-xs text-gray-400 mt-1">
              {t("tables.name_hint", "The table name or number displayed on the floor plan")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("table_settings.floor", "Floor")} *
              </label>
              <input
                type="text"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="e.g. 1"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("tables.type", "Type / Shape")} *
              </label>
              <select
                value={shape}
                onChange={(e) => handleShapeChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm outline-none transition"
              >
                <option value="round">{t("tables.small_round", "Small (Round - 2)")}</option>
                <option value="square">{t("tables.medium_square", "Medium (Square - 4)")}</option>
                <option value="rectangle">{t("tables.large_rect", "Large (Rectangle - 6)")}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("table_settings.seating_capacity", "Seating Capacity")}
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={seatingCapacity}
              onChange={(e) => setSeatingCapacity(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm outline-none transition"
            />
          </div>

          {/* Info callout matching Figma */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-100 dark:bg-zinc-800 text-xs text-gray-600 dark:text-gray-300">
            <IconInfoCircle size={18} className="shrink-0 text-gray-500 mt-0.5" />
            <p>
              {t(
                "tables.capacity_info",
                "Default capacities per table type: Small: 2 seats, Medium: 4 seats, Large: 6 seats."
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 text-sm font-medium transition active:scale-95"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition shadow-sm active:scale-95"
            >
              {isSubmitting
                ? t("common.saving", "Saving...")
                : initialData
                ? t("common.save", "Save")
                : t("common.add", "Add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
