import React, { useEffect, useRef, useState } from "react";
import Page from "../../components/Page";
import { Link, useParams } from "react-router-dom";
import { addMenuItemAddon, addMenuItemRecipeItem, addMenuItemVariant, deleteMenuItemAddon, deleteMenuItemVariant, deleteRecipeItem, getMenuItem, getMenuItemImageSuggestions, removeMenuItemPhoto, selectMenuItemImageSuggestion, updateMenuItem, updateMenuItemAddon, updateMenuItemRecipeItem, updateMenuItemVariant, uploadMenuItemPhoto, useMenuItem } from "../../controllers/menu_item.controller";
import { useCategories, useTaxes } from "../../controllers/settings.controller";
import { useKitchenStations } from "../../controllers/kitchen_stations.controller";
import toast from "react-hot-toast";
import { mutate } from "swr";
import { IconCarrot, IconChevronDown, IconLink, IconPencil, IconPhoto, IconPlus, IconSparkles, IconTrash, IconUpload } from "@tabler/icons-react";

import { iconStroke } from "../../config/config"
import imageCompression from "browser-image-compression";
import { getImageURL, setImageStorageConfig } from "../../helpers/ImageHelper";
import { useTranslation } from "react-i18next";
import AsyncSelect from "react-select/async"
import { useTheme } from "../../contexts/ThemeContext";

