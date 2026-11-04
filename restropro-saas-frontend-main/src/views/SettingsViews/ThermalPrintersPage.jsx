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
  IconUsb,
  IconServer,
  IconCopy,
  IconKey,
  IconClock,
  IconRadar,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import ApiClient from "../../helpers/ApiClient";
import useSWR from "swr";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useKitchenStations } from "../../controllers/kitchen_stations.controller";
import useConfirm from "../../hooks/useConfirm";
import { Link } from "react-router-dom";
import { mutate as globalMutate } from "swr";
import { usePrintSettings, savePrintSettings } from "../../controllers/settings.controller";

const PRINT_MODE_LABELS = {
  browser: "Browser Print",
  direct_escpos: "Android (RawBT)",
};

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

const EMPTY_FORM = {
  name: "",
  transport: "tcp",
  ip: "",
  port: "9100",
  usb_name: "",
  agent_id: "",
  paper_size: "80",
  is_default: false,
  is_kot_printer: false,
  auto_cut: true,
  station_id: "",
};

const JOB_STATUS_STYLES = {
  printed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  queued: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  sending: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function ThermalPrintersPage() {
  const { t } = useTranslation();
  const [confirm, ConfirmDialog] = useConfirm();

  // Fetch thermal printer configs
  const {
    data: printerData,
    error: printerError,
    isLoading: isPrintersLoading,
    mutate: mutatePrinters,
  } = useSWR("/pos/printers", fetcher);

  const printers = printerData?.printerConfigs || [];

  // Print agents (restaurant-side relays) and recent print jobs, refreshed live
  const { data: agentData, mutate: mutateAgents } = useSWR("/pos/print-agents", fetcher, { refreshInterval: 10000 });
  const agents = agentData?.printAgents || [];
  const { data: jobData, mutate: mutateJobs } = useSWR("/pos/print-jobs?limit=15", fetcher, { refreshInterval: 10000 });
  const printJobs = jobData?.printJobs || [];

  // Fetch kitchen stations for routing mapping
  const { data: stations = [] } = useKitchenStations();

  // These printers are only used when Print Settings → Printing Mode is "Direct Network".
  const { data: printSettings, APIURL: printSettingsUrl } = usePrintSettings();
  const printMode = printSettings?.printMode || "browser";
  const isPrintersInUse = printMode === "direct_tcp";
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const handleUseThesePrinters = async () => {
    if (!printSettings) return;
    setIsSwitchingMode(true);
    try {
      const s = printSettings;
      await savePrintSettings(
        s.pageFormat ?? "80",
        s.header ?? "",
        s.footer ?? "",
        s.showNotes ?? true,
        s.isEnablePrint ?? true,
        s.showStoreDetails ?? true,
        s.showCustomerDetails ?? true,
        s.printToken ?? false,
        "direct_tcp",
        s.autoCut ?? true,
        s.cashDrawerKick ?? true
      );
      await globalMutate(printSettingsUrl);
      toast.success("Printing Mode switched to Direct Network. Receipts and KOT now use these printers.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to switch printing mode.");
    } finally {
      setIsSwitchingMode(false);
    }
  };

  // Modal & form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);
  const [deletePrinterId, setDeletePrinterId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingPrinterId, setTestingPrinterId] = useState(null);

  // Agent states
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [issuedToken, setIssuedToken] = useState(null); // { agentName, token }
  const [deleteAgentId, setDeleteAgentId] = useState(null);
  const [retryingJobId, setRetryingJobId] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);

  const selectedAgent = agents.find((a) => String(a.id) === String(formData.agent_id));
  const [scanningAgentId, setScanningAgentId] = useState(null);

  // Ask the agent to look for network printers again (it also scans when it connects).
  const scanAgentNetwork = async (agent) => {
    if (!agent) return;
    setScanningAgentId(agent.id);
    try {
      const res = await ApiClient.post(`/pos/print-agents/${agent.id}/scan`);
      const count = res.data?.network_printers?.length || 0;
      toast.success(count ? `Found ${count} network printer(s).` : "No network printers found.");
      await mutateAgents();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not scan for printers.");
    } finally {
      setScanningAgentId(null);
    }
  };

  // Which saved printer (other than the one being edited) already uses this address.
  const printerUsing = (transport, address) =>
    printers.find((p) => p.transport === transport && p.address === address && p.id !== editingPrinter?.id);

  const pickNetworkPrinter = (address) => {
    const [ip, port] = address.split(":");
    setFormData((prev) => ({ ...prev, ip, port: port || "9100" }));
  };

  const openAddModal = () => {
    setEditingPrinter(null);
    setFormData({
      ...EMPTY_FORM,
      agent_id: agents.length === 1 ? String(agents[0].id) : "",
      is_default: printers.length === 0,
      is_kot_printer: printers.length === 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (printer) => {
    setEditingPrinter(printer);
    const isUsb = printer.transport === "usb";
    const parts = isUsb ? [] : (printer.address || "").split(":");
    setFormData({
      name: printer.name || "",
      transport: isUsb ? "usb" : "tcp",
      ip: parts[0] || "",
      port: parts[1] || "9100",
      usb_name: isUsb ? printer.address || "" : "",
      agent_id: printer.agent_id ? String(printer.agent_id) : "",
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
    const isUsb = formData.transport === "usb";
    const cleanIp = formData.ip.trim();
    const cleanPort = formData.port.trim() || "9100";
    const usbName = formData.usb_name.trim();

    if (!formData.name.trim()) {
      toast.error("Please enter a printer name.");
      return;
    }
    if (isUsb && !formData.agent_id) {
      toast.error("USB printers need a print agent. Add an agent first, then select it.");
      return;
    }
    if (isUsb ? !usbName : !cleanIp) {
      toast.error(isUsb ? "Please enter the installed printer name." : "Please enter a valid IP address.");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      transport: formData.transport,
      address: isUsb ? usbName : `${cleanIp}:${cleanPort}`,
      agent_id: formData.agent_id ? Number(formData.agent_id) : null,
      paper_size: Number(formData.paper_size),
      is_default: formData.is_default ? 1 : 0,
      is_kot_printer: formData.is_kot_printer ? 1 : 0,
      auto_cut: formData.auto_cut ? 1 : 0,
      station_id: formData.station_id ? Number(formData.station_id) : null,
    };
    setIsSubmitting(true);

    try {
      if (editingPrinter) {
        await ApiClient.patch(`/pos/printers/${editingPrinter.id}`, payload);
        toast.success("Printer configuration updated!");
      } else {
        await ApiClient.post("/pos/printers", payload);
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
      if (res.data?.status === "printed") {
        toast.success(res.data?.message || `Test print successful on ${printer.name}!`, { duration: 4000 });
      } else {
        toast(res.data?.message || "Test print queued.", { icon: "⏳", duration: 6000 });
      }
    } catch (err) {
      toast.dismiss(toastId);
      const errMsg = err?.response?.data?.message || "Connection timed out. Check printer power & network cable.";
      toast.error(`Test print failed: ${errMsg}`, { duration: 6000 });
    } finally {
      setTestingPrinterId(null);
      mutateJobs();
    }
  };

  // ─── Print agents ───────────────────────────────────────

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    const name = agentName.trim();
    if (!name) {
      toast.error("Please enter a name for this agent.");
      return;
    }
    setIsCreatingAgent(true);
    try {
      const res = await ApiClient.post("/pos/print-agents", { name });
      setIssuedToken({ agentName: name, token: res.data.token });
      setIsAgentModalOpen(false);
      setAgentName("");
      await mutateAgents();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create print agent.");
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const handleRegenerateToken = async (agent) => {
    if (!(await confirm({ title: t("settings.regenerate_token_title", "Regenerate Token"), description: t("settings.confirm_regenerate_token", { name: agent.name, defaultValue: 'Regenerate the token for "{{name}}"? The agent will disconnect until you run it with the new token.' }), confirmText: t("settings.regenerate_action", "Regenerate") }))) {
      return;
    }
    try {
      const res = await ApiClient.post(`/pos/print-agents/${agent.id}/regenerate-token`);
      setIssuedToken({ agentName: agent.name, token: res.data.token });
      await mutateAgents();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to regenerate token.");
    }
  };

  const handleDeleteAgentConfirm = async () => {
    if (!deleteAgentId) return;
    try {
      await ApiClient.delete(`/pos/print-agents/${deleteAgentId}`);
      toast.success("Print agent removed.");
      await Promise.all([mutateAgents(), mutatePrinters()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to remove print agent.");
    } finally {
      setDeleteAgentId(null);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (_) {
      toast.error("Copy failed. Select the text and copy it manually.");
    }
  };

  const handleRetryJob = async (job) => {
    setRetryingJobId(job.id);
    try {
      const res = await ApiClient.post(`/pos/print-jobs/${job.id}/retry`);
      if (res.data?.status === "printed") toast.success(res.data.message || "Reprinted.");
      else toast(res.data?.message || "Job queued.", { icon: "⏳" });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Reprint failed.");
    } finally {
      setRetryingJobId(null);
      mutateJobs();
    }
  };

  const agentInstallCommand = issuedToken
    ? `node src/index.js --server ${window.location.origin} --token ${issuedToken.token}`
    : "";

  return (
    <Page className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <IconPrinter size={24} stroke={iconStroke} />
            </div>
            <span>Thermal Printers</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure LAN and USB ESC/POS thermal printers for instant, silent receipt and kitchen printing.
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

      {/* Not-in-use warning: printers here are ignored unless Printing Mode = Direct Network */}
      {printSettings && !isPrintersInUse && (
        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 flex flex-col md:flex-row md:items-center gap-3">
          <IconAlertCircle className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
          <div className="flex-1 text-xs text-gray-700 dark:text-gray-300 space-y-1">
            <p className="font-semibold text-amber-900 dark:text-amber-300">
              These printers are not being used
            </p>
            <p className="leading-relaxed">
              Printing Mode in <Link to="/dashboard/settings/print-settings" className="underline font-medium">Print Settings</Link> is
              set to <strong>{PRINT_MODE_LABELS[printMode] || printMode}</strong>, so receipts and kitchen tickets ignore the
              printers below. Switch to <strong>Direct Network</strong> to print silently to them.
            </p>
          </div>
          <button
            type="button"
            onClick={handleUseThesePrinters}
            disabled={isSwitchingMode}
            className="h-[42px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-medium text-sm shrink-0 transition active:scale-95"
          >
            {isSwitchingMode ? "Switching..." : "Use these printers"}
          </button>
        </div>
      )}

      {/* Info Banner */}
      <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/10 flex items-start gap-3">
        <IconWifi className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" size={20} />
        <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
          <p className="font-semibold text-emerald-900 dark:text-emerald-300">
            Zero Browser Dialogs & 100% Unicode Support
          </p>
          <p className="leading-relaxed">
            Receipts and kitchen tickets are rendered as 1-bit raster images, so any language (Khmer, Thai, Chinese,
            Arabic, accents, emojis) prints with 100% fidelity. A <strong>Print Agent</strong> running on a computer in
            your restaurant relays jobs to LAN (port 9100) and USB printers. Jobs queue automatically if a printer or
            agent is offline.
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
            const agent = agents.find((a) => Number(a.id) === Number(printer.agent_id));

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
                        {printer.transport === "usb" ? (
                          <IconUsb size={20} stroke={iconStroke} />
                        ) : (
                          <IconPrinter size={20} stroke={iconStroke} />
                        )}
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

                    {agent ? (
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          agent.online
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-red-50 text-red-700 border-red-200/50 dark:bg-red-950/40 dark:text-red-300"
                        }`}
                        title={agent.online ? "Print agent online" : "Print agent offline: jobs will queue"}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${agent.online ? "bg-emerald-500" : "bg-red-500"}`} />
                        <span>via {agent.name}</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-gray-50 dark:bg-gray-800/60 text-gray-500 border border-gray-200/60 dark:border-gray-700"
                        title="Printed by the server directly. Works only when the server is on the same network as the printer."
                      >
                        <IconServer size={12} />
                        <span>Server direct</span>
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

      {/* Print Agents */}
      <section className="space-y-3 pt-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <IconDeviceDesktop size={18} stroke={iconStroke} className="text-emerald-600" />
              <span>Print Agents</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              A small program on a computer in your restaurant that relays print jobs from the cloud to your LAN and USB
              printers.
            </p>
          </div>
          <button
            onClick={() => setIsAgentModalOpen(true)}
            className="h-[42px] px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition active:scale-95 flex items-center justify-center gap-1.5"
          >
            <IconPlus size={16} stroke={iconStroke} />
            <span>Add Agent</span>
          </button>
        </div>

        {agents.length === 0 ? (
          <div className="p-5 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs text-gray-500 flex items-start gap-3">
            <IconAlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              No print agents yet. If this POS is hosted in the cloud, the server cannot reach printers on your local
              network. Add an agent and run it on any always-on computer in the restaurant (Windows, Mac, Linux or
              Raspberry Pi).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => {
              const assigned = printers.filter((p) => Number(p.agent_id) === Number(agent.id)).length;
              return (
                <div
                  key={agent.id}
                  className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">{agent.name}</h4>
                      <p className="text-[11px] text-gray-500 font-mono">
                        {agent.hostname || "never connected"}
                        {agent.agent_version ? ` · v${agent.agent_version}` : ""}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        agent.online
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${agent.online ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                      {agent.online ? "Online" : "Offline"}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 space-y-0.5">
                    <p>
                      {assigned} printer{assigned === 1 ? "" : "s"} assigned
                      {agent.online && agent.installed_printers?.length
                        ? ` · ${agent.installed_printers.length} installed on this computer`
                        : ""}
                      {agent.online && agent.network_printers?.length
                        ? ` · ${agent.network_printers.length} found on the network`
                        : ""}
                    </p>
                    <p>Last seen: {agent.online ? "now" : formatTime(agent.last_seen_at)}</p>
                    <p className="font-mono">Token: ••••{agent.token_hint}</p>
                  </div>
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleRegenerateToken(agent)}
                      className="h-[42px] px-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition active:scale-95 flex items-center gap-1.5"
                    >
                      <IconKey size={14} />
                      <span>New Token</span>
                    </button>
                    <button
                      onClick={() => setDeleteAgentId(agent.id)}
                      className="w-[42px] h-[42px] rounded-xl border border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center justify-center transition active:scale-95"
                      title="Remove Agent"
                    >
                      <IconTrash size={16} stroke={iconStroke} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Print Jobs */}
      <section className="space-y-3 pt-2">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <IconClock size={18} stroke={iconStroke} className="text-emerald-600" />
            <span>Recent Print Jobs</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Every receipt and kitchen ticket is logged. Reprint anything that failed.
          </p>
        </div>

        {printJobs.length === 0 ? (
          <div className="p-5 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs text-gray-500 text-center">
            No print jobs yet.
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {printJobs.map((job) => (
              <div key={job.id} className="p-3 md:px-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md capitalize ${JOB_STATUS_STYLES[job.status] || ""}`}>
                      {job.status}
                    </span>
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 uppercase">{job.job_type}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{job.reference || ""}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {job.printer_name || "Deleted printer"} · {formatTime(job.created_at)}
                    {job.attempts > 1 ? ` · ${job.attempts} attempts` : ""}
                  </p>
                  {job.last_error && job.status !== "printed" && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">{job.last_error}</p>
                  )}
                </div>
                {job.status !== "printed" && Boolean(job.can_retry) && (
                  <button
                    onClick={() => handleRetryJob(job)}
                    disabled={retryingJobId === job.id}
                    className="h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50 self-start md:self-auto"
                  >
                    <IconRefresh size={14} className={retryingJobId === job.id ? "animate-spin" : ""} />
                    <span>Reprint</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Agent Modal */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateAgent}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4"
          >
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base flex items-center gap-2">
              <IconDeviceDesktop size={18} className="text-emerald-600" />
              <span>Add Print Agent</span>
            </h3>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Agent Name *</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Front Counter PC"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsAgentModalOpen(false)}
                className="h-[42px] px-5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 transition active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingAgent}
                className="h-[42px] px-6 rounded-xl bg-restro-green hover:bg-emerald-600 text-white text-xs font-semibold transition active:scale-95 shadow-sm disabled:opacity-50"
              >
                Create Agent
              </button>
            </div>
          </form>
        </div>
      )}

      {/* One-time token display */}
      {issuedToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base flex items-center gap-2">
              <IconKey size={18} className="text-emerald-600" />
              <span>Token for "{issuedToken.agentName}"</span>
            </h3>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300">
              Copy this now. It will not be shown again. Anyone with this token can receive this restaurant's print jobs.
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                On the restaurant computer, inside the <span className="font-mono">restropro-print-agent</span> folder run:
              </p>
              <div className="flex items-stretch gap-2">
                {/* Two separate commands: Windows PowerShell 5 does not support "&&". */}
                <code className="flex-1 p-3 rounded-xl bg-gray-900 text-emerald-300 text-[11px] font-mono break-all select-all whitespace-pre-wrap">
                  {`npm install --omit=dev\n${agentInstallCommand}`}
                </code>
                <button
                  onClick={() => copyToClipboard(`npm install --omit=dev\n${agentInstallCommand}`)}
                  className="w-[42px] min-h-[42px] rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition active:scale-95"
                  title="Copy command"
                >
                  <IconCopy size={16} />
                </button>
              </div>
              <p className="text-[11px] text-gray-400">
                Then edit each printer and set <strong>Print via</strong> to this agent.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setIssuedToken(null)}
                className="h-[42px] px-6 rounded-xl bg-restro-green hover:bg-emerald-600 text-white text-xs font-semibold transition active:scale-95 shadow-sm flex items-center gap-1.5"
              >
                <IconCheck size={14} />
                <span>I've copied it</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteModal
        isOpen={Boolean(deleteAgentId)}
        onClose={() => setDeleteAgentId(null)}
        onConfirm={handleDeleteAgentConfirm}
        title="Remove Print Agent"
        description="Printers assigned to this agent will switch to server direct printing. The agent will be disconnected immediately."
      />

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

              {/* Connection type */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Connection</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "tcp", label: "Network (LAN / Wi-Fi)", Icon: IconWifi },
                    { value: "usb", label: "USB / Installed", Icon: IconUsb },
                  ].map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData({ ...formData, transport: value })}
                      className={`h-[42px] rounded-xl border text-xs font-semibold transition active:scale-95 flex items-center justify-center gap-2 ${
                        formData.transport === value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={16} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Print route */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Print via</label>
                <select
                  value={formData.agent_id}
                  onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                  className="w-full h-[42px] px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-100 outline-none"
                >
                  <option value="" disabled={formData.transport === "usb"}>
                    Server direct (server is on the same network)
                  </option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — print agent {a.online ? "(online)" : "(offline)"}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  {agents.length === 0
                    ? "No print agents yet. For a cloud-hosted POS, add a Print Agent below and run it on a computer in the restaurant."
                    : "Use a print agent when the POS server is in the cloud or the printer is connected by USB."}
                </p>
              </div>

              {/* USB / installed printer name */}
              {formData.transport === "usb" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Installed Printer Name *
                  </label>
                  {selectedAgent?.installed_printers?.length > 0 && (
                    <div className="mb-2 rounded-xl border border-gray-200 dark:border-gray-700 p-2 space-y-1.5 max-h-56 overflow-y-auto">
                      {selectedAgent.installed_printers.map((name) => {
                        const selected = formData.usb_name === name;
                        const usedBy = printerUsing("usb", name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, usb_name: name }))}
                            className={`w-full min-h-[42px] px-3 py-2 rounded-lg border text-left text-sm transition active:scale-95 flex items-center gap-2 ${
                              selected
                                ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                                : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                            }`}
                          >
                            <IconPrinter size={16} className="shrink-0 text-gray-400" />
                            <span className="flex-1 break-words">{name}</span>
                            {usedBy && <span className="text-[11px] text-amber-600 shrink-0">used by “{usedBy.name}”</span>}
                            {selected && <IconCheck size={16} className="shrink-0 text-emerald-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <input
                    type="text"
                    list="agent-installed-printers"
                    placeholder="e.g. EPSON TM-T82 Receipt"
                    value={formData.usb_name}
                    onChange={(e) => setFormData({ ...formData, usb_name: e.target.value })}
                    className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                  />
                  <datalist id="agent-installed-printers">
                    {(selectedAgent?.installed_printers || []).map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {selectedAgent?.installed_printers?.length
                      ? `Tap a printer installed on "${selectedAgent.name}", or type its name.`
                      : selectedAgent && !selectedAgent.online
                      ? `"${selectedAgent.name}" is offline. Start the print agent to see its printers.`
                      : "Must match the printer name in the agent computer's printer list (Printer Tools on that computer shows it)."}
                  </p>
                </div>
              )}

              {/* Network printers found by the selected agent */}
              {formData.transport !== "usb" && selectedAgent && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Printers found on the network</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {selectedAgent.network_scanned_at
                          ? `Seen by "${selectedAgent.name}" · ${formatTime(selectedAgent.network_scanned_at)}`
                          : `Searched by "${selectedAgent.name}"`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!selectedAgent.online || !selectedAgent.can_scan || scanningAgentId === selectedAgent.id}
                      onClick={() => scanAgentNetwork(selectedAgent)}
                      className="h-[42px] px-3 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition active:scale-95 flex items-center gap-1.5 shrink-0 disabled:opacity-50 disabled:active:scale-100"
                    >
                      <IconRadar size={16} className={scanningAgentId === selectedAgent.id ? "animate-spin" : ""} />
                      {scanningAgentId === selectedAgent.id ? "Scanning…" : "Scan again"}
                    </button>
                  </div>

                  {!selectedAgent.online ? (
                    <p className="text-[12px] text-gray-500">
                      “{selectedAgent.name}” is offline. Start the print agent on the restaurant computer to find printers.
                    </p>
                  ) : !selectedAgent.can_scan ? (
                    <p className="text-[12px] text-gray-500">
                      Update the print agent on “{selectedAgent.name}” to v1.1 or newer to find network printers automatically, or
                      enter the IP below.
                    </p>
                  ) : !selectedAgent.network_scanned_at || scanningAgentId === selectedAgent.id ? (
                    <p className="text-[12px] text-gray-500">Looking for printers on the restaurant network…</p>
                  ) : selectedAgent.network_printers.length === 0 ? (
                    <p className="text-[12px] text-gray-500">
                      No network printers found. Check the printer is on and connected to the same network as “
                      {selectedAgent.name}”, then tap Scan again, or enter its IP below.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedAgent.network_printers.map(({ address }) => {
                        const selected = `${formData.ip.trim()}:${formData.port.trim() || "9100"}` === address;
                        const usedBy = printerUsing("tcp", address);
                        return (
                          <button
                            key={address}
                            type="button"
                            onClick={() => pickNetworkPrinter(address)}
                            className={`min-h-[42px] px-3 py-2 rounded-lg border text-left transition active:scale-95 flex items-center gap-2 ${
                              selected
                                ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                                : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                            }`}
                          >
                            <IconWifi size={16} className="shrink-0 text-gray-400" />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-mono">{address}</span>
                              {usedBy && <span className="block text-[11px] text-amber-600 truncate">used by “{usedBy.name}”</span>}
                            </span>
                            {selected && <IconCheck size={16} className="shrink-0 text-emerald-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* IP Address & Port */}
              <div className={`grid grid-cols-3 gap-3 ${formData.transport === "usb" ? "hidden" : ""}`}>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    {selectedAgent?.network_printers?.length ? "Or enter the IP address *" : "IP Address (LAN/Wi-Fi) *"}
                  </label>
                  <input
                    type="text"
                    required={formData.transport !== "usb"}
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
      <ConfirmDialog />
    </Page>
  );
}
