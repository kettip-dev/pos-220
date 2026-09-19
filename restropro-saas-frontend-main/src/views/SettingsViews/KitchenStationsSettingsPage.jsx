import React, { useState, useEffect } from "react";
import Page from "../../components/Page";
import DeleteModal from "../../components/DeleteModal";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconFlame,
  IconChefHat,
  IconGlassFull,
  IconCoffee,
  IconMeat,
  IconFish,
  IconCake,
  IconToolsKitchen2,
  IconPrinter,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconSwitchHorizontal,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import {
  useKitchenStations,
  addKitchenStation,
  updateKitchenStation,
  deleteKitchenStation,
} from "../../controllers/kitchen_stations.controller";
import ApiClient from "../../helpers/ApiClient";
import toast from "react-hot-toast";
import { mutate } from "swr";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import clsx from "clsx";

export const STATION_ICONS = [
  { id: "Flame", label: "Flame", icon: IconFlame },
  { id: "ChefHat", label: "Chef Hat", icon: IconChefHat },
  { id: "GlassFull", label: "Bar / Glass", icon: IconGlassFull },
  { id: "Coffee", label: "Coffee / Drinks", icon: IconCoffee },
  { id: "Meat", label: "Grill / Meat", icon: IconMeat },
  { id: "Fish", label: "Seafood / Sushi", icon: IconFish },
  { id: "Cake", label: "Bakery / Dessert", icon: IconCake },
  { id: "ToolsKitchen2", label: "Kitchen", icon: IconToolsKitchen2 },
];

