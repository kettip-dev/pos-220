import React, { useRef, useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Page from "../../components/Page";
import {
  IconAdjustmentsHorizontal,
  IconArrowsSort,
  IconCarrot,
  IconCategory2,
  IconCheck,
  IconChefHat,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFilterOff,
  IconLayoutGrid,
  IconList,
  IconPencil,
  IconPhoto,
  IconPhotoOff,
  IconPlus,
  IconSearch,
  IconSquare,
  IconSquareCheckFilled,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import {
  useCategories,
  useTaxes,
  useStoreSettings,
} from "../../controllers/settings.controller";
import toast from "react-hot-toast";
import { mutate } from "swr";
import { Link, useNavigate } from "react-router-dom";
import {
  addMenuItem,
  updateMenuItem,
  changeMenuItemVisibility,
  deleteMenuItem,
  useMenuItems,
  exportMenuItems,
  uploadMenuItemPhoto,
  removeMenuItemPhoto,
  addMenuItemVariant,
  addMenuItemAddon,
} from "../../controllers/menu_item.controller";
import { useKitchenStations } from "../../controllers/kitchen_stations.controller";
import { useTheme } from "../../contexts/ThemeContext";
import { getImageURL } from "../../helpers/ImageHelper";
import ImportMenuItemsModal from "../../components/ImportMenuItemsModal";
import DeleteModal from "../../components/DeleteModal";
import imageCompression from "browser-image-compression";
import clsx from "clsx";

const VIEW_MODE_STORAGE_KEY = "restro_menu_items_view_mode";

export default function MenuItemsSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();

  // Store settings for currency
  const { data: storeSettings } = useStoreSettings();
  const currency = storeSettings?.currency || "$";

  const formatPrice = (val) => {
    const num = Number(val);
    if (val === null || val === undefined || val === "" || Number.isNaN(num)) {
      return `${currency}0.00`;
    }
    return `${currency}${num.toFixed(2)}`;
  };

  // Data hooks
  const {
    data: categories,
    error: errorCategories,
    isLoading: isLoadingCategories,
  } = useCategories();

  const {
    data: taxes,
    error: errorTaxes,
    isLoading: isLoadingTaxes,
  } = useTaxes();

  const { APIURL, data: menuItems, error, isLoading } = useMenuItems();
  const { data: stations } = useKitchenStations();

  // View & Filter state
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem(VIEW_MODE_STORAGE_KEY) || "grid";
  });
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "hidden"
  const [stationFilter, setStationFilter] = useState("all"); // "all" | "override" | "unassigned" | stationId
  const [missingPhotoOnly, setMissingPhotoOnly] = useState(false);
  const [sortBy, setSortBy] = useState("name_asc"); // "name_asc" | "name_desc" | "price_asc" | "price_desc" | "category"

  // Selection & Bulk Actions state
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState("");
  const [bulkStationTarget, setBulkStationTarget] = useState("");
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Modals & Unified Add/Quick-Edit Drawer state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [deleteItemData, setDeleteItemData] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null = Add mode, object = Quick-Edit mode

  // Controlled Drawer Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formNetPrice, setFormNetPrice] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formTaxId, setFormTaxId] = useState("");
  const [formKitchenStationId, setFormKitchenStationId] = useState("");
  const [formIsEnabled, setFormIsEnabled] = useState(true);
  const [stagedPhotoFile, setStagedPhotoFile] = useState(null);
  const [stagedPhotoPreview, setStagedPhotoPreview] = useState(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
  const [isSavingDrawer, setIsSavingDrawer] = useState(false);
  const drawerFileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  // Clean up object URL for staged photo preview
  useEffect(() => {
    return () => {
      if (stagedPhotoPreview && stagedPhotoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(stagedPhotoPreview);
      }
    };
  }, [stagedPhotoPreview]);

  // Open Drawer for Add or Quick Edit
  const openAddDrawer = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormDescription("");
    setFormPrice("");
    setFormNetPrice("");
    setFormCategoryId(
      selectedCategory !== "all" && selectedCategory !== "uncategorized"
        ? String(selectedCategory)
        : ""
    );
    setFormTaxId("");
    setFormKitchenStationId("");
    setFormIsEnabled(true);
    setStagedPhotoFile(null);
    setStagedPhotoPreview(null);
    setRemoveExistingPhoto(false);
    setIsDrawerOpen(true);
  };

  const openQuickEditDrawer = (item) => {
    setEditingItem(item);
    setFormTitle(item.title || "");
    setFormDescription(item.description || "");
    setFormPrice(item.price !== null && item.price !== undefined ? String(item.price) : "");
    setFormNetPrice(
      item.net_price !== null && item.net_price !== undefined ? String(item.net_price) : ""
    );
    setFormCategoryId(item.category_id ? String(item.category_id) : "");
    setFormTaxId(item.tax_id ? String(item.tax_id) : "");
    setFormKitchenStationId(item.kitchen_station_id ? String(item.kitchen_station_id) : "");
    setFormIsEnabled(Boolean(item.is_enabled));
    setStagedPhotoFile(null);
    setStagedPhotoPreview(item.image ? getImageURL(item.image) : null);
    setRemoveExistingPhoto(false);
    setIsDrawerOpen(true);
  };

  // KPI Metrics & Category Counts
  const stats = useMemo(() => {
    if (!menuItems) {
      return { total: 0, active: 0, hidden: 0, missingPhoto: 0 };
    }
    let active = 0;
    let hidden = 0;
    let missingPhoto = 0;
    menuItems.forEach((item) => {
      if (item.is_enabled) active += 1;
      else hidden += 1;
      if (!item.image) missingPhoto += 1;
    });
    return {
      total: menuItems.length,
      active,
      hidden,
      missingPhoto,
    };
  }, [menuItems]);

  const categoryItemCounts = useMemo(() => {
    if (!menuItems) return { all: 0, uncategorized: 0 };
    const counts = { all: menuItems.length, uncategorized: 0 };
    menuItems.forEach((item) => {
      if (item.category_id) {
        counts[item.category_id] = (counts[item.category_id] || 0) + 1;
      } else {
        counts.uncategorized += 1;
      }
    });
    return counts;
  }, [menuItems]);

  // Filtered + Sorted items
  const filteredItems = useMemo(() => {
    if (!menuItems) return [];
    const q = search.trim().toLowerCase();

    const list = menuItems.filter((item) => {
      // Category filter
      if (selectedCategory === "uncategorized") {
        if (item.category_id) return false;
      } else if (selectedCategory !== "all") {
        if (String(item.category_id) !== String(selectedCategory)) return false;
      }

      // Status filter
      if (statusFilter === "active" && !item.is_enabled) return false;
      if (statusFilter === "hidden" && item.is_enabled) return false;

      // Missing photo filter
      if (missingPhotoOnly && item.image) return false;

      // Kitchen station filter
      if (stationFilter === "override") {
        if (!item.kitchen_station_id) return false;
      } else if (stationFilter === "unassigned") {
        if (item.effective_kitchen_station_id) return false;
      } else if (stationFilter !== "all") {
        if (String(item.effective_kitchen_station_id) !== String(stationFilter)) {
          return false;
        }
      }

      // Search query
      if (q) {
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        const matchCat = item.category_title?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCat) return false;
      }

      return true;
    });

    // Sort
    return [...list].sort((a, b) => {
      if (sortBy === "name_asc") {
        return (a.title || "").localeCompare(b.title || "");
      }
      if (sortBy === "name_desc") {
        return (b.title || "").localeCompare(a.title || "");
      }
      if (sortBy === "price_asc") {
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      }
      if (sortBy === "price_desc") {
        return (Number(b.price) || 0) - (Number(a.price) || 0);
      }
      if (sortBy === "category") {
        const catCmp = (a.category_title || "zzz").localeCompare(b.category_title || "zzz");
        if (catCmp !== 0) return catCmp;
        return (a.title || "").localeCompare(b.title || "");
      }
      return 0;
    });
  }, [
    menuItems,
    selectedCategory,
    statusFilter,
    stationFilter,
    missingPhotoOnly,
    search,
    sortBy,
  ]);

  const hasActiveFilters =
    search.trim() !== "" ||
    selectedCategory !== "all" ||
    statusFilter !== "all" ||
    stationFilter !== "all" ||
    missingPhotoOnly;

  const resetFilters = () => {
    setSearch("");
    setSelectedCategory("all");
    setStatusFilter("all");
    setStationFilter("all");
    setMissingPhotoOnly(false);
  };

  // Selection helpers
  const filteredIds = useMemo(() => filteredItems.map((i) => i.id), [filteredItems]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const toggleSelectItem = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  if (isLoadingCategories || isLoadingTaxes || isLoading) {
    return <Page className="px-4 md:px-8 py-6">{t("menu_items.please_wait")}</Page>;
  }

  if (errorCategories || errorTaxes || error) {
    return <Page className="px-4 md:px-8 py-6">{t("menu_items.error_loading_details")}</Page>;
  }

  // Handle photo selection inside Drawer
  const handleDrawerFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStagedPhotoFile(file);
    setRemoveExistingPhoto(false);
    const previewUrl = URL.createObjectURL(file);
    setStagedPhotoPreview(previewUrl);
  };

  const handleRemoveDrawerPhoto = () => {
    setStagedPhotoFile(null);
    setStagedPhotoPreview(null);
    if (editingItem?.image) {
      setRemoveExistingPhoto(true);
    }
    if (drawerFileInputRef.current) {
      drawerFileInputRef.current.value = "";
    }
  };

  // Save handler for Add / Quick-Edit Drawer
  async function handleSaveDrawer(openFullDetailsAfter = false) {
    const title = formTitle.trim();
    const description = formDescription.trim() || null;
    const price = formPrice !== "" ? Number(formPrice) : "";
    const netPrice = formNetPrice !== "" ? Number(formNetPrice) : null;
    const categoryId = formCategoryId || null;
    const taxId = formTaxId || null;
    const kitchenStationId = formKitchenStationId || null;

    if (!title) {
      toast.error(t("menu_items.please_enter_title"));
      return;
    }
    if (price === "" || Number.isNaN(price) || price < 0) {
      toast.error(t("menu_items.please_provide_valid_price"));
      return;
    }

    setIsSavingDrawer(true);
    try {
      toast.loading(t("menu_items.please_wait"));
      let targetItemId = editingItem?.id;

      if (editingItem) {
        const res = await updateMenuItem(
          editingItem.id,
          title,
          description,
          price,
          netPrice,
          categoryId,
          taxId,
          kitchenStationId
        );
        if (res.status !== 200) {
          throw new Error("Failed to update item");
        }
        // If visibility changed during quick-edit
        if (Boolean(editingItem.is_enabled) !== Boolean(formIsEnabled)) {
          await changeMenuItemVisibility(editingItem.id, formIsEnabled);
        }
      } else {
        const res = await addMenuItem(
          title,
          description,
          price,
          netPrice,
          categoryId,
          taxId,
          kitchenStationId
        );
        if (res.status !== 200) {
          throw new Error("Failed to add item");
        }
        targetItemId = res.data?.menuItemId;
        if (targetItemId && !formIsEnabled) {
          await changeMenuItemVisibility(targetItemId, false);
        }
      }

      // Upload or remove photo if requested
      if (targetItemId && stagedPhotoFile) {
        const compressedImage = await imageCompression(stagedPhotoFile, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 512,
          useWebWorker: true,
        });
        const formData = new FormData();
        formData.append("image", compressedImage);
        await uploadMenuItemPhoto(targetItemId, formData);
      } else if (targetItemId && removeExistingPhoto && editingItem?.image) {
        await removeMenuItemPhoto(targetItemId);
      }

      await mutate(APIURL);
      toast.dismiss();
      toast.success(editingItem ? "Menu item updated!" : "Menu item added!");
      setIsDrawerOpen(false);

      if (openFullDetailsAfter && targetItemId) {
        navigate(`/dashboard/settings/menu-items/${targetItemId}`);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || t("menu_items.something_went_wrong");
      console.error(err);
      toast.dismiss();
      toast.error(message);
    } finally {
      setIsSavingDrawer(false);
    }
  }

  // Duplicate Item (clones item + variants + addons)
  const handleDuplicateItem = async (item) => {
    try {
      toast.loading(`Duplicating "${item.title}"...`);
      const res = await addMenuItem(
        `${item.title} (Copy)`,
        item.description || null,
        item.price,
        item.net_price || null,
        item.category_id || null,
        item.tax_id || null,
        item.kitchen_station_id || null
      );
      if (res.status === 200 && res.data?.menuItemId) {
        const newId = res.data.menuItemId;
        if (Array.isArray(item.variants)) {
          for (const v of item.variants) {
            if (v?.title) {
              await addMenuItemVariant(newId, v.title, v.price || 0);
            }
          }
        }
        if (Array.isArray(item.addons)) {
          for (const a of item.addons) {
            if (a?.title) {
              await addMenuItemAddon(newId, a.title, a.price || 0);
            }
          }
        }
        await mutate(APIURL);
        toast.dismiss();
        toast.success(`Duplicated "${item.title}"`);
      }
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error(
        err?.response?.data?.message || t("menu_items.something_went_wrong")
      );
    }
  };

  // Single Delete
  const btnDelete = (id, title) => {
    setDeleteItemData({ id, title });
  };

  const confirmDelete = async () => {
    if (!deleteItemData) return;
    try {
      toast.loading(t("menu_items.please_wait"));
      const res = await deleteMenuItem(deleteItemData.id);
      if (res.status === 200) {
        setSelectedIds((prev) => prev.filter((id) => id !== deleteItemData.id));
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || t("menu_items.something_went_wrong");
      console.error(err);
      toast.dismiss();
      toast.error(message);
    } finally {
      setDeleteItemData(null);
    }
  };

  const btnShowUpdate = (id) => {
    navigate(`/dashboard/settings/menu-items/${id}`);
  };

  const btnChangeItemVisibilty = async (id, isEnabled) => {
    try {
      toast.loading(t("menu_items.please_wait"));
      const res = await changeMenuItemVisibility(id, isEnabled);
      if (res.status === 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message || t("menu_items.something_went_wrong");
      console.error(err);
      toast.dismiss();
      toast.error(message);
    }
  };

  // Bulk Actions
  const handleBulkVisibility = async (enableFlag) => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      toast.loading(
        `${enableFlag ? "Activating" : "Hiding"} ${selectedIds.length} items...`
      );
      await Promise.all(
        selectedIds.map((id) => changeMenuItemVisibility(id, enableFlag))
      );
      await mutate(APIURL);
      toast.dismiss();
      toast.success(
        `${selectedIds.length} items ${enableFlag ? "activated" : "hidden"}!`
      );
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Failed to update some items.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkAssignCategory = async (newCatId) => {
    if (!newCatId || selectedIds.length === 0) return;
    const targetCategoryId = newCatId === "none" ? null : Number(newCatId);
    const itemsToUpdate = menuItems.filter((i) => selectedIds.includes(i.id));
    setIsBulkProcessing(true);
    try {
      toast.loading(`Updating category for ${itemsToUpdate.length} items...`);
      await Promise.all(
        itemsToUpdate.map((item) =>
          updateMenuItem(
            item.id,
            item.title,
            item.description,
            item.price,
            item.net_price,
            targetCategoryId,
            item.tax_id,
            item.kitchen_station_id
          )
        )
      );
      await mutate(APIURL);
      toast.dismiss();
      toast.success(`Updated category for ${itemsToUpdate.length} items!`);
      setBulkCategoryTarget("");
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Failed to update category for selected items.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkAssignStation = async (newStationVal) => {
    if (!newStationVal || selectedIds.length === 0) return;
    const targetStationId = newStationVal === "default" ? null : Number(newStationVal);
    const itemsToUpdate = menuItems.filter((i) => selectedIds.includes(i.id));
    setIsBulkProcessing(true);
    try {
      toast.loading(`Updating kitchen station for ${itemsToUpdate.length} items...`);
      await Promise.all(
        itemsToUpdate.map((item) =>
          updateMenuItem(
            item.id,
            item.title,
            item.description,
            item.price,
            item.net_price,
            item.category_id,
            item.tax_id,
            targetStationId
          )
        )
      );
      await mutate(APIURL);
      toast.dismiss();
      toast.success(`Updated kitchen station for ${itemsToUpdate.length} items!`);
      setBulkStationTarget("");
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Failed to update kitchen station for selected items.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      toast.loading(`Deleting ${selectedIds.length} items...`);
      await Promise.all(selectedIds.map((id) => deleteMenuItem(id)));
      await mutate(APIURL);
      toast.dismiss();
      toast.success(`Deleted ${selectedIds.length} items!`);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Failed to delete some items.");
    } finally {
      setIsBulkProcessing(false);
      setIsBulkDeleteModalOpen(false);
    }
  };

  return (
    <Page className="px-4 md:px-8 py-6 pb-28">
      {/* ── Top Header & Primary Actions ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-bold text-restro-text tracking-tight">
            {t("menu_items.title")}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your catalog, pricing, kitchen routing, and modifiers across{" "}
            <span className="font-semibold text-restro-text">
              {categories?.length || 0} categories
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto whitespace-nowrap py-0.5 no-scrollbar">
          <button
            id="btn-add-menu-item"
            onClick={openAddDrawer}
            className="min-h-[44px] rounded-xl border border-restro-border-green transition active:scale-95 hover:shadow-md px-4 py-2.5 text-sm whitespace-nowrap shrink-0 flex items-center gap-2 text-white bg-restro-green hover:bg-restro-green-button-hover font-semibold shadow-sm"
          >
            <IconPlus size={18} stroke={iconStroke} /> {t("menu_items.new")}
          </button>

          <Link
            to="categories"
            className="min-h-[44px] rounded-xl border border-restro-border-green transition active:scale-95 hover:shadow-sm px-3.5 py-2 text-sm whitespace-nowrap shrink-0 flex items-center gap-1.5 text-restro-text bg-restro-gray hover:bg-restro-button-hover font-medium"
          >
            <IconCategory2 size={18} stroke={iconStroke} />{" "}
            {t("menu_items.categories")}
          </Link>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="min-h-[44px] rounded-xl border border-restro-border-green transition active:scale-95 hover:shadow-sm px-3.5 py-2 text-sm whitespace-nowrap shrink-0 flex items-center gap-1.5 text-restro-text bg-restro-gray hover:bg-restro-button-hover font-medium"
          >
            <IconUpload size={18} stroke={iconStroke} /> Import
          </button>

          <button
            onClick={async () => {
              try {
                toast.loading("Exporting...");
                const response = await exportMenuItems();
                const blob = new Blob([response.data], { type: "text/csv" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "menu_items_export.csv";
                a.click();
                window.URL.revokeObjectURL(url);
                toast.dismiss();
                toast.success("Exported successfully!");
              } catch (err) {
                toast.dismiss();
                toast.error("Export failed.");
              }
            }}
            className="min-h-[44px] rounded-xl border border-restro-border-green transition active:scale-95 hover:shadow-sm px-3.5 py-2 text-sm whitespace-nowrap shrink-0 flex items-center gap-1.5 text-restro-text bg-restro-gray hover:bg-restro-button-hover font-medium"
          >
            <IconDownload size={18} stroke={iconStroke} /> Export
          </button>
        </div>
      </div>

      {/* ── Interactive KPI Summary Pills ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("all");
            setMissingPhotoOnly(false);
          }}
          className={clsx(
            "min-h-[56px] rounded-2xl border p-3.5 flex items-center justify-between text-left transition-all active:scale-95",
            statusFilter === "all" && !missingPhotoOnly
              ? "bg-restro-green/10 border-restro-green ring-1 ring-restro-green/40"
              : "bg-white dark:bg-[#202020] border-restro-border-green hover:border-restro-green/40"
          )}
        >
          <div>
            <p className="text-xs font-medium text-gray-500">Total Menu Items</p>
            <p className="text-xl font-bold text-restro-text mt-0.5">{stats.total}</p>
          </div>
          <span className="w-10 h-10 rounded-xl bg-restro-gray flex items-center justify-center text-restro-text">
            <IconCarrot size={20} stroke={iconStroke} />
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === "active" ? "all" : "active");
          }}
          className={clsx(
            "min-h-[56px] rounded-2xl border p-3.5 flex items-center justify-between text-left transition-all active:scale-95",
            statusFilter === "active"
              ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/40"
              : "bg-white dark:bg-[#202020] border-restro-border-green hover:border-emerald-500/40"
          )}
        >
          <div>
            <p className="text-xs font-medium text-gray-500">Active on POS</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.active}
            </p>
          </div>
          <span className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <IconEye size={20} stroke={iconStroke} />
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === "hidden" ? "all" : "hidden");
          }}
          className={clsx(
            "min-h-[56px] rounded-2xl border p-3.5 flex items-center justify-between text-left transition-all active:scale-95",
            statusFilter === "hidden"
              ? "bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/40"
              : "bg-white dark:bg-[#202020] border-restro-border-green hover:border-amber-500/40"
          )}
        >
          <div>
            <p className="text-xs font-medium text-gray-500">Hidden / 86&apos;d</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {stats.hidden}
            </p>
          </div>
          <span className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <IconEyeOff size={20} stroke={iconStroke} />
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMissingPhotoOnly((prev) => !prev)}
          className={clsx(
            "min-h-[56px] rounded-2xl border p-3.5 flex items-center justify-between text-left transition-all active:scale-95",
            missingPhotoOnly
              ? "bg-purple-500/10 border-purple-500 ring-1 ring-purple-500/40"
              : "bg-white dark:bg-[#202020] border-restro-border-green hover:border-purple-500/40"
          )}
        >
          <div>
            <p className="text-xs font-medium text-gray-500">Missing Photo</p>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">
              {stats.missingPhoto}
            </p>
          </div>
          <span className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <IconPhotoOff size={20} stroke={iconStroke} />
          </span>
        </button>
      </div>

      {/* ── Filter, Sort & View Mode Toolbar ── */}
      <div className="flex flex-col xl:flex-row gap-3 mb-4">
        {/* Search bar */}
        <div className="relative flex-1 min-w-[240px]">
          <IconSearch
            size={18}
            stroke={iconStroke}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search items by name, description, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-[42px] pl-10 pr-10 py-2 w-full text-sm rounded-xl border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green placeholder-gray-400"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              title="Clear search"
              className="w-8 h-8 rounded-lg flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition active:scale-95"
            >
              <IconX size={16} />
            </button>
          )}
        </div>

        {/* Controls group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status segmented control */}
          <div className="flex items-center bg-restro-gray rounded-xl p-1 border border-restro-border-green min-h-[42px]">
            {[
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "hidden", label: "Hidden" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={clsx(
                  "min-h-[34px] px-3 rounded-lg text-xs font-semibold transition active:scale-95",
                  statusFilter === tab.id
                    ? "bg-restro-green text-white shadow-sm"
                    : "text-restro-text hover:bg-restro-button-hover"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Kitchen Station Filter */}
          <div className="relative">
            <select
              aria-label="Filter by Kitchen Station"
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="min-h-[42px] text-xs font-medium rounded-xl px-3.5 py-2 border border-restro-border-green dark:bg-black bg-restro-gray text-restro-text focus:outline-restro-border-green"
            >
              <option value="all">All Kitchen Stations</option>
              <option value="override">Station Overrides Only</option>
              <option value="unassigned">Default / Unassigned Station</option>
              {stations
                ?.filter((s) => s.is_enabled)
                ?.map((st) => (
                  <option key={st.id} value={String(st.id)}>
                    Station: {st.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="relative flex items-center">
            <IconArrowsSort
              size={15}
              stroke={iconStroke}
              className="absolute left-3 text-gray-400 pointer-events-none"
            />
            <select
              aria-label="Sort menu items"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="min-h-[42px] pl-8 pr-3.5 py-2 text-xs font-medium rounded-xl border border-restro-border-green dark:bg-black bg-restro-gray text-restro-text focus:outline-restro-border-green"
            >
              <option value="name_asc">Sort: Name (A → Z)</option>
              <option value="name_desc">Sort: Name (Z → A)</option>
              <option value="price_asc">Sort: Price (Low → High)</option>
              <option value="price_desc">Sort: Price (High → Low)</option>
              <option value="category">Sort: Category</option>
            </select>
          </div>

          {/* Select All Filtered Button */}
          {filteredItems.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              className={clsx(
                "min-h-[42px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition active:scale-95",
                allFilteredSelected
                  ? "bg-restro-green/15 border-restro-green text-restro-green"
                  : "bg-restro-gray border-restro-border-green text-restro-text hover:bg-restro-button-hover"
              )}
            >
              {allFilteredSelected ? (
                <IconSquareCheckFilled size={16} className="text-restro-green" />
              ) : (
                <IconSquare size={16} stroke={iconStroke} />
              )}
              <span>{allFilteredSelected ? "Deselect All" : "Select All"}</span>
            </button>
          )}

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-[42px] px-3 rounded-xl border border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 hover:bg-red-100"
            >
              <IconFilterOff size={15} stroke={iconStroke} /> Reset
            </button>
          )}

          {/* View Mode Toggle (Grid vs Table) */}
          <div className="flex items-center bg-restro-gray rounded-xl p-1 border border-restro-border-green min-h-[42px] ml-auto">
            <button
              type="button"
              title="Visual Card Grid View"
              onClick={() => setViewMode("grid")}
              className={clsx(
                "w-9 h-[34px] rounded-lg flex items-center justify-center transition active:scale-95",
                viewMode === "grid"
                  ? "bg-restro-green text-white shadow-sm"
                  : "text-restro-text hover:bg-restro-button-hover"
              )}
            >
              <IconLayoutGrid size={17} stroke={iconStroke} />
            </button>
            <button
              type="button"
              title="High-Density Table View"
              onClick={() => setViewMode("table")}
              className={clsx(
                "w-9 h-[34px] rounded-lg flex items-center justify-center transition active:scale-95",
                viewMode === "table"
                  ? "bg-restro-green text-white shadow-sm"
                  : "text-restro-text hover:bg-restro-button-hover"
              )}
            >
              <IconList size={17} stroke={iconStroke} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Category Horizontal Touch Rail ── */}
      <div className="flex items-center gap-2 overflow-x-auto touch-pan-x no-scrollbar pb-2 mb-5">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={clsx(
            "min-h-[42px] px-4 py-2 rounded-full text-xs font-semibold transition active:scale-95 shrink-0 border flex items-center gap-1.5",
            selectedCategory === "all"
              ? "bg-restro-green text-white border-restro-green shadow-sm"
              : "text-restro-text bg-restro-gray border-restro-border-green hover:bg-restro-button-hover"
          )}
        >
          <span>All Categories</span>
          <span
            className={clsx(
              "px-1.5 py-0.5 rounded-full text-[10px]",
              selectedCategory === "all"
                ? "bg-white/20 text-white"
                : "bg-black/5 dark:bg-white/10 text-gray-500"
            )}
          >
            {categoryItemCounts.all || 0}
          </span>
        </button>

        {categories?.map((cat) => {
          const isSelected = String(selectedCategory) === String(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(String(cat.id))}
              className={clsx(
                "min-h-[42px] px-4 py-2 rounded-full text-xs font-semibold transition active:scale-95 shrink-0 border whitespace-nowrap flex items-center gap-1.5",
                isSelected
                  ? "bg-restro-green text-white border-restro-green shadow-sm"
                  : "text-restro-text bg-restro-gray border-restro-border-green hover:bg-restro-button-hover"
              )}
            >
              <span>{cat.title}</span>
              <span
                className={clsx(
                  "px-1.5 py-0.5 rounded-full text-[10px]",
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-black/5 dark:bg-white/10 text-gray-500"
                )}
              >
                {categoryItemCounts[cat.id] || 0}
              </span>
            </button>
          );
        })}

        {categoryItemCounts.uncategorized > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory("uncategorized")}
            className={clsx(
              "min-h-[42px] px-4 py-2 rounded-full text-xs font-semibold transition active:scale-95 shrink-0 border whitespace-nowrap flex items-center gap-1.5",
              selectedCategory === "uncategorized"
                ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                : "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/50 hover:bg-amber-100"
            )}
          >
            <span>Uncategorized</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 dark:bg-white/10">
              {categoryItemCounts.uncategorized}
            </span>
          </button>
        )}
      </div>

      {/* ── Empty State ── */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-restro-border-green bg-restro-gray/40">
          <div className="w-16 h-16 rounded-2xl bg-restro-gray flex items-center justify-center mb-4 text-gray-400 border border-restro-border-green">
            <IconCarrot size={32} stroke={iconStroke} />
          </div>
          <p className="text-base font-bold text-restro-text mb-1">
            No menu items match your view
          </p>
          <p className="text-sm text-gray-500 max-w-md mb-5">
            {hasActiveFilters
              ? "Try adjusting your search query, category pill, or status/station filters."
              : "Add your first menu item or import a CSV catalog to get started."}
          </p>
          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-restro-border-green bg-white dark:bg-[#252525] text-sm font-semibold text-restro-text hover:bg-restro-button-hover transition active:scale-95"
              >
                Reset All Filters
              </button>
            )}
            <button
              type="button"
              onClick={openAddDrawer}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-restro-green text-white text-sm font-semibold hover:bg-restro-green-button-hover transition active:scale-95 flex items-center gap-1.5"
            >
              <IconPlus size={16} stroke={iconStroke} /> {t("menu_items.new")}
            </button>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* ── Visual Card Grid View ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredItems.map((menuItem) => {
            const {
              id,
              title,
              description,
              price,
              net_price,
              tax_title,
              tax_rate,
              category_title,
              addons,
              variants,
              is_enabled,
              image,
              kitchen_station_id,
              effective_kitchen_station_name,
              effective_kitchen_station_color,
            } = menuItem;
            const imageURL = image ? getImageURL(image) : null;
            const isSelected = selectedIds.includes(id);

            return (
              <div
                key={id}
                onClick={() => btnShowUpdate(id)}
                className={clsx(
                  "group relative flex flex-col rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
                  isSelected
                    ? "ring-2 ring-restro-green border-restro-green bg-white dark:bg-[#252525]"
                    : is_enabled
                    ? "bg-white dark:bg-[#252525] border-restro-border-green hover:border-restro-green/60"
                    : "bg-gray-100/90 dark:bg-[#181818] border-restro-border-green opacity-75"
                )}
              >
                {/* Image area */}
                <div className="relative w-full h-44 bg-restro-gray overflow-hidden flex items-center justify-center flex-shrink-0">
                  {imageURL ? (
                    <img
                      src={imageURL}
                      alt={title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 gap-1.5">
                      <IconCarrot size={34} stroke={iconStroke} />
                      <span className="text-[11px] font-medium text-gray-400">
                        No photo
                      </span>
                    </div>
                  )}

                  {/* Multi-select checkbox (top-left) */}
                  <button
                    type="button"
                    title={isSelected ? "Deselect item" : "Select item"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectItem(id);
                    }}
                    className={clsx(
                      "w-9 h-9 rounded-xl flex items-center justify-center absolute top-2.5 left-2.5 z-10 transition active:scale-95 backdrop-blur-md border",
                      isSelected
                        ? "bg-restro-green text-white border-restro-green shadow-md"
                        : "bg-black/45 hover:bg-black/65 text-white border-white/25"
                    )}
                  >
                    {isSelected ? (
                      <IconCheck size={18} stroke={2.5} />
                    ) : (
                      <IconSquare size={18} stroke={iconStroke} />
                    )}
                  </button>

                  {/* Quick Toggle Active / Hidden pill (top-right) */}
                  <button
                    type="button"
                    title={is_enabled ? "Click to hide from POS" : "Click to activate on POS"}
                    onClick={(e) => {
                      e.stopPropagation();
                      btnChangeItemVisibilty(id, !is_enabled);
                    }}
                    className={clsx(
                      "min-h-[30px] px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border flex items-center gap-1 absolute top-2.5 right-2.5 z-10 transition active:scale-95 shadow-sm",
                      is_enabled
                        ? "bg-emerald-500/95 hover:bg-emerald-600 text-white border-emerald-300/40"
                        : "bg-gray-700/90 hover:bg-gray-800 text-gray-200 border-gray-500/40"
                    )}
                  >
                    {is_enabled ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        Active
                      </>
                    ) : (
                      <>
                        <IconEyeOff size={12} stroke={2} />
                        Hidden
                      </>
                    )}
                  </button>

                  {/* Category overlay strip */}
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-gradient-to-t from-black/75 via-black/45 to-transparent flex items-center justify-between gap-2">
                    <span className="text-[11px] text-white font-semibold truncate">
                      {category_title || "Uncategorized"}
                    </span>
                    {effective_kitchen_station_name && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-black/65 text-white border border-white/15 shrink-0"
                        title={
                          kitchen_station_id
                            ? `Station Override: ${effective_kitchen_station_name}`
                            : `Category Station: ${effective_kitchen_station_name}`
                        }
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              effective_kitchen_station_color || "#f97316",
                          }}
                        />
                        <span className="truncate max-w-[90px]">
                          {effective_kitchen_station_name}
                        </span>
                        {kitchen_station_id && (
                          <span className="text-[9px] text-amber-300">*</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <div className="flex flex-col flex-1 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm text-restro-text group-hover:text-restro-green transition-colors line-clamp-1 leading-snug">
                      {title}
                    </p>
                  </div>

                  {description ? (
                    <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                      {description}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400/70 italic mt-1">
                      No description
                    </p>
                  )}

                  {/* Modifiers & Tax Chips */}
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    {variants?.length > 0 && (
                      <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-500/20">
                        {variants.length} Variant{variants.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {addons?.length > 0 && (
                      <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-purple-500/20">
                        {addons.length} Addon{addons.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {tax_title && (
                      <span className="bg-restro-gray text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-full border border-restro-border-green">
                        {tax_title} ({tax_rate}%)
                      </span>
                    )}
                  </div>

                  {/* Price + Touch Action Bar */}
                  <div className="mt-auto pt-3.5 border-t border-restro-border-green/60 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-restro-green font-extrabold text-base">
                        {formatPrice(price)}
                      </span>
                      {net_price ? (
                        <span className="block text-[10px] text-gray-400">
                          Net: {formatPrice(net_price)}
                        </span>
                      ) : null}
                    </div>

                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        title="Quick Edit in Drawer"
                        onClick={() => openQuickEditDrawer(menuItem)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-95 text-restro-text bg-restro-gray/70 hover:bg-restro-button-hover border border-transparent hover:border-restro-border-green"
                      >
                        <IconAdjustmentsHorizontal size={17} stroke={iconStroke} />
                      </button>

                      <button
                        type="button"
                        title="Duplicate Item"
                        onClick={() => handleDuplicateItem(menuItem)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-95 text-restro-text bg-restro-gray/70 hover:bg-restro-button-hover border border-transparent hover:border-restro-border-green"
                      >
                        <IconCopy size={16} stroke={iconStroke} />
                      </button>

                      <button
                        type="button"
                        title="Open Full Details (Variants, Addons, Recipe)"
                        onClick={() => btnShowUpdate(id)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-95 text-restro-text bg-restro-gray/70 hover:bg-restro-button-hover border border-transparent hover:border-restro-border-green"
                      >
                        <IconPencil size={16} stroke={iconStroke} />
                      </button>

                      <button
                        type="button"
                        title="Delete Item"
                        onClick={() => btnDelete(id, title)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-red-500 transition active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <IconTrash size={16} stroke={iconStroke} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── High-Density Table / List View (QuickBooks Style) ── */
        <div className="w-full overflow-x-auto border-t border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-neutral-800 text-[13px] font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-[#18181b]">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    aria-label="Select all menu items"
                    className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">Menu item</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Kitchen station</th>
                <th className="py-3 px-3">Modifiers</th>
                <th className="py-3 px-3">Price / Tax</th>
                <th className="py-3 px-3">POS status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
                {filteredItems.map((menuItem) => {
                  const {
                    id,
                    title,
                    description,
                    price,
                    net_price,
                    tax_title,
                    tax_rate,
                    category_title,
                    addons,
                    variants,
                    is_enabled,
                    image,
                    kitchen_station_id,
                    effective_kitchen_station_name,
                    effective_kitchen_station_color,
                  } = menuItem;
                  const imageURL = image ? getImageURL(image) : null;
                  const isSelected = selectedIds.includes(id);

                  return (
                    <tr
                      key={id}
                      onClick={() => btnShowUpdate(id)}
                      className={clsx(
                        "group cursor-pointer transition hover:bg-slate-50/70 dark:hover:bg-neutral-800/40",
                        isSelected
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                          : "",
                        !is_enabled && "opacity-70"
                      )}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3 px-3 text-center w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-neutral-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* Thumbnail + Title */}
                      <td className="py-3 px-3 min-w-[220px]">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-restro-gray border border-restro-border-green overflow-hidden flex items-center justify-center shrink-0">
                            {imageURL ? (
                              <img
                                src={imageURL}
                                alt={title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <IconCarrot
                                size={20}
                                stroke={iconStroke}
                                className="text-gray-400"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-restro-text group-hover:text-restro-green transition-colors truncate">
                              {title}
                            </p>
                            {description && (
                              <p className="text-xs text-gray-500 truncate max-w-[260px]">
                                {description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {category_title ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-restro-gray text-restro-text border border-restro-border-green">
                            {category_title}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Uncategorized
                          </span>
                        )}
                      </td>

                      {/* Kitchen Station */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {effective_kitchen_station_name ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-black/5 dark:border-white/10"
                            style={{
                              backgroundColor: `${
                                effective_kitchen_station_color || "#f97316"
                              }20`,
                              color: effective_kitchen_station_color || "#f97316",
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor:
                                  effective_kitchen_station_color || "#f97316",
                              }}
                            />
                            <span>{effective_kitchen_station_name}</span>
                            {kitchen_station_id && (
                              <span className="text-[10px] opacity-80 font-normal">
                                (Override)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            Default Kitchen
                          </span>
                        )}
                      </td>

                      {/* Modifiers */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {variants?.length > 0 && (
                            <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                              {variants.length} Var
                            </span>
                          )}
                          {addons?.length > 0 && (
                            <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                              {addons.length} Addon
                            </span>
                          )}
                          {(!variants || variants.length === 0) &&
                            (!addons || addons.length === 0) && (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                        </div>
                      </td>

                      {/* Price & Tax */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-restro-green text-sm">
                          {formatPrice(price)}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {net_price ? `Net ${formatPrice(net_price)}` : ""}
                          {net_price && tax_title ? " • " : ""}
                          {tax_title ? `${tax_title} (${tax_rate}%)` : ""}
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td
                        className="py-3 px-3 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => btnChangeItemVisibilty(id, !is_enabled)}
                          className={clsx(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border transition active:scale-95",
                            is_enabled
                              ? "bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/70 dark:text-emerald-400 border-[#bbf7d0] dark:border-emerald-800"
                              : "bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400 border-slate-200 dark:border-neutral-700"
                          )}
                        >
                          {is_enabled ? "Active" : "Hidden"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 pl-3 pr-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Quick Edit in Drawer"
                            onClick={() => openQuickEditDrawer(menuItem)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-95 text-restro-text hover:bg-restro-button-hover"
                          >
                            <IconAdjustmentsHorizontal
                              size={17}
                              stroke={iconStroke}
                            />
                          </button>
                          <button
                            type="button"
                            title="Duplicate Item"
                            onClick={() => handleDuplicateItem(menuItem)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-95 text-restro-text hover:bg-restro-button-hover"
                          >
                            <IconCopy size={17} stroke={iconStroke} />
                          </button>
                          <button
                            type="button"
                            title="Open Full Details"
                            onClick={() => btnShowUpdate(id)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-95 text-restro-text hover:bg-restro-button-hover"
                          >
                            <IconPencil size={17} stroke={iconStroke} />
                          </button>
                          <button
                            type="button"
                            title="Delete Item"
                            onClick={() => btnDelete(id, title)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-red-500 transition active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <IconTrash size={17} stroke={iconStroke} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {/* ── Floating Multi-Select Bulk Action Bar ── */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 w-[95%] max-w-4xl rounded-2xl bg-gray-900/95 dark:bg-[#141414]/95 text-white backdrop-blur-md border border-white/15 shadow-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-xl bg-restro-green text-white text-xs font-extrabold">
              {selectedIds.length} Selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-gray-300 hover:text-white underline transition"
            >
              Clear selection
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isBulkProcessing}
              onClick={() => handleBulkVisibility(true)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
            >
              <IconEye size={15} stroke={iconStroke} /> Activate
            </button>

            <button
              type="button"
              disabled={isBulkProcessing}
              onClick={() => handleBulkVisibility(false)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
            >
              <IconEyeOff size={15} stroke={iconStroke} /> Hide
            </button>

            {/* Bulk Assign Category */}
            <select
              aria-label="Bulk Assign Category"
              disabled={isBulkProcessing}
              value={bulkCategoryTarget}
              onChange={(e) => handleBulkAssignCategory(e.target.value)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 focus:outline-none"
            >
              <option value="" className="text-black">
                Move to Category...
              </option>
              <option value="none" className="text-black">
                Remove Category (Uncategorized)
              </option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id} className="text-black">
                  {cat.title}
                </option>
              ))}
            </select>

            {/* Bulk Assign Kitchen Station */}
            <select
              aria-label="Bulk Assign Kitchen Station"
              disabled={isBulkProcessing}
              value={bulkStationTarget}
              onChange={(e) => handleBulkAssignStation(e.target.value)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 focus:outline-none"
            >
              <option value="" className="text-black">
                Assign Station...
              </option>
              <option value="default" className="text-black">
                Category Default (Auto-route)
              </option>
              {stations
                ?.filter((s) => s.is_enabled)
                ?.map((st) => (
                  <option key={st.id} value={st.id} className="text-black">
                    {st.name}
                  </option>
                ))}
            </select>

            <button
              type="button"
              disabled={isBulkProcessing}
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
            >
              <IconTrash size={15} stroke={iconStroke} /> Delete
            </button>
          </div>
        </div>
      )}

      {/* ── Unified Add / Quick-Edit Slide-Over Drawer ── */}
      <div
        onClick={() => !isSavingDrawer && setIsDrawerOpen(false)}
        className={clsx(
          "fixed inset-0 bg-black/45 backdrop-blur-sm z-40 transition-opacity duration-300",
          isDrawerOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      />
      <div
        className={clsx(
          "fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-[#1a1a1a] shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out border-l border-restro-border-green",
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-restro-border-green shrink-0">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-restro-green">
              {editingItem ? "Quick Edit Menu Item" : "Create Menu Item"}
            </span>
            <h3 className="text-lg font-bold text-restro-text">
              {editingItem ? editingItem.title : "Add New Item"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-restro-text hover:bg-restro-button-hover transition active:scale-95"
          >
            <IconX size={20} stroke={iconStroke} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Photo Upload + Active Toggle Row */}
          <div className="flex items-center gap-4 p-3.5 rounded-2xl border border-restro-border-green bg-restro-gray/40">
            <div className="relative w-20 h-20 rounded-xl bg-restro-gray border border-restro-border-green overflow-hidden flex items-center justify-center shrink-0">
              {stagedPhotoPreview ? (
                <img
                  src={stagedPhotoPreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <IconPhoto size={28} stroke={iconStroke} className="text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-restro-text mb-1">Item Photo</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="min-h-[38px] px-3 py-1.5 rounded-xl bg-restro-green text-white text-xs font-semibold cursor-pointer hover:bg-restro-green-button-hover transition active:scale-95 inline-flex items-center gap-1.5">
                  <IconUpload size={14} stroke={iconStroke} />
                  <span>{stagedPhotoPreview ? "Change Photo" : "Upload Photo"}</span>
                  <input
                    ref={drawerFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleDrawerFileChange}
                    className="hidden"
                  />
                </label>
                {stagedPhotoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveDrawerPhoto}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl border border-red-300 dark:border-red-800/50 text-red-500 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 transition active:scale-95 inline-flex items-center gap-1"
                  >
                    <IconTrash size={14} stroke={iconStroke} /> Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Auto-compressed for fast POS loading.
              </p>
            </div>
          </div>

          {/* Visibility status toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl border border-restro-border-green bg-restro-gray/30">
            <div>
              <p className="text-sm font-semibold text-restro-text">
                Available on POS & QR Menu
              </p>
              <p className="text-xs text-gray-500">
                Toggle off to temporarily hide (86) this item
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormIsEnabled((prev) => !prev)}
              className={clsx(
                "min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border",
                formIsEnabled
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                  : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700"
              )}
            >
              {formIsEnabled ? (
                <>
                  <IconEye size={16} stroke={iconStroke} /> Active
                </>
              ) : (
                <>
                  <IconEyeOff size={16} stroke={iconStroke} /> Hidden
                </>
              )}
            </button>
          </div>

          {/* Item Title */}
          <div>
            <label className="mb-1.5 block text-gray-500 text-xs font-bold uppercase tracking-wide">
              {t("menu_items.item_title")} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="min-h-[44px] text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
              placeholder={t("menu_items.enter_item_title")}
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-gray-500 text-xs font-bold uppercase tracking-wide">
              {t("menu_items.item_description")}
              <span className="text-[11px] font-normal text-gray-400 ml-1">
                {t("menu_items.max_chars")}
              </span>
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green resize-none"
              placeholder={t("menu_items.enter_item_description")}
              rows="2"
              maxLength={500}
            />
          </div>

          {/* Price & Net Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-gray-500 text-xs font-bold uppercase tracking-wide">
                {t("menu_items.item_price")} ({currency}){" "}
                <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                className="min-h-[44px] text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-gray-500 text-xs font-bold uppercase tracking-wide">
                {t("menu_items.item_net_price")} ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formNetPrice}
                onChange={(e) => setFormNetPrice(e.target.value)}
                className="min-h-[44px] text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Category & Tax */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-gray-500 text-xs font-bold uppercase tracking-wide">
                {t("menu_items.item_category")}
              </label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="min-h-[44px] text-sm w-full rounded-xl px-3.5 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
              >
                <option value="">{t("menu_items.none")}</option>
                {categories?.map((category) => (
                  <option value={String(category.id)} key={category.id}>
                    {category.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-gray-500 text-xs font-bold uppercase tracking-wide">
                {t("menu_items.item_tax")}
              </label>
              <select
                value={formTaxId}
                onChange={(e) => setFormTaxId(e.target.value)}
                className="min-h-[44px] text-sm w-full rounded-xl px-3.5 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
              >
                <option value="">{t("menu_items.none")}</option>
                {taxes?.map((tax) => (
                  <option value={String(tax.id)} key={tax.id}>
                    {tax.title} - {tax.rate}% ({tax.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Kitchen Station */}
          <div>
            <label className="mb-1.5 block text-gray-500 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
              <IconChefHat size={15} stroke={iconStroke} />
              Kitchen Station Routing
            </label>
            <select
              value={formKitchenStationId}
              onChange={(e) => setFormKitchenStationId(e.target.value)}
              className="min-h-[44px] text-sm w-full rounded-xl px-3.5 py-2.5 border border-restro-border-green dark:bg-black bg-restro-gray focus:outline-restro-border-green"
            >
              <option value="">Category Default (Auto-routes by category)</option>
              {stations
                ?.filter((s) => s.is_enabled)
                ?.map((station) => (
                  <option value={String(station.id)} key={station.id}>
                    {station.name}
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Override prep station routing for this specific item, or leave as
              Category Default.
            </p>
          </div>
        </div>

        {/* Sticky Drawer Footer */}
        <div className="px-6 py-4 border-t border-restro-border-green shrink-0 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur flex flex-col gap-2.5">
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={isSavingDrawer}
              onClick={() => setIsDrawerOpen(false)}
              className="min-h-[46px] px-4 py-2.5 rounded-xl border border-restro-border-green text-sm font-semibold text-restro-text bg-restro-gray hover:bg-restro-button-hover transition active:scale-95"
            >
              {t("menu_items.close")}
            </button>
            <button
              type="button"
              disabled={isSavingDrawer}
              onClick={() => handleSaveDrawer(false)}
              className="min-h-[46px] flex-1 rounded-xl border border-restro-border-green px-4 py-2.5 text-sm font-bold text-white bg-restro-green hover:bg-restro-green-button-hover transition active:scale-95 shadow-sm"
            >
              {editingItem ? "Save Changes" : t("menu_items.save")}
            </button>
          </div>

          <button
            type="button"
            disabled={isSavingDrawer}
            onClick={() => handleSaveDrawer(true)}
            className="min-h-[42px] w-full rounded-xl border border-restro-green/40 bg-restro-green/10 hover:bg-restro-green/20 text-restro-green text-xs font-bold px-4 py-2 flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <span>
              {editingItem
                ? "Save & Manage Variants, Addons & Recipes"
                : "Save & Configure Variants / Addons"}
            </span>
            <IconExternalLink size={15} stroke={iconStroke} />
          </button>
        </div>
      </div>

      {/* Import Modal */}
      <ImportMenuItemsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => mutate(APIURL)}
      />

      {/* Single Delete Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(deleteItemData)}
        onClose={() => setDeleteItemData(null)}
        onConfirm={confirmDelete}
        title="Delete Menu Item?"
        description={
          deleteItemData
            ? `Are you sure you want to delete "${deleteItemData.title}"? ${t(
                "menu_items.process_irreversible"
              )}`
            : t("menu_items.process_irreversible")
        }
        cancelText={t("menu_items.close") || "Cancel"}
        confirmText="Delete Item"
      />

      {/* Bulk Delete Confirmation Modal */}
      <DeleteModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title={`Delete ${selectedIds.length} Selected Items?`}
        description={`You are about to permanently delete ${selectedIds.length} menu items. This action cannot be undone.`}
        cancelText={t("menu_items.close") || "Cancel"}
        confirmText={`Delete ${selectedIds.length} Items`}
      />
    </Page>
  );
}
