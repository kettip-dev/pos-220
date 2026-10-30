import {
  IconBellRinging,
  IconCarrot,
  IconCheck,
  IconChevronRight,
  IconLock,
  IconMail,
  IconMapPin,
  IconMenu,
  IconMinus,
  IconMoodEmpty,
  IconNotes,
  IconPhone,
  IconPlus,
  IconReceipt2,
  IconSearch,
  IconShare,
  IconShieldCheck,
  IconToolsKitchen2,
  IconX,
} from "@tabler/icons-react";
import React, { useEffect, useMemo, useState } from "react";
import { iconStroke } from "../config/config";
import {
  callWaiterFromQrMenu,
  clearQRTableSession,
  getCart,
  getQRMenuInit,
  getQRTableSession,
  setCart,
  setQRTableSession,
  verifyQRTablePin,
} from "../controllers/qrmenu.controller";
import { CURRENCIES } from "../config/currencies.config";
import { getImageURL, setImageStorageConfig } from "../helpers/ImageHelper";
import toast from "react-hot-toast";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { getQRMenuLink } from "../helpers/QRMenuHelper";
import { useTranslation } from "react-i18next";
import LanguageChanger from "../components/LanguageChanger";

const WAITER_REASONS = [
  { key: "water", label: "Water", emoji: "" },
  { key: "bill", label: "Request Bill", emoji: "" },
  { key: "cutlery", label: "Cutlery", emoji: "" },
  { key: "napkins", label: "Napkins", emoji: "" },
  { key: "condiments", label: "Condiments", emoji: "" },
  { key: "clean_table", label: "Clean Table", emoji: "" },
  { key: "order_more", label: "Help Ordering", emoji: "" },
  { key: "other", label: "Other", emoji: "" },
];

function areCartItemsSameConfig(a, b) {
  if (Number(a.id) !== Number(b.id)) return false;
  if (Number(a.variant_id || 0) !== Number(b.variant_id || 0)) return false;
  const addonsA = (a.addons_ids || []).map(Number).sort((x, y) => x - y).join(",");
  const addonsB = (b.addons_ids || []).map(Number).sort((x, y) => x - y).join(",");
  if (addonsA !== addonsB) return false;
  const notesA = (a.notes || "").trim().toLowerCase();
  const notesB = (b.notes || "").trim().toLowerCase();
  return notesA === notesB;
}

