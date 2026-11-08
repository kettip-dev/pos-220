import React, { useEffect, useRef, useState } from "react";
import Page from "../../components/Page";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addMenuItem,
  addMenuItemAddon,
  addMenuItemRecipeItem,
  addMenuItemVariant,
  changeMenuItemVisibility,
  deleteMenuItem,
  deleteMenuItemAddon,
  deleteMenuItemVariant,
  deleteRecipeItem,
  getMenuItem,
  getMenuItemImageSuggestions,
  removeMenuItemPhoto,
  selectMenuItemImageSuggestion,
  updateMenuItem,
  setMenuItemBarcode,
  setMenuItemPrepMinutes,
  updateMenuItemRecipeItem,
  updateMenuItemVariant,
  uploadMenuItemPhoto,
} from "../../controllers/menu_item.controller";
import {
  useCategories,
  useTaxes,
  useStoreSettings,
} from "../../controllers/settings.controller";
import { useKitchenStations } from "../../controllers/kitchen_stations.controller";
import toast from "react-hot-toast";
import {
  IconArrowLeft,
  IconCarrot,
  IconCheck,
  IconChefHat,
  IconCopy,
  IconDeviceFloppy,
  IconEye,
  IconEyeOff,
  IconLink,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import imageCompression from "browser-image-compression";
import { getImageURL, setImageStorageConfig } from "../../helpers/ImageHelper";
import { useTranslation } from "react-i18next";
import AsyncSelect from "react-select/async";
import { useTheme } from "../../contexts/ThemeContext";
import DeleteModal from "../../components/DeleteModal";
import clsx from "clsx";
import ItemAddonsCard, { ADDON_LIBRARY_PATH } from "../../components/menu/ItemAddonsCard";
import TranslationFields, { normalizeTranslations, useTranslationsEnabled } from "../../components/menu/TranslationFields";

export default function MenuItemViewPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const params = useParams();
  const itemId = params.id;

  // Store settings for currency
  const { data: storeSettings } = useStoreSettings();
  const currency = storeSettings?.currency || "$";
  const isKitchenEnabled = storeSettings?.isKitchenEnabled !== false;

  const formatPrice = (val) => {
    const num = Number(val);
    if (val === null || val === undefined || val === "" || Number.isNaN(num)) {
      return `${currency}0.00`;
    }
    return `${currency}${num.toFixed(2)}`;
  };

  // Controlled form state for reactive Live POS Preview & dirty tracking
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTranslations, setFormTranslations] = useState({});
  const [variantUpdateTranslations, setVariantUpdateTranslations] = useState({});
  const translationsEnabled = useTranslationsEnabled();
  const [formPrice, setFormPrice] = useState("");
  const [formNetPrice, setFormNetPrice] = useState("");
  const [formBarcode, setFormBarcode] = useState("");
  const [formPrepMinutes, setFormPrepMinutes] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formTaxId, setFormTaxId] = useState("");
  const [formKitchenStationId, setFormKitchenStationId] = useState("");

  // Inline quick-add state for Variants & Addons
  const [inlineVariantTitle, setInlineVariantTitle] = useState("");
  const [inlineVariantPrice, setInlineVariantPrice] = useState("");

  // Legacy modal refs for editing variants/addons
  const variantIdRef = useRef();
  const variantTitleUpdateRef = useRef();
  const variantPriceUpdateRef = useRef();


  // Image management state
  const [aiImageSuggestions, setAiImageSuggestions] = useState([]);
  const [isLoadingAiSuggestions, setIsLoadingAiSuggestions] = useState(false);
  const [selectingImageUrl, setSelectingImageUrl] = useState(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageUrlPreviewError, setImageUrlPreviewError] = useState(false);
  const [isSavingImageUrl, setIsSavingImageUrl] = useState(false);

  // Recipe management state
  const [activeAddRecipeItemTab, setActiveAddRecipeItemTab] = useState("item");
  const quantityRef = useRef();
  const [selectedRecipeData, setSelectedRecipeData] = useState({
    ingredient: null,
    selectedBase: null,
  });

  const [editRecipeData, setEditRecipeData] = useState({
    id: null,
    ingredient: null,
    quantity: null,
    selectedBase: null,
    baseType: "item",
  });
  const quantityEditRef = useRef(null);

  // Unified DeleteModal state (replaces all window.confirm calls)
  // { type: 'item' | 'photo' | 'variant' | 'addon' | 'recipe', payload: any, title: string, description: string }
  const [deleteConfirmState, setDeleteConfirmState] = useState(null);

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

  const { data: stations } = useKitchenStations();

  const [state, setState] = useState({
    menuItem: {},
    inventoryItems: [],
    variants: [],
    addons: [],
    recipeItems: [],
  });

  useEffect(() => {
    _init(itemId);
  }, [itemId]);

  const _init = async (id) => {
    try {
      const res = await getMenuItem(id);
      if (res.status === 200) {
        if (res.data?.imageStorageConfig) {
          setImageStorageConfig(res.data.imageStorageConfig);
        }

        const item = res.data?.formattedMenuItem || {};
        setFormTitle(item.title || "");
        setFormDescription(item.description || "");
        setFormTranslations(normalizeTranslations(item.translations));
        setFormPrice(
          item.price !== null && item.price !== undefined ? String(item.price) : ""
        );
        setFormNetPrice(
          item.net_price !== null && item.net_price !== undefined
            ? String(item.net_price)
            : ""
        );
        setFormCategoryId(item.category_id ? String(item.category_id) : "");
        setFormBarcode(item.barcode || "");
        setFormPrepMinutes(item.prep_minutes ? String(item.prep_minutes) : "");
        setFormTaxId(item.tax_id ? String(item.tax_id) : "");
        setFormKitchenStationId(
          item.kitchen_station_id ? String(item.kitchen_station_id) : ""
        );

        setState({
          menuItem: item,
          variants: item.variants || [],
          addons: item.addons || [],
          recipeItems: item.recipeItems || [],
          inventoryItems: res.data?.inventoryItems || [],
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoadingCategories || isLoadingTaxes) {
    return <Page className="px-4 md:px-8 py-6">{t("menu_item.please_wait")}</Page>;
  }

  if (errorCategories || errorTaxes) {
    return (
      <Page className="px-4 md:px-8 py-6">
        {t("menu_item.error_loading_details")}
      </Page>
    );
  }

  const {
    id,
    title,
    image,
    is_enabled,
    category_kitchen_station_name,
  } = state.menuItem;
  const imageURL = image ? getImageURL(image) : null;

  // Save core item details
  async function btnSave() {
    const cleanTitle = formTitle.trim();
    const cleanDescription = formDescription.trim() || null;
    const priceVal = formPrice !== "" ? Number(formPrice) : "";
    const netPriceVal = formNetPrice !== "" ? Number(formNetPrice) : null;
    const categoryId = formCategoryId || null;
    const taxId = formTaxId || null;
    const kitchenStationId = formKitchenStationId || null;

    if (!cleanTitle) {
      toast.error(t("menu_item.provide_title_error"));
      return;
    }

    if (priceVal === "" || Number.isNaN(priceVal) || priceVal < 0) {
      toast.error(t("menu_item.provide_valid_price_error"));
      return;
    }

    try {
      toast.loading(t("menu_item.please_wait"));
      const res = await updateMenuItem(
        id,
        cleanTitle,
        cleanDescription,
        priceVal,
        netPriceVal,
        categoryId,
        taxId,
        kitchenStationId,
        translationsEnabled ? formTranslations : undefined
      );

      if (res.status === 200) {
        // Barcode is saved separately (unique per business).
        if ((formBarcode || "").trim() !== (state.menuItem?.barcode || "")) {
          await setMenuItemBarcode(id, formBarcode.trim() || null);
        }
        if (String(formPrepMinutes || "") !== String(state.menuItem?.prep_minutes || "")) {
          await setMenuItemPrepMinutes(id, formPrepMinutes === "" ? null : Number(formPrepMinutes));
        }
        await _init(itemId);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || t("menu_items.something_went_wrong");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  }

  // Toggle Active / Hidden status right from Detail Page Header
  const handleToggleVisibility = async () => {
    try {
      toast.loading(t("menu_item.please_wait"));
      const nextStatus = !is_enabled;
      const res = await changeMenuItemVisibility(id, nextStatus);
      if (res.status === 200) {
        await _init(itemId);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error(
        error?.response?.data?.message || t("menu_items.something_went_wrong")
      );
    }
  };

  // Duplicate Item from Detail Page
  const handleDuplicateCurrentItem = async () => {
    try {
      toast.loading(`Duplicating "${formTitle || title}"...`);
      const res = await addMenuItem(
        `${formTitle || title} (Copy)`,
        formDescription || null,
        formPrice || 0,
        formNetPrice || null,
        formCategoryId || null,
        formTaxId || null,
        formKitchenStationId || null,
        translationsEnabled ? formTranslations : undefined
      );
      if (res.status === 200 && res.data?.menuItemId) {
        const newId = res.data.menuItemId;
        for (const v of state.variants || []) {
          if (v?.title) {
            await addMenuItemVariant(newId, v.title, v.price || 0, v.translations || undefined);
          }
        }
        for (const a of state.addons || []) {
          if (a?.title) {
            await addMenuItemAddon(newId, a.title, a.price || 0, a.translations || undefined);
          }
        }
        toast.dismiss();
        toast.success("Duplicated item! Opening copy...");
        navigate(`/dashboard/settings/menu-items/${newId}`);
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error(
        error?.response?.data?.message || t("menu_items.something_went_wrong")
      );
    }
  };

  // Unified DeleteModal confirmation executor
  const handleConfirmDeleteModal = async () => {
    if (!deleteConfirmState) return;
    const { type, payload } = deleteConfirmState;
    setDeleteConfirmState(null);

    try {
      toast.loading(t("menu_item.please_wait"));

      if (type === "item") {
        const res = await deleteMenuItem(id);
        if (res.status === 200) {
          toast.dismiss();
          toast.success(res.data.message);
          navigate("/dashboard/settings/menu-items");
          return;
        }
      } else if (type === "photo") {
        const res = await removeMenuItemPhoto(itemId);
        if (res.status === 200) {
          toast.dismiss();
          toast.success(res.data.message);
          await _init(itemId);
        }
      } else if (type === "variant") {
        const res = await deleteMenuItemVariant(id, payload.variantId);
        if (res.status === 200) {
          await _init(itemId);
          toast.dismiss();
          toast.success(res.data.message);
        }
      } else if (type === "addon") {
        const res = await deleteMenuItemAddon(id, payload.addonId);
        if (res.status === 200) {
          await _init(itemId);
          toast.dismiss();
          toast.success(res.data.message);
        }
      } else if (type === "recipe") {
        const res = await deleteRecipeItem(
          itemId,
          payload.recipeItemId,
          payload.variantId,
          payload.addonId
        );
        if (res.status === 200) {
          await _init(itemId);
          toast.dismiss();
          toast.success(res.data.message);
        }
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error(
        error?.response?.data?.message || t("menu_items.something_went_wrong")
      );
    }
  };

  // Variants Add & Update
  async function handleInlineAddVariant() {
    const variantTitle = inlineVariantTitle.trim();
    const variantPrice = inlineVariantPrice !== "" ? Number(inlineVariantPrice) : 0;

    if (!variantTitle) {
      toast.error(t("menu_item.provide_variant_title_error"));
      return;
    }
    if (variantPrice < 0) {
      toast.error(t("menu_item.provide_valid_variant_price_error"));
      return;
    }

    try {
      toast.loading(t("menu_item.please_wait"));
      const res = await addMenuItemVariant(id, variantTitle, variantPrice);

      if (res.status === 200) {
        setInlineVariantTitle("");
        setInlineVariantPrice("");
        await _init(itemId);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || t("menu_items.something_went_wrong");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  }

  const btnShowVariantUpdate = (variantId, vTitle, vPrice, vTranslations = null) => {
    setVariantUpdateTranslations(normalizeTranslations(vTranslations));
    variantIdRef.current.value = variantId;
    variantTitleUpdateRef.current.value = vTitle;
    variantPriceUpdateRef.current.value = vPrice;
    document.getElementById("modal-update-variant").showModal();
  };

  async function btnUpdateVariant() {
    const variantId = variantIdRef.current.value;
    const variantTitle = variantTitleUpdateRef.current.value?.trim();
    const variantPrice = variantPriceUpdateRef.current.value || 0;

    if (!variantTitle) {
      toast.error(t("menu_item.provide_variant_title_error"));
      return;
    }
    if (variantPrice < 0) {
      toast.error(t("menu_item.provide_valid_variant_price_error"));
      return;
    }

    try {
      toast.loading(t("menu_item.please_wait"));
      const res = await updateMenuItemVariant(
        id,
        variantId,
        variantTitle,
        variantPrice,
        translationsEnabled ? variantUpdateTranslations : undefined
      );

      if (res.status === 200) {
        variantIdRef.current.value = null;
        variantTitleUpdateRef.current.value = null;
        variantPriceUpdateRef.current.value = null;

        await _init(itemId);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || t("menu_items.something_went_wrong");
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  }

  // Photo Upload / AI / URL
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.loading(t("menu_item.please_wait"));
      const compressedImage = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 512,
        useWebWorker: true,
      });

      const formData = new FormData();
      formData.append("image", compressedImage);

      const res = await uploadMenuItemPhoto(itemId, formData);
      if (res.status === 200) {
        toast.dismiss();
        toast.success(res.data.message);
        await _init(itemId);
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      const message =
        error?.response?.data?.message || t("menu_item.upload_image_error");
      toast.error(message);
    }
  };

  const btnShowAISuggestions = async () => {
    const itemTitle = formTitle.trim() || title;

    if (!itemTitle) {
      toast.error(t("menu_item.provide_title_error"));
      return;
    }

    document.getElementById("modal-ai-image-suggestions").showModal();
    setAiImageSuggestions([]);
    setIsLoadingAiSuggestions(true);

    try {
      const res = await getMenuItemImageSuggestions(itemId, itemTitle);
      if (res.status === 200) {
        setAiImageSuggestions(res.data?.imageUrls || []);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || t("menu_item.ai_suggestions_error");
      toast.error(message);
      document.getElementById("modal-ai-image-suggestions").close();
    } finally {
      setIsLoadingAiSuggestions(false);
    }
  };

  const btnSelectAISuggestion = async (imageUrl) => {
    setSelectingImageUrl(imageUrl);

    try {
      const res = await selectMenuItemImageSuggestion(itemId, imageUrl);
      if (res.status === 200) {
        toast.success(res.data.message);
        document.getElementById("modal-ai-image-suggestions").close();
        await _init(itemId);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message ||
        t("menu_item.ai_suggestion_select_error");
      toast.error(message);
    } finally {
      setSelectingImageUrl(null);
    }
  };

  const btnShowImageUrlModal = () => {
    setImageUrlInput("");
    setImageUrlPreviewError(false);
    document.getElementById("modal-image-url").showModal();
  };

  const btnUseImageUrl = async () => {
    const url = imageUrlInput.trim();

    if (!url) {
      toast.error(t("menu_item.image_link_empty_error"));
      return;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        toast.error(t("menu_item.image_link_https_error"));
        return;
      }
    } catch {
      toast.error(t("menu_item.image_link_invalid_error"));
      return;
    }

    setIsSavingImageUrl(true);

    try {
      const res = await selectMenuItemImageSuggestion(itemId, url);
      if (res.status === 200) {
        toast.success(res.data.message);
        document.getElementById("modal-image-url").close();
        await _init(itemId);
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || t("menu_item.image_link_use_error");
      toast.error(message);
    } finally {
      setIsSavingImageUrl(false);
    }
  };

  // Recipe options & handlers
  const getBaseIdOptions = (tabType = activeAddRecipeItemTab) => {
    const data =
      tabType === "variant"
        ? state.variants
        : tabType === "addon"
        ? state.addons
        : [];

    return data.map((item) => ({
      label: item.title,
      value: item.id,
    }));
  };

  const getIngredientsOptions = () => {
    return (
      state.inventoryItems?.map((item) => ({
        label: item.title,
        value: item.id,
        unit: item.unit,
      })) || []
    );
  };

  async function btnAddRecipeItem() {
    const qty = parseFloat(quantityRef.current?.value);

    if (!selectedRecipeData.ingredient) {
      toast.error("Please select an ingredient.");
      return;
    }

    if (Number.isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }

    if (
      (activeAddRecipeItemTab === "variant" ||
        activeAddRecipeItemTab === "addon") &&
      !selectedRecipeData.selectedBase
    ) {
      toast.error("Please select a variant or addon.");
      return;
    }

    let variantId = 0;
    let addonId = 0;

    if (activeAddRecipeItemTab === "variant") {
      variantId = selectedRecipeData?.selectedBase?.id;
    } else if (activeAddRecipeItemTab === "addon") {
      addonId = selectedRecipeData?.selectedBase?.id;
    }

    try {
      toast.loading("Please wait...");

      const res = await addMenuItemRecipeItem({
        menuItemId: itemId,
        variantId,
        addonId,
        ingredientId: selectedRecipeData?.ingredient?.value,
        quantity: qty,
      });

      if (res.status === 200) {
        toast.dismiss();
        toast.success(res.data.message);

        quantityRef.current.value = null;
        setSelectedRecipeData({
          ingredient: null,
          selectedBase: null,
        });
        setActiveAddRecipeItemTab("item");

        document.getElementById("modal-add-recipe-item").close();
        await _init(itemId);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || "Something went wrong!";
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  }

  async function btnUpdateRecipeItem() {
    const qty = parseFloat(quantityEditRef.current?.value);

    if (!editRecipeData.ingredient) {
      toast.error("Please select an ingredient.");
      return;
    }

    if (Number.isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }

    if (
      (editRecipeData.baseType === "variant" ||
        editRecipeData.baseType === "addon") &&
      !editRecipeData.selectedBase
    ) {
      toast.error("Please select a variant or addon.");
      return;
    }

    let variantId = 0;
    let addonId = 0;

    if (editRecipeData.baseType === "variant") {
      variantId = editRecipeData?.selectedBase?.id;
    } else if (editRecipeData.baseType === "addon") {
      addonId = editRecipeData?.selectedBase?.id;
    }

    try {
      toast.loading("Updating...");

      const res = await updateMenuItemRecipeItem({
        id: editRecipeData.id,
        menuItemId: itemId,
        variantId,
        addonId,
        ingredientId: editRecipeData?.ingredient?.value,
        quantity: qty,
      });

      if (res.status === 200) {
        toast.dismiss();
        toast.success(res.data.message);

        document.getElementById("modal-edit-recipe-item").close();
        await _init(itemId);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || "Something went wrong!";
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  }

  // Computed preview values
  const previewCategoryTitle =
    categories?.find((c) => String(c.id) === String(formCategoryId))?.title ||
    "Uncategorized";
  const previewStation = stations?.find(
    (s) => String(s.id) === String(formKitchenStationId)
  );
  const previewStationName =
    previewStation?.name || category_kitchen_station_name || "Master Kitchen";

  return (
    <Page className="px-4 md:px-8 py-4 md:py-6 pb-20">
      {/* ── Sticky Action Header ── */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3.5 mb-6 bg-white/90 dark:bg-[#161616]/90 backdrop-blur-md border-b border-restro-border-green flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/dashboard/settings/menu-items"
            title="Back to Menu Items"
            className="w-10 h-10 rounded-xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover flex items-center justify-center text-restro-text transition active:scale-95 shrink-0"
          >
            <IconArrowLeft size={18} stroke={iconStroke} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Link
                to="/dashboard/settings"
                className="hover:text-restro-green transition"
              >
                {t("navbar.settings")}
              </Link>
              <span>/</span>
              <Link
                to="/dashboard/settings/menu-items"
                className="hover:text-restro-green transition"
              >
                {t("menu_items.title")}
              </Link>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h2 className="text-lg md:text-xl font-bold text-restro-text truncate">
                {formTitle || title || "Menu Item"}
              </h2>
              <button
                type="button"
                onClick={handleToggleVisibility}
                title={
                  is_enabled
                    ? "Click to hide from POS"
                    : "Click to activate on POS"
                }
                className={clsx(
                  "min-h-[30px] px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 transition active:scale-95 border shrink-0",
                  is_enabled
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                    : "bg-gray-200 dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-700"
                )}
              >
                {is_enabled ? (
                  <>
                    <IconEye size={14} stroke={iconStroke} /> Active
                  </>
                ) : (
                  <>
                    <IconEyeOff size={14} stroke={iconStroke} /> Hidden
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDuplicateCurrentItem}
            title="Duplicate this Menu Item"
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
          >
            <IconCopy size={16} stroke={iconStroke} />
            <span className="hidden sm:inline">Duplicate</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setDeleteConfirmState({
                type: "item",
                payload: { id },
                title: "Delete Menu Item?",
                description: `Are you sure you want to permanently delete "${
                  formTitle || title
                }"? This action cannot be undone.`,
              })
            }
            title="Delete Menu Item"
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
          >
            <IconTrash size={16} stroke={iconStroke} />
            <span className="hidden sm:inline">Delete</span>
          </button>

          <button
            type="button"
            onClick={btnSave}
            className="min-h-[42px] px-5 py-2 rounded-xl border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover text-white text-sm font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
          >
            <IconDeviceFloppy size={18} stroke={iconStroke} />
            <span>{t("menu_item.save")}</span>
          </button>
        </div>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row items-start">
        {/* ── Left Column: Photo Manager & Live POS Preview ── */}
        <div className="w-full lg:w-80 xl:w-88 flex-shrink-0 space-y-5 lg:sticky lg:top-24">
          {/* Photo Card */}
          <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Item Photo
              </span>
              {image && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <IconCheck size={13} stroke={2.5} /> Uploaded
                </span>
              )}
            </div>

            <div className="relative w-full aspect-square max-h-60 rounded-2xl flex items-center justify-center mb-3.5 text-restro-text dark:text-white bg-restro-gray border border-restro-border-green overflow-hidden">
              {image ? (
                <img
                  src={imageURL}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                  <IconCarrot stroke={iconStroke} size={48} />
                  <span className="text-xs font-medium">No photo uploaded</span>
                </div>
              )}
            </div>

            {/* Touch-Friendly Photo Action Grid */}
            <div className="grid grid-cols-2 gap-2">
              <label
                htmlFor="file"
                className="min-h-[42px] rounded-xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
              >
                <IconUpload stroke={iconStroke} size={16} />
                <span>{t("menu_item.upload")}</span>
                <input
                  onChange={handleFileChange}
                  type="file"
                  name="file"
                  id="file"
                  className="hidden"
                  accept="image/*"
                />
              </label>

              <button
                type="button"
                onClick={btnShowAISuggestions}
                className="min-h-[42px] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
              >
                <IconSparkles stroke={iconStroke} size={16} />
                <span>AI Suggest</span>
              </button>

              <button
                type="button"
                onClick={btnShowImageUrlModal}
                className={clsx(
                  "min-h-[42px] rounded-xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95",
                  !image && "col-span-2"
                )}
              >
                <IconLink stroke={iconStroke} size={16} />
                <span>Image URL</span>
              </button>

              {image && (
                <button
                  type="button"
                  onClick={() =>
                    setDeleteConfirmState({
                      type: "photo",
                      payload: {},
                      title: "Remove Item Photo?",
                      description: t("menu_item.remove_image_confirm"),
                    })
                  }
                  className="min-h-[42px] rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <IconTrash stroke={iconStroke} size={16} />
                  <span>{t("menu_item.remove")}</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-400 text-center mt-2.5">
              PNG, JPG, WebP up to 5MB (auto-optimized)
            </p>
          </div>

          {/* Reactive POS Live Preview Card */}
          <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live POS Preview
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                Terminal Card
              </span>
            </div>

            <div className="rounded-xl border border-restro-border-green overflow-hidden bg-restro-card-bg shadow-sm">
              <div className="relative h-32 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                {image ? (
                  <img
                    src={imageURL}
                    alt={formTitle || title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <IconCarrot
                    stroke={iconStroke}
                    size={32}
                    className="text-gray-400"
                  />
                )}
                <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/65 text-white backdrop-blur">
                  {previewCategoryTitle}
                </span>
                <span className="absolute bottom-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/65 text-amber-300 backdrop-blur flex items-center gap-1">
                  <IconChefHat size={11} stroke={2} />
                  {previewStationName}
                </span>
              </div>
              <div className="p-3.5">
                <p className="text-sm font-bold text-restro-text truncate">
                  {formTitle || "Item Title"}
                </p>
                {formDescription && (
                  <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                    {formDescription}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-base font-extrabold text-restro-green">
                    {formatPrice(formPrice)}
                  </span>
                  <div className="flex items-center gap-1">
                    {state.variants?.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                        {state.variants.length} Var
                      </span>
                    )}
                    <span className="w-7 h-7 rounded-lg bg-restro-green text-white flex items-center justify-center text-sm font-bold shadow">
                      +
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Core Details, Variants, Addons, Recipe ── */}
        <div className="flex-1 min-w-0 space-y-6 w-full">
          {/* Basic Info Card */}
          <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-restro-border-green/60">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-restro-text">
                  Core Item Details
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Title, pricing, tax calculation, and kitchen station routing
                </p>
              </div>
              <button
                type="button"
                onClick={btnSave}
                className="min-h-[40px] rounded-xl transition active:scale-95 text-white hover:shadow-md px-4 py-2 text-xs font-bold border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover flex items-center gap-1.5"
              >
                <IconDeviceFloppy size={15} stroke={iconStroke} />
                {t("menu_item.save")}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="text-xs font-bold uppercase tracking-wide mb-1.5 block text-gray-500"
                >
                  {t("menu_item.title")} <span className="text-red-400">*</span>
                </label>
                <input
                  id="title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  type="text"
                  name="title"
                  className="min-h-[44px] text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray"
                  placeholder={t("menu_items.enter_item_title")}
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="text-xs font-bold uppercase tracking-wide mb-1.5 block text-gray-500"
                >
                  {t("menu_item.description")}
                  <span className="text-[11px] font-normal text-gray-400 ml-1">
                    {t("menu_items.max_chars")}
                  </span>
                </label>
                <textarea
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  name="description"
                  className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray resize-none"
                  placeholder={t("menu_items.enter_item_description")}
                  rows="3"
                  maxLength={500}
                />
              </div>

              <TranslationFields
                value={formTranslations}
                onChange={setFormTranslations}
                fields={["title", "description"]}
                primaryTitle={formTitle}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="price"
                    className="text-xs font-bold uppercase tracking-wide mb-1.5 block text-gray-500"
                  >
                    {t("menu_item.price")} ({currency}){" "}
                    <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="price"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    name="price"
                    className="min-h-[44px] text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label
                    htmlFor="nprice"
                    className="text-xs font-bold uppercase tracking-wide mb-1.5 block text-gray-500"
                  >
                    {t("menu_item.net_price")} ({currency})
                  </label>
                  <input
                    id="nprice"
                    value={formNetPrice}
                    onChange={(e) => setFormNetPrice(e.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    name="nprice"
                    className="min-h-[44px] text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="prep_minutes"
                  className="text-xs font-bold uppercase tracking-wide mb-1.5 block text-gray-500"
                >
                  {t("pos_ops.prep_minutes", "Target prep time on the kitchen screen (minutes, optional)")}
                </label>
                <input
                  id="prep_minutes"
                  value={formPrepMinutes}
                  onChange={(e) => setFormPrepMinutes(e.target.value)}
                  type="number"
                  min="1"
                  max="240"
                  inputMode="numeric"
                  className="min-h-[44px] text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray"
                  placeholder={t("pos_ops.prep_minutes_ph", "e.g. 12")}
                />
              </div>

              <div>
                <label
                  htmlFor="barcode"
                  className="text-xs font-bold uppercase tracking-wide mb-1.5 block text-gray-500"
                >
                  {t("pos_ops.barcode", "Barcode (optional)")}
                </label>
                <input
                  id="barcode"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    // Scanners end with Enter: keep it from submitting anything.
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  type="text"
                  inputMode="numeric"
                  name="barcode"
                  maxLength={64}
                  className="min-h-[44px] text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray font-mono"
                  placeholder={t("pos_ops.barcode_ph", "Scan or type the code on the package")}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="category"
                    className="text-xs font-bold uppercase tracking-wide mb-1.5 block text-gray-500"
                  >
                    {t("menu_item.category")}
                  </label>
                  <select
                    id="category"
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    name="category"
                    className="min-h-[44px] text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray"
                  >
                    <option value="">{t("menu_item.none")}</option>
                    {categories.map((category) => (
                      <option value={String(category.id)} key={category.id}>
                        {category.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="tax"
                    className="text-xs font-bold uppercase tracking-wide mb-1.5 block text-gray-500"
                  >
                    {t("menu_item.tax")}
                  </label>
                  <select
                    id="tax"
                    name="tax"
                    value={formTaxId}
                    onChange={(e) => setFormTaxId(e.target.value)}
                    className="min-h-[44px] text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray"
                  >
                    <option value="">{t("menu_item.none")}</option>
                    {taxes.map((tax) => (
                      <option value={String(tax.id)} key={tax.id}>
                        {tax.title} - {tax.rate}% ({tax.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isKitchenEnabled && (
                <div>
                  <label
                    htmlFor="kitchenStation"
                    className="text-xs font-bold uppercase tracking-wide mb-1.5 block text-gray-500 flex items-center gap-1.5"
                  >
                    <IconChefHat size={15} stroke={iconStroke} />
                    Kitchen Station
                  </label>
                  <select
                    id="kitchenStation"
                    value={formKitchenStationId}
                    onChange={(e) => setFormKitchenStationId(e.target.value)}
                    name="kitchenStation"
                    className="min-h-[44px] text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray"
                  >
                    <option value="">
                      {category_kitchen_station_name
                        ? `Category Default (${category_kitchen_station_name})`
                        : "Category Default (Auto-routes by category)"}
                    </option>
                    {stations
                      ?.filter((s) => s.is_enabled)
                      ?.map((station) => (
                        <option value={String(station.id)} key={station.id}>
                          {station.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Override kitchen station routing for this item, or leave as
                    Category Default.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Variants Card with Fast Inline Quick-Add ── */}
          <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-restro-text">
                  {t("menu_item.show_variants")}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {state.variants?.length || 0} size/style variants configured
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {state.variants?.length || 0}
              </span>
            </div>

            {/* Inline Quick-Add Variant Row */}
            <div className="flex flex-col sm:flex-row gap-2.5 mb-4 p-3 rounded-xl bg-restro-gray/50 border border-restro-border-green">
              <input
                type="text"
                value={inlineVariantTitle}
                onChange={(e) => setInlineVariantTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInlineAddVariant()}
                placeholder="Variant title (e.g. Large, Spicy, 500ml)..."
                className="min-h-[42px] flex-1 text-sm rounded-xl px-3.5 py-2 border border-restro-border-green bg-white dark:bg-black focus:outline-restro-border-green"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={inlineVariantPrice}
                onChange={(e) => setInlineVariantPrice(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInlineAddVariant()}
                placeholder={`Final Price (${currency})`}
                className="min-h-[42px] w-full sm:w-40 text-sm rounded-xl px-3.5 py-2 border border-restro-border-green bg-white dark:bg-black focus:outline-restro-border-green"
              />
              <button
                type="button"
                onClick={handleInlineAddVariant}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-restro-green hover:bg-restro-green-button-hover text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition active:scale-95"
              >
                <IconPlus size={16} stroke={iconStroke} />
                {t("menu_item.add_variant")}
              </button>
            </div>

            {state.variants?.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                No variants yet. Use the quick-add bar above to add sizes or
                options.
              </p>
            ) : (
              <div className="space-y-2">
                {state.variants?.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between p-3 rounded-xl transition hover:bg-restro-gray/40 border border-restro-border-green"
                  >
                    <div>
                      <p className="text-sm font-bold text-restro-text">
                        {variant.title}
                      </p>
                      {translationsEnabled && Object.values(normalizeTranslations(variant.translations)).some((tr) => tr?.title) && (
                        <p className="text-xs text-restro-text/60">
                          {Object.values(normalizeTranslations(variant.translations)).map((tr) => tr?.title).filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <p className="text-xs font-semibold text-restro-green">
                        {t("menu_item.price")}: {formatPrice(variant.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Edit variant"
                        onClick={() =>
                          btnShowVariantUpdate(
                            variant.id,
                            variant.title,
                            variant.price,
                            variant.translations
                          )
                        }
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-95 text-restro-text hover:bg-restro-button-hover"
                      >
                        <IconPencil stroke={iconStroke} size={16} />
                      </button>
                      <button
                        type="button"
                        title="Delete variant"
                        onClick={() =>
                          setDeleteConfirmState({
                            type: "variant",
                            payload: { variantId: variant.id },
                            title: "Delete Variant?",
                            description: `Delete variant "${variant.title}"?`,
                          })
                        }
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-red-500 transition active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <IconTrash stroke={iconStroke} size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Add-ons: picked from the shared add-on list ── */}
          <ItemAddonsCard
            itemId={itemId}
            addons={state.addons || []}
            onChanged={() => _init(itemId)}
            formatPrice={formatPrice}
            currency={currency}
          />

          {/* ── Recipe / Inventory Card ── */}
          <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-restro-text">
                  Recipe / Inventory Deduction
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {state.recipeItems?.length || 0} stock ingredients linked
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  document.getElementById("modal-add-recipe-item").showModal()
                }
                className="min-h-[40px] rounded-xl border border-restro-border-green px-3.5 py-2 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition active:scale-95 flex items-center gap-1.5"
              >
                <IconPlus size={15} stroke={iconStroke} /> Link Ingredient
              </button>
            </div>
            {state.recipeItems?.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                No recipe ingredients linked
              </p>
            ) : (
              <div className="space-y-2">
                {state.recipeItems?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl transition hover:bg-restro-gray/40 border border-restro-border-green"
                  >
                    <div>
                      <p className="text-sm font-bold text-restro-text flex items-center gap-1.5 flex-wrap">
                        <span>{item.ingredient_title}</span>
                        {item.variant_title && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            Variant: {item.variant_title}
                          </span>
                        )}
                        {item.addon_title && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            Addon: {item.addon_title}
                          </span>
                        )}
                        {item.source === "library" && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                            {t("addons.from_list")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Deducts:{" "}
                        <span className="font-semibold text-restro-text">
                          {item.quantity} {item.unit}
                        </span>
                      </p>
                    </div>
                    {item.source === "library" ? (
                      <Link
                        to={ADDON_LIBRARY_PATH}
                        title={t("addons.edit_in_addons_title")}
                        className="min-h-[42px] px-3 rounded-xl border border-restro-border-green text-xs font-bold text-restro-text hover:bg-restro-button-hover flex items-center gap-1.5 shrink-0 transition active:scale-95"
                      >
                        <IconPencil stroke={iconStroke} size={14} /> {t("addons.edit_in_addons")}
                      </Link>
                    ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Edit recipe ingredient"
                        onClick={() => {
                          setEditRecipeData({
                            id: item.id,
                            quantity: item.quantity,
                            ingredient: {
                              value: item.inventory_item_id,
                              label: item.ingredient_title,
                              unit: item.unit,
                            },
                            selectedBase: item.variant_id
                              ? {
                                  id: item.variant_id,
                                  label: item.variant_title,
                                }
                              : item.addon_id
                              ? { id: item.addon_id, label: item.addon_title }
                              : null,
                            baseType: item.variant_id
                              ? "variant"
                              : item.addon_id
                              ? "addon"
                              : "item",
                          });
                          setTimeout(() => {
                            if (quantityEditRef.current)
                              quantityEditRef.current.value = item.quantity;
                          }, 100);
                          setActiveAddRecipeItemTab(
                            item.variant_id
                              ? "variant"
                              : item.addon_id
                              ? "addon"
                              : "item"
                          );
                          document
                            .getElementById("modal-edit-recipe-item")
                            .showModal();
                        }}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition active:scale-95 text-restro-text hover:bg-restro-button-hover"
                      >
                        <IconPencil stroke={iconStroke} size={16} />
                      </button>
                      <button
                        type="button"
                        title="Remove recipe ingredient"
                        onClick={() =>
                          setDeleteConfirmState({
                            type: "recipe",
                            payload: {
                              recipeItemId: item.id,
                              variantId: item.variant_id,
                              addonId: item.addon_id,
                            },
                            title: "Remove Recipe Ingredient?",
                            description: `Unlink "${item.ingredient_title}" from this recipe?`,
                          })
                        }
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-red-500 transition active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <IconTrash stroke={iconStroke} size={16} />
                      </button>
                    </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialogs & Modals ── */}

      {/* Unified Delete Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(deleteConfirmState)}
        onClose={() => setDeleteConfirmState(null)}
        onConfirm={handleConfirmDeleteModal}
        title={deleteConfirmState?.title || "Confirm Delete"}
        description={
          deleteConfirmState?.description ||
          t("menu_items.process_irreversible")
        }
        cancelText={t("menu_item.close") || "Cancel"}
        confirmText="Confirm"
      />

      {/* Variant update dialog */}
      <dialog
        id="modal-update-variant"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg">{t("menu_item.update_variant")}</h3>
          <div className="mt-4">
            <input type="hidden" ref={variantIdRef} />
            <label
              htmlFor="variant-update-title"
              className="mb-1 block text-gray-500 text-sm"
            >
              {t("menu_item.variant_title")}
            </label>
            <input
              id="variant-update-title"
              ref={variantTitleUpdateRef}
              type="text"
              name="title"
              className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray"
              placeholder={t("menu_item.variant_title")}
            />
          </div>
          <div className="my-4">
            <label
              htmlFor="variant-update-price"
              className="mb-1 block text-gray-500 text-sm"
            >
              {t("menu_item.variant_price")} ({currency})
            </label>
            <input
              id="variant-update-price"
              ref={variantPriceUpdateRef}
              type="number"
              step="0.01"
              name="price"
              className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray"
              placeholder={t("menu_item.variant_price")}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t("menu_item.final_price_note")}
            </p>
          </div>
          <TranslationFields
            value={variantUpdateTranslations}
            onChange={setVariantUpdateTranslations}
          />
          <div className="modal-action">
            <form method="dialog">
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text">
                {t("menu_item.close")}
              </button>
              <button
                onClick={btnUpdateVariant}
                className="rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 ml-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover"
              >
                {t("menu_item.save")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* Recipe add dialog */}
      <dialog
        id="modal-add-recipe-item"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg">Add New Recipe Item</h3>
          <div role="tablist" className="tabs my-4">
            {["item", "variant", "addon"].map((tab) => (
              <a
                key={tab}
                role="tab"
                className={`tab rounded-t-lg ${
                  activeAddRecipeItemTab === tab
                    ? theme === "black"
                      ? "border-b-2 border-b-restro-green text-white bg-restro-green-10 hover:bg-restro-green-10"
                      : "border-b-2 border-b-restro-green text-restro-green bg-restro-green-10 hover:bg-restro-green-10"
                    : theme === "black"
                    ? "text-white hover:bg-restro-bg-hover-dark-mode"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
                onClick={() => {
                  setSelectedRecipeData({ ingredient: null, selectedBase: null });
                  if (quantityRef.current) quantityRef.current.value = "";
                  setActiveAddRecipeItemTab(tab);
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </a>
            ))}
          </div>
          {activeAddRecipeItemTab !== "item" && (
            <p className="text-xs text-gray-500 mb-4">
              <strong>Note:</strong> Add only those extra inventory items that
              are <em>not included</em> in the base item recipe.
            </p>
          )}
          {(activeAddRecipeItemTab === "variant" ||
            activeAddRecipeItemTab === "addon") && (
            <div className="mb-4">
              <label className="mb-1 block text-gray-500 text-sm">
                {activeAddRecipeItemTab === "variant"
                  ? "Select Variant"
                  : "Select Addon"}
              </label>
              <AsyncSelect
                key={`base-${activeAddRecipeItemTab}`}
                defaultOptions={getBaseIdOptions(activeAddRecipeItemTab)}
                loadOptions={(inputValue, callback) =>
                  callback(
                    getBaseIdOptions(activeAddRecipeItemTab).filter((opt) =>
                      opt.label.toLowerCase().includes(inputValue.toLowerCase())
                    )
                  )
                }
                isClearable
                placeholder="Type to search..."
                onChange={(v) => {
                  setSelectedRecipeData((prev) => ({
                    ...prev,
                    selectedBase: v ? { id: v.value, label: v.label } : null,
                  }));
                }}
                value={selectedRecipeData.selectedBase}
                noOptionsMessage={() => "No results found"}
              />
            </div>
          )}
          <div className="mb-4 overflow-visible">
            <label className="mb-1 block text-gray-500 text-sm">
              Select Inventory Item
            </label>
            <AsyncSelect
              key={`inventory-${activeAddRecipeItemTab}`}
              defaultOptions={getIngredientsOptions()}
              loadOptions={(inputValue, callback) =>
                callback(
                  getIngredientsOptions().filter((opt) =>
                    opt.label.toLowerCase().includes(inputValue.toLowerCase())
                  )
                )
              }
              isClearable
              placeholder="Type to search..."
              onChange={(v) =>
                setSelectedRecipeData((prev) => ({ ...prev, ingredient: v }))
              }
              value={selectedRecipeData?.ingredient}
              noOptionsMessage={() => "No results found"}
              className="overflow-visible"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-gray-500 text-sm">
              Qty.{" "}
              {selectedRecipeData?.ingredient?.unit != null && (
                <span>(in {selectedRecipeData.ingredient.unit})</span>
              )}
            </label>
            <input
              type="number"
              ref={quantityRef}
              className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray"
              placeholder="Enter Qty."
              step="any"
              min="0"
            />
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text">
                Close
              </button>
              <button
                type="button"
                onClick={btnAddRecipeItem}
                className="rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* Recipe edit dialog */}
      <dialog
        id="modal-edit-recipe-item"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg">Edit Recipe Item</h3>
          <div role="tablist" className="tabs my-4">
            {["item", "variant", "addon"].map((tab) => (
              <a
                key={tab}
                role="tab"
                className={`tab ${
                  editRecipeData.baseType === tab
                    ? "border-b-2 border-b-restro-green bg-restro-green/10 rounded-t-lg text-restro-green"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
                onClick={() =>
                  setEditRecipeData((prev) => ({
                    ...prev,
                    baseType: tab,
                    selectedBase: null,
                    quantity: "",
                    ingredient: null,
                  }))
                }
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </a>
            ))}
          </div>
          {editRecipeData.baseType !== "item" && (
            <p className="text-xs text-gray-500 mb-4">
              <strong>Note:</strong> Add only those extra inventory items that
              are <em>not included</em> in the base item recipe.
            </p>
          )}
          {(editRecipeData.baseType === "variant" ||
            editRecipeData.baseType === "addon") && (
            <div className="mb-4">
              <label className="mb-1 block text-gray-500 text-sm">
                {editRecipeData.baseType === "variant"
                  ? "Select Variant"
                  : "Select Addon"}
              </label>
              <AsyncSelect
                defaultOptions={getBaseIdOptions(editRecipeData.baseType)}
                loadOptions={(inputValue, callback) =>
                  callback(
                    getBaseIdOptions(editRecipeData.baseType).filter((opt) =>
                      opt.label.toLowerCase().includes(inputValue.toLowerCase())
                    )
                  )
                }
                isClearable
                placeholder="Type to search..."
                onChange={(v) => {
                  setEditRecipeData((prev) => ({
                    ...prev,
                    selectedBase: v ? { id: v.value, label: v.label } : null,
                  }));
                }}
                value={editRecipeData.selectedBase}
                noOptionsMessage={() => "No results found"}
              />
            </div>
          )}
          <div className="mb-4">
            <label className="mb-1 block text-gray-500 text-sm">
              Select Inventory Item
            </label>
            <AsyncSelect
              defaultOptions={getIngredientsOptions()}
              loadOptions={(inputValue, callback) =>
                callback(
                  getIngredientsOptions().filter((opt) =>
                    opt.label.toLowerCase().includes(inputValue.toLowerCase())
                  )
                )
              }
              isClearable
              placeholder="Type to search..."
              onChange={(v) =>
                setEditRecipeData((prev) => ({ ...prev, ingredient: v }))
              }
              value={editRecipeData.ingredient}
              noOptionsMessage={() => "No results found"}
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-gray-500 text-sm">
              Qty.{" "}
              {editRecipeData?.ingredient?.unit != null && (
                <span>(in {editRecipeData.ingredient.unit})</span>
              )}
            </label>
            <input
              type="number"
              ref={quantityEditRef}
              className="text-sm w-full border bg-restro-gray rounded-xl px-4 py-2.5 dark:bg-black border-restro-border-green"
              placeholder="Enter Qty."
              step="any"
              min="0"
              defaultValue={editRecipeData.quantity}
            />
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text">
                Close
              </button>
              <button
                type="button"
                onClick={btnUpdateRecipeItem}
                className="rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover"
              >
                Update
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* AI image suggestions dialog */}
      <dialog
        id="modal-ai-image-suggestions"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <IconSparkles stroke={iconStroke} className="text-restro-green" />
            {t("menu_item.ai_suggestions_title")}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {t("menu_item.ai_suggestions_select_hint")}
          </p>
          <div className="mt-4">
            {isLoadingAiSuggestions ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <span className="loading loading-spinner loading-md text-restro-green" />
                <p className="text-sm text-gray-500">
                  {t("menu_item.ai_suggestions_loading")}
                </p>
              </div>
            ) : aiImageSuggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <IconPhoto stroke={iconStroke} size={32} className="text-gray-400" />
                <p className="text-sm text-gray-500 text-center">
                  {t("menu_item.ai_suggestions_empty")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {aiImageSuggestions.map((suggestion, index) => {
                  const isSelecting = selectingImageUrl === suggestion;
                  return (
                    <button
                      key={index}
                      type="button"
                      disabled={Boolean(selectingImageUrl)}
                      onClick={() => btnSelectAISuggestion(suggestion)}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition hover:border-restro-green group ${
                        theme === "black"
                          ? "border-restro-border-dark-mode bg-restro-bg-gray"
                          : "border-restro-green-light bg-gray-50"
                      }`}
                    >
                      <img
                        src={suggestion}
                        alt={title}
                        className="w-full h-full object-cover"
                      />
                      <div
                        className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${
                          isSelecting
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {isSelecting ? (
                          <span className="loading loading-spinner loading-sm text-white" />
                        ) : (
                          <span className="text-white text-xs font-medium px-2 py-1 rounded-full bg-restro-green">
                            {t("menu_item.save")}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text">
                {t("menu_item.close")}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* Image via link dialog */}
      <dialog
        id="modal-image-url"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <IconLink stroke={iconStroke} className="text-restro-green" />
            {t("menu_item.image_link_title")}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {t("menu_item.image_link_hint")}
          </p>
          <div className="mt-4">
            <label
              htmlFor="image_url"
              className="mb-1 block text-gray-500 text-sm"
            >
              {t("menu_item.image_link_label")}
            </label>
            <input
              value={imageUrlInput}
              onChange={(e) => {
                setImageUrlInput(e.target.value);
                setImageUrlPreviewError(false);
              }}
              type="url"
              name="image_url"
              id="image_url"
              className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray"
              placeholder={t("menu_item.image_link_placeholder")}
            />
          </div>
          {imageUrlInput.trim() && (
            <div
              className={`mt-4 w-full aspect-video rounded-xl overflow-hidden border flex items-center justify-center ${
                theme === "black"
                  ? "border-restro-border-dark-mode bg-restro-bg-gray"
                  : "border-restro-green-light bg-gray-50"
              }`}
            >
              {imageUrlPreviewError ? (
                <p className="text-xs text-gray-500 px-4 text-center">
                  {t("menu_item.image_link_preview_error")}
                </p>
              ) : (
                <img
                  src={imageUrlInput.trim()}
                  alt={t("menu_item.image_link_preview_alt")}
                  className="w-full h-full object-contain"
                  onError={() => setImageUrlPreviewError(true)}
                />
              )}
            </div>
          )}
          <div className="modal-action">
            <form method="dialog">
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text">
                {t("menu_item.close")}
              </button>
            </form>
            <button
              type="button"
              disabled={isSavingImageUrl}
              onClick={btnUseImageUrl}
              className="rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 ml-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover disabled:opacity-60"
            >
              {isSavingImageUrl ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                t("menu_item.image_link_use")
              )}
            </button>
          </div>
        </div>
      </dialog>
    </Page>
  );
}
