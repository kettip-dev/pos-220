import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Page from "../../components/Page";
import DeleteModal from "../../components/DeleteModal";
import {
  IconPencil,
  IconPlus,
  IconTrash,
  IconArmchair2,
  IconQrcode,
  IconCopy,
  IconRefresh,
  IconPrinter,
  IconShieldLock,
  IconSearch,
  IconUsers,
  IconBuildingStore,
  IconCircle,
  IconSquare,
  IconRectangle,
  IconX,
  IconDownload,
  IconLink,
  IconCheck,
  IconLayoutGrid,
  IconLayersSubtract,
  IconExternalLink,
  IconDotsVertical,
  IconShieldCheck,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import {
  addNewStoreTable,
  deleteTable,
  rotateStoreTablePin,
  updateStoreTable,
  useStoreSettings,
  useStoreTables,
} from "../../controllers/settings.controller";
import toast from "react-hot-toast";
import { mutate } from "swr";
import {
  getTableQRMenuLink,
  printTableQRPinSlip,
  printBatchTableQRPinSlips,
} from "../../helpers/QRMenuHelper";
import QRCode from "qrcode";
import { generateDuplicateTableTitle } from "../../helpers/TableHelper";
import clsx from "clsx";

const CAPACITY_PRESETS = [2, 4, 6, 8, 10, 12];

const TABLE_SHAPES = [
  { id: "round", labelKey: "table_settings.shape_round", defaultLabel: "Round", defaultSeats: 2, icon: IconCircle },
  { id: "square", labelKey: "table_settings.shape_square", defaultLabel: "Square", defaultSeats: 4, icon: IconSquare },
  { id: "rectangle", labelKey: "table_settings.shape_rectangle", defaultLabel: "Rectangle", defaultSeats: 6, icon: IconRectangle },
];

export default function TableSettingsPage() {
  const { t } = useTranslation();

  const { data: storeSettings, isLoading: isLoadingStore } = useStoreSettings();
  const { APIURL, data: storeTables, error, isLoading } = useStoreTables();

  // Filter, Search & Grouping states
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [capacityFilter, setCapacityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [groupByFloor, setGroupByFloor] = useState(true);

  // Action states
  const [rotatingPinId, setRotatingPinId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [deleteTableId, setDeleteTableId] = useState(null);
  const [copiedPinId, setCopiedPinId] = useState(null);

  // Add / Edit Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    floor: "0",
    seatingCapacity: 4,
    shape: "square",
  });

  // QR Preview Modal state
  const [previewTable, setPreviewTable] = useState(null);
  const [previewQrDataUrl, setPreviewQrDataUrl] = useState("");
  const [embedPinInQr, setEmbedPinInQr] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const tablesList = useMemo(() => (Array.isArray(storeTables) ? storeTables : []), [storeTables]);
  const uniqueQRCode = storeSettings?.uniqueQRCode;
  const isQRMenuEnabled = Boolean(storeSettings?.isQRMenuEnabled);

  // Format floor label nicely
  const formatFloorLabel = (floorVal) => {
    const raw = floorVal !== undefined && floorVal !== null && String(floorVal).trim() !== ""
      ? String(floorVal).trim()
      : "0";
    if (/^(floor|zone|ជាន់)/i.test(raw)) return raw;
    return t("table_settings.floor_label", { floor: raw, defaultValue: `Floor ${raw}` });
  };

  // Format display title so "9" shows as "Table 9" or "តុ 9", while "Table 1" stays "Table 1"
  const formatTableHeading = (title) => {
    const str = String(title || "").trim();
    if (!str) return t("pos.table", "Table");
    if (/^(table|តុ)(\s|$|[0-9])/i.test(str)) return str;
    return `${t("pos.table", "Table")} ${str}`;
  };

  // Extract unique sorted floors and table counts per floor
  const { floors, floorCounts, totalSeats } = useMemo(() => {
    const counts = new Map();
    let seatsSum = 0;

    tablesList.forEach((tbl) => {
      const f = tbl.floor !== undefined && tbl.floor !== null && String(tbl.floor).trim() !== ""
        ? String(tbl.floor).trim()
        : "0";
      counts.set(f, (counts.get(f) || 0) + 1);
      seatsSum += Number(tbl.seating_capacity || 0);
    });

    const sortedFloors = Array.from(counts.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    return {
      floors: sortedFloors,
      floorCounts: counts,
      totalSeats: seatsSum,
    };
  }, [tablesList]);

  // Reset selected floor if deleted
  useEffect(() => {
    if (selectedFloor !== "all" && !floorCounts.has(selectedFloor)) {
      setSelectedFloor("all");
    }
  }, [floors, selectedFloor, floorCounts]);

  // Natural sort + filter tables
  const filteredTables = useMemo(() => {
    return tablesList
      .filter((tbl) => {
        const f = tbl.floor !== undefined && tbl.floor !== null && String(tbl.floor).trim() !== ""
          ? String(tbl.floor).trim()
          : "0";

        if (selectedFloor !== "all" && f !== selectedFloor) {
          return false;
        }

        const cap = Number(tbl.seating_capacity || 0);
        if (capacityFilter === "small" && cap > 2) return false;
        if (capacityFilter === "medium" && (cap < 3 || cap > 4)) return false;
        if (capacityFilter === "large" && cap < 5) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const titleMatch = String(tbl.table_title || "").toLowerCase().includes(q);
          const floorMatch = f.toLowerCase().includes(q);
          const pinMatch = String(tbl.table_pin || "").toLowerCase().includes(q);
          const capMatch = String(cap) === q;
          if (!titleMatch && !floorMatch && !pinMatch && !capMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const floorA = String(a.floor ?? "0").trim();
        const floorB = String(b.floor ?? "0").trim();
        const floorCmp = floorA.localeCompare(floorB, undefined, { numeric: true, sensitivity: "base" });
        if (floorCmp !== 0) return floorCmp;
        return String(a.table_title || "").localeCompare(String(b.table_title || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [tablesList, selectedFloor, capacityFilter, searchQuery]);

  // Group filtered tables by floor
  const groupedTables = useMemo(() => {
    const map = new Map();
    filteredTables.forEach((tbl) => {
      const f = tbl.floor !== undefined && tbl.floor !== null && String(tbl.floor).trim() !== ""
        ? String(tbl.floor).trim()
        : "0";
      if (!map.has(f)) map.set(f, []);
      map.get(f).push(tbl);
    });
    return Array.from(map.entries());
  }, [filteredTables]);

  // Generate QR preview image when previewTable changes
  useEffect(() => {
    let active = true;
    async function buildPreviewQr() {
      if (!previewTable || !uniqueQRCode) {
        setPreviewQrDataUrl("");
        return;
      }
      try {
        const encryptedId = previewTable.encrypted_id || previewTable.id;
        const pin = embedPinInQr ? previewTable.table_pin : null;
        const link = getTableQRMenuLink(uniqueQRCode, encryptedId, pin);
        const url = await QRCode.toDataURL(link, {
          width: 480,
          margin: 1,
        });
        if (active) setPreviewQrDataUrl(url);
      } catch (err) {
        console.error(err);
      }
    }
    buildPreviewQr();
    return () => {
      active = false;
    };
  }, [previewTable, uniqueQRCode, embedPinInQr]);

  // Open Add Modal
  const openAddModal = (defaultFloor = null) => {
    const targetFloor =
      defaultFloor !== null
        ? defaultFloor
        : selectedFloor !== "all"
        ? selectedFloor
        : floors[0] || "0";

    setEditingTable(null);
    setFormData({
      title: "",
      floor: targetFloor,
      seatingCapacity: 4,
      shape: "square",
    });
    setIsFormOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (tbl) => {
    const cap = Number(tbl.seating_capacity || 4);
    const defaultShape = tbl.shape || (cap <= 2 ? "round" : cap <= 4 ? "square" : "rectangle");
    setEditingTable(tbl);
    setFormData({
      title: tbl.table_title || "",
      floor: tbl.floor !== undefined && tbl.floor !== null ? String(tbl.floor) : "0",
      seatingCapacity: cap,
      shape: defaultShape,
    });
    setIsFormOpen(true);
  };

  // Save Add / Edit Table
  const handleSaveTable = async (e) => {
    e.preventDefault();
    const title = String(formData.title || "").trim();
    const floor = String(formData.floor ?? "").trim();
    const seatingCapacity = Number(formData.seatingCapacity);

    if (!title) {
      toast.error(t("table_settings.provide_title_error"));
      return;
    }
    if (!floor) {
      toast.error(t("table_settings.provide_floor_error"));
      return;
    }
    if (isNaN(seatingCapacity) || seatingCapacity < 0) {
      toast.error(t("table_settings.provide_valid_seating_capacity_error"));
      return;
    }

    setIsSubmitting(true);
    try {
      toast.loading(t("table_settings.please_wait"));
      if (editingTable) {
        const res = await updateStoreTable(
          editingTable.id,
          title,
          floor,
          seatingCapacity,
          formData.shape
        );
        if (res.status === 200) {
          await mutate(APIURL);
          toast.dismiss();
          toast.success(res.data.message);
          setIsFormOpen(false);
          setEditingTable(null);
        }
      } else {
        const res = await addNewStoreTable(
          title,
          floor,
          seatingCapacity,
          formData.shape
        );
        if (res.status === 200) {
          await mutate(APIURL);
          toast.dismiss();
          toast.success(res.data.message || t("table_settings.store_table_added"));
          setIsFormOpen(false);
        }
      }
    } catch (err) {
      const message = err?.response?.data?.message || t("table_settings.something_went_wrong");
      console.error(err);
      toast.dismiss();
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Table
  const btnDelete = async (id) => {
    try {
      toast.loading(t("table_settings.please_wait"));
      const res = await deleteTable(id);
      if (res.status === 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (err) {
      const message = err?.response?.data?.message || t("table_settings.something_went_wrong");
      console.error(err);
      toast.dismiss();
      toast.error(message);
    }
  };

  // Duplicate Table
  const btnDuplicate = async (storeTable) => {
    if (duplicatingId) return;
    setDuplicatingId(storeTable.id);
    try {
      toast.loading(t("table_settings.please_wait"));
      const newTitle = generateDuplicateTableTitle(storeTable.table_title, tablesList);
      const res = await addNewStoreTable(
        newTitle,
        storeTable.floor,
        storeTable.seating_capacity,
        storeTable.shape || "round"
      );
      if (res.status === 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message || t("table_settings.store_table_added"));
      }
    } catch (err) {
      const message = err?.response?.data?.message || t("table_settings.something_went_wrong");
      console.error(err);
      toast.dismiss();
      toast.error(message);
    } finally {
      setDuplicatingId(null);
    }
  };

  // Rotate 4-digit Table PIN
  const handleRotatePin = async (storeTable) => {
    if (rotatingPinId) return;
    setRotatingPinId(storeTable.id);
    try {
      const res = await rotateStoreTablePin(storeTable.id);
      if (res.status === 200) {
        await mutate(APIURL);
        if (previewTable && previewTable.id === storeTable.id) {
          setPreviewTable((prev) => (prev ? { ...prev, table_pin: res.data.table_pin } : null));
        }
        toast.success(
          `${formatTableHeading(storeTable.table_title)} PIN: ${res.data.table_pin}`
        );
      }
    } catch (err) {
      toast.error("Failed to rotate Table PIN");
    } finally {
      setRotatingPinId(null);
    }
  };

  // Copy 4-digit Table PIN with feedback
  const handleCopyPin = (storeTable) => {
    if (!storeTable?.table_pin) return;
    navigator.clipboard?.writeText(String(storeTable.table_pin));
    setCopiedPinId(storeTable.id);
    toast.success(t("table_settings.pin_copied", "Table PIN copied!"));
    setTimeout(() => {
      setCopiedPinId(null);
    }, 1800);
  };

  // Download Table QR PNG
  const btnDownloadTableMenuQR = async (storeTable, includePin = false) => {
    try {
      if (!isQRMenuEnabled) {
        toast.error(t("table_settings.enable_qr_menu_error"));
        return;
      }
      const encryptedId = storeTable.encrypted_id || storeTable.id;
      const pin = includePin ? storeTable.table_pin : null;
      const qrMenuLink = getTableQRMenuLink(uniqueQRCode, encryptedId, pin);
      const qrDataURL = await QRCode.toDataURL(qrMenuLink, { width: 1080, margin: 1 });
      const link = document.createElement("a");
      const fileName = String(storeTable.table_title || "table")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();

      link.download = `table-${fileName}-qr.png`;
      link.href = qrDataURL;
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
    }
  };

  // Print Single Table QR + PIN
  const handlePrintSingleSlip = (storeTable) => {
    if (!isQRMenuEnabled) {
      toast.error(t("table_settings.enable_qr_menu_error"));
      return;
    }
    printTableQRPinSlip({
      storeName: storeSettings?.storeName || "Restaurant",
      uniqueQRCode,
      table: storeTable,
    });
  };

  // Print All Filtered Table QR Slips
  const handlePrintAllSlips = () => {
    if (!isQRMenuEnabled) {
      toast.error(t("table_settings.enable_qr_menu_error"));
      return;
    }
    const targetTables = filteredTables.length > 0 ? filteredTables : tablesList;
    if (targetTables.length === 0) return;
    printBatchTableQRPinSlips({
      storeName: storeSettings?.storeName || "Restaurant",
      uniqueQRCode,
      tables: targetTables,
    });
  };

  if (isLoading || isLoadingStore) {
    return (
      <Page className="px-6 py-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="loading loading-spinner loading-md text-emerald-600"></div>
          <span>{t("table_settings.please_wait")}</span>
        </div>
      </Page>
    );
  }

  if (error) {
    console.error(error);
    return (
      <Page className="px-6 py-8 max-w-7xl mx-auto">
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-sm font-medium">
          {t("table_settings.error_loading_data")}
        </div>
      </Page>
    );
  }

  // Render a single Table Card
  const renderTableCard = (storeTable) => {
    const { id, table_title, seating_capacity, floor, table_pin, shape } = storeTable;
    const cap = Number(seating_capacity || 0);
    const resolvedShape = shape || (cap <= 2 ? "round" : cap <= 4 ? "square" : "rectangle");
    const ShapeIcon =
      resolvedShape === "round"
        ? IconCircle
        : resolvedShape === "square"
        ? IconSquare
        : IconRectangle;

    // Subtle modern gradient top accent & avatar theme based on capacity
    const isSmall = cap <= 2;
    const isMedium = cap <= 4;

    const accentGradient = isSmall
      ? "from-sky-500 via-sky-400 to-cyan-400"
      : isMedium
      ? "from-emerald-500 via-teal-500 to-emerald-400"
      : "from-indigo-500 via-purple-500 to-indigo-400";

    const avatarTheme = isSmall
      ? "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300 border-sky-100 dark:border-sky-800/50"
      : isMedium
      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800/50"
      : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800/50";

    const isPinCopied = copiedPinId === id;

    return (
      <div
        key={id}
        className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-[#2e3340] bg-white dark:bg-[#1a1d24] shadow-xs hover:shadow-lg hover:border-emerald-500/50 dark:hover:border-emerald-500/40 transition-all duration-200 overflow-hidden"
      >
        {/* Sleek Top Gradient Accent */}
        <div className={clsx("h-[3px] w-full bg-gradient-to-r", accentGradient)} />

        <div className="p-4 flex-1 flex flex-col justify-between gap-3.5">
          {/* Card Header: Table Avatar, Title + Floor & Seats, Actions */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Table Shape Avatar (Clickable to preview QR) */}
              <button
                type="button"
                onClick={() => setPreviewTable(storeTable)}
                title={t("table_settings.preview_qr", "Click to preview QR Code")}
                className={clsx(
                  "relative w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95 shadow-2xs group/avatar",
                  avatarTheme
                )}
              >
                <ShapeIcon size={22} stroke={2} className="transition-transform group-hover/avatar:scale-110" />
                {/* Tiny QR indicator badge */}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-zinc-800 shadow-xs border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover/avatar:text-emerald-500 transition-colors">
                  <IconQrcode size={10} stroke={2.2} />
                </div>
              </button>

              {/* Title & Metadata */}
              <div className="min-w-0 flex-1">
                <h4
                  title={formatTableHeading(table_title)}
                  className="font-bold text-[15px] sm:text-base text-slate-900 dark:text-white leading-snug truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
                >
                  {formatTableHeading(table_title)}
                </h4>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-slate-300">
                    <IconLayersSubtract size={11} className="opacity-70 shrink-0" />
                    <span className="truncate max-w-[110px]">{formatFloorLabel(floor)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                    <IconUsers size={11} className="shrink-0" />
                    <span>
                      {cap} {t("table_settings.seats", "Seats")}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Header Actions */}
            <div className="flex items-center gap-0.5 shrink-0 -mr-1">
              <button
                type="button"
                onClick={() => openEditModal(storeTable)}
                title={t("common.edit", "Edit Table")}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-95 text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-zinc-800"
              >
                <IconPencil stroke={iconStroke} size={15} />
              </button>

              {/* Dropdown for Secondary Actions */}
              <div className="dropdown dropdown-end">
                <button
                  tabIndex={0}
                  type="button"
                  title={t("table_settings.more_actions", "More Actions")}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-95 text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-zinc-800"
                >
                  <IconDotsVertical stroke={iconStroke} size={15} />
                </button>
                <ul
                  tabIndex={0}
                  className="dropdown-content z-30 menu p-1.5 shadow-xl bg-white dark:bg-[#1a1d24] border border-slate-200 dark:border-[#303642] rounded-2xl w-44 text-xs font-semibold space-y-0.5 mt-1"
                >
                  <li>
                    <button
                      type="button"
                      onClick={() => setPreviewTable(storeTable)}
                      className="flex items-center gap-2 py-2 px-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200"
                    >
                      <IconQrcode size={15} />
                      <span>{t("table_settings.preview_qr", "Preview QR")}</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      disabled={duplicatingId === id}
                      onClick={() => btnDuplicate(storeTable)}
                      className="flex items-center gap-2 py-2 px-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
                    >
                      <IconCopy size={15} />
                      <span>{t("common.duplicate", "Duplicate")}</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      disabled={rotatingPinId === id}
                      onClick={() => handleRotatePin(storeTable)}
                      className="flex items-center gap-2 py-2 px-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
                    >
                      <IconRefresh size={15} className={clsx(rotatingPinId === id && "animate-spin text-emerald-600")} />
                      <span>{t("table_settings.reset_pin", "Reset PIN")}</span>
                    </button>
                  </li>
                  <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />
                  <li>
                    <button
                      type="button"
                      onClick={() => setDeleteTableId(id)}
                      className="flex items-center gap-2 py-2 px-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <IconTrash size={15} />
                      <span>{t("common.delete", "Delete Table")}</span>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sleek PIN & Security Access Bar */}
          <div className="px-3 py-2 rounded-xl bg-slate-50/90 dark:bg-[#20242e] border border-slate-200/80 dark:border-[#2f3542] flex items-center justify-between gap-2 shadow-2xs">
            <button
              type="button"
              onClick={() => handleCopyPin(storeTable)}
              title={t("table_settings.copy_pin", "Click to copy PIN")}
              className="flex items-center gap-2 text-left group/pin cursor-pointer flex-1 min-w-0"
            >
              <IconShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {t("table_settings.table_pin", "PIN")}:
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-white dark:bg-[#15171e] border border-slate-200 dark:border-zinc-700 font-mono font-black tracking-widest text-xs text-slate-900 dark:text-white group-hover/pin:border-emerald-500 group-hover/pin:text-emerald-600 transition shadow-2xs flex items-center gap-1.5">
                <span>{table_pin || "----"}</span>
                {isPinCopied ? (
                  <IconCheck size={11} className="text-emerald-600 shrink-0" />
                ) : (
                  <IconCopy size={10} className="text-slate-400 group-hover/pin:text-emerald-500 opacity-60 group-hover/pin:opacity-100 transition shrink-0" />
                )}
              </span>
            </button>

            <button
              type="button"
              disabled={rotatingPinId === id}
              onClick={() => handleRotatePin(storeTable)}
              title={t("table_settings.reset_pin", "Generate New 4-Digit PIN")}
              className="px-2.5 py-1 min-h-[32px] rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#1a1d24] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition active:scale-95 disabled:opacity-50 shrink-0 shadow-2xs"
            >
              <IconRefresh
                size={13}
                className={clsx(rotatingPinId === id && "animate-spin text-emerald-600")}
              />
              <span className="text-[11px] font-medium">{t("table_settings.reset_pin", "Reset")}</span>
            </button>
          </div>

          {/* Primary Card Footer Actions (>= 42px Touch Targets) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => btnDownloadTableMenuQR(storeTable)}
              className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-[#303642] bg-white dark:bg-[#20242e] hover:bg-slate-50 dark:hover:bg-[#2a2f3a] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-2xs"
            >
              <IconDownload size={15} stroke={iconStroke} className="shrink-0 text-slate-500 dark:text-slate-400" />
              <span className="truncate">{t("table_settings.download_table_qr", "Download QR")}</span>
            </button>

            <button
              type="button"
              onClick={() => handlePrintSingleSlip(storeTable)}
              className="min-h-[42px] px-3 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:shadow-emerald-600/25 transition active:scale-95"
            >
              <IconPrinter size={15} stroke={iconStroke} className="shrink-0 text-white" />
              <span className="truncate">{t("table_settings.print_qr", "Print QR")}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Page className="px-4 sm:px-8 py-6 max-w-7xl mx-auto">
      {/* Top Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t("table_settings.store_tables")}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              {tablesList.length} {t("tables.tables", "Tables")}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            {t(
              "table_settings.subtitle",
              "Manage dining tables, seating capacities, 4-digit security PINs, and printable QR ordering slips."
            )}
          </p>
        </div>

        {/* Header Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/dashboard/tables"
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#303642] bg-white dark:bg-[#1a1d24] hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 text-sm font-medium flex items-center gap-2 shadow-2xs transition active:scale-95"
          >
            <IconArmchair2 size={18} stroke={iconStroke} className="text-emerald-600 dark:text-emerald-400" />
            <span>{t("tables.visual_floor_plan", "Visual Floor Plan")}</span>
          </Link>

          {tablesList.length > 0 && (
            <button
              type="button"
              onClick={handlePrintAllSlips}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#303642] bg-white dark:bg-[#1a1d24] hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 text-sm font-medium flex items-center gap-2 shadow-2xs transition active:scale-95"
            >
              <IconPrinter size={18} stroke={iconStroke} className="text-slate-500" />
              <span>
                {t("table_settings.print_all_qr", "Print All QR Slips")} ({filteredTables.length})
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => openAddModal()}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition active:scale-95"
          >
            <IconPlus size={19} stroke={2.2} />
            <span>{t("table_settings.new")}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#2e2e2e] bg-white dark:bg-[#1a1d24] flex items-center gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <IconArmchair2 size={22} stroke={iconStroke} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("table_settings.total_tables", "Total Tables")}
            </p>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {tablesList.length}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#2e2e2e] bg-white dark:bg-[#1a1d24] flex items-center gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <IconUsers size={22} stroke={iconStroke} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("table_settings.total_seats", "Total Capacity")}
            </p>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {totalSeats}{" "}
              <span className="text-xs font-semibold text-slate-400">
                {t("table_settings.seats", "Seats")}
              </span>
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#2e2e2e] bg-white dark:bg-[#1a1d24] flex items-center gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <IconBuildingStore size={22} stroke={iconStroke} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t("table_settings.floors_zones", "Floors / Zones")}
            </p>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {floors.length}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#2e2e2e] bg-white dark:bg-[#1a1d24] flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={clsx(
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                isQRMenuEnabled
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
              )}
            >
              <IconQrcode size={22} stroke={iconStroke} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {t("table_settings.qr_menu_status", "QR Ordering")}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={clsx(
                    "w-2 h-2 rounded-full",
                    isQRMenuEnabled ? "bg-emerald-500" : "bg-amber-500"
                  )}
                />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {isQRMenuEnabled
                    ? t("table_settings.qr_enabled", "Active")
                    : t("table_settings.qr_disabled", "Disabled")}
                </span>
              </div>
            </div>
          </div>

          <Link
            to="/dashboard/settings/details"
            title={t("settings.store_details", "Store Details")}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-zinc-800 transition"
          >
            <IconExternalLink size={16} />
          </Link>
        </div>
      </div>

      {/* Filter, Floor Tabs & Search Bar */}
      {tablesList.length > 0 && (
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-[#2e2e2e] bg-white dark:bg-[#1a1d24] mb-6 space-y-3 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Floor Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedFloor("all")}
                className={clsx(
                  "min-h-[42px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 whitespace-nowrap flex items-center gap-1.5",
                  selectedFloor === "all"
                    ? "bg-slate-900 text-white dark:bg-emerald-600 dark:text-white shadow-xs"
                    : "bg-slate-100 dark:bg-[#252932] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                )}
              >
                <IconLayoutGrid size={15} />
                <span>{t("table_settings.all_floors", "All Floors")}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-white/20">
                  {tablesList.length}
                </span>
              </button>

              {floors.map((f) => {
                const isSelected = selectedFloor === f;
                const count = floorCounts.get(f) || 0;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelectedFloor(f)}
                    className={clsx(
                      "min-h-[42px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 whitespace-nowrap flex items-center gap-1.5",
                      isSelected
                        ? "bg-restro-green text-white shadow-xs"
                        : "bg-slate-100 dark:bg-[#252932] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                    )}
                  >
                    <span>{formatFloorLabel(f)}</span>
                    <span
                      className={clsx(
                        "px-1.5 py-0.2 rounded-full text-[11px]",
                        isSelected
                          ? "bg-white/25 text-white"
                          : "bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-300"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <IconSearch
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(
                  "table_settings.search_placeholder",
                  "Search table, floor, capacity, PIN..."
                )}
                className="w-full min-h-[42px] pl-10 pr-9 py-2 rounded-xl border border-slate-200 dark:border-[#303642] bg-slate-50 dark:bg-[#222630] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Secondary Row: Capacity Chips & Group by Floor Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-[#262a34]">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { key: "all", label: t("tables.all_capacity", "All Capacity"), icon: IconArmchair2 },
                { key: "small", label: t("tables.small_2", "Small (1-2)"), icon: IconCircle },
                { key: "medium", label: t("tables.medium_4", "Medium (3-4)"), icon: IconSquare },
                { key: "large", label: t("tables.large_6", "Large (5+)"), icon: IconRectangle },
              ].map((item) => {
                const ItemIcon = item.icon;
                const isSelected = capacityFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setCapacityFilter(item.key)}
                    className={clsx(
                      "min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 whitespace-nowrap flex items-center gap-1.5",
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs"
                        : "bg-slate-50 dark:bg-[#222630] text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800"
                    )}
                  >
                    <ItemIcon size={14} className={isSelected ? "text-emerald-600 dark:text-emerald-400" : "opacity-60"} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {selectedFloor === "all" && floors.length > 1 && (
              <label className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#222630] border border-slate-200/80 dark:border-[#303642] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={groupByFloor}
                  onChange={(e) => setGroupByFloor(e.target.checked)}
                  className="toggle toggle-xs toggle-success"
                />
                <span>{t("table_settings.group_by_floor", "Group by Floor")}</span>
              </label>
            )}
          </div>
        </div>
      )}

      {/* Tables Content Area */}
      {tablesList.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-[#303642] p-12 text-center flex flex-col items-center justify-center bg-white/60 dark:bg-[#1a1d24]/60">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
            <IconArmchair2 size={32} stroke={iconStroke} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {t("table_settings.no_tables_title", "No Store Tables Found")}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-6">
            {t(
              "table_settings.no_tables_desc",
              "Add your restaurant tables to enable Dine-In POS selection, floor plans, and table QR self-ordering."
            )}
          </p>
          <button
            type="button"
            onClick={() => openAddModal()}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition active:scale-95"
          >
            <IconPlus size={18} stroke={2.2} />
            <span>{t("table_settings.new")}</span>
          </button>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-[#2e2e2e] bg-white dark:bg-[#1a1d24] p-10 text-center">
          <IconArmchair2 size={40} className="mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t("tables.no_tables_found", "No tables match your filter.")}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedFloor("all");
              setCapacityFilter("all");
              setSearchQuery("");
            }}
            className="mt-3 text-xs font-bold text-emerald-600 hover:underline"
          >
            {t("tables.clear_filters", "Clear all filters")}
          </button>
        </div>
      ) : groupByFloor && selectedFloor === "all" && groupedTables.length > 1 ? (
        <div className="space-y-8">
          {groupedTables.map(([floorKey, floorTables]) => {
            const floorSeats = floorTables.reduce(
              (acc, item) => acc + Number(item.seating_capacity || 0),
              0
            );
            return (
              <div key={floorKey} className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-[#1a1d24] border border-slate-200/80 dark:border-[#2a2e39] shadow-2xs">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#15171e] border border-slate-200/90 dark:border-zinc-700 text-slate-900 dark:text-white shadow-2xs">
                      <IconLayersSubtract size={16} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="font-bold text-xs sm:text-sm tracking-wide">
                        {formatFloorLabel(floorKey)}
                      </span>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                      {floorTables.length} {t("tables.tables", "Tables")} • {floorSeats}{" "}
                      {t("table_settings.seats", "Seats")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openAddModal(floorKey)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#15171e] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-zinc-700 hover:border-emerald-500/50 text-slate-700 dark:text-slate-200 hover:text-emerald-600 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition active:scale-95"
                  >
                    <IconPlus size={15} stroke={2.5} className="text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {t("table_settings.new")} ({formatFloorLabel(floorKey)})
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4.5">
                  {floorTables.map((tbl) => renderTableCard(tbl))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4.5">
          {filteredTables.map((tbl) => renderTableCard(tbl))}
        </div>
      )}

      {/* Controlled Add / Edit Table Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1a1d24] border border-slate-200 dark:border-[#303642] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-[#292e38] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <IconArmchair2 size={20} stroke={iconStroke} />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {editingTable
                    ? t("table_settings.update_table")
                    : t("table_settings.add_new_table")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTable} className="p-6 space-y-5">
              {/* Table Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("table_settings.title")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t("table_settings.enter_table_title")}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-[#303642] bg-slate-50 dark:bg-[#222630] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Floor / Zone Input + Existing Floor Quick Chips */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("table_settings.floor")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  placeholder={t("table_settings.enter_floor_title")}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-[#303642] bg-slate-50 dark:bg-[#222630] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {floors.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-slate-400 mr-1">
                      {t("table_settings.floors_zones", "Floors")}:
                    </span>
                    {floors.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormData({ ...formData, floor: f })}
                        className={clsx(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-95",
                          String(formData.floor).trim() === f
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        )}
                      >
                        {formatFloorLabel(f)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Table Shape Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("table_settings.shape", "Table Shape")}
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {TABLE_SHAPES.map((sh) => {
                    const IconComp = sh.icon;
                    const isSelected = formData.shape === sh.id;
                    return (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            shape: sh.id,
                            seatingCapacity: editingTable
                              ? formData.seatingCapacity
                              : sh.defaultSeats,
                          })
                        }
                        className={clsx(
                          "min-h-[46px] p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95",
                          isSelected
                            ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                            : "border-slate-200 dark:border-[#303642] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                        )}
                      >
                        <IconComp size={16} />
                        <span>{t(sh.labelKey, sh.defaultLabel)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seating Capacity + Quick Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t("table_settings.seating_capacity")} <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={formData.seatingCapacity}
                    onChange={(e) =>
                      setFormData({ ...formData, seatingCapacity: e.target.value })
                    }
                    className="w-28 min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#303642] bg-slate-50 dark:bg-[#222630] text-sm font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 flex-1">
                    {CAPACITY_PRESETS.map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setFormData({ ...formData, seatingCapacity: num })}
                        className={clsx(
                          "min-w-[40px] min-h-[40px] px-2.5 rounded-xl text-xs font-bold border transition active:scale-95",
                          Number(formData.seatingCapacity) === num
                            ? "border-emerald-500 bg-emerald-600 text-white shadow-2xs"
                            : "border-slate-200 dark:border-[#303642] bg-slate-50 dark:bg-[#222630] text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-[#292e38]">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-[#303642] text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition active:scale-95"
                >
                  {t("table_settings.close")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-sm font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {t("table_settings.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Table QR & PIN Preview Modal */}
      {previewTable && (
        <div
          onClick={() => setPreviewTable(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1a1d24] border border-slate-200 dark:border-[#303642] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-[#292e38] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {formatTableHeading(previewTable.table_title)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatFloorLabel(previewTable.floor)} • {previewTable.seating_capacity}{" "}
                  {t("table_settings.seats", "Seats")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTable(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col items-center text-center space-y-4">
              {!isQRMenuEnabled ? (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                  {t("table_settings.enable_qr_menu_error")}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white border-2 border-slate-200 shadow-inner">
                  {previewQrDataUrl ? (
                    <img
                      src={previewQrDataUrl}
                      alt={`QR ${previewTable.table_title}`}
                      className="w-52 h-52 object-contain"
                    />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center">
                      <span className="loading loading-spinner loading-md text-emerald-600" />
                    </div>
                  )}
                </div>
              )}

              {/* Security PIN Box */}
              <div className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#222630] border border-dashed border-slate-300 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconShieldLock size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <div className="text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t("table_settings.table_pin", "Table PIN")}
                    </p>
                    <p className="font-mono text-xl font-black tracking-widest text-slate-900 dark:text-white">
                      {previewTable.table_pin || "----"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={rotatingPinId === previewTable.id}
                  onClick={() => handleRotatePin(previewTable)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#1a1d24] text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 transition active:scale-95"
                >
                  <IconRefresh
                    size={14}
                    className={clsx(rotatingPinId === previewTable.id && "animate-spin")}
                  />
                  <span>{t("table_settings.reset_pin", "Reset PIN")}</span>
                </button>
              </div>

              {/* Include PIN toggle */}
              <label className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/70 dark:bg-[#222630]/60 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                <span>Embed PIN in QR Link (Auto-unlock ordering)</span>
                <input
                  type="checkbox"
                  checked={embedPinInQr}
                  onChange={(e) => setEmbedPinInQr(e.target.checked)}
                  className="toggle toggle-xs toggle-success"
                />
              </label>

              {/* Modal Action Buttons */}
              <div className="w-full grid grid-cols-3 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!uniqueQRCode) return;
                    const encryptedId = previewTable.encrypted_id || previewTable.id;
                    const pin = embedPinInQr ? previewTable.table_pin : null;
                    const link = getTableQRMenuLink(uniqueQRCode, encryptedId, pin);
                    navigator.clipboard?.writeText(link);
                    setCopiedLink(true);
                    toast.success(t("table_settings.link_copied", "QR link copied!"));
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="min-h-[42px] px-2.5 rounded-xl border border-slate-200 dark:border-[#303642] bg-slate-50 dark:bg-[#222630] hover:bg-slate-100 text-xs font-semibold flex items-center justify-center gap-1 text-slate-700 dark:text-slate-200 transition active:scale-95"
                >
                  {copiedLink ? <IconCheck size={15} className="text-emerald-600" /> : <IconLink size={15} />}
                  <span className="truncate">{t("table_settings.copy_link", "Copy Link")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => btnDownloadTableMenuQR(previewTable, embedPinInQr)}
                  className="min-h-[42px] px-2.5 rounded-xl border border-slate-200 dark:border-[#303642] bg-slate-50 dark:bg-[#222630] hover:bg-slate-100 text-xs font-semibold flex items-center justify-center gap-1 text-slate-700 dark:text-slate-200 transition active:scale-95"
                >
                  <IconDownload size={15} />
                  <span className="truncate">{t("table_settings.download_table_qr")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintSingleSlip(previewTable)}
                  className="min-h-[42px] px-2.5 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-xs font-semibold flex items-center justify-center gap-1 transition active:scale-95"
                >
                  <IconPrinter size={15} />
                  <span className="truncate">{t("table_settings.print_qr_pin")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(deleteTableId)}
        onClose={() => setDeleteTableId(null)}
        onConfirm={async () => {
          const id = deleteTableId;
          setDeleteTableId(null);
          await btnDelete(id);
        }}
        title={t("table_settings.delete_table", "Delete Table")}
        description={t("table_settings.are_you_sure")}
      />
    </Page>
  );
}
