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
  IconCircle,
  IconSquare,
  IconRectangle,
  IconX,
  IconDownload,
  IconLink,
  IconCheck,
  IconLayoutGrid,
  IconLayersSubtract,
  IconDotsVertical,
  IconShieldCheck,
  IconList,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconChevronDown,
  IconArrowsSort,
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

  // View mode, Pagination & Settings states
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem("restropro_tables_view_mode") || "cards";
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Sorting & Row Selection states
  const [sortField, setSortField] = useState("floor");
  const [sortOrder, setSortOrder] = useState("asc");
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());

  useEffect(() => {
    localStorage.setItem("restropro_tables_view_mode", viewMode);
  }, [viewMode]);

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
    // Only bare numbers get a prefix: "2" -> "Floor 2", while "Main Lounge" stays as is
    if (!/^\d+$/.test(raw)) return raw;
    return t("table_settings.floor_label", { floor: raw, defaultValue: `Floor ${raw}` });
  };

  // Only short codes get a prefix: "9" / "A1" -> "Table 9", while "Bar Stool 1" stays as is
  const formatTableHeading = (title) => {
    const str = String(title || "").trim();
    if (!str) return t("pos.table", "Table");
    if (!/^[A-Za-z]?\d+[A-Za-z]?$/.test(str)) return str;
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

  // Handle Sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Sort filtered tables
  const sortedTables = useMemo(() => {
    return [...filteredTables].sort((a, b) => {
      let cmp = 0;
      if (sortField === "floor") {
        const floorA = String(a.floor ?? "0").trim();
        const floorB = String(b.floor ?? "0").trim();
        cmp = floorA.localeCompare(floorB, undefined, { numeric: true, sensitivity: "base" });
        if (cmp === 0) {
          cmp = String(a.table_title || "").localeCompare(String(b.table_title || ""), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }
      } else if (sortField === "title") {
        cmp = String(a.table_title || "").localeCompare(String(b.table_title || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      } else if (sortField === "capacity") {
        cmp = Number(a.seating_capacity || 0) - Number(b.seating_capacity || 0);
      } else if (sortField === "shape") {
        cmp = String(a.shape || "square").localeCompare(String(b.shape || "square"));
      } else if (sortField === "pin") {
        cmp = String(a.table_pin || "").localeCompare(String(b.table_pin || ""));
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [filteredTables, sortField, sortOrder]);

  // Pagination calculations
  const totalItems = sortedTables.length;
  const totalPages = pageSize === "all" ? 1 : Math.ceil(totalItems / pageSize) || 1;
  const startIndex = pageSize === "all" ? 0 : (page - 1) * pageSize;
  const endIndex = pageSize === "all" ? totalItems : Math.min(startIndex + pageSize, totalItems);

  const displayedTables = useMemo(() => {
    if (pageSize === "all") return sortedTables;
    return sortedTables.slice(startIndex, endIndex);
  }, [sortedTables, startIndex, endIndex, pageSize]);

  // Group displayed tables by floor for Cards view
  const groupedTables = useMemo(() => {
    const map = new Map();
    const source = viewMode === "cards" ? sortedTables : displayedTables;
    source.forEach((tbl) => {
      const f = tbl.floor !== undefined && tbl.floor !== null && String(tbl.floor).trim() !== ""
        ? String(tbl.floor).trim()
        : "0";
      if (!map.has(f)) map.set(f, []);
      map.get(f).push(tbl);
    });
    return Array.from(map.entries());
  }, [displayedTables, sortedTables, viewMode]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedFloor, capacityFilter, searchQuery]);

  // Ensure page is clamped
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // Row selection logic
  const isAllSelected = displayedTables.length > 0 && displayedTables.every((t) => selectedRowIds.has(t.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        displayedTables.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        displayedTables.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedRowIds(new Set());
  };

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
    const targetTables = sortedTables.length > 0 ? sortedTables : tablesList;
    if (targetTables.length === 0) return;
    printBatchTableQRPinSlips({
      storeName: storeSettings?.storeName || "Restaurant",
      uniqueQRCode,
      tables: targetTables,
    });
  };

  // Batch Print Selected QR Slips
  const handlePrintSelectedSlips = () => {
    if (!isQRMenuEnabled) {
      toast.error(t("table_settings.enable_qr_menu_error"));
      return;
    }
    const selectedTables = sortedTables.filter((tbl) => selectedRowIds.has(tbl.id));
    if (!selectedTables.length) return;
    printBatchTableQRPinSlips({
      storeName: storeSettings?.storeName || "Restaurant",
      uniqueQRCode,
      tables: selectedTables,
    });
  };

  // Print Table View
  const handlePrintTable = () => {
    window.print();
  };

  // Export CSV
  const handleExportCSV = (onlySelected = false) => {
    const targetList = onlySelected && selectedRowIds.size > 0
      ? sortedTables.filter((tbl) => selectedRowIds.has(tbl.id))
      : sortedTables;

    if (!targetList.length) {
      toast.error(t("table_settings.no_tables_to_export", "No tables to export"));
      return;
    }

    const headers = [
      "Table ID",
      "Table Title",
      "Floor / Zone",
      "Seating Capacity",
      "Shape",
      "Security PIN",
      "QR Ordering Link",
    ];

    const rows = targetList.map((tbl) => {
      const encId = tbl.encrypted_id || tbl.id;
      const qrLink = uniqueQRCode ? getTableQRMenuLink(uniqueQRCode, encId, tbl.table_pin) : "";
      return [
        `"${tbl.id}"`,
        `"${(tbl.table_title || "").replace(/"/g, '""')}"`,
        `"${(tbl.floor ?? "0").toString().replace(/"/g, '""')}"`,
        tbl.seating_capacity || 0,
        `"${tbl.shape || "square"}"`,
        `"${tbl.table_pin || ""}"`,
        `"${qrLink}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `dining_tables_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t("table_settings.exported_csv", "Tables exported to CSV"));
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
    const { id, table_title, seating_capacity, table_pin, shape } = storeTable;
    const cap = Number(seating_capacity || 0);
    const resolvedShape = shape || (cap <= 2 ? "round" : cap <= 4 ? "square" : "rectangle");
    const shapeObj = TABLE_SHAPES.find((s) => s.id === resolvedShape) || TABLE_SHAPES[1];
    const ShapeIcon = shapeObj.icon;
    const isPinCopied = copiedPinId === id;
    const isSelected = selectedRowIds.has(id);

    return (
      <div
        key={id}
        className={clsx(
          "group relative flex flex-col rounded-2xl border bg-white dark:bg-[#1a1d24] transition",
          isSelected
            ? "border-emerald-500 ring-2 ring-emerald-500/25"
            : "border-slate-200 dark:border-[#2e3340] hover:border-slate-300 dark:hover:border-zinc-600 hover:shadow-md"
        )}
      >
        {/* Identity: shape, name, seats */}
        <div className="p-4 pb-3 flex items-start gap-3">
          <button
            type="button"
            onClick={() => setPreviewTable(storeTable)}
            title={t("table_settings.preview_qr", "Preview QR")}
            className="w-[42px] h-[42px] rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 flex items-center justify-center shrink-0 transition active:scale-95"
          >
            <ShapeIcon size={20} stroke={2} />
          </button>

          <button
            type="button"
            onClick={() => openEditModal(storeTable)}
            title={t("common.edit", "Edit")}
            className="flex-1 min-w-0 text-left pt-0.5"
          >
            <h4 className="font-semibold text-[15px] leading-snug text-slate-900 dark:text-white line-clamp-2 break-words">
              {formatTableHeading(table_title)}
            </h4>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {cap} {t("table_settings.seats", "Seats")} · {t(shapeObj.labelKey, shapeObj.defaultLabel)}
            </p>
          </button>

          <div className="flex items-center shrink-0 -mr-1.5 -mt-1">
            <button
              type="button"
              onClick={() => toggleSelectRow(id)}
              title={isSelected ? t("table_settings.deselect", "Deselect") : t("table_settings.select_table", "Select")}
              className={clsx(
                "w-9 h-9 rounded-xl flex items-center justify-center transition",
                isSelected || selectedRowIds.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
              )}
            >
              <span
                className={clsx(
                  "w-[18px] h-[18px] rounded-md border flex items-center justify-center",
                  isSelected
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-transparent"
                )}
              >
                <IconCheck size={12} stroke={3} />
              </span>
            </button>

            <div className="dropdown dropdown-end">
              <button
                tabIndex={0}
                type="button"
                title={t("table_settings.more_actions", "More actions")}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-zinc-800 transition active:scale-95"
              >
                <IconDotsVertical stroke={iconStroke} size={16} />
              </button>
              <ul
                tabIndex={0}
                className="dropdown-content z-30 menu p-1.5 shadow-xl bg-white dark:bg-[#1a1d24] border border-slate-200 dark:border-[#303642] rounded-2xl w-48 text-sm space-y-0.5 mt-1"
              >
                <li>
                  <button type="button" onClick={() => openEditModal(storeTable)} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl text-slate-700 dark:text-slate-200">
                    <IconPencil size={16} />
                    <span>{t("common.edit", "Edit")}</span>
                  </button>
                </li>
                <li>
                  <button type="button" disabled={duplicatingId === id} onClick={() => btnDuplicate(storeTable)} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl text-slate-700 dark:text-slate-200 disabled:opacity-40">
                    <IconCopy size={16} />
                    <span>{t("common.duplicate", "Duplicate")}</span>
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => btnDownloadTableMenuQR(storeTable)} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl text-slate-700 dark:text-slate-200">
                    <IconDownload size={16} />
                    <span>{t("table_settings.download_table_qr", "Download QR")}</span>
                  </button>
                </li>
                <li>
                  <button type="button" disabled={rotatingPinId === id} onClick={() => handleRotatePin(storeTable)} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl text-slate-700 dark:text-slate-200 disabled:opacity-40">
                    <IconRefresh size={16} className={clsx(rotatingPinId === id && "animate-spin text-emerald-600")} />
                    <span>{t("table_settings.reset_pin", "Reset PIN")}</span>
                  </button>
                </li>
                <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />
                <li>
                  <button type="button" onClick={() => setDeleteTableId(id)} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                    <IconTrash size={16} />
                    <span>{t("common.delete", "Delete")}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* PIN + QR actions */}
        <div className="mt-auto px-4 pb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopyPin(storeTable)}
            title={t("table_settings.copy_pin", "Click to copy PIN")}
            className="flex-1 min-w-0 h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-[#20242e] border border-slate-200/80 dark:border-[#2f3542] hover:border-emerald-500/60 flex items-center gap-2 text-left transition group/pin"
          >
            <IconShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t("table_settings.pin", "PIN")}
            </span>
            <span className="font-mono font-bold tracking-[0.2em] text-sm text-slate-900 dark:text-white">
              {table_pin || "----"}
            </span>
            {isPinCopied ? (
              <IconCheck size={14} className="ml-auto text-emerald-600 shrink-0" />
            ) : (
              <IconCopy size={14} className="ml-auto text-slate-300 group-hover/pin:text-emerald-500 shrink-0 transition" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setPreviewTable(storeTable)}
            title={t("table_settings.preview_qr", "Preview QR")}
            className="w-[42px] h-[42px] rounded-xl border border-slate-200 dark:border-[#303642] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center justify-center shrink-0 transition active:scale-95"
          >
            <IconQrcode size={18} stroke={iconStroke} />
          </button>

          <button
            type="button"
            onClick={() => handlePrintSingleSlip(storeTable)}
            title={t("table_settings.print_qr", "Print QR")}
            className="w-[42px] h-[42px] rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 flex items-center justify-center shrink-0 transition active:scale-95"
          >
            <IconPrinter size={18} stroke={iconStroke} />
          </button>
        </div>
      </div>
    );
  };

  const toolbarIconBtn =
    "w-[42px] h-[42px] rounded-xl border border-slate-200 dark:border-[#303642] bg-white dark:bg-[#1a1d24] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center justify-center transition active:scale-95 shrink-0";

  return (
    <Page className="px-4 sm:px-8 py-6 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
            {t("table_settings.store_tables")}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-500 dark:text-slate-400">
            <span>
              {tablesList.length} {t("tables.tables", "Tables")} · {totalSeats} {t("table_settings.seats", "Seats")} · {floors.length}{" "}
              {t("table_settings.floors", "floors")}
            </span>
            <Link
              to="/dashboard/settings/details"
              title={t("settings.store_details", "Store Details")}
              className={clsx(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition",
                isQRMenuEnabled
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400"
              )}
            >
              <span className={clsx("w-1.5 h-1.5 rounded-full", isQRMenuEnabled ? "bg-emerald-500" : "bg-amber-500")} />
              {isQRMenuEnabled
                ? t("table_settings.qr_ordering_active", "QR ordering active")
                : t("table_settings.qr_ordering_off", "QR ordering off")}
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/dashboard/tables"
            className="min-h-[42px] px-3.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 text-sm font-medium flex items-center gap-2 transition active:scale-95"
          >
            <IconArmchair2 size={18} stroke={iconStroke} />
            <span>{t("tables.visual_floor_plan", "Visual Floor Plan")}</span>
          </Link>

          {tablesList.length > 0 && (
            <button
              type="button"
              onClick={handlePrintAllSlips}
              className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-[#303642] bg-white dark:bg-[#1a1d24] hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 text-sm font-medium flex items-center gap-2 transition active:scale-95"
            >
              <IconPrinter size={18} stroke={iconStroke} />
              <span>
                {t("table_settings.print_all_qr", "Print All QR Slips")} ({filteredTables.length})
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => openAddModal()}
            className="min-h-[42px] px-4 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition active:scale-95"
          >
            <IconPlus size={18} stroke={2.2} />
            <span>{t("table_settings.new")}</span>
          </button>
        </div>
      </div>

      {/* ── Floor Tabs + Toolbar ── */}
      {tablesList.length > 0 && (
        <div className="mb-6 print:hidden">
          {floors.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-[#2e2e2e] mb-4">
              {["all", ...floors].map((f) => {
                const isActive = selectedFloor === f;
                const count = f === "all" ? tablesList.length : floorCounts.get(f) || 0;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSelectedFloor(f)}
                    className={clsx(
                      "relative min-h-[44px] px-3.5 text-sm whitespace-nowrap flex items-center gap-2 transition",
                      isActive
                        ? "font-semibold text-slate-900 dark:text-white"
                        : "font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    <span>{f === "all" ? t("table_settings.all_floors", "All Floors") : formatFloorLabel(f)}</span>
                    <span
                      className={clsx(
                        "px-1.5 rounded-md text-[11px] font-semibold tabular-nums",
                        isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-slate-400"
                      )}
                    >
                      {count}
                    </span>
                    <span
                      className={clsx(
                        "absolute left-2 right-2 -bottom-px h-0.5 rounded-full",
                        isActive ? "bg-emerald-600" : "bg-transparent"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("table_settings.search_placeholder", "Search table, floor, capacity, PIN...")}
                className="w-full h-[42px] pl-10 pr-9 text-sm rounded-xl border border-slate-200 dark:border-[#303642] bg-white dark:bg-[#1a1d24] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>

            <select
              value={capacityFilter}
              onChange={(e) => setCapacityFilter(e.target.value)}
              className="h-[42px] pl-3 pr-8 rounded-xl border border-slate-200 dark:border-[#303642] bg-white dark:bg-[#1a1d24] text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">{t("tables.all_capacity", "All Capacity")}</option>
              <option value="small">{t("tables.small_2", "Small (1-2)")}</option>
              <option value="medium">{t("tables.medium_4", "Medium (3-4)")}</option>
              <option value="large">{t("tables.large_6", "Large (5+)")}</option>
            </select>

            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center h-[42px] p-1 rounded-xl bg-slate-100 dark:bg-[#222630]">
                {[
                  { key: "cards", icon: IconLayoutGrid, label: t("table_settings.cards", "Cards") },
                  { key: "table", icon: IconList, label: t("table_settings.table", "List") },
                ].map(({ key, icon: ModeIcon, label }) => (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    onClick={() => setViewMode(key)}
                    className={clsx(
                      "h-[34px] px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition",
                      viewMode === key
                        ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    )}
                  >
                    <ModeIcon size={16} stroke={iconStroke} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              <div className="dropdown dropdown-end">
                <button tabIndex={0} type="button" title={t("table_settings.more_actions", "More actions")} className={toolbarIconBtn}>
                  <IconDotsVertical size={17} stroke={iconStroke} />
                </button>
                <ul
                  tabIndex={0}
                  className="dropdown-content z-30 menu p-1.5 shadow-xl bg-white dark:bg-[#1a1d24] border border-slate-200 dark:border-[#303642] rounded-2xl w-52 text-sm space-y-0.5 mt-1"
                >
                  <li>
                    <button type="button" onClick={() => handleExportCSV(false)} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl text-slate-700 dark:text-slate-200">
                      <IconDownload size={16} />
                      <span>{t("table_settings.export_csv", "Export CSV")}</span>
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={handlePrintTable} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl text-slate-700 dark:text-slate-200">
                      <IconPrinter size={16} />
                      <span>{t("table_settings.print_table", "Print Table")}</span>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── Tables Content Area (Cards or Table View) ── */}
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
      ) : viewMode === "table" ? (
        /* ── High-Density Compact Data Table (Table Design System) ── */
        <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-neutral-800 text-[13px] font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b]">
                <th className="w-10 px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all tables"
                    className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => handleSort("title")}
                    className="flex items-center gap-1 hover:text-emerald-600 transition"
                  >
                    <span>{t("table_settings.col_table", "Table")}</span>
                    {sortField === "title" ? (
                      sortOrder === "asc" ? (
                        <IconChevronUp size={14} className="text-emerald-600" />
                      ) : (
                        <IconChevronDown size={14} className="text-emerald-600" />
                      )
                    ) : (
                      <IconArrowsSort size={13} className="text-slate-400 opacity-60" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => handleSort("floor")}
                    className="flex items-center gap-1 hover:text-emerald-600 transition"
                  >
                    <span>{t("table_settings.col_floor", "Floor / Zone")}</span>
                    {sortField === "floor" ? (
                      sortOrder === "asc" ? (
                        <IconChevronUp size={14} className="text-emerald-600" />
                      ) : (
                        <IconChevronDown size={14} className="text-emerald-600" />
                      )
                    ) : (
                      <IconArrowsSort size={13} className="text-slate-400 opacity-60" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => handleSort("capacity")}
                    className="flex items-center gap-1 hover:text-emerald-600 transition"
                  >
                    <span>{t("table_settings.col_capacity", "Capacity")}</span>
                    {sortField === "capacity" ? (
                      sortOrder === "asc" ? (
                        <IconChevronUp size={14} className="text-emerald-600" />
                      ) : (
                        <IconChevronDown size={14} className="text-emerald-600" />
                      )
                    ) : (
                      <IconArrowsSort size={13} className="text-slate-400 opacity-60" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => handleSort("shape")}
                    className="flex items-center gap-1 hover:text-emerald-600 transition"
                  >
                    <span>{t("table_settings.col_shape", "Shape")}</span>
                    {sortField === "shape" ? (
                      sortOrder === "asc" ? (
                        <IconChevronUp size={14} className="text-emerald-600" />
                      ) : (
                        <IconChevronDown size={14} className="text-emerald-600" />
                      )
                    ) : (
                      <IconArrowsSort size={13} className="text-slate-400 opacity-60" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => handleSort("pin")}
                    className="flex items-center gap-1 hover:text-emerald-600 transition"
                  >
                    <span>{t("table_settings.col_pin", "Security PIN")}</span>
                    {sortField === "pin" ? (
                      sortOrder === "asc" ? (
                        <IconChevronUp size={14} className="text-emerald-600" />
                      ) : (
                        <IconChevronDown size={14} className="text-emerald-600" />
                      )
                    ) : (
                      <IconArrowsSort size={13} className="text-slate-400 opacity-60" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2.5">{t("table_settings.col_qr", "QR Ordering")}</th>
                <th className="px-4 py-2.5 text-right">{t("table_settings.col_actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80 text-slate-700 dark:text-slate-200">
              {displayedTables.map((tbl) => {
                const { id, table_title, seating_capacity, floor, table_pin, shape } = tbl;
                const isSelected = selectedRowIds.has(id);
                const cap = Number(seating_capacity || 0);
                const resolvedShape = shape || (cap <= 2 ? "round" : cap <= 4 ? "square" : "rectangle");
                const shapeObj = TABLE_SHAPES.find((s) => s.id === resolvedShape) || TABLE_SHAPES[1];
                const ShapeIcon = shapeObj.icon;

                const isSmall = cap <= 2;
                const isMedium = cap <= 4;
                const avatarTheme = isSmall
                  ? "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300 border-sky-100 dark:border-sky-800/50"
                  : isMedium
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800/50"
                  : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800/50";

                return (
                  <tr
                    key={id}
                    className={clsx(
                      "hover:bg-slate-50/70 dark:hover:bg-neutral-800/40 transition text-xs sm:text-[13px]",
                      isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20"
                    )}
                  >
                    {/* Checkbox */}
                    <td className="w-10 px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(id)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Table Name & Avatar */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setPreviewTable(tbl)}
                          title={t("table_settings.preview_qr", "Click to preview QR Code")}
                          className={clsx(
                            "relative w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95 shadow-2xs group/avatar",
                            avatarTheme
                          )}
                        >
                          <ShapeIcon size={18} stroke={2} className="transition-transform group-hover/avatar:scale-110" />
                          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-white dark:bg-zinc-800 shadow-2xs border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500">
                            <IconQrcode size={8} stroke={2.5} />
                          </div>
                        </button>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white leading-tight">
                            {formatTableHeading(table_title)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Floor / Zone */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-zinc-700/60">
                        <IconLayersSubtract size={13} className="opacity-60" />
                        <span>{formatFloorLabel(floor)}</span>
                      </span>
                    </td>

                    {/* Seating Capacity */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60">
                        <IconUsers size={12} />
                        <span>{cap} {t("table_settings.seats", "Seats")}</span>
                      </span>
                    </td>

                    {/* Shape */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200/80 dark:bg-zinc-800/60 dark:text-slate-300 dark:border-zinc-700">
                        <ShapeIcon size={13} className="opacity-70" />
                        <span>{t(shapeObj.labelKey, shapeObj.defaultLabel)}</span>
                      </span>
                    </td>

                    {/* 4-Digit Security PIN */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyPin(tbl)}
                          title={t("table_settings.copy_pin", "Click to copy PIN")}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#20242e] border border-slate-200/90 dark:border-[#2f3542] font-mono font-bold text-xs text-slate-900 dark:text-white hover:border-emerald-500 hover:text-emerald-600 transition flex items-center gap-1.5 shadow-2xs group/pin"
                        >
                          <IconShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                          <span>{table_pin || "----"}</span>
                          {copiedPinId === id ? (
                            <IconCheck size={11} className="text-emerald-600" />
                          ) : (
                            <IconCopy size={11} className="text-slate-400 opacity-60 group-hover/pin:opacity-100" />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={rotatingPinId === id}
                          onClick={() => handleRotatePin(tbl)}
                          title={t("table_settings.reset_pin", "Reset PIN")}
                          className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition active:scale-95 disabled:opacity-50"
                        >
                          <IconRefresh
                            size={13}
                            className={clsx(rotatingPinId === id && "animate-spin text-emerald-600")}
                          />
                        </button>
                      </div>
                    </td>

                    {/* QR Code / Link */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewTable(tbl)}
                          title={t("table_settings.preview_qr", "Preview QR Code")}
                          className="min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 dark:border-[#303642] bg-white dark:bg-[#20242e] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition active:scale-95 flex items-center gap-1 shadow-2xs"
                        >
                          <IconQrcode size={13} className="text-emerald-600 dark:text-emerald-400" />
                          <span>{t("table_settings.qr", "QR")}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => btnDownloadTableMenuQR(tbl)}
                          title={t("table_settings.download_table_qr", "Download QR PNG")}
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center transition active:scale-95"
                        >
                          <IconDownload size={13} />
                        </button>
                      </div>
                    </td>

                    {/* Row Actions */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handlePrintSingleSlip(tbl)}
                          title={t("table_settings.print_qr", "Print QR Slip")}
                          className="w-8 h-8 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center transition active:scale-95"
                        >
                          <IconPrinter size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(tbl)}
                          title={t("common.edit", "Edit Table")}
                          className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-zinc-800 flex items-center justify-center transition active:scale-95"
                        >
                          <IconPencil size={15} />
                        </button>

                        <button
                          type="button"
                          disabled={duplicatingId === id}
                          onClick={() => btnDuplicate(tbl)}
                          title={t("common.duplicate", "Duplicate Table")}
                          className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-zinc-800 flex items-center justify-center transition active:scale-95 disabled:opacity-40"
                        >
                          <IconCopy size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTableId(id)}
                          title={t("common.delete", "Delete Table")}
                          className="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition active:scale-95"
                        >
                          <IconTrash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Cards, grouped by floor ── */
        <div className="space-y-8">
          {groupedTables.map(([floorKey, floorTables]) => {
            const floorSeats = floorTables.reduce(
              (acc, item) => acc + Number(item.seating_capacity || 0),
              0
            );
            return (
              <section key={floorKey}>
                {(groupedTables.length > 1 || selectedFloor !== "all") && (
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-baseline gap-2.5 min-w-0">
                      <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                        {formatFloorLabel(floorKey)}
                      </h2>
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {floorTables.length} {t("tables.tables", "Tables")} · {floorSeats} {t("table_settings.seats", "Seats")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAddModal(floorKey)}
                      className="min-h-[42px] px-3 rounded-xl text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1.5 shrink-0 transition active:scale-95"
                    >
                      <IconPlus size={16} stroke={2.2} />
                      <span>{t("table_settings.new")}</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {floorTables.map((tbl) => renderTableCard(tbl))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ── Pagination (list view) ── */}
      {viewMode === "table" && tablesList.length > 0 && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-sm text-slate-500 dark:text-slate-400 print:hidden">
          <div className="flex items-center gap-3">
            <span>
              {startIndex + 1}–{endIndex} {t("common.of", "of")} {totalItems}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(e.target.value === "all" ? "all" : Number(e.target.value));
                setPage(1);
              }}
              className="h-9 pl-2.5 pr-7 rounded-lg border border-slate-200 dark:border-[#303642] bg-white dark:bg-[#1a1d24] text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
              aria-label={t("table_settings.rows_per_page", "Rows per page")}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / {t("common.page", "page")}
                </option>
              ))}
              <option value="all">{t("common.all", "All")}</option>
            </select>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={clsx(toolbarIconBtn, "disabled:opacity-40 disabled:cursor-not-allowed")}
                aria-label={t("common.previous", "Previous")}
              >
                <IconChevronLeft size={16} stroke={iconStroke} />
              </button>
              <span className="tabular-nums font-medium text-slate-700 dark:text-slate-200 px-1">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={clsx(toolbarIconBtn, "disabled:opacity-40 disabled:cursor-not-allowed")}
                aria-label={t("common.next", "Next")}
              >
                <IconChevronRight size={16} stroke={iconStroke} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Floating Bulk Action Bar (When Rows / Cards Selected) ── */}
      {selectedRowIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 dark:bg-[#1a1d24]/95 backdrop-blur-md text-white border border-slate-700 dark:border-neutral-700 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fadeIn print:hidden">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {selectedRowIds.size} {selectedRowIds.size === 1 ? t("table_settings.table_selected", "table selected") : t("table_settings.tables_selected", "tables selected")}
          </span>

          <div className="h-4 w-px bg-slate-700 dark:bg-neutral-700" />

          {isQRMenuEnabled && (
            <button
              type="button"
              onClick={handlePrintSelectedSlips}
              className="min-h-[36px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
            >
              <IconPrinter size={15} />
              <span>{t("table_settings.print_selected_qr", "Print QR Slips")}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleExportCSV(true)}
            className="min-h-[36px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 border border-slate-700"
          >
            <IconDownload size={15} />
            <span>{t("table_settings.export_selected_csv", "Export Selected")}</span>
          </button>

          <button
            type="button"
            onClick={clearSelection}
            title={t("table_settings.deselect_all", "Deselect All")}
            className="min-h-[36px] px-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs transition active:scale-95"
          >
            <IconX size={15} />
          </button>
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
