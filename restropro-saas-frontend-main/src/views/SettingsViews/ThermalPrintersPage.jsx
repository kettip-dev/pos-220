import React, { useState } from "react";
import Page from "../../components/Page";
import DeleteModal from "../../components/DeleteModal";
import {
  IconPrinter,
  IconPlus,
  IconPencil,
  IconTrash,
  IconCheck,
  IconX,
  IconRefresh,
  IconFlame,
  IconReceipt,
  IconDeviceDesktop,
  IconAlertCircle,
  IconWifi,
  IconScissors,
  IconCash,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import ApiClient from "../../helpers/ApiClient";
import useSWR from "swr";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useKitchenStations } from "../../controllers/kitchen_stations.controller";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export default function ThermalPrintersPage() {
  const { t } = useTranslation();

  // Fetch thermal printer configs
  const {
    data: printerData,
    error: printerError,
    isLoading: isPrintersLoading,
    mutate: mutatePrinters,
  } = useSWR("/pos/printers", fetcher);

  const printers = printerData?.printerConfigs || [];

  // Fetch kitchen stations for routing mapping
  const { data: stations = [] } = useKitchenStations();

  // Modal & form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);
  const [deletePrinterId, setDeletePrinterId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingPrinterId, setTestingPrinterId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    ip: "192.168.1.200",
    port: "9100",
    paper_size: "80",
    is_default: false,
    is_kot_printer: false,
    auto_cut: true,
    station_id: "",
  });

  const openAddModal = () => {
    setEditingPrinter(null);
    setFormData({
      name: "",
      ip: "192.168.1.200",
      port: "9100",
      paper_size: "80",
      is_default: printers.length === 0,
      is_kot_printer: printers.length === 0,
      auto_cut: true,
      station_id: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (printer) => {
    setEditingPrinter(printer);
    const parts = (printer.address || "").split(":");
    setFormData({
      name: printer.name || "",
      ip: parts[0] || "192.168.1.200",
      port: parts[1] || "9100",
      paper_size: String(printer.paper_size || 80),
      is_default: Boolean(printer.is_default),
      is_kot_printer: Boolean(printer.is_kot_printer),
      auto_cut: Boolean(printer.auto_cut !== 0),
      station_id: printer.station_id ? String(printer.station_id) : "",
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const cleanIp = formData.ip.trim();
    const cleanPort = formData.port.trim() || "9100";

    if (!formData.name.trim()) {
      toast.error("Please enter a printer name.");
      return;
    }
    if (!cleanIp) {
      toast.error("Please enter a valid IP address.");
      return;
    }

    const fullAddress = `${cleanIp}:${cleanPort}`;
    setIsSubmitting(true);

    try {
      if (editingPrinter) {
        await ApiClient.patch(`/pos/printers/${editingPrinter.id}`, {
          name: formData.name.trim(),
          transport: "tcp",
          address: fullAddress,
          paper_size: Number(formData.paper_size),
          is_default: formData.is_default ? 1 : 0,
          is_kot_printer: formData.is_kot_printer ? 1 : 0,
          auto_cut: formData.auto_cut ? 1 : 0,
          station_id: formData.station_id ? Number(formData.station_id) : null,
        });
        toast.success("Printer configuration updated!");
      } else {
        await ApiClient.post("/pos/printers", {
          name: formData.name.trim(),
          transport: "tcp",
          address: fullAddress,
          paper_size: Number(formData.paper_size),
          is_default: formData.is_default ? 1 : 0,
          is_kot_printer: formData.is_kot_printer ? 1 : 0,
          auto_cut: formData.auto_cut ? 1 : 0,
          station_id: formData.station_id ? Number(formData.station_id) : null,
        });
        toast.success("Thermal printer added successfully!");
      }

      await mutatePrinters();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to save printer configuration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletePrinterId) return;
    try {
      await ApiClient.delete(`/pos/printers/${deletePrinterId}`);
      toast.success("Printer deleted.");
      await mutatePrinters();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete printer.");
    } finally {
      setDeletePrinterId(null);
    }
  };

  const handleTestPrint = async (printer) => {
    setTestingPrinterId(printer.id);
    const toastId = toast.loading(`Sending test receipt to ${printer.name} (${printer.address})...`);
    try {
      const res = await ApiClient.post(`/pos/printers/${printer.id}/test`);
      toast.dismiss(toastId);
      toast.success(res.data?.message || `Test print successful on ${printer.name}!`, { duration: 4000 });
    } catch (err) {
      toast.dismiss(toastId);
      const errMsg = err?.response?.data?.message || "Connection timed out. Check printer power & network cable.";
      toast.error(`Test print failed: ${errMsg}`, { duration: 6000 });
    } finally {
      setTestingPrinterId(null);
    }
  };

  return (
    <Page className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <IconPrinter size={24} stroke={iconStroke} />
            </div>
            <span>Thermal Printers (LAN / TCP)</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure direct network ESC/POS thermal printers for instant, silent receipt and kitchen printing.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="h-[42px] px-5 rounded-xl bg-restro-green hover:bg-emerald-600 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
        >
          <IconPlus size={18} stroke={iconStroke} />
          <span>Add Printer</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/10 flex items-start gap-3">
        <IconWifi className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" size={20} />
        <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
          <p className="font-semibold text-emerald-900 dark:text-emerald-300">
            Zero Browser Dialogs & 100% Unicode Support
          </p>
          <p className="leading-relaxed">
            Direct network printing streams 1-bit monochrome canvas raster images directly to your thermal printers on
            Port 9100. Any language (Thai, Vietnamese, Chinese, Japanese, Arabic, accents, emojis) prints with 100%
            fidelity in under 150ms.
          </p>
        </div>
      </div>

      {/* Printers Grid */}
      {isPrintersLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-gray-100 dark:bg-gray-800/40 animate-pulse" />
          ))}
        </div>
      ) : printers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <IconPrinter size={32} stroke={iconStroke} />
          </div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">No Thermal Printers Configured</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Connect your receipt and kitchen station thermal printers to your local Wi-Fi or LAN router, then click Add
            Printer to register their IP addresses.
          </p>
          <button
            onClick={openAddModal}
            className="h-[42px] px-6 rounded-xl bg-restro-green text-white text-xs font-semibold hover:bg-emerald-600 transition active:scale-95 inline-flex items-center gap-1.5 shadow-sm"
          >
            <IconPlus size={16} stroke={iconStroke} />
            <span>Add First Printer</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {printers.map((printer) => {
            const station = stations.find((s) => Number(s.id) === Number(printer.station_id));

            return (
              <div
                key={printer.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col justify-between hover:shadow-sm transition-all"
              >
                <div className="space-y-3">
                  {/* Top Bar: Name & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700">
                        <IconPrinter size={20} stroke={iconStroke} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight">
                          {printer.name}
                        </h4>
                        <span className="text-xs text-gray-500 font-mono">{printer.address}</span>
                      </div>
                    </div>

                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {printer.paper_size || 80}mm
                    </span>
                  </div>

                  {/* Feature Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {printer.is_default === 1 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50">
                        <IconReceipt size={12} />
                        <span>Default Receipt</span>
                      </span>
                    )}

                    {printer.is_kot_printer === 1 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/50">
                        <IconFlame size={12} />
                        <span>KOT Printer</span>
                      </span>
                    )}

                    {station && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50">
                        <span>Station: {station.name}</span>
                      </span>
                    )}

                    {printer.auto_cut !== 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-50 dark:bg-gray-800/60 text-gray-500">
                        <IconScissors size={12} />
                        <span>Auto-cut</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleTestPrint(printer)}
                    disabled={testingPrinterId === printer.id}
                    className="h-[38px] px-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <IconRefresh
                      size={14}
                      className={testingPrinterId === printer.id ? "animate-spin text-emerald-600" : ""}
                    />
                    <span>{testingPrinterId === printer.id ? "Testing..." : "Test Print"}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(printer)}
                      className="w-[38px] h-[38px] rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition active:scale-95"
                      title="Edit Printer"
                    >
                      <IconPencil size={16} stroke={iconStroke} />
                    </button>
                    <button
                      onClick={() => setDeletePrinterId(printer.id)}
                      className="w-[38px] h-[38px] rounded-xl border border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center justify-center transition active:scale-95"
                      title="Delete Printer"
                    >
                      <IconTrash size={16} stroke={iconStroke} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Printer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base flex items-center gap-2">
                <IconPrinter size={18} className="text-emerald-600" />
                <span>{editingPrinter ? "Edit Thermal Printer" : "Add Thermal Printer"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Printer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Kitchen Printer, Cashier Printer"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                />
              </div>

              {/* IP Address & Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    IP Address (LAN/Wi-Fi) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.1.200"
                    value={formData.ip}
                    onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                    className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Port</label>
                  <input
                    type="text"
                    placeholder="9100"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    className="w-full h-[42px] px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              {/* Paper Size */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Paper Width
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paper_size: "80" })}
                    className={`h-[42px] rounded-xl border text-xs font-semibold transition active:scale-95 flex items-center justify-center gap-2 ${
                      formData.paper_size === "80"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span>80mm (Standard)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paper_size: "58" })}
                    className={`h-[42px] rounded-xl border text-xs font-semibold transition active:scale-95 flex items-center justify-center gap-2 ${
                      formData.paper_size === "58"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span>58mm (Narrow)</span>
                  </button>
                </div>
              </div>

              {/* Station Binding */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Assign to Kitchen Station (Optional)
                </label>
                <select
                  value={formData.station_id}
                  onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                  className="w-full h-[42px] px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-100 outline-none"
                >
                  <option value="">-- None (General / Cashier) --</option>
                  {stations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} (Station #{st.id})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Items assigned to this station will automatically route to this printer when creating orders.
                </p>
              </div>

              {/* Toggles */}
              <div className="pt-2 space-y-2.5 border-t border-gray-100 dark:border-gray-800">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Set as Default Receipt Printer
                  </span>
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Set as Default Kitchen KOT Printer
                  </span>
                  <input
                    type="checkbox"
                    checked={formData.is_kot_printer}
                    onChange={(e) => setFormData({ ...formData, is_kot_printer: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Auto-Cut Paper After Printing
                  </span>
                  <input
                    type="checkbox"
                    checked={formData.auto_cut}
                    onChange={(e) => setFormData({ ...formData, auto_cut: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-[42px] px-5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-[42px] px-6 rounded-xl bg-restro-green hover:bg-emerald-600 text-white text-xs font-semibold transition active:scale-95 shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting && <IconRefresh size={14} className="animate-spin" />}
                  <span>{editingPrinter ? "Update Printer" : "Save Printer"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(deletePrinterId)}
        onClose={() => setDeletePrinterId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Printer"
        description="Are you sure you want to remove this printer? Station routing rules associated with this printer will be unassigned."
      />
    </Page>
  );
}