export default function MenuItemViewPage() {
  const { t } = useTranslation();
  const {theme} = useTheme();
  const params = useParams();
  const itemId = params.id;

  const titleRef = useRef();
  const descriptionRef = useRef();
  const priceRef = useRef();
  const netPriceRef = useRef();
  const taxIdRef = useRef();
  const categoryIdRef = useRef();
  const kitchenStationIdRef = useRef();

  const variantTitleRef = useRef();
  const variantPriceRef = useRef();

  const variantIdRef = useRef();
  const variantTitleUpdateRef = useRef();
  const variantPriceUpdateRef = useRef();

  const addonTitleRef = useRef();
  const addonPriceRef = useRef();

  const addonIdRef = useRef();
  const addonTitleUpdateRef = useRef();
  const addonPriceUpdateRef = useRef();

  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [aiImageSuggestions, setAiImageSuggestions] = useState([]);
  const [isLoadingAiSuggestions, setIsLoadingAiSuggestions] = useState(false);
  const [selectingImageUrl, setSelectingImageUrl] = useState(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageUrlPreviewError, setImageUrlPreviewError] = useState(false);
  const [isSavingImageUrl, setIsSavingImageUrl] = useState(false);
  const [activeAddRecipeItemTab, setActiveAddRecipeItemTab] = useState("item");
  const quantityRef = useRef();
  const [selectedRecipeData, setSelectedRecipeData] = useState({
    ingredient: null, // selected ingredient (inventory item)
    selectedBase: null, // can be item, variant, or addon
  });

  const [editRecipeData, setEditRecipeData] = useState({
    id: null,
    ingredient: null,
    quantity: null,
    selectedBase: null,
    baseType: "item", // can be item, variant, or addon
  });

  const quantityEditRef = useRef(null);

  const {
    APIURL: APIURLCategories,
    data: categories,
    error: errorCategories,
    isLoading: isLoadingCategories,
  } = useCategories();

  const {
    APIURL: APIURLTaxes,
    data: taxes,
    error: errorTaxes,
    isLoading: isLoadingTaxes,
  } = useTaxes();

  const { data: stations } = useKitchenStations();

  // const { APIURL, data: menuItem, error, isLoading } = useMenuItem(itemId);
  const [state, setState] = useState({
    menuItem: {},
    inventoryItems:[],
    variants:[],
    addons:[],
    recipeItems:[]
  })
 
  useEffect(()=>{
    _init(itemId)
  },[itemId]);

  const _init = async (id) => {
    try {
      const res = await getMenuItem(id);
      if(res.status == 200) {
        // Initialize cloud storage config for image URLs
        if (res.data?.imageStorageConfig) {
          setImageStorageConfig(res.data.imageStorageConfig);
        }

       setTimeout(() => {
        if(taxIdRef.current){
          taxIdRef.current.value = res.data?.formattedMenuItem?.tax_id;
        }

        if(categoryIdRef.current){
          categoryIdRef.current.value = res.data?.formattedMenuItem?.category_id;
        }

        if(kitchenStationIdRef.current){
          kitchenStationIdRef.current.value = res.data?.formattedMenuItem?.kitchen_station_id || "";
        }
       }, 100)

        setState({
          ...state,
          menuItem: res.data?.formattedMenuItem || {},
          variants: res.data?.formattedMenuItem?.variants || [],
          addons: res.data?.formattedMenuItem?.addons || [],
          recipeItems: res.data?.formattedMenuItem?.recipeItems || [],
          inventoryItems: res.data?.inventoryItems || []
        })
      }
    } catch (error) {
      console.log(error);
    }
  }

  if (isLoadingCategories) {
    return <Page>{t('menu_item.please_wait')}</Page>;
  }

  if (errorCategories) {
    return <Page>{t('menu_item.error_loading_details')}</Page>;
  }

  if (isLoadingTaxes) {
    return <Page>{t('menu_item.please_wait')}</Page>;
  }

  if (errorTaxes) {
    return <Page>{t('menu_item.error_loading_details')}</Page>;
  }

  // if (isLoading) {
  //   return <Page>{t('menu_item.please_wait')}</Page>;
  // }

  // if (error) {
  //   return <Page>{t('menu_item.error_loading_details')}</Page>;
  // }

  const {
    id,
    title,
    description,
    category_id,
    category_title,
    tax_id,
    tax_title,
    tax_rate,
    tax_type,
    price,
    net_price,
    addons,
    variants,
    image,
    kitchen_station_id,
    category_kitchen_station_name,
  } = state.menuItem;
  const imageURL = image ? getImageURL(image) : null;


  async function btnSave() {
    const title = titleRef.current.value;
    const description = descriptionRef.current.value;
    const price = priceRef.current.value;
    const netPrice = netPriceRef.current.value || null;
    const categoryId = categoryIdRef.current.value || null;
    const taxId = taxIdRef.current.value || null;
    const kitchenStationId = kitchenStationIdRef.current?.value || null;

    if(!title) {
      toast.error(t('menu_item.provide_title_error'));
      return;
    }

    if(price < 0) {
      toast.error(t('menu_item.provide_valid_price_error'));
      return;
    }

    try {
      toast.loading(t('menu_item.please_wait'));
      const res = await updateMenuItem(id, title, description, price, netPrice, categoryId, taxId, kitchenStationId);

      if(res.status == 200) {
        await _init(itemId);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error.response.data.message || t('menu_items.something_went_wrong');
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  }

  const btnVariantDelete = async (variantId) => {
    const isConfirm = window.confirm(t('menu_item.confirm_delete'));

    if(!isConfirm) {
      return;
    }

    try {
      toast.loading(t('menu_item.please_wait'));
      const res = await deleteMenuItemVariant(id, variantId);

      if(res.status == 200) {
        await _init(itemId);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('menu_items.something_went_wrong');
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  };

  const btnAddonDelete = async (addonId) => {
    const isConfirm = window.confirm(t('menu_item.confirm_delete'));

    if(!isConfirm) {
      return;
    }

    try {
      toast.loading(t('menu_item.please_wait'));
      const res = await deleteMenuItemAddon(id, addonId);

      if(res.status == 200) {
        await _init(itemId);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('menu_items.something_went_wrong');
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  };

  async function btnAddVariant() {
    const variantTitle = variantTitleRef.current.value;
    const variantPrice = variantPriceRef.current.value || 0;

    if(!variantTitle) {
      toast.error(t('menu_item.provide_variant_title_error'));
      return;
    }
    if(variantPrice < 0) {
      toast.error(t('menu_item.provide_valid_variant_price_error'));
      return;
    }

    try {
      toast.loading(t('menu_item.please_wait'));
      const res = await addMenuItemVariant(id, variantTitle, variantPrice);

      if(res.status == 200) {
        variantTitleRef.current.value = null;
        variantPriceRef.current.value = null;

        await _init(itemId);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('menu_items.something_went_wrong');
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  }

  const btnShowVariantUpdate = (variantId, title, price) => {
    variantIdRef.current.value = variantId;
    variantTitleUpdateRef.current.value = title;
    variantPriceUpdateRef.current.value = price;
    document.getElementById('modal-update-variant').showModal()
  };

  async function btnUpdateVariant() {
    const variantId = variantIdRef.current.value;
    const variantTitle = variantTitleUpdateRef.current.value;
    const variantPrice = variantPriceUpdateRef.current.value || 0;

    if(!variantTitle) {
      toast.error(t('menu_item.provide_variant_title_error'));
      return;
    }
    if(variantPrice < 0) {
      toast.error(t('menu_item.provide_valid_variant_price_error'));
      return;
    }

    try {
      toast.loading(t('menu_item.please_wait'));
      const res = await updateMenuItemVariant(id, variantId, variantTitle, variantPrice);

      if(res.status == 200) {
        variantIdRef.current.value = null;
        variantTitleUpdateRef.current.value = null;
        variantPriceUpdateRef.current.value = null;

        await _init(itemId);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('menu_items.something_went_wrong');
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  }

  async function btnAddAddon() {
    const addonTitle = addonTitleRef.current.value;
    const addonPrice = addonPriceRef.current.value || 0;

    if(!addonTitle) {
      toast.error(t('menu_item.provide_addon_title_error'));
      return;
    }
    if(addonPrice < 0) {
      toast.error(t('menu_item.provide_valid_addon_price_error'));
      return;
    }

    try {
      toast.loading(t('menu_item.please_wait'));
      const res = await addMenuItemAddon(id, addonTitle, addonPrice);

      if(res.status == 200) {
        addonTitleRef.current.value = null;
        addonPriceRef.current.value = null;

        await _init(itemId);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('menu_items.something_went_wrong');
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  }

  const btnShowAddonUpdate = (addonId, title, price) => {
    addonIdRef.current.value = addonId;
    addonTitleUpdateRef.current.value = title;
    addonPriceUpdateRef.current.value = price;
    document.getElementById('modal-update-addon').showModal()
  };

  async function btnUpdateAddon() {
    const addonId = addonIdRef.current.value;
    const addonTitle = addonTitleUpdateRef.current.value;
    const addonPrice = addonPriceUpdateRef.current.value || 0;

    if(!addonTitle) {
      toast.error(t('menu_item.provide_addon_title_error'));
      return;
    }
    if(addonPrice < 0) {
      toast.error(t('menu_item.provide_valid_addon_price_error'));
      return;
    }

    try {
      toast.loading(t('menu_item.please_wait'));
      const res = await updateMenuItemAddon(id, addonId, addonTitle, addonPrice);

      if(res.status == 200) {
        addonIdRef.current.value = null;
        addonTitleUpdateRef.current.value = null;
        addonPriceUpdateRef.current.value = null;

        await _init(itemId);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('menu_items.something_went_wrong');
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  }

  const handleFileChange = async (e) => {

    const file = e.target.files[0];

    if(!file) {
      return;
    }

    // compress image
    try {
      toast.loading(t('menu_item.please_wait'));
      const compressedImage = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 512,
        useWebWorker: true,
      })

      const formData = new FormData();
      formData.append("image", compressedImage);

      const res = await uploadMenuItemPhoto(itemId, formData);
      if(res.status == 200) {
        toast.dismiss();
        toast.success(res.data.message);

        // update the image state
        const imagePath = res.data.imageURL;
        await _init(itemId);
      }

    } catch (error) {
      console.error(error);
      toast.dismiss();
      const message = error?.response?.data?.message || t('menu_item.upload_image_error');
      toast.error(message)
    }
  }

  const btnRemoveMenuItemImage = async () => {
    const isConfirm = window.confirm(t('menu_item.remove_image_confirm'));

    if(!isConfirm) {
      return;
    }

    try {
      toast.loading(t('menu_item.please_wait'));

      const res = await removeMenuItemPhoto(itemId);
      if(res.status == 200) {
        toast.dismiss();
        toast.success(res.data.message);
        await _init(itemId);
      }

    } catch (error) {
      console.error(error);
      toast.dismiss();
      const message = error?.response?.data?.message || t('menu_items.something_went_wrong');
      toast.error(message)
    }
  }

  const btnShowAISuggestions = async () => {
    const itemTitle = titleRef.current?.value || title;

    if (!itemTitle) {
      toast.error(t('menu_item.provide_title_error'));
      return;
    }

    document.getElementById('modal-ai-image-suggestions').showModal();
    setAiImageSuggestions([]);
    setIsLoadingAiSuggestions(true);

    try {
      const res = await getMenuItemImageSuggestions(itemId, itemTitle);
      if (res.status == 200) {
        setAiImageSuggestions(res.data?.imageUrls || []);
      }
    } catch (error) {
      console.error(error);
      const message = error?.response?.data?.message || t('menu_item.ai_suggestions_error');
      toast.error(message);
      document.getElementById('modal-ai-image-suggestions').close();
    } finally {
      setIsLoadingAiSuggestions(false);
    }
  }

  const btnSelectAISuggestion = async (imageUrl) => {
    setSelectingImageUrl(imageUrl);

    try {
      const res = await selectMenuItemImageSuggestion(itemId, imageUrl);
      if (res.status == 200) {
        toast.success(res.data.message);
        document.getElementById('modal-ai-image-suggestions').close();
        await _init(itemId);
      }
    } catch (error) {
      console.error(error);
      const message = error?.response?.data?.message || t('menu_item.ai_suggestion_select_error');
      toast.error(message);
    } finally {
      setSelectingImageUrl(null);
    }
  }

  const btnShowImageUrlModal = () => {
    setImageUrlInput("");
    setImageUrlPreviewError(false);
    document.getElementById('modal-image-url').showModal();
  }

  const btnUseImageUrl = async () => {
    const url = imageUrlInput.trim();

    if (!url) {
      toast.error(t('menu_item.image_link_empty_error'));
      return;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        toast.error(t('menu_item.image_link_https_error'));
        return;
      }
    } catch {
      toast.error(t('menu_item.image_link_invalid_error'));
      return;
    }

    setIsSavingImageUrl(true);

    try {
      const res = await selectMenuItemImageSuggestion(itemId, url);
      if (res.status == 200) {
        toast.success(res.data.message);
        document.getElementById('modal-image-url').close();
        await _init(itemId);
      }
    } catch (error) {
      console.error(error);
      const message = error?.response?.data?.message || t('menu_item.image_link_use_error');
      toast.error(message);
    } finally {
      setIsSavingImageUrl(false);
    }
  }


  const getBaseIdOptions = () => {
    const data =
      activeAddRecipeItemTab == "variant"
        ? state.variants
        : activeAddRecipeItemTab == "addon"
        ? state.addons
        : [];

    return data.map((item) => ({
      label: item.title,
      value: item.id,
    }));
  };

  const getIngredientsOptions = () => {
    return state.inventoryItems?.map((item) => ({
      label: item.title,
      value: item.id,
      unit:item.unit
    }));
  };

  async function btnAddRecipeItem() {
    const qty = parseFloat(quantityRef.current?.value);

    if (!selectedRecipeData.ingredient) {
      toast.error("Please select an ingredient.");
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }

    if ((activeAddRecipeItemTab === "variant" || activeAddRecipeItemTab === "addon") && !selectedRecipeData.selectedBase) {
      toast.error("Please select a variant or addon.");
      return;
    }

    let variantId = 0;
    let addonId = 0;

    if(activeAddRecipeItemTab == 'variant'){
      variantId = selectedRecipeData?.selectedBase?.id;
    }else if(activeAddRecipeItemTab == 'addon'){
      addonId = selectedRecipeData?.selectedBase?.id;
    }

    try {
      toast.loading("Please wait...");

      const res = await addMenuItemRecipeItem({
        menuItemId: itemId,
        variantId,
        addonId,
        ingredientId: selectedRecipeData?.ingredient?.value,
        quantity:qty,
      });

      if (res.status === 200) {
        toast.dismiss();
        toast.success(res.data.message);

        quantityRef.current.value = null;
        setSelectedRecipeData({
          ingredient:null,
          selectedBase:null
        });
        setActiveAddRecipeItemTab('item')

        document.getElementById('modal-add-recipe-item').close();

        await _init(itemId);
      }
    } catch (error) {
      const message = error?.response?.data?.message || "Something went wrong!";
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

    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }

    if ((editRecipeData.baseType === "variant" || editRecipeData.baseType === "addon") && !editRecipeData.selectedBase) {
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
      const message = error?.response?.data?.message || "Something went wrong!";
      console.error(error);
      toast.dismiss();
      toast.error(message);
    }
  }

  const btnDeleteRecipeItem = async (recipeItemId, recipeItemVariantId, recipeItemAddonId) => {
    const isConfirm = window.confirm("Are you sure! This process is irreversible!");

    if(!isConfirm) {
      return;
    }

    try {
      toast.loading("Please wait...");
      const res = await deleteRecipeItem(itemId, recipeItemId, recipeItemVariantId, recipeItemAddonId);

      if(res.status == 200) {
        await _init(itemId);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || "Something went wrong!";
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  };

  return (
    <Page className="px-4 md:px-8 py-3 md:py-6">
      <div className="text-sm breadcrumbs">
        <ul>
          <li>
            <Link to="/dashboard/settings">{t('navbar.settings')}</Link>
          </li>
          <li>
            <Link to="/dashboard/settings/menu-items">{t('menu_items.title')}</Link>
          </li>
          <li>{title}</li>
        </ul>
      </div>

      <div className="my-6 flex gap-6 flex-col lg:flex-row items-start">
        {/* Left Column: Image & POS Preview */}
        <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
          {/* Image card */}
          <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] p-4 flex flex-col items-center">
            <div className='relative w-48 h-48 md:w-56 md:h-56 rounded-2xl flex items-center justify-center text-2xl mb-3 text-restro-text dark:text-white bg-restro-bg-gray border border-restro-border-green overflow-hidden'>
              {
                image ? (
                  <img src={imageURL} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <p className="text-gray-400"><IconCarrot stroke={iconStroke} size={48} /></p>
                )
              }

              {/* upload image options */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                <label
                  htmlFor="file"
                  title={t('menu_item.upload')}
                  className="flex items-center justify-center w-8 h-8 rounded-full shadow cursor-pointer transition active:scale-95 bg-white/90 dark:bg-black/80 backdrop-blur hover:bg-white dark:hover:bg-black border border-restro-border-green text-restro-text"
                >
                  <IconUpload stroke={iconStroke} size={15} />
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
                  title={t('menu_item.ai_suggest_image')}
                  className="flex items-center justify-center w-8 h-8 rounded-full shadow cursor-pointer transition active:scale-95 bg-gradient-to-br from-emerald-500 to-green-600 text-white hover:brightness-110"
                >
                  <IconSparkles stroke={iconStroke} size={15} />
                </button>

                <button
                  type="button"
                  onClick={btnShowImageUrlModal}
                  title={t('menu_item.paste_image_link')}
                  className="flex items-center justify-center w-8 h-8 rounded-full shadow cursor-pointer transition active:scale-95 bg-white/90 dark:bg-black/80 backdrop-blur hover:bg-white dark:hover:bg-black border border-restro-border-green text-restro-text"
                >
                  <IconLink stroke={iconStroke} size={15} />
                </button>

                {uploadedPhoto && (
                  <button
                    onClick={btnRemoveMenuItemImage}
                    title={t('menu_item.remove')}
                    className="flex items-center justify-center w-8 h-8 rounded-full shadow cursor-pointer transition active:scale-95 text-red-500 bg-white/90 dark:bg-black/80 backdrop-blur hover:bg-red-50 border border-red-200"
                  >
                    <IconTrash stroke={iconStroke} size={15} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">PNG, JPG, WebP up to 5MB</p>
          </div>

          {/* POS Live Preview Card */}
          <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live POS Preview
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-medium">Customer View</span>
            </div>
            {/* Simulated mini POS card */}
            <div className="rounded-xl border border-restro-border-green overflow-hidden bg-restro-card-bg shadow-sm">
              <div className="relative h-28 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                {image ? (
                  <img src={imageURL} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <IconCarrot stroke={iconStroke} size={32} className="text-gray-400" />
                )}
                <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur">
                  {categories.find(c => c.id == category_id)?.title || "General"}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-bold text-restro-text truncate">{title || "Item Title"}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    {price ? `${price}` : "$0.00"}
                  </span>
                  <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow">
                    +
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Details, Variants, Addons, Recipe */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Basic Info Card */}
          <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Item Details</p>
              <button
                onClick={btnSave}
                className='rounded-xl transition active:scale-95 text-white hover:shadow-md px-5 py-2 text-xs font-semibold border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'
              >
                {t('menu_item.save')}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="title" className={`text-sm mb-1 block font-medium ${theme === 'black' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('menu_item.title')} <span className="text-red-400">*</span>
                </label>
                <input
                  ref={titleRef}
                  defaultValue={title}
                  type="text"
                  name="title"
                  className='text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray'
                  placeholder={t('menu_items.enter_item_title')}
                />
              </div>

              <div>
                <label htmlFor="description" className={`text-sm mb-1 block font-medium ${theme === 'black' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('menu_item.description')}
                  <span className="text-xs text-gray-400 ml-1">{t('menu_items.max_chars')}</span>
                </label>
                <textarea
                  ref={descriptionRef}
                  defaultValue={description}
                  name="description"
                  className='text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray resize-none'
                  placeholder={t('menu_items.enter_item_description')}
                  rows="3"
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className={`text-sm mb-1 block font-medium ${theme === 'black' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('menu_item.price')} <span className="text-red-400">*</span>
                  </label>
                  <input
                    ref={priceRef}
                    defaultValue={price}
                    type="number"
                    name="price"
                    className='text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray'
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label htmlFor="nprice" className={`text-sm mb-1 block font-medium ${theme === 'black' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('menu_item.net_price')}
                  </label>
                  <input
                    ref={netPriceRef}
                    type="number"
                    name="nprice"
                    defaultValue={net_price}
                    className='text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray'
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className={`text-sm mb-1 block font-medium ${theme === 'black' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('menu_item.category')}
                  </label>
                  <select
                    ref={categoryIdRef}
                    defaultValue={category_id}
                    name="category"
                    className='text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray'
                  >
                    <option value="">{t('menu_item.none')}</option>
                    {categories.map((category) => (
                      <option value={category.id} key={category.id}>{category.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tax" className={`text-sm mb-1 block font-medium ${theme === 'black' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('menu_item.tax')}
                  </label>
                  <select
                    ref={taxIdRef}
                    name="tax"
                    defaultValue={tax_id}
                    className='text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray'
                  >
                    <option value="">{t('menu_item.none')}</option>
                    {taxes.map((tax) => (
                      <option value={tax.id} key={tax.id}>{tax.title} - {tax.rate}% ({tax.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="kitchenStation" className={`text-sm mb-1 block font-medium ${theme === 'black' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Kitchen Station
                </label>
                <select
                  ref={kitchenStationIdRef}
                  defaultValue={kitchen_station_id || ""}
                  name="kitchenStation"
                  className='text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray'
                >
                  <option value="">
                    {category_kitchen_station_name 
                      ? `Category Default (${category_kitchen_station_name})` 
                      : "Category Default (Auto-routes by category)"}
                  </option>
                  {stations?.filter((s) => s.is_enabled)?.map((station) => (
                    <option value={station.id} key={station.id}>
                      {station.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Override kitchen station routing for this item, or leave as Category Default.
                </p>
              </div>
            </div>
          </div>

          {/* Variants Card */}
          <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('menu_item.show_variants')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{state.variants?.length || 0} variants configured</p>
              </div>
              <button
                onClick={() => document.getElementById('modal-add-variant').showModal()}
                className="rounded-xl border border-restro-border-green px-3 py-1.5 text-xs font-semibold text-restro-green bg-restro-green/10 hover:bg-restro-green/20 transition active:scale-95 flex items-center gap-1"
              >
                <IconPlus size={13} stroke={iconStroke} /> {t('menu_item.add_variant')}
              </button>
            </div>
            {state.variants?.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No variants yet</p>
            ) : (
              <div className="space-y-2">
                {state.variants?.map((variant) => (
                  <div key={variant.id} className={`flex items-center justify-between p-3 rounded-xl transition ${theme === 'black' ? 'hover:bg-restro-card-iconbg' : 'hover:bg-gray-50'} border border-restro-border-green`}>
                    <div>
                      <p className="text-sm font-medium text-restro-text">{variant.title}</p>
                      <p className="text-xs text-gray-500">{t('menu_item.price')}: {variant.price}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => btnShowVariantUpdate(variant.id, variant.title, variant.price)} className='w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 text-restro-text hover:bg-restro-button-hover'>
                        <IconPencil stroke={iconStroke} size={15} />
                      </button>
                      <button onClick={() => btnVariantDelete(variant.id)} className='w-8 h-8 rounded-lg flex items-center justify-center text-red-500 transition active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20'>
                        <IconTrash stroke={iconStroke} size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Addons Card */}
          <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('menu_item.show_addons')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{state.addons?.length || 0} addons configured</p>
              </div>
              <button
                onClick={() => document.getElementById('modal-add-addon').showModal()}
                className="rounded-xl border border-restro-border-green px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition active:scale-95 flex items-center gap-1"
              >
                <IconPlus size={13} stroke={iconStroke} /> {t('menu_item.add_addon')}
              </button>
            </div>
            {state.addons?.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No addons yet</p>
            ) : (
              <div className="space-y-2">
                {state.addons?.map((addon) => (
                  <div key={addon.id} className={`flex items-center justify-between p-3 rounded-xl transition ${theme === 'black' ? 'hover:bg-restro-card-iconbg' : 'hover:bg-gray-50'} border border-restro-border-green`}>
                    <div>
                      <p className="text-sm font-medium text-restro-text">{addon.title}</p>
                      <p className="text-xs text-gray-500">{t('menu_item.price_increase')}: +{addon.price}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => btnShowAddonUpdate(addon.id, addon.title, addon.price)} className='w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 text-restro-text hover:bg-restro-button-hover'>
                        <IconPencil stroke={iconStroke} size={15} />
                      </button>
                      <button onClick={() => btnAddonDelete(addon.id)} className='w-8 h-8 rounded-lg flex items-center justify-center text-red-500 transition active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20'>
                        <IconTrash stroke={iconStroke} size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recipe Card */}
          <div className="rounded-2xl border border-restro-border-green bg-white dark:bg-[#252525] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recipe / Inventory</p>
                <p className="text-xs text-gray-400 mt-0.5">{state.recipeItems?.length || 0} ingredients linked</p>
              </div>
              <button
                onClick={() => document.getElementById('modal-add-recipe-item').showModal()}
                className="rounded-xl border border-restro-border-green px-3 py-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition active:scale-95 flex items-center gap-1"
              >
                <IconPlus size={13} stroke={iconStroke} /> Add Item
              </button>
            </div>
            {state.recipeItems?.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No recipe ingredients linked</p>
            ) : (
              <div className="space-y-2">
                {state.recipeItems?.map((item) => (
                  <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl transition ${theme === 'black' ? 'hover:bg-restro-card-iconbg' : 'hover:bg-gray-50'} border border-restro-border-green`}>
                    <div>
                      <p className="text-sm font-medium text-restro-text flex items-center gap-1">
                        {item.ingredient_title}
                        {item.variant_title && <span className="ml-1 px-2 text-xs rounded-full bg-gray-200 dark:bg-gray-700">{item.variant_title}</span>}
                        {item.addon_title && <span className="ml-1 px-2 text-xs rounded-full bg-gray-200 dark:bg-gray-700">{item.addon_title}</span>}
                      </p>
                      <p className="text-xs text-gray-500">({item.quantity} {item.unit})</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditRecipeData({
                            id: item.id, quantity: item.quantity,
                            ingredient: { value: item.inventory_item_id, label: item.ingredient_title, unit: item.unit },
                            selectedBase: item.variant_id ? { id: item.variant_id, label: item.variant_title } : item.addon_id ? { id: item.addon_id, label: item.addon_title } : null,
                            baseType: item.variant_id ? "variant" : item.addon_id ? "addon" : "item",
                          });
                          setTimeout(() => { if (quantityEditRef.current) quantityEditRef.current.value = item.quantity; }, 100);
                          setActiveAddRecipeItemTab(item.variant_id ? "variant" : item.addon_id ? "addon" : "item");
                          document.getElementById("modal-edit-recipe-item").showModal();
                        }}
                        className='w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 text-restro-text hover:bg-restro-button-hover'
                      >
                        <IconPencil stroke={iconStroke} size={15} />
                      </button>
                      <button
                        onClick={() => btnDeleteRecipeItem(item.id, item.variant_id, item.addon_id)}
                        className='w-8 h-8 rounded-lg flex items-center justify-center text-red-500 transition active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20'
                      >
                        <IconTrash stroke={iconStroke} size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialogs ── */}

      {/* variant add dialog */}
      <dialog id="modal-add-variant" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg">{t('menu_item.add_variant')}</h3>
          <div className="mt-4">
            <label htmlFor="title" className="mb-1 block text-gray-500 text-sm">{t('menu_item.variant_title')}</label>
            <input ref={variantTitleRef} type="text" name="title" className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray' placeholder={t('menu_item.variant_title')} />
          </div>
          <div className="my-4">
            <label htmlFor="price" className="mb-1 block text-gray-500 text-sm">{t('menu_item.variant_price')}</label>
            <input ref={variantPriceRef} type="number" name="price" className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray' placeholder={t('menu_item.variant_price')} />
            <p className="text-xs text-gray-500 mt-1">{t('menu_item.final_price_note')}</p>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>{t('menu_item.close')}</button>
              <button onClick={() => { btnAddVariant(); }} className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 ml-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t('menu_item.save')}</button>
            </form>
          </div>
        </div>
      </dialog>

      {/* variant update dialog */}
      <dialog id="modal-update-variant" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg">{t('menu_item.update_variant')}</h3>
          <div className="mt-4">
            <input type="hidden" ref={variantIdRef} />
            <label htmlFor="title" className='mb-1 block text-gray-500 text-sm' />
            <input ref={variantTitleUpdateRef} type="text" name="title" className="text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray" placeholder={t('menu_item.variant_title')} />
          </div>
          <div className="my-4">
            <label htmlFor="price" className="mb-1 block text-gray-500 text-sm">{t('menu_item.variant_price')}</label>
            <input ref={variantPriceUpdateRef} type="number" name="price" className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray' placeholder={t('menu_item.variant_price')} />
            <p className="text-xs text-gray-500 mt-1">{t('menu_item.final_price_note')}</p>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>{t('menu_item.close')}</button>
              <button onClick={() => { btnUpdateVariant(); }} className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 ml-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t('menu_item.save')}</button>
            </form>
          </div>
        </div>
      </dialog>

      {/* addon add dialog */}
      <dialog id="modal-add-addon" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg">{t('menu_item.add_addon')}</h3>
          <div className="mt-4">
            <label htmlFor="title" className="mb-1 block text-gray-500 text-sm">{t('menu_item.addon_title')}</label>
            <input ref={addonTitleRef} type="text" name="title" className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray' placeholder={t('menu_item.addon_title')} />
          </div>
          <div className="my-4">
            <label htmlFor="price" className="mb-1 block text-gray-500 text-sm">{t('menu_item.addon_price')}</label>
            <input ref={addonPriceRef} type="number" name="price" className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray' placeholder={t('menu_item.addon_price')} />
            <p className="text-xs text-gray-500 mt-1">{t('menu_item.final_price_note')}</p>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 flex-1 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>{t('menu_item.close')}</button>
              <button onClick={() => { btnAddAddon(); }} className='btn rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t('menu_item.save')}</button>
            </form>
          </div>
        </div>
      </dialog>

      {/* addon update dialog */}
      <dialog id="modal-update-addon" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg">{t('menu_item.update_addon')}</h3>
          <div className="mt-4">
            <input type="hidden" ref={addonIdRef} />
            <label htmlFor="title" className="mb-1 block text-gray-500 text-sm">{t('menu_item.addon_title')}</label>
            <input ref={addonTitleUpdateRef} type="text" name="title" className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray' placeholder={t('menu_item.addon_title')} />
          </div>
          <div className="my-4">
            <label htmlFor="price" className="mb-1 block text-gray-500 text-sm">{t('menu_item.addon_price')}</label>
            <input ref={addonPriceUpdateRef} type="number" name="price" className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray' placeholder={t('menu_item.addon_price')} />
            <p className="text-xs text-gray-500 mt-1">{t('menu_item.final_price_note')}</p>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 flex-1 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>{t('menu_item.close')}</button>
              <button onClick={() => { btnUpdateAddon(); }} className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 ml-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t('menu_item.save')}</button>
            </form>
          </div>
        </div>
      </dialog>

      {/* recipe add dialog */}
      <dialog id="modal-add-recipe-item" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg">Add New Recipe Item</h3>
          <div role="tablist" className="tabs my-4">
            {["item", "variant", "addon"].map((tab) => (
              <a key={tab} role="tab" className={`tab rounded-t-lg ${activeAddRecipeItemTab === tab ? theme === "black" ? "border-b-2 border-b-restro-green text-white bg-restro-green-10 hover:bg-restro-green-10" : "border-b-2 border-b-restro-green text-restro-green bg-restro-green-10 hover:bg-restro-green-10" : theme === "black" ? "text-white hover:bg-restro-bg-hover-dark-mode" : "text-gray-500 hover:bg-gray-100"}`}
                onClick={() => { setSelectedRecipeData({ ingredient: null, selectedBase: null }); quantityRef.current.value = ""; setActiveAddRecipeItemTab(tab); }}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </a>
            ))}
          </div>
          {activeAddRecipeItemTab !== "item" && (<p className="text-xs text-gray-500 mb-4"><strong>Note:</strong> Add only those extra inventory items that are <em>not included</em> in the base item recipe.</p>)}
          {(activeAddRecipeItemTab === "variant" || activeAddRecipeItemTab === "addon") && (
            <div className="mb-4">
              <label htmlFor="baseSelect" className="mb-1 block text-gray-500 text-sm">{activeAddRecipeItemTab === "variant" ? "Select Variant" : "Select Addon"}</label>
              <AsyncSelect key={`base-${activeAddRecipeItemTab}`} defaultOptions={getBaseIdOptions()} loadOptions={(inputValue, callback) => callback(getBaseIdOptions().filter((opt) => opt.label.toLowerCase().includes(inputValue.toLowerCase())))} isClearable placeholder="Type to search..." onChange={(v) => { setSelectedRecipeData((prev) => ({ ...prev, selectedBase: v ? { id: v.value, label: v.label } : null })); }} value={selectedRecipeData.selectedBase} noOptionsMessage={() => "No results found"}
                styles={{ control: (base) => ({ ...base, backgroundColor: theme === "black" ? "#232323" : "#f3f4f6", borderRadius: "0.5rem", borderColor: theme === "black" ? "#232323" : "#f3f4f6", height: 40, boxShadow: "none", color: theme === "black" ? "#ffffff" : "#111827", "&:hover": { borderColor: theme === "black" ? "#23233" : "#9ca3af" } }), menu: (base) => ({ ...base, borderRadius: "0.5rem" }), menuList: (base) => ({ ...base, maxHeight: 150, overflowY: "auto", borderRadius: "0.5rem", backgroundColor: theme === "black" ? "#232323" : "white" }), option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? theme === "black" ? "#292929" : "#e5e7eb" : theme === "black" ? "#232323" : "white", color: theme === "black" ? "#f9fafb" : "#111827", "&:active": { backgroundColor: theme === "black" ? "#6b7280" : "#d1d5db" } }), indicatorSeparator: (base) => ({ ...base, backgroundColor: theme === "black" ? "#333333" : "#d1d5db" }) }}
              />
            </div>
          )}
          <div className="mb-4 overflow-visible">
            <label htmlFor="inventorySelect" className="mb-1 block text-gray-500 text-sm">Select Inventory Item</label>
            <AsyncSelect key={`inventory-${activeAddRecipeItemTab}`} defaultOptions={getIngredientsOptions()} loadOptions={(inputValue, callback) => callback(getIngredientsOptions().filter((opt) => opt.label.toLowerCase().includes(inputValue.toLowerCase())))} isClearable placeholder="Type to search..." onChange={(v) => setSelectedRecipeData((prev) => ({ ...prev, ingredient: v }))} value={selectedRecipeData?.ingredient} noOptionsMessage={() => "No results found"} className="overflow-visible"
              styles={{ control: (base) => ({ ...base, backgroundColor: theme === "black" ? "#232323" : "#f3f4f6", borderRadius: "0.5rem", borderColor: theme === "black" ? "#232323" : "#f3f4f6", height: 40, boxShadow: "none", color: theme === "black" ? "#ffffff" : "#111827", "&:hover": { borderColor: theme === "black" ? "#23233" : "#9ca3af" } }), menu: (base) => ({ ...base, borderRadius: "0.5rem" }), menuList: (base) => ({ ...base, maxHeight: 150, overflowY: "auto", borderRadius: "0.5rem", backgroundColor: theme === "black" ? "#232323" : "white" }), option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? theme === "black" ? "#292929" : "#e5e7eb" : theme === "black" ? "#232323" : "white", color: theme === "black" ? "#f9fafb" : "#111827", "&:active": { backgroundColor: theme === "black" ? "#6b7280" : "#d1d5db" } }), indicatorSeparator: (base) => ({ ...base, backgroundColor: theme === "black" ? "#333333" : "#d1d5db" }) }}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="recipe_item_qty" className="mb-1 block text-gray-500 text-sm">Qty. {selectedRecipeData?.ingredient?.unit != null && (<span>(in {selectedRecipeData.ingredient.unit})</span>)}</label>
            <input type="number" ref={quantityRef} className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray' placeholder="Enter Qty." step="any" min="0" />
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 flex-1 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>Close</button>
              <button type="button" onClick={btnAddRecipeItem} className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>Save</button>
            </form>
          </div>
        </div>
      </dialog>

      {/* recipe edit dialog */}
      <dialog id="modal-edit-recipe-item" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg">Edit Recipe Item</h3>
          <div role="tablist" className="tabs my-4">
            {["item", "variant", "addon"].map((tab) => (
              <a key={tab} role="tab" className={`tab ${editRecipeData.baseType === tab ? "border-b-2 border-b-restro-green bg-restro-green/10 rounded-t-lg text-restro-green" : "text-gray-500 hover:bg-gray-100"}`}
                onClick={() => setEditRecipeData((prev) => ({ ...prev, baseType: tab, selectedBase: null, quantity: "", ingredient: null }))}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </a>
            ))}
          </div>
          {editRecipeData.baseType !== "item" && (<p className="text-xs text-gray-500 mb-4"><strong>Note:</strong> Add only those extra inventory items that are <em>not included</em> in the base item recipe.</p>)}
          {(editRecipeData.baseType === "variant" || editRecipeData.baseType === "addon") && (
            <div className="mb-4">
              <label className="mb-1 block text-gray-500 text-sm">{editRecipeData.baseType === "variant" ? "Select Variant" : "Select Addon"}</label>
              <AsyncSelect defaultOptions={getBaseIdOptions()} loadOptions={(inputValue, callback) => callback(getBaseIdOptions().filter((opt) => opt.label.toLowerCase().includes(inputValue.toLowerCase())))} isClearable placeholder="Type to search..." onChange={(v) => { setEditRecipeData((prev) => ({ ...prev, selectedBase: v ? { id: v.value, label: v.label } : null })); }} value={editRecipeData.selectedBase} noOptionsMessage={() => "No results found"}
                styles={{ control: (base) => ({ ...base, backgroundColor: theme === "black" ? "" : "", borderRadius: "0.5rem", borderColor: theme === "black" ? "#232323" : "#f3f4f6", height: 40, boxShadow: "none", color: theme === "black" ? "#ffffff" : "#111827", "&:hover": { borderColor: theme === "black" ? "#23233" : "#9ca3af" } }), menu: (base) => ({ ...base, borderRadius: "0.5rem" }), menuList: (base) => ({ ...base, maxHeight: 150, overflowY: "auto", borderRadius: "0.5rem", backgroundColor: theme === "black" ? "#232323" : "white" }), option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? theme === "black" ? "#292929" : "#e5e7eb" : theme === "black" ? "#232323" : "white", color: theme === "black" ? "#f9fafb" : "#111827", "&:active": { backgroundColor: theme === "black" ? "#6b7280" : "#d1d5db" } }), indicatorSeparator: (base) => ({ ...base, backgroundColor: theme === "black" ? "#333333" : "#d1d5db" }) }}
              />
            </div>
          )}
          <div className="mb-4">
            <label className="mb-1 block text-gray-500 text-sm">Select Inventory Item</label>
            <AsyncSelect defaultOptions={getIngredientsOptions()} loadOptions={(inputValue, callback) => callback(getIngredientsOptions().filter((opt) => opt.label.toLowerCase().includes(inputValue.toLowerCase())))} isClearable placeholder="Type to search..." onChange={(v) => setEditRecipeData((prev) => ({ ...prev, ingredient: v }))} value={editRecipeData.ingredient} noOptionsMessage={() => "No results found"}
              styles={{ control: (base) => ({ ...base, backgroundColor: theme === "black" ? "" : "", borderRadius: "0.5rem", borderColor: theme === "black" ? "#232323" : "#f3f4f6", height: 40, boxShadow: "none", color: theme === "black" ? "#ffffff" : "#111827", "&:hover": { borderColor: theme === "black" ? "#23233" : "#9ca3af" } }), menu: (base) => ({ ...base, borderRadius: "0.5rem" }), menuList: (base) => ({ ...base, maxHeight: 150, overflowY: "auto", borderRadius: "0.5rem", backgroundColor: theme === "black" ? "#232323" : "white" }), option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? theme === "black" ? "#292929" : "#e5e7eb" : theme === "black" ? "#232323" : "white", color: theme === "black" ? "#f9fafb" : "#111827", "&:active": { backgroundColor: theme === "black" ? "#6b7280" : "#d1d5db" } }), indicatorSeparator: (base) => ({ ...base, backgroundColor: theme === "black" ? "#333333" : "#d1d5db" }) }}
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-gray-500 text-sm">Qty. {editRecipeData?.ingredient?.unit != null && (<span>(in {editRecipeData.ingredient.unit})</span>)}</label>
            <input type="number" ref={quantityEditRef} className="text-sm w-full border bg-restro-gray rounded-lg px-4 py-2 dark:bg-black border-restro-bg-gray outline-restro-green-light" placeholder="Enter Qty." step="any" min="0" defaultValue={editRecipeData.quantity} />
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>Close</button>
              <button type="button" onClick={btnUpdateRecipeItem} className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>Update</button>
            </form>
          </div>
        </div>
      </dialog>

      {/* AI image suggestions dialog */}
      <dialog id="modal-ai-image-suggestions" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <IconSparkles stroke={iconStroke} className="text-restro-green" />
            {t('menu_item.ai_suggestions_title')}
          </h3>
          <p className="text-xs text-gray-500 mt-1">{t('menu_item.ai_suggestions_select_hint')}</p>
          <div className="mt-4">
            {isLoadingAiSuggestions ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <span className="loading loading-spinner loading-md text-restro-green"></span>
                <p className="text-sm text-gray-500">{t('menu_item.ai_suggestions_loading')}</p>
              </div>
            ) : aiImageSuggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <IconPhoto stroke={iconStroke} size={32} className="text-gray-400" />
                <p className="text-sm text-gray-500 text-center">{t('menu_item.ai_suggestions_empty')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {aiImageSuggestions.map((suggestion, index) => {
                  const isSelecting = selectingImageUrl === suggestion;
                  return (
                    <button key={index} type="button" disabled={!!selectingImageUrl} onClick={() => btnSelectAISuggestion(suggestion)} className={`relative aspect-square rounded-xl overflow-hidden border-2 transition hover:border-restro-green group ${theme === 'black' ? 'border-restro-border-dark-mode bg-restro-bg-gray' : 'border-restro-green-light bg-gray-50'}`}>
                      <img src={suggestion} alt={title} className="w-full h-full object-cover" />
                      <div className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${isSelecting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {isSelecting ? <span className="loading loading-spinner loading-sm text-white"></span> : <span className="text-white text-xs font-medium px-2 py-1 rounded-full bg-restro-green">{t('menu_item.save')}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>{t('menu_item.close')}</button>
            </form>
          </div>
        </div>
      </dialog>

      {/* image via link dialog */}
      <dialog id="modal-image-url" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <IconLink stroke={iconStroke} className="text-restro-green" />
            {t('menu_item.image_link_title')}
          </h3>
          <p className="text-xs text-gray-500 mt-1">{t('menu_item.image_link_hint')}</p>
          <div className="mt-4">
            <label htmlFor="image_url" className="mb-1 block text-gray-500 text-sm">{t('menu_item.image_link_label')}</label>
            <input value={imageUrlInput} onChange={(e) => { setImageUrlInput(e.target.value); setImageUrlPreviewError(false); }} type="url" name="image_url" id="image_url" className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green bg-restro-gray' placeholder={t('menu_item.image_link_placeholder')} />
          </div>
          {imageUrlInput.trim() && (
            <div className={`mt-4 w-full aspect-video rounded-xl overflow-hidden border flex items-center justify-center ${theme === 'black' ? 'border-restro-border-dark-mode bg-restro-bg-gray' : 'border-restro-green-light bg-gray-50'}`}>
              {imageUrlPreviewError ? <p className="text-xs text-gray-500 px-4 text-center">{t('menu_item.image_link_preview_error')}</p> : <img src={imageUrlInput.trim()} alt={t('menu_item.image_link_preview_alt')} className="w-full h-full object-contain" onError={() => setImageUrlPreviewError(true)} />}
            </div>
          )}
          <div className="modal-action">
            <form method="dialog">
              <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>{t('menu_item.close')}</button>
            </form>
            <button type="button" disabled={isSavingImageUrl} onClick={btnUseImageUrl} className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 ml-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover disabled:opacity-60'>
              {isSavingImageUrl ? <span className="loading loading-spinner loading-sm"></span> : t('menu_item.image_link_use')}
            </button>
          </div>
        </div>
      </dialog>
    </Page>
  );
}