export default function QRMenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const qrcode = params.qrcode;

  const [searchParams, setSearchParams] = useSearchParams();
  const urlTableParam = searchParams.get("table") ?? null;
  const urlPinParam = searchParams.get("pin") || searchParams.get("token") || null;

  const [state, setState] = useState({
    isLoading: true,
    storeSettings: null,
    storeTable: null,
    publicTables: [],
    isTablePinVerified: false,
    sessionToken: null,
    activeSessionSummary: null,
    serviceCharge: null,
    categories: [],
    currentCategory: "all",
    menuItems: [],
    searchQuery: "",
    cartItems: [],
    currency: "",
  });

  //Controlled Item Detail / Customization Modal state
  const [customizingItem, setCustomizingItem] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customNotes, setCustomNotes] = useState("");

  // Table & PIN Verification Modal state
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [selectedTableRef, setSelectedTableRef] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Call Waiter Modal state
  const [isWaiterModalOpen, setIsWaiterModalOpen] = useState(false);
  const [waiterReason, setWaiterReason] = useState("water");
  const [waiterNotes, setWaiterNotes] = useState("");
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);

  // Store Details Modal state
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);

  useEffect(() => {
    _getQRMenu(qrcode);
  }, [qrcode, urlTableParam]);

  const _getQRMenu = async (code) => {
    try {
      const savedSession = getQRTableSession(code);
      const effectiveTableParam =
        urlTableParam || savedSession?.encryptedTableId || savedSession?.tableId || null;
      const effectiveToken =
        urlPinParam ||
        (savedSession &&
        (!urlTableParam ||
          String(savedSession.encryptedTableId) === String(urlTableParam) ||
          String(savedSession.tableId) === String(urlTableParam))
          ? savedSession.sessionToken
          : null);

      const res = await getQRMenuInit(code, effectiveTableParam, effectiveToken);
      const storedCart = getCart();

      if (res.status == 200) {
        const data = res.data;
        const currencyObj = CURRENCIES.find((c) => c.cc == data?.storeSettings?.currency);
        const currencySymbol = currencyObj?.symbol || data?.storeSettings?.currency || "$";

        if (data?.imageStorageConfig) {
          setImageStorageConfig(data.imageStorageConfig);
        }

        const resolvedTable = data?.storeTable || null;
        const pinVerified = Boolean(data?.isTablePinVerified && resolvedTable);
        const verifiedToken = data?.verifiedSessionToken || null;

        if (resolvedTable && pinVerified && verifiedToken) {
          setQRTableSession(code, {
            tableId: resolvedTable.id,
            encryptedTableId: resolvedTable.encrypted_id || effectiveTableParam,
            tableTitle: resolvedTable.table_title,
            floor: resolvedTable.floor,
            sessionToken: verifiedToken,
            currency: currencySymbol,
            serviceCharge: data?.serviceCharge || null,
            storeName: data?.storeSettings?.store_name || "",
          });
        } else if (resolvedTable) {
          // Save table metadata without sessionToken if PIN not verified yet or rotated
          setQRTableSession(code, {
            tableId: resolvedTable.id,
            encryptedTableId: resolvedTable.encrypted_id || effectiveTableParam,
            tableTitle: resolvedTable.table_title,
            floor: resolvedTable.floor,
            sessionToken: null,
            currency: currencySymbol,
            serviceCharge: data?.serviceCharge || null,
            storeName: data?.storeSettings?.store_name || "",
          });
        }

        // Remove raw ?pin= from address bar once processed
        if (urlPinParam && resolvedTable?.encrypted_id) {
          setSearchParams({ table: resolvedTable.encrypted_id }, { replace: true });
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          storeSettings: data?.storeSettings,
          categories: data?.categories || [],
          menuItems: data?.menuItems || [],
          storeTable: resolvedTable,
          publicTables: data?.publicTables || [],
          isTablePinVerified: pinVerified,
          sessionToken: verifiedToken,
          activeSessionSummary: data?.activeSessionSummary || null,
          serviceCharge: data?.serviceCharge || null,
          cartItems: [...storedCart],
          currency: currencySymbol,
        }));
      }
    } catch (error) {
      console.error(error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const {
    isLoading,
    storeSettings,
    categories,
    menuItems,
    currentCategory,
    searchQuery,
    cartItems,
    currency,
    serviceCharge,
    storeTable,
    publicTables,
    isTablePinVerified,
    sessionToken,
    activeSessionSummary,
  } = state;

  const storeName = storeSettings?.store_name || "";
  const address = storeSettings?.address || "";
  const phone = storeSettings?.phone || "";
  const email = storeSettings?.email || "";
  const storeImage = storeSettings?.store_image || "";
  const is_qr_menu_enabled = storeSettings?.is_qr_menu_enabled || false;
  const is_qr_order_enabled = storeSettings?.is_qr_order_enabled || false;

  const totalCartQuantity = useMemo(
    () => (cartItems || []).reduce((acc, item) => acc + (Number(item.quantity) || 1), 0),
    [cartItems]
  );

  const totalCartPrice = useMemo(
    () =>
      (cartItems || []).reduce(
        (acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 1),
        0
      ),
    [cartItems]
  );

  const activeTableOrdersCount = useMemo(() => {
    const kCount = activeSessionSummary?.kitchenOrders?.length || 0;
    const pCount = activeSessionSummary?.pendingQrOrders?.length || 0;
    return kCount + pCount;
  }, [activeSessionSummary]);

  const filteredMenuItems = useMemo(() => {
    return (menuItems || [])
      .filter((menuItem) => menuItem.is_enabled)
      .filter((item) => {
        const { category_id } = item;
        if (currentCategory === "all") {
          return (
            !category_id ||
            categories.find((category) => category.id === category_id && category.is_enabled)
          );
        }
        return String(currentCategory) === String(category_id);
      })
      .filter((menuItem) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          String(menuItem.title || "").toLowerCase().includes(q) ||
          String(menuItem.description || "").toLowerCase().includes(q) ||
          String(menuItem.category_title || "").toLowerCase().includes(q)
        );
      });
  }, [menuItems, categories, currentCategory, searchQuery]);

  // Calculate live price inside customization modal
  const modalUnitPrice = useMemo(() => {
    if (!customizingItem) return 0;
    let base = parseFloat(customizingItem.price) || 0;
    if (selectedVariantId && customizingItem.variants?.length > 0) {
      const v = customizingItem.variants.find((x) => String(x.id) === String(selectedVariantId));
      if (v) base = parseFloat(v.price) || 0;
    }
    if (selectedAddonIds.length > 0 && customizingItem.addons?.length > 0) {
      selectedAddonIds.forEach((aId) => {
        const addon = customizingItem.addons.find((x) => String(x.id) === String(aId));
        if (addon) base += parseFloat(addon.price) || 0;
      });
    }
    return base;
  }, [customizingItem, selectedVariantId, selectedAddonIds]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {t("qr_menu.loading_message", "Loading digital menu...")}
        </p>
      </div>
    );
  }

  if (!qrcode) {
    return (
      <div className="min-h-screen w-full bg-white dark:bg-zinc-950 flex items-center justify-center p-6 text-center">
        <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
          {t("qr_menu.broken_link", "Invalid menu link.")}
        </p>
      </div>
    );
  }

  if (!is_qr_menu_enabled) {
    return (
      <div className="min-h-screen w-full bg-white dark:bg-zinc-950 flex items-center justify-center p-6 text-center">
        <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
          {t("qr_menu.menu_not_available", "Digital menu is currently unavailable.")}
        </p>
      </div>
    );
  }

  const QR_MENU_LINK = getQRMenuLink(qrcode);

  const btnShare = async () => {
    const shareData = {
      title: storeName || t("qr_menu.menu", "Menu"),
      text: storeName || t("qr_menu.menu", "Menu"),
      url: QR_MENU_LINK,
    };
    try {
      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(QR_MENU_LINK);
        toast.success(t("qr_menu.menu_link_copied", "Menu link copied!"));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const openItemModal = (item) => {
    setCustomizingItem(item);
    setSelectedVariantId(item.variants?.length > 0 ? String(item.variants[0].id) : null);
    setSelectedAddonIds([]);
    setCustomQuantity(1);
    setCustomNotes("");
  };

  const syncCartState = (nextCart) => {
    setCart(nextCart);
    setState((prev) => ({
      ...prev,
      cartItems: [...nextCart],
    }));
  };

  const upsertCartItem = (configuredItem, qtyDelta = 1) => {
    const nextCart = [...(state.cartItems || [])];
    const existingIndex = nextCart.findIndex((c) => areCartItemsSameConfig(c, configuredItem));

    if (existingIndex !== -1) {
      const updatedQty = (Number(nextCart[existingIndex].quantity) || 1) + qtyDelta;
      if (updatedQty <= 0) {
        nextCart.splice(existingIndex, 1);
      } else {
        nextCart[existingIndex] = {
          ...nextCart[existingIndex],
          quantity: updatedQty,
        };
      }
    } else if (qtyDelta > 0) {
      nextCart.push({
        ...configuredItem,
        quantity: qtyDelta,
        notes: configuredItem.notes || null,
      });
    }

    syncCartState(nextCart);
  };

  const handleConfirmModalItem = () => {
    if (!customizingItem) return;
    const variants = customizingItem.variants || [];
    const addons = customizingItem.addons || [];

    const chosenVariant = selectedVariantId
      ? variants.find((v) => String(v.id) === String(selectedVariantId)) || null
      : null;

    const chosenAddons = selectedAddonIds
      .map((aId) => addons.find((a) => String(a.id) === String(aId)))
      .filter(Boolean);

    const itemCart = {
      ...customizingItem,
      price: Number(modalUnitPrice.toFixed(2)),
      variant_id: chosenVariant ? chosenVariant.id : null,
      variant: chosenVariant,
      addons_ids: chosenAddons.map((a) => a.id),
      addons: chosenAddons,
      notes: customNotes.trim() ? customNotes.trim() : null,
    };

    upsertCartItem(itemCart, customQuantity);
    toast.success(`${customizingItem.title} ${t("qr_menu.added", "added to cart")}`);
    setCustomizingItem(null);
  };

  const getSimpleItemQuantityInCart = (itemId) => {
    return (cartItems || [])
      .filter(
        (c) =>
          Number(c.id) === Number(itemId) &&
          !c.variant_id &&
          (!c.addons_ids || c.addons_ids.length === 0) &&
          !c.notes
      )
      .reduce((acc, c) => acc + (Number(c.quantity) || 1), 0);
  };

  const openTableVerificationModal = () => {
    setSelectedTableRef(
      storeTable?.encrypted_id || storeTable?.id || publicTables?.[0]?.encrypted_id || ""
    );
    setPinInput("");
    setIsTableModalOpen(true);
  };

  const handleVerifyTablePin = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTableRef) {
      toast.error(t("qr_menu.select_table_prompt", "Please select your table"));
      return;
    }
    if (!pinInput || pinInput.trim().length < 4) {
      toast.error(t("qr_menu.enter_4digit_pin", "Please enter the 4-digit Table PIN"));
      return;
    }

    try {
      setIsVerifyingPin(true);
      const res = await verifyQRTablePin(qrcode, selectedTableRef, pinInput.trim());
      if (res.status === 200 && res.data?.success) {
        const verifiedTable = res.data.storeTable;
        const token = res.data.sessionToken;

        setQRTableSession(qrcode, {
          tableId: verifiedTable.id,
          encryptedTableId: verifiedTable.encrypted_id,
          tableTitle: verifiedTable.table_title,
          floor: verifiedTable.floor,
          sessionToken: token,
          currency,
          serviceCharge,
          storeName,
        });

        setSearchParams({ table: verifiedTable.encrypted_id }, { replace: true });

        setState((prev) => ({
          ...prev,
          storeTable: verifiedTable,
          isTablePinVerified: true,
          sessionToken: token,
          activeSessionSummary: res.data.activeSessionSummary || prev.activeSessionSummary,
        }));

        toast.success(
          `Table ${verifiedTable.table_title} verified! You can now place orders.`
        );
        setIsTableModalOpen(false);
      }
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        "Invalid 4-digit Table PIN. Please ask your server.";
      toast.error(msg);
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleCallWaiter = async (e) => {
    if (e) e.preventDefault();
    const tableRef = storeTable?.encrypted_id || storeTable?.id || urlTableParam;
    if (!tableRef) {
      toast.error("Please select your table first so our team knows where to come.");
      setIsWaiterModalOpen(false);
      openTableVerificationModal();
      return;
    }

    try {
      setIsCallingWaiter(true);
      const res = await callWaiterFromQrMenu(qrcode, {
        tableId: tableRef,
        reason: waiterReason,
        notes: waiterNotes.trim(),
      });
      if (res.status === 201 || res.status === 200) {
        toast.success(t("qr_menu.waiter_notified", "Server notified! Someone will be right with you."));
        setIsWaiterModalOpen(false);
        setWaiterNotes("");
      }
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        t("qr_menu.waiter_error", "Could not notify server. Please try again.");
      toast.error(msg);
    } finally {
      setIsCallingWaiter(false);
    }
  };

  const goToCart = () => {
    const tableQuery = storeTable?.encrypted_id
      ? `?table=${encodeURIComponent(storeTable.encrypted_id)}`
      : urlTableParam
      ? `?table=${encodeURIComponent(urlTableParam)}`
      : "";
    navigate(`/m/${qrcode}/cart${tableQuery}`, {
      state: {
        storeTable,
        currency,
        serviceCharge,
        isTablePinVerified,
        sessionToken,
        publicTables,
      },
    });
  };

  const goToOrderTracker = () => {
    const tableQuery = storeTable?.encrypted_id || urlTableParam || "";
    navigate(`/m/order-success?qrcode=${encodeURIComponent(qrcode)}&table=${encodeURIComponent(tableQuery)}`);
  };

  return (
    <div className="min-h-screen w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 pb-32">
      {/* 1. STICKY TOP HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {storeImage ? (
              <img
                src={getImageURL(storeImage)}
                alt={storeName}
                className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center shrink-0">
                <IconToolsKitchen2 size={22} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                {storeName}
              </h1>
              {address && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                  <IconMapPin size={12} className="shrink-0" />
                  <span className="truncate">{address}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsWaiterModalOpen(true)}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
              title="Call Waiter"
            >
              <IconBellRinging size={17} />
              <span className="hidden xs:inline">{t("qr_menu.call_waiter", "Call Server")}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsStoreModalOpen(true)}
              className="min-h-[42px] min-w-[42px] rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 flex items-center justify-center active:scale-95 transition cursor-pointer"
              aria-label="Store info"
            >
              <IconMenu stroke={iconStroke} size={20} />
            </button>
          </div>
        </div>

        {/* 2. TABLE & SECURITY STATUS BAR */}
        {is_qr_order_enabled && (
          <div className="max-w-4xl mx-auto px-4 pb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={openTableVerificationModal}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition active:scale-95 cursor-pointer ${
                  storeTable && isTablePinVerified
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300"
                    : "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-200"
                }`}
              >
                {storeTable ? (
                  <>
                    <span>
                      {t("tables.table", "Table")} {storeTable.table_title}
                      {storeTable.floor ? ` • ${storeTable.floor}` : ""}
                    </span>
                    {isTablePinVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold">
                        <IconShieldCheck size={12} />
                        {t("qr_menu.pin_verified", "PIN Verified")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold">
                        <IconLock size={11} />
                        {t("qr_menu.enter_pin", "Enter PIN")}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <IconLock size={14} className="text-amber-500" />
                    <span>{t("qr_menu.select_table_pin", "Select Table & Enter PIN")}</span>
                  </>
                )}
              </button>
            </div>

            {activeTableOrdersCount > 0 && (
              <button
                type="button"
                onClick={goToOrderTracker}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
              >
                <IconReceipt2 size={15} />
                <span>{t("qr_menu.track_order", "Active Order / Bill")}</span>
                <IconChevronRight size={14} />
              </button>
            )}
          </div>
        )}

        {/* 3. SEARCH & CATEGORY PILLS */}
        <div className="max-w-4xl mx-auto px-4 pb-3 space-y-2.5">
          <div className="relative flex items-center">
            <IconSearch size={18} className="absolute left-3.5 text-slate-400 pointer-events-none" />
            <input
              type="search"
              name="search"
              id="search"
              className="w-full min-h-[42px] bg-slate-100 dark:bg-zinc-800/90 rounded-xl pl-10 pr-9 py-2 text-sm outline-none border border-transparent focus:border-emerald-500 transition"
              placeholder={t("qr_menu.search_placeholder", "Search dishes, drinks...")}
              value={searchQuery}
              onChange={(e) => setState((prev) => ({ ...prev, searchQuery: e.target.value }))}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, searchQuery: "" }))}
                className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <IconX size={16} />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => setState((prev) => ({ ...prev, currentCategory: "all" }))}
              className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition active:scale-95 cursor-pointer border ${
                currentCategory === "all"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-700"
              }`}
            >
              {t("qr_menu.all", "All Items")}
            </button>

            {categories
              .filter((category) => category.is_enabled)
              .map((category) => {
                const isSelected = String(currentCategory) === String(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      setState((prev) => ({ ...prev, currentCategory: String(category.id) }))
                    }
                    className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition active:scale-95 cursor-pointer border ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-700"
                    }`}
                  >
                    {category.title}
                  </button>
                );
              })}
          </div>
        </div>
      </header>

      {/* 4. MENU CATALOG */}
      <main className="max-w-4xl mx-auto px-4 pt-4">
        {filteredMenuItems.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center text-slate-400 gap-2">
            <IconMoodEmpty size={44} stroke={1.5} />
            <p className="text-sm font-semibold">
              {t("qr_menu.no_items_found", "No matching menu items found.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredMenuItems.map((item) => {
              const {
                addons = [],
                variants = [],
                category_id,
                category_title,
                id,
                image,
                price,
                title,
                description,
              } = item;

              const imageURL = getImageURL(image);
              const hasVariantOrAddon = variants.length > 0 || addons.length > 0;
              const simpleQty = !hasVariantOrAddon ? getSimpleItemQuantityInCart(id) : 0;

              return (
                <div
                  key={id}
                  onClick={() => openItemModal(item)}
                  className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-3.5 flex gap-3.5 shadow-2xs hover:border-emerald-500/40 transition cursor-pointer"
                >
                  {/* Left: Item details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-2">
                          {title}
                        </h3>
                      </div>

                      {category_id && category_title && (
                        <span className="inline-block mt-1 text-[11px] font-semibold text-slate-400">
                          {category_title}
                        </span>
                      )}

                      {description && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                        {currency}
                        {Number(price).toFixed(2)}
                      </span>

                      {hasVariantOrAddon && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400">
                          {t("qr_menu.customisable", "Customizable")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Thumbnail + Add/Stepper control */}
                  <div className="flex flex-col items-center justify-between shrink-0">
                    <div className="w-28 h-28 rounded-xl bg-slate-100 dark:bg-zinc-800 overflow-hidden relative flex items-center justify-center text-slate-400 border border-slate-100 dark:border-zinc-800">
                      {image ? (
                        <img
                          src={imageURL}
                          alt={title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <IconCarrot size={28} />
                      )}
                    </div>

                    {is_qr_order_enabled && (
                      <div
                        className="mt-2 w-28"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!hasVariantOrAddon && simpleQty > 0 ? (
                          <div className="min-h-[38px] w-full rounded-xl bg-emerald-600 text-white flex items-center justify-between px-1.5 shadow-xs">
                            <button
                              type="button"
                              onClick={() => upsertCartItem(item, -1)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition cursor-pointer"
                            >
                              <IconMinus size={15} stroke={2.5} />
                            </button>
                            <span className="text-xs font-extrabold">{simpleQty}</span>
                            <button
                              type="button"
                              onClick={() => upsertCartItem(item, 1)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition cursor-pointer"
                            >
                              <IconPlus size={15} stroke={2.5} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (hasVariantOrAddon) {
                                openItemModal(item);
                              } else {
                                upsertCartItem(item, 1);
                                toast.success(`${title} ${t("qr_menu.added", "added")}`);
                              }
                            }}
                            className="min-h-[38px] w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold py-2 px-3 flex items-center justify-center gap-1 shadow-xs active:scale-95 transition cursor-pointer"
                          >
                            <IconPlus size={14} stroke={2.5} />
                            <span>{t("qr_menu.add", "Add")}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 5. STICKY BOTTOM VIEW CART BAR */}
      {is_qr_order_enabled && totalCartQuantity > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-3 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95">
          <div className="max-w-4xl mx-auto">
            <button
              type="button"
              onClick={goToCart}
              className="w-full min-h-[56px] bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 px-5 rounded-2xl shadow-lg flex items-center justify-between active:scale-98 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-xl bg-white/20 text-xs font-extrabold">
                  {totalCartQuantity} {totalCartQuantity === 1 ? "item" : t("qr_menu.items_added", "items")}
                </span>
                <span className="text-base font-extrabold">
                  {currency}
                  {totalCartPrice.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-1 text-base font-extrabold">
                <span>{t("qr_menu.view_cart", "View Cart")}</span>
                <IconChevronRight size={20} stroke={2.5} />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 6. CONTROLLED ITEM DETAIL & CUSTOMIZATION MODAL */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-zinc-800 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-start justify-between gap-3">
              <div className="flex gap-3.5 min-w-0">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center text-slate-400">
                  {customizingItem.image ? (
                    <img
                      src={getImageURL(customizingItem.image)}
                      alt={customizingItem.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <IconCarrot size={28} />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {customizingItem.title}
                  </h3>
                  <p className="text-sm font-extrabold text-emerald-600 mt-0.5">
                    {currency}
                    {Number(customizingItem.price).toFixed(2)}
                  </p>
                  {customizingItem.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {customizingItem.description}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-5 flex-1">
              {/* Variants */}
              {customizingItem.variants?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      {t("qr_menu.variants", "Select Option")}
                    </h4>
                    <span className="text-[11px] font-bold text-emerald-600">Required</span>
                  </div>
                  <div className="space-y-2">
                    {customizingItem.variants.map((variant) => {
                      const isChecked = String(selectedVariantId) === String(variant.id);
                      return (
                        <label
                          key={variant.id}
                          onClick={() => setSelectedVariantId(String(variant.id))}
                          className={`min-h-[46px] p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                            isChecked
                              ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30"
                              : "border-slate-200 dark:border-zinc-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="item_variant"
                              checked={isChecked}
                              onChange={() => setSelectedVariantId(String(variant.id))}
                              className="radio radio-sm radio-success"
                            />
                            <span className="text-sm font-semibold">{variant.title}</span>
                          </div>
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {currency}
                            {Number(variant.price).toFixed(2)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Addons */}
              {customizingItem.addons?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      {t("qr_menu.addons", "Add-ons & Extras")}
                    </h4>
                    <span className="text-[11px] text-slate-400">Optional</span>
                  </div>
                  <div className="space-y-2">
                    {customizingItem.addons.map((addon) => {
                      const isChecked = selectedAddonIds.includes(String(addon.id));
                      const toggleAddon = () => {
                        setSelectedAddonIds((prev) =>
                          prev.includes(String(addon.id))
                            ? prev.filter((x) => x !== String(addon.id))
                            : [...prev, String(addon.id)]
                        );
                      };
                      return (
                        <label
                          key={addon.id}
                          className={`min-h-[46px] p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                            isChecked
                              ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30"
                              : "border-slate-200 dark:border-zinc-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={toggleAddon}
                              className="checkbox checkbox-sm checkbox-success rounded"
                            />
                            <span className="text-sm font-semibold">{addon.title}</span>
                          </div>
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            +{currency}
                            {Number(addon.price).toFixed(2)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Special Notes */}
              {is_qr_order_enabled && (
                <div>
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
                    <IconNotes size={15} />
                    <span>{t("cart.notes", "Special Instructions")}</span>
                  </label>
                  <input
                    type="text"
                    maxLength={150}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder={t(
                      "cart.notes_placeholder",
                      "E.g. No onions, less spicy, sauce on the side..."
                    )}
                    className="w-full min-h-[42px] rounded-xl px-3.5 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {is_qr_order_enabled && (
              <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900 flex items-center gap-3">
                <div className="min-h-[48px] px-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-700 active:scale-95 cursor-pointer"
                  >
                    <IconMinus size={16} />
                  </button>
                  <span className="w-6 text-center font-extrabold text-sm">{customQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setCustomQuantity((q) => Math.min(50, q + 1))}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-700 active:scale-95 cursor-pointer"
                  >
                    <IconPlus size={16} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmModalItem}
                  className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm px-5 py-3 flex items-center justify-between shadow-md active:scale-98 transition cursor-pointer"
                >
                  <span>{t("qr_menu.add_to_cart", "Add to Cart")}</span>
                  <span>
                    {currency}
                    {(modalUnitPrice * customQuantity).toFixed(2)}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. TABLE SELECTION & 4-DIGIT PIN VERIFICATION MODAL */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <IconShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {t("qr_menu.verify_table_title", "Verify Table Session")}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t(
                      "qr_menu.verify_table_subtitle",
                      "Enter the 4-digit Table PIN from your server or table slip"
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTableModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500"
              >
                <IconX size={17} />
              </button>
            </div>

            <form onSubmit={handleVerifyTablePin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t("tables.table", "Your Table")}
                </label>
                <select
                  value={selectedTableRef}
                  onChange={(e) => setSelectedTableRef(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:border-emerald-500"
                >
                  <option value="">{t("qr_menu.choose_table", "-- Choose Table --")}</option>
                  {publicTables.map((tbl) => (
                    <option key={tbl.id} value={tbl.encrypted_id || tbl.id}>
                      Table {tbl.table_title} {tbl.floor ? `(${tbl.floor})` : ""} •{" "}
                      {tbl.seating_capacity} Seats
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t("qr_menu.table_pin_label", "4-Digit Table PIN")}
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="• • • •"
                  className="w-full min-h-[52px] rounded-xl px-4 py-3 text-center text-2xl font-black tracking-[0.5em] bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 outline-none focus:border-emerald-600"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isVerifyingPin}
                className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm py-3 shadow-md active:scale-98 transition cursor-pointer"
              >
                {isVerifyingPin
                  ? t("common.please_wait", "Verifying...")
                  : t("qr_menu.unlock_ordering", "Verify & Unlock Ordering")}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 8. CALL WAITER MODAL */}
      {isWaiterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                  <IconBellRinging size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {t("qr_menu.call_waiter", "Call Server")}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {storeTable
                      ? `Table ${storeTable.table_title}${storeTable.floor ? ` • ${storeTable.floor}` : ""}`
                      : "Let us know what you need"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWaiterModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500"
              >
                <IconX size={17} />
              </button>
            </div>

            <form onSubmit={handleCallWaiter} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {WAITER_REASONS.map((r) => {
                  const active = waiterReason === r.key;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setWaiterReason(r.key)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer ${
                        active
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                          : "border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span>{r.emoji}</span>
                      <span>{r.label}</span>
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                maxLength={200}
                value={waiterNotes}
                onChange={(e) => setWaiterNotes(e.target.value)}
                placeholder="Optional note (e.g. 2 glasses of ice water)..."
                className="w-full min-h-[42px] rounded-xl px-3.5 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:border-amber-500"
              />

              <button
                type="submit"
                disabled={isCallingWaiter}
                className="w-full min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-sm py-3 shadow-md active:scale-98 transition cursor-pointer"
              >
                {isCallingWaiter ? "Notifying..." : "Notify Server Now"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 9. STORE DETAILS & LANGUAGE MODAL */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <LanguageChanger className="rounded-xl px-3 py-2 text-xs font-bold border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={btnShare}
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
                >
                  <IconShare size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
                >
                  <IconX size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center text-center pt-2">
              {storeImage && (
                <img
                  src={getImageURL(storeImage)}
                  className="w-20 h-20 rounded-2xl object-cover shadow-md mb-3"
                  alt={storeName}
                />
              )}
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">{storeName}</h3>
            </div>

            <div className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 pt-2">
              {address && (
                <div className="flex items-start gap-2.5">
                  <IconMapPin size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{address}</span>
                </div>
              )}
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center gap-2.5 hover:text-emerald-600">
                  <IconPhone size={18} className="text-emerald-600 shrink-0" />
                  <span>{phone}</span>
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2.5 hover:text-emerald-600 break-all"
                >
                  <IconMail size={18} className="text-emerald-600 shrink-0" />
                  <span>{email}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
