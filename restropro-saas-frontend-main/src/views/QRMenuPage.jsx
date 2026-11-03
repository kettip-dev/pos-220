import {
  IconBellRinging,
  IconCheck,
  IconArmchair,
  IconChevronLeft,
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
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const [tableStep, setTableStep] = useState("table");
  const [tableFloorFilter, setTableFloorFilter] = useState("all");
  const [tableSearch, setTableSearch] = useState("");

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

  // Menu grouped into one section per enabled category (uncategorized items last)
  const menuSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const items = (menuItems || [])
      .filter((menuItem) => menuItem.is_enabled)
      .filter((menuItem) => {
        if (!q) return true;
        return (
          String(menuItem.title || "").toLowerCase().includes(q) ||
          String(menuItem.description || "").toLowerCase().includes(q) ||
          String(menuItem.category_title || "").toLowerCase().includes(q)
        );
      });

    const sections = (categories || [])
      .filter((category) => category.is_enabled)
      .map((category) => ({
        id: String(category.id),
        title: category.title,
        items: items.filter((item) => String(item.category_id) === String(category.id)),
      }));

    const uncategorized = items.filter((item) => !item.category_id);
    if (uncategorized.length > 0) {
      sections.push({
        id: "uncategorized",
        title: t("qr_menu.other", "Other"),
        items: uncategorized,
      });
    }

    return sections.filter((section) => section.items.length > 0);
  }, [menuItems, categories, searchQuery, t]);

  // Category tabs follow scroll position (scroll-spy)
  const [activeSectionId, setActiveSectionId] = useState(null);
  const stickyBarRef = useRef(null);
  const chipBarRef = useRef(null);
  const isAutoScrollingRef = useRef(false);
  const autoScrollTimerRef = useRef(null);

  useEffect(() => {
    if (isLoading) return;
    const onScroll = () => {
      if (isAutoScrollingRef.current) return;
      const offset = (stickyBarRef.current?.offsetHeight || 0) + 24;
      let active = menuSections[0]?.id || null;
      for (const section of menuSections) {
        const el = document.getElementById(`menu-section-${section.id}`);
        if (el && el.getBoundingClientRect().top - offset <= 0) active = section.id;
      }
      setActiveSectionId((prev) => (prev === active ? prev : active));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isLoading, menuSections]);

  useEffect(() => {
    const bar = chipBarRef.current;
    const chip = bar?.querySelector(`[data-section="${activeSectionId}"]`);
    if (!bar || !chip) return;
    bar.scrollTo({
      left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2,
      behavior: "smooth",
    });
  }, [activeSectionId]);

  useEffect(() => () => clearTimeout(autoScrollTimerRef.current), []);

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
    const knownTableRef = storeTable?.encrypted_id || storeTable?.id || "";
    setSelectedTableRef(knownTableRef ? String(knownTableRef) : "");
    setTableStep(knownTableRef ? "pin" : "table");
    setTableFloorFilter("all");
    setTableSearch("");
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

  const scrollToSection = (sectionId) => {
    const el = document.getElementById(`menu-section-${sectionId}`);
    if (!el) return;
    const offset = (stickyBarRef.current?.offsetHeight || 0) + 8;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    setActiveSectionId(sectionId);
    isAutoScrollingRef.current = true;
    window.scrollTo({ top, behavior: "smooth" });
    clearTimeout(autoScrollTimerRef.current);
    autoScrollTimerRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 700);
  };

  const renderAddControl = (item, hasVariantOrAddon, simpleQty) => {
    if (!is_qr_order_enabled) return null;

    if (!hasVariantOrAddon && simpleQty > 0) {
      return (
        <div
          onClick={(e) => e.stopPropagation()}
          className="h-[42px] rounded-full bg-emerald-600 text-white flex items-center shadow-lg shadow-emerald-900/20 ring-2 ring-white dark:ring-zinc-950"
        >
          <button
            type="button"
            onClick={() => upsertCartItem(item, -1)}
            className="w-[42px] h-[42px] rounded-full flex items-center justify-center active:scale-95 transition cursor-pointer"
            aria-label="Decrease quantity"
          >
            <IconMinus size={16} stroke={2.75} />
          </button>
          <span className="min-w-[18px] text-center text-sm font-extrabold tabular-nums">
            {simpleQty}
          </span>
          <button
            type="button"
            onClick={() => upsertCartItem(item, 1)}
            className="w-[42px] h-[42px] rounded-full flex items-center justify-center active:scale-95 transition cursor-pointer"
            aria-label="Increase quantity"
          >
            <IconPlus size={16} stroke={2.75} />
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (hasVariantOrAddon) {
            openItemModal(item);
          } else {
            upsertCartItem(item, 1);
            toast.success(`${item.title} ${t("qr_menu.added", "added")}`);
          }
        }}
        className="h-[42px] min-w-[42px] px-3.5 rounded-full bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-zinc-700 shadow-lg shadow-slate-900/10 flex items-center justify-center gap-1 text-sm font-extrabold active:scale-95 transition cursor-pointer"
        aria-label={t("qr_menu.add", "Add")}
      >
        <IconPlus size={16} stroke={3} />
        <span>{t("qr_menu.add", "Add")}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 pb-32">
      {/* 1. HERO HEADER */}
      <header className="relative overflow-hidden bg-zinc-900 text-white">
        {storeImage && (
          <img
            src={getImageURL(storeImage)}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/70 via-zinc-900/60 to-zinc-950/90" />

        <div className="relative max-w-5xl mx-auto px-4 pt-4 pb-10 sm:pb-12">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsWaiterModalOpen(true)}
              className="h-[42px] px-3.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
            >
              <IconBellRinging size={18} />
              <span>{t("qr_menu.call_waiter", "Call Server")}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsStoreModalOpen(true)}
              className="w-[42px] h-[42px] rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white flex items-center justify-center active:scale-95 transition cursor-pointer"
              aria-label="Store info"
            >
              <IconMenu stroke={iconStroke} size={20} />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-4">
            {storeImage ? (
              <img
                src={getImageURL(storeImage)}
                alt={storeName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-white/40 shadow-xl shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 ring-2 ring-white/30 flex items-center justify-center shrink-0">
                <IconToolsKitchen2 size={30} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-extrabold text-xl sm:text-3xl leading-tight tracking-tight line-clamp-2">
                {storeName}
              </h1>
              {address && (
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(true)}
                  className="mt-1 max-w-full text-left text-xs sm:text-sm text-white/75 flex items-center gap-1 cursor-pointer"
                >
                  <IconMapPin size={14} className="shrink-0" />
                  <span className="truncate">{address}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="relative -mt-5 rounded-t-3xl bg-white dark:bg-zinc-950">
        {/* 2. TABLE & ORDER STATUS */}
        {is_qr_order_enabled && (
          <div className="max-w-5xl mx-auto px-4 pt-4 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={openTableVerificationModal}
              className={`flex-1 min-h-[56px] p-2.5 pr-3 rounded-2xl border flex items-center gap-3 text-left active:scale-[0.99] transition cursor-pointer ${
                storeTable && isTablePinVerified
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
              }`}
            >
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white ${
                  storeTable && isTablePinVerified ? "bg-emerald-600" : "bg-amber-500"
                }`}
              >
                {storeTable && isTablePinVerified ? (
                  <IconShieldCheck size={20} />
                ) : (
                  <IconLock size={19} />
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">
                  {storeTable
                    ? `${t("tables.table", "Table")} ${storeTable.table_title}${
                        storeTable.floor ? ` • ${storeTable.floor}` : ""
                      }`
                    : t("qr_menu.select_table_pin", "Select Table & Enter PIN")}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                  {storeTable && isTablePinVerified
                    ? t("qr_menu.pin_verified_hint", "PIN verified · You can order now")
                    : t("qr_menu.pin_required_hint", "Enter your table PIN to start ordering")}
                </span>
              </span>
              <IconChevronRight size={18} className="text-slate-400 shrink-0" />
            </button>

            {activeTableOrdersCount > 0 && (
              <button
                type="button"
                onClick={goToOrderTracker}
                className="min-h-[56px] p-2.5 pr-3 rounded-2xl border bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900 flex items-center gap-3 text-left active:scale-[0.99] transition cursor-pointer"
              >
                <span className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                  <IconReceipt2 size={20} />
                </span>
                <span className="flex-1 min-w-0 text-sm font-bold text-sky-900 dark:text-sky-200">
                  {t("qr_menu.track_order", "Active Order / Bill")}
                  <span className="block text-xs font-medium text-sky-700/80 dark:text-sky-300/80">
                    {activeTableOrdersCount} {t("qr_menu.orders", "order(s)")}
                  </span>
                </span>
                <IconChevronRight size={18} className="text-sky-400 shrink-0" />
              </button>
            )}
          </div>
        )}

        {/* 3. STICKY SEARCH & CATEGORY TABS */}
        <div
          ref={stickyBarRef}
          className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-slate-100 dark:border-zinc-800/80"
        >
          <div className="max-w-5xl mx-auto px-4 pt-3 pb-2">
            <div className="relative flex items-center">
              <IconSearch size={18} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                type="search"
                name="search"
                id="search"
                className="w-full h-[44px] bg-slate-100 dark:bg-zinc-900 rounded-full pl-10 pr-10 text-sm outline-none border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 transition"
                placeholder={t("qr_menu.search_placeholder", "Search dishes, drinks...")}
                value={searchQuery}
                onChange={(e) => setState((prev) => ({ ...prev, searchQuery: e.target.value }))}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, searchQuery: "" }))}
                  className="absolute right-1 w-[42px] h-[42px] rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <IconX size={16} />
                </button>
              )}
            </div>
          </div>

          {menuSections.length > 1 && (
            <div className="max-w-5xl mx-auto">
              <div ref={chipBarRef} className="flex gap-1 overflow-x-auto no-scrollbar px-2.5 scroll-smooth">
                {menuSections.map((section) => {
                  const isActive = activeSectionId === section.id;
                  return (
                    <button
                      key={section.id}
                      data-section={section.id}
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className={`relative h-[44px] px-3 text-sm whitespace-nowrap transition active:scale-95 cursor-pointer ${
                        isActive
                          ? "font-extrabold text-emerald-700 dark:text-emerald-400"
                          : "font-semibold text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {section.title}
                      <span
                        className={`absolute left-3 right-3 bottom-0 h-[3px] rounded-full transition ${
                          isActive ? "bg-emerald-600" : "bg-transparent"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 4. MENU CATALOG, GROUPED BY CATEGORY */}
        <main className="max-w-5xl mx-auto px-4">
          {menuSections.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center text-slate-400 gap-2">
              <IconMoodEmpty size={44} stroke={1.5} />
              <p className="text-sm font-semibold">
                {t("qr_menu.no_items_found", "No matching menu items found.")}
              </p>
            </div>
          ) : (
            menuSections.map((section) => (
              <section key={section.id} id={`menu-section-${section.id}`} className="pt-6">
                <div className="flex items-baseline gap-2 mb-1 md:mb-3">
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {section.title}
                  </h2>
                  <span className="text-xs font-semibold text-slate-400">{section.items.length}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 md:gap-4">
                  {section.items.map((item) => {
                    const { addons = [], variants = [], id, image, price, title, description } = item;
                    const hasVariantOrAddon = variants.length > 0 || addons.length > 0;
                    const simpleQty = !hasVariantOrAddon ? getSimpleItemQuantityInCart(id) : 0;

                    return (
                      <article
                        key={id}
                        onClick={() => openItemModal(item)}
                        className="py-4 flex gap-4 border-b border-slate-100 dark:border-zinc-800/80 last:border-b-0 md:p-4 md:border md:last:border md:rounded-2xl md:hover:border-emerald-500/40 md:hover:shadow-sm transition cursor-pointer"
                      >
                        <div className="flex-1 min-w-0 flex flex-col">
                          <h3 className="font-bold text-[15px] sm:text-base leading-snug text-slate-900 dark:text-white line-clamp-2">
                            {title}
                          </h3>
                          {description && (
                            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {description}
                            </p>
                          )}
                          <div className="mt-auto pt-2.5 flex items-center gap-2 flex-wrap">
                            <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                              {currency}
                              {Number(price).toFixed(2)}
                            </span>
                            {hasVariantOrAddon && (
                              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                                {t("qr_menu.customisable", "Customizable")}
                              </span>
                            )}
                          </div>
                          {!image && (
                            <div className="mt-3 self-end">
                              {renderAddControl(item, hasVariantOrAddon, simpleQty)}
                            </div>
                          )}
                        </div>

                        {image && (
                          <div className="relative shrink-0 w-[112px] h-[112px] sm:w-[128px] sm:h-[128px] mb-3">
                            <img
                              src={getImageURL(image)}
                              alt={title}
                              className="w-full h-full object-cover rounded-2xl bg-slate-100 dark:bg-zinc-800"
                              loading="lazy"
                            />
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                              {renderAddControl(item, hasVariantOrAddon, simpleQty)}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </main>
      </div>

      {/* 5. STICKY BOTTOM VIEW CART BAR */}
      {is_qr_order_enabled && totalCartQuantity > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-white via-white/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95">
          <div className="max-w-5xl mx-auto">
            <button
              type="button"
              onClick={goToCart}
              className="w-full min-h-[58px] bg-emerald-600 hover:bg-emerald-700 text-white py-3 pl-3 pr-4 rounded-2xl shadow-xl shadow-emerald-900/25 flex items-center justify-between gap-3 active:scale-[0.98] transition cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-white text-emerald-700 text-sm font-black flex items-center justify-center tabular-nums">
                  {totalCartQuantity}
                </span>
                <span className="text-base font-extrabold">{t("qr_menu.view_cart", "View Cart")}</span>
              </div>

              <div className="flex items-center gap-1 text-base font-extrabold tabular-nums">
                <span>
                  {currency}
                  {totalCartPrice.toFixed(2)}
                </span>
                <IconChevronRight size={20} stroke={2.5} />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 6. CONTROLLED ITEM DETAIL & CUSTOMIZATION MODAL */}
      {customizingItem && (
        <div
          onClick={() => setCustomizingItem(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-zinc-800 max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <button
              type="button"
              onClick={() => setCustomizingItem(null)}
              className="absolute top-3 right-3 z-10 w-[42px] h-[42px] rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur text-slate-700 dark:text-slate-200 shadow-md flex items-center justify-center active:scale-95 cursor-pointer"
              aria-label="Close"
            >
              <IconX size={20} />
            </button>

            <div className="overflow-y-auto flex-1">
            {/* Modal Header */}
            {customizingItem.image && (
              <div className="aspect-[16/10] bg-slate-100 dark:bg-zinc-800">
                <img
                  src={getImageURL(customizingItem.image)}
                  alt={customizingItem.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className={`px-4 pb-4 border-b border-slate-100 dark:border-zinc-800 ${customizingItem.image ? "pt-4" : "pt-5 pr-16"}`}>
              <h3 className="font-extrabold text-xl leading-snug text-slate-900 dark:text-white">
                {customizingItem.title}
              </h3>
              <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {currency}
                {Number(customizingItem.price).toFixed(2)}
              </p>
              {customizingItem.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {customizingItem.description}
                </p>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-5">
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

      {/* 7. TABLE SELECTION & 4-DIGIT PIN VERIFICATION SHEET */}
      {isTableModalOpen && (() => {
        const tableRefOf = (tbl) => String(tbl.encrypted_id || tbl.id);
        const selectedTable =
          publicTables.find((tbl) => tableRefOf(tbl) === String(selectedTableRef)) ||
          (storeTable && tableRefOf(storeTable) === String(selectedTableRef) ? storeTable : null);

        const floors = [...new Set(publicTables.map((tbl) => tbl.floor || ""))];
        const tableQuery = tableSearch.trim().toLowerCase();
        const visibleTables = publicTables.filter(
          (tbl) =>
            (tableFloorFilter === "all" || (tbl.floor || "") === tableFloorFilter) &&
            (!tableQuery || String(tbl.table_title || "").toLowerCase().includes(tableQuery))
        );
        const tableGroups = floors
          .map((floor) => ({
            floor,
            tables: visibleTables.filter((tbl) => (tbl.floor || "") === floor),
          }))
          .filter((group) => group.tables.length > 0);

        return (
          <div
            onClick={() => setIsTableModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-zinc-800 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-4 flex items-start gap-3">
                {tableStep === "pin" && publicTables.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTableStep("table")}
                    className="w-[42px] h-[42px] -ml-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 active:scale-95 cursor-pointer"
                    aria-label="Back"
                  >
                    <IconChevronLeft size={20} />
                  </button>
                ) : (
                  <div className="w-[42px] h-[42px] rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                    {tableStep === "pin" ? <IconShieldCheck size={22} /> : <IconArmchair size={22} />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                    {t("qr_menu.step", "Step")} {tableStep === "table" ? 1 : 2}/2
                  </p>
                  <h3 className="font-extrabold text-lg leading-tight text-slate-900 dark:text-white">
                    {tableStep === "table"
                      ? t("qr_menu.pick_your_table", "Where are you sitting?")
                      : t("qr_menu.enter_table_pin", "Enter table PIN")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {tableStep === "table"
                      ? t("qr_menu.pick_your_table_hint", "Tap your table to continue")
                      : t(
                          "qr_menu.verify_table_subtitle",
                          "Enter the 4-digit Table PIN from your server or table slip"
                        )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTableModalOpen(false)}
                  className="w-[42px] h-[42px] rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 shrink-0 active:scale-95 cursor-pointer"
                  aria-label="Close"
                >
                  <IconX size={18} />
                </button>
              </div>

              {tableStep === "table" ? (
                <>
                  {/* Floor filter + search */}
                  {(floors.length > 1 || publicTables.length > 12) && (
                    <div className="px-5 pb-3 space-y-2.5 border-b border-slate-100 dark:border-zinc-800">
                      {publicTables.length > 12 && (
                        <div className="relative flex items-center">
                          <IconSearch size={17} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                          <input
                            type="search"
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                            placeholder={t("qr_menu.search_table", "Search table...")}
                            className="w-full h-[42px] rounded-full pl-10 pr-4 text-sm bg-slate-100 dark:bg-zinc-800 outline-none border border-transparent focus:border-emerald-500"
                          />
                        </div>
                      )}
                      {floors.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
                          {["all", ...floors].map((floor) => {
                            const isActive = tableFloorFilter === floor;
                            return (
                              <button
                                key={floor || "_none"}
                                type="button"
                                onClick={() => setTableFloorFilter(floor)}
                                className={`h-[42px] px-4 rounded-full text-sm font-bold whitespace-nowrap border transition active:scale-95 cursor-pointer ${
                                  isActive
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                                    : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-700"
                                }`}
                              >
                                {floor === "all"
                                  ? t("qr_menu.all", "All")
                                  : floor || t("qr_menu.other", "Other")}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Table grid grouped by floor */}
                  <div className="flex-1 overflow-y-auto px-5 pb-6">
                    {tableGroups.length === 0 ? (
                      <p className="py-10 text-center text-sm font-semibold text-slate-400">
                        {t("qr_menu.no_tables_found", "No tables found.")}
                      </p>
                    ) : (
                      tableGroups.map((group) => (
                        <div key={group.floor || "_none"} className="pt-4">
                          {(tableFloorFilter === "all" && floors.length > 1) && (
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                              {group.floor || t("qr_menu.other", "Other")}
                            </h4>
                          )}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {group.tables.map((tbl) => {
                              const isSelected = tableRefOf(tbl) === String(selectedTableRef);
                              return (
                                <button
                                  key={tbl.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTableRef(tableRefOf(tbl));
                                    setPinInput("");
                                    setTableStep("pin");
                                  }}
                                  className={`min-h-[72px] p-3 rounded-2xl border-2 text-left flex flex-col justify-between gap-1.5 transition active:scale-95 cursor-pointer ${
                                    isSelected
                                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                                      : "border-slate-200 dark:border-zinc-700 hover:border-emerald-300 dark:hover:border-emerald-800"
                                  }`}
                                >
                                  <span className="text-sm font-bold leading-snug text-slate-900 dark:text-white line-clamp-2">
                                    {tbl.table_title}
                                  </span>
                                  {Number(tbl.seating_capacity) > 0 && (
                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                      <IconUsers size={13} />
                                      {tbl.seating_capacity}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <form onSubmit={handleVerifyTablePin} className="px-5 pb-5 space-y-5 overflow-y-auto">
                  {/* Selected table summary */}
                  {selectedTable && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700 flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <IconArmchair size={20} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">
                          {selectedTable.table_title}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                          {[
                            selectedTable.floor,
                            Number(selectedTable.seating_capacity) > 0
                              ? `${selectedTable.seating_capacity} ${t("qr_menu.seats", "seats")}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                      </span>
                      {publicTables.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTableStep("table")}
                          className="h-[42px] px-3 rounded-xl text-sm font-bold text-emerald-700 dark:text-emerald-400 active:scale-95 cursor-pointer"
                        >
                          {t("qr_menu.change", "Change")}
                        </button>
                      )}
                    </div>
                  )}

                  {/* PIN boxes (one real input stretched over them) */}
                  <label className="relative block">
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                      className="absolute inset-0 w-full h-full opacity-0 caret-transparent cursor-pointer"
                      aria-label={t("qr_menu.table_pin_label", "4-Digit Table PIN")}
                      autoFocus
                    />
                    <div className="flex justify-center gap-3">
                      {Array.from({ length: Math.max(4, pinInput.length) }).map((_, i) => {
                        const filled = i < pinInput.length;
                        const isCurrent = i === pinInput.length;
                        return (
                          <div
                            key={i}
                            className={`w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black tabular-nums transition ${
                              filled
                                ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-slate-900 dark:text-white"
                                : isCurrent
                                ? "border-emerald-500 ring-4 ring-emerald-500/15 bg-white dark:bg-zinc-900"
                                : "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800"
                            }`}
                          >
                            {pinInput[i] || ""}
                          </div>
                        );
                      })}
                    </div>
                  </label>

                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    {t("qr_menu.pin_where_hint", "Find the PIN on your table slip or ask a server.")}
                  </p>

                  <button
                    type="submit"
                    disabled={isVerifyingPin || pinInput.length < 4 || !selectedTableRef}
                    className="w-full min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 text-white font-extrabold text-base py-3 shadow-md disabled:shadow-none active:scale-[0.98] transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isVerifyingPin
                      ? t("common.please_wait", "Verifying...")
                      : t("qr_menu.unlock_ordering", "Verify & Unlock Ordering")}
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      })()}

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