export const STATION_COLORS = [
  { hex: "#f97316", name: "Orange" },
  { hex: "#ef4444", name: "Red" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#10b981", name: "Emerald" },
  { hex: "#8b5cf6", name: "Purple" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#eab308", name: "Yellow" },
  { hex: "#14b8a6", name: "Teal" },
];

export function renderStationIcon(iconName, color = "#f97316", size = 20) {
  const found = STATION_ICONS.find((item) => item.id === iconName);
  const IconComponent = found ? found.icon : IconFlame;
  return <IconComponent size={size} stroke={iconStroke} style={{ color }} />;
}

export default function KitchenStationsSettingsPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const { APIURL, data: stations, error, isLoading } = useKitchenStations();

  // Printers list for routing assignment
  const [printers, setPrinters] = useState([]);
  const [isPrintersLoading, setIsPrintersLoading] = useState(false);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editStation, setEditStation] = useState(null); // station object when editing
  const [deleteStationId, setDeleteStationId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    color: "#f97316",
    icon: "Flame",
    printer_id: "",
    is_enabled: true,
  });

  // Fetch available thermal printers from backend
  useEffect(() => {
    async function fetchPrinters() {
      setIsPrintersLoading(true);
      try {
        const res = await ApiClient.get("/pos/printers");
        if (res.data?.printerConfigs) {
          setPrinters(res.data.printerConfigs);
        }
      } catch (err) {
        console.error("Failed to load printers for kitchen stations:", err);
      } finally {
        setIsPrintersLoading(false);
      }
    }
    fetchPrinters();
  }, []);

  const openAddModal = () => {
    setFormData({
      name: "",
      color: "#f97316",
      icon: "Flame",
      printer_id: "",
      is_enabled: true,
    });
    setEditStation(null);
    setIsAddOpen(true);
  };

  const openEditModal = (station) => {
    setFormData({
      name: station.name,
      color: station.color || "#f97316",
      icon: station.icon || "Flame",
      printer_id: station.printer_id ? String(station.printer_id) : "",
      is_enabled: station.is_enabled === 1 || station.is_enabled === true,
    });
    setEditStation(station);
    setIsAddOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Please enter a station name");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editStation) {
        await updateKitchenStation(editStation.id, {
          name: formData.name.trim(),
          color: formData.color,
          icon: formData.icon,
          printer_id: formData.printer_id ? Number(formData.printer_id) : null,
          is_enabled: formData.is_enabled ? 1 : 0,
        });
        toast.success("Station updated successfully");
      } else {
        await addKitchenStation({
          name: formData.name.trim(),
          color: formData.color,
          icon: formData.icon,
          printer_id: formData.printer_id ? Number(formData.printer_id) : null,
          is_enabled: formData.is_enabled ? 1 : 0,
        });
        toast.success("Station added successfully");
      }
      await mutate(APIURL);
      setIsAddOpen(false);
      setEditStation(null);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to save station";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteStationId) return;
    try {
      toast.loading("Deleting station...");
      await deleteKitchenStation(deleteStationId);
      await mutate(APIURL);
      toast.dismiss();
      toast.success("Station deleted successfully");
      setDeleteStationId(null);
    } catch (err) {
      toast.dismiss();
      const msg = err?.response?.data?.message || "Failed to delete station";
      toast.error(msg);
    }
  };

  const handleToggleActive = async (station) => {
    try {
      const newStatus = station.is_enabled ? 0 : 1;
      await updateKitchenStation(station.id, { is_enabled: newStatus });
      await mutate(APIURL);
      toast.success(`${station.name} is now ${newStatus ? "active" : "inactive"}`);
    } catch (err) {
      toast.error("Failed to update station status");
    }
  };

  if (isLoading) {
    return (
      <Page className="px-6 py-8">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="loading loading-spinner loading-md"></div>
          <span>Loading kitchen stations...</span>
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page className="px-6 py-8">
        <div className="alert alert-error">
          <IconAlertCircle stroke={iconStroke} />
          <span>Error loading kitchen stations. Please try again.</span>
        </div>
      </Page>
    );
  }

  return (
    <Page className="px-6 py-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Kitchen Stations
            </h1>
            <span className="badge badge-sm bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border-none font-semibold">
              KDS & KOT Routing
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Split kitchen orders into dedicated prep stations (Hot Kitchen, Bar, Grill, Bakery) and route KOT print jobs directly to each station&apos;s thermal printer.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-sm gap-2 h-10 min-h-0 px-4 rounded-xl normal-case font-medium"
        >
          <IconPlus size={18} stroke={iconStroke} />
          <span>Add Station</span>
        </button>
      </div>

      {/* Stations List / Empty State */}
      {(!stations || stations.length === 0) ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-[#333] p-12 text-center flex flex-col items-center justify-center bg-white/50 dark:bg-[#1a1a1a]/50">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-orange-500 flex items-center justify-center mb-4">
            <IconFlame size={32} stroke={iconStroke} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Kitchen Stations Yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-6">
            By default, all orders appear together in the master kitchen. Create stations to split items by Bar, Hot Kitchen, Cold Prep, or Bakery.
          </p>
          <button
            onClick={openAddModal}
            className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 text-white border-none gap-2 rounded-xl"
          >
            <IconPlus size={18} stroke={iconStroke} />
            <span>Create First Station</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stations.map((station) => {
            const isEnabled = station.is_enabled === 1 || station.is_enabled === true;

            return (
              <div
                key={station.id}
                className={clsx(
                  "rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col bg-white dark:bg-[#1e1e1e] shadow-sm hover:shadow-md",
                  isEnabled
                    ? "border-slate-200 dark:border-[#2f2f2f]"
                    : "border-slate-200/60 dark:border-[#262626] opacity-75"
                )}
              >
                {/* Station Color Strip Header */}
                <div
                  className="h-2 w-full"
                  style={{ backgroundColor: station.color || "#f97316" }}
                />

                <div className="p-5 flex-1 flex flex-col justify-between">
                  {/* Card Top: Icon, Name & Status Switch */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center shadow-inner"
                          style={{
                            backgroundColor: `${station.color || "#f97316"}20`,
                          }}
                        >
                          {renderStationIcon(station.icon, station.color, 24)}
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                            {station.name}
                          </h3>
                          <span
                            className={clsx(
                              "inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-md",
                              isEnabled
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-slate-400"
                            )}
                          >
                            {isEnabled ? "Active Station" : "Disabled"}
                          </span>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleToggleActive(station)}
                        className="toggle toggle-sm toggle-success"
                        title={isEnabled ? "Click to disable station" : "Click to enable station"}
                      />
                    </div>

                    {/* Routing Details */}
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#2a2a2a] space-y-2.5">
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <IconPrinter size={15} className="text-slate-400 shrink-0" stroke={iconStroke} />
                        <span className="font-medium truncate">
                          {station.printer_name ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              🖨️ {station.printer_name} ({station.printer_transport})
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">
                              Default KOT Printer
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#252525] px-3 py-2 rounded-xl">
                        <span>
                          <strong className="text-slate-800 dark:text-slate-200">{station.category_count || 0}</strong> categories
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span>
                          <strong className="text-slate-800 dark:text-slate-200">{station.item_count || 0}</strong> menu items
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-[#2a2a2a] flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(station)}
                      className="btn btn-sm btn-ghost hover:bg-slate-100 dark:hover:bg-[#2a2a2a] text-slate-700 dark:text-slate-300 normal-case rounded-lg px-2.5 h-8 min-h-0 gap-1.5"
                    >
                      <IconPencil size={15} stroke={iconStroke} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteStationId(station.id)}
                      className="btn btn-sm btn-ghost hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-400 normal-case rounded-lg px-2.5 h-8 min-h-0 gap-1.5"
                    >
                      <IconTrash size={15} stroke={iconStroke} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Station Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-[#333] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-[#2e2e2e] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${formData.color}25` }}
                >
                  {renderStationIcon(formData.icon, formData.color, 20)}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {editStation ? "Edit Kitchen Station" : "New Kitchen Station"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Define station identifier, icon, color badge, and printer.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="btn btn-sm btn-circle btn-ghost text-slate-400"
              >
                <IconX size={18} stroke={iconStroke} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5">
              {/* Station Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Station Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hot Kitchen, Bar, Grill, Bakery"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input input-bordered w-full text-sm bg-white dark:bg-[#252525] border-slate-200 dark:border-[#3a3a3a] rounded-xl focus:border-emerald-500"
                />
              </div>

              {/* Station Color Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Station Badge Color
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  {STATION_COLORS.map((col) => {
                    const isSelected = formData.color === col.hex;
                    return (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: col.hex })}
                        className={clsx(
                          "w-8 h-8 rounded-full transition-transform flex items-center justify-center",
                          isSelected ? "ring-2 ring-offset-2 ring-emerald-500 scale-110" : "hover:scale-105"
                        )}
                        style={{ backgroundColor: col.hex }}
                        title={col.name}
                      >
                        {isSelected && <IconCheck size={16} className="text-white drop-shadow" stroke={2.5} />}
                      </button>
                    );
                  })}
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-8 h-8 rounded-full border-none p-0 cursor-pointer overflow-hidden bg-transparent"
                    title="Custom color"
                  />
                </div>
              </div>

              {/* Station Icon Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Station Icon
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {STATION_ICONS.map((item) => {
                    const isSelected = formData.icon === item.id;
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: item.id })}
                        className={clsx(
                          "flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all gap-1.5",
                          isSelected
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-semibold"
                            : "border-slate-200 dark:border-[#333] hover:bg-slate-50 dark:hover:bg-[#282828] text-slate-600 dark:text-slate-300"
                        )}
                      >
                        <IconComp size={20} stroke={iconStroke} style={{ color: isSelected ? formData.color : undefined }} />
                        <span className="truncate max-w-full text-[11px]">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Designated Thermal Printer */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Designated Thermal Printer
                  </label>
                  <span className="text-[11px] text-slate-400">Optional</span>
                </div>
                <select
                  value={formData.printer_id}
                  onChange={(e) => setFormData({ ...formData, printer_id: e.target.value })}
                  className="select select-bordered w-full text-sm bg-white dark:bg-[#252525] border-slate-200 dark:border-[#3a3a3a] rounded-xl focus:border-emerald-500"
                >
                  <option value="">No dedicated printer (Uses default KOT printer)</option>
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.transport.toUpperCase()} - {p.address || "Local"}) {p.is_kot_printer ? "★ KOT" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  When enabled, KOT print jobs for this station will automatically route to this printer.
                </p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-[#252525] p-3.5 rounded-xl">
                <div>
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Station Active</h4>
                  <p className="text-[11px] text-slate-400">Active stations appear in the KDS top bar</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_enabled}
                  onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                  className="toggle toggle-success toggle-sm"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#2e2e2e]">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="btn btn-sm btn-ghost rounded-xl normal-case"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-sm btn-primary bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-xl normal-case px-5 gap-2"
                >
                  {isSubmitting && <span className="loading loading-spinner loading-xs"></span>}
                  <span>{editStation ? "Save Changes" : "Create Station"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteStationId && (
        <DeleteModal
          isOpen={true}
          title="Delete Kitchen Station?"
          message="Deleting this station will unassign any categories and menu items currently routed here. They will automatically revert to the master kitchen. This action cannot be undone."
          onClose={() => setDeleteStationId(null)}
          onConfirm={handleDelete}
        />
      )}
    </Page>
  );
}
