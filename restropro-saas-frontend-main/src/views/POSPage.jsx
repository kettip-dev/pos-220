import React, { useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next';
import Page from "../components/Page";
import DeleteModal from "../components/DeleteModal";
import { IconPlus, IconNotes, IconArmchair, IconScreenShare, IconSearch, IconDeviceFloppy, IconChefHat, IconCash, IconMinus, IconNote, IconTrash, IconFilter, IconPhoto, IconFilterFilled, IconClipboardList, IconX, IconClearAll, IconPencil, IconCheck, IconCarrot, IconRotate, IconQrcode, IconArmchair2, IconUser, IconCategory, IconGridDots, IconLayoutGrid, IconListDetails, IconListTree, IconMenu4, IconLayoutGridFilled, IconMenu2, IconLayoutList, IconLayout2, IconLayout2Filled, IconAlertTriangleFilled, IconChevronUp, IconShoppingCart, IconCopy, IconReceipt, IconLayersIntersect, IconLoader2, IconTag, IconSparkles, IconFlame } from "@tabler/icons-react";
import { VITE_BACKEND_SOCKET_IO, iconStroke } from "../config/config";
import { approveQROrder, cancelAllQROrders, cancelQROrder, createOrder, createOrderAndInvoice, getDrafts, getQROrders, getQROrdersCount, initPOS, setDrafts } from "../controllers/pos.controller";
import { CURRENCIES } from '../config/currencies.config';
import { PAYMENT_ICONS } from "../config/payment_icons";
import { toast } from "react-hot-toast";
import { searchCustomer } from '../controllers/customers.controller';
import { Link, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { setDetailsForReceiptPrint, triggerPrintReceipt, triggerPrintToken, getDetailsForReceiptPrint } from '../helpers/ReceiptHelper';
import { SocketContext } from "../contexts/SocketContext";
import { initSocket } from '../utils/socket';
import { getImageURL, setImageStorageConfig } from '../helpers/ImageHelper';
import { getUserDetailsInLocalStorage } from '../helpers/UserDetails';
import AsyncCreatableSelect from 'react-select/async-creatable';
import DialogAddCustomer from '../components/DialogAddCustomer';
import POSMenuItemDetailedView from '../components/POSMenuItemDetailedView';
import POSMenuItemCompactView from '../components/POSMenuItemCompactView';
import TablePickerModal from '../components/tables/TablePickerModal';
import POSOrderHeader from '../components/pos/POSOrderHeader';
import POSModifierDrawer from '../components/pos/POSModifierDrawer';
import POSPaymentDrawer from '../components/pos/POSPaymentDrawer';
import POSDraftsDrawer from '../components/pos/POSDraftsDrawer';
import POSCustomerDrawer from '../components/pos/POSCustomerDrawer';
import POSQROrdersDrawer from '../components/pos/POSQROrdersDrawer';
import POSPaymentSuccessModal from '../components/pos/POSPaymentSuccessModal';
import POSPromotionDrawer from '../components/pos/POSPromotionDrawer';
import POSSplitBillDrawer from '../components/pos/POSSplitBillDrawer';
import { useActivePromotions } from '../controllers/promotions.controller';
import { evaluateCartPromotions } from '../helpers/promotionEvaluator';
import { clsx } from "clsx";
import { useTheme } from '../contexts/ThemeContext';

export default function POSPage() {
  const { t } = useTranslation();
  const outletCtx = useOutletContext() || {};
  const isNavCollapsed = outletCtx.isOperationalBarCollapsed || false;
  const onToggleNav = outletCtx.toggleOperationalBar || null;

  const [posDeleteModalConfig, setPosDeleteModalConfig] = useState(null);
  const user = getUserDetailsInLocalStorage();
  const { socket, isSocketConnected } = useContext(SocketContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const diningOptionRef = useRef();
  const tableRef = useRef();
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [selectedTableTitle, setSelectedTableTitle] = useState("");
  const [isDraftsDrawerOpen, setIsDraftsDrawerOpen] = useState(false);
  const [isCustomerDrawerOpen, setIsCustomerDrawerOpen] = useState(false);
  const [isQrOrdersDrawerOpen, setIsQrOrdersDrawerOpen] = useState(false);
  const [isPromotionDrawerOpen, setIsPromotionDrawerOpen] = useState(false);
  const [isSplitDrawerOpen, setIsSplitDrawerOpen] = useState(false);
  const [splitBillOrder, setSplitBillOrder] = useState(null);
  const [enteredCouponCode, setEnteredCouponCode] = useState("");
  const { promotions: activePromotionsList = [] } = useActivePromotions();
  const [completedPaymentInfo, setCompletedPaymentInfo] = useState(null);
  const isQrOrdersDrawerOpenRef = useRef(false);

  useEffect(() => {
    isQrOrdersDrawerOpenRef.current = isQrOrdersDrawerOpen;
  }, [isQrOrdersDrawerOpen]);

  // dialog: notes ref
  const dialogNotesIndexRef = useRef();
  const dialogNotesTextRef = useRef();
  // dialog: notes ref

  // dialog: category filter
  const categoryFilterDropdownRef = useRef(null);
  // dialog: category filter

  // dialog: category filter
  const draftTitleRef = useRef(null);
  // dialog: category filter

  // dialog: search customer
  const searchCustomerRef = useRef(null);
  // dialog: search customer

  const tapSound = new Audio("/tap.mp3");

  const [state, setState] = useState({
    view:"compact",
    categories: [],
    menuItems: [],
    paymentTypes: [],
    printSettings: null,
    storeSettings: null,
    storeTables: [],
    serviceCharge:null,
    currency: "",
    isLoading: true,

    cartItems: [],
    customerType: "WALKIN",
    customer: null,
    addCustomerDefaultValue: null,

    searchQuery: "",
    selectedCategory: "all",

    selectedItemId: null,

    drafts: [],

    itemsTotal: 0,
    discountType: "fixed",
    discountValue: 0,
    discountAmount: 0,
    taxTotal: 0,
    serviceChargeTotal:0,
    payableTotal: 0,

    orderId: null,
    tokenNo: null,

    qrOrdersCount: 0,
    qrOrders: [],
    selectedQrOrderItem: null,

    selectedPaymentType: null,
  });

  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isPaySummaryExpanded, setIsPaySummaryExpanded] = useState(false);
  const [dualScreenRoomId, setDualScreenRoomId] = useState(null);
  const [dualScreenUrl, setDualScreenUrl] = useState(null);
  const [newCounterInput, setNewCounterInput] = useState('');
  const [selectedDiningOption, setSelectedDiningOption] = useState('dinein');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [isDiscountDrawerOpen, setIsDiscountDrawerOpen] = useState(false);
  const [activeTableContext, setActiveTableContext] = useState(null);

  // New Drawer, Tablet, and Cashier UX states
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
  const [isModifierDrawerOpen, setIsModifierDrawerOpen] = useState(false);
  const [activeCustomizingItem, setActiveCustomizingItem] = useState(null);
  const [guestCount, setGuestCount] = useState(1);
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);
  const [inlineNoteText, setInlineNoteText] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isSendingToKitchen, setIsSendingToKitchen] = useState(false);
  const [customExchangeRate, setCustomExchangeRate] = useState(null);
  const searchInputRef = useRef(null);

  // 'Add to Same Line' preference (persisted in localStorage, default true)
  const [isAddSameLine, setIsAddSameLine] = useState(() => {
    const stored = localStorage.getItem("restro_pos_add_to_same_line");
    return stored === null ? true : stored === "true";
  });

  const toggleAddSameLine = () => {
    const nextVal = !isAddSameLine;
    setIsAddSameLine(nextVal);
    localStorage.setItem("restro_pos_add_to_same_line", String(nextVal));
    playTapSound();
    if (nextVal) {
      toast.success(t('pos.same_line_enabled', 'Add to same line: ON (combines identical items)'));
    } else {
      toast(t('pos.same_line_disabled', 'Add to same line: OFF (separate lines)'));
    }
  };

  // Helper to check if two cart items are identical (same item, variant, addons, notes)
  const areItemsIdentical = (itemA, itemB) => {
    if (!itemA || !itemB) return false;

    // 1. Menu item ID
    const idA = itemA.id ?? itemA.item_id;
    const idB = itemB.id ?? itemB.item_id;
    if (idA !== idB) return false;

    // 2. Variant
    const varA = itemA.variant?.id ?? itemA.variant_id ?? null;
    const varB = itemB.variant?.id ?? itemB.variant_id ?? null;
    if (String(varA || '') !== String(varB || '')) return false;

    // 3. Addons
    const getNormalizedAddons = (item) => {
      const list = item.addons || item.addons_ids || [];
      if (!Array.isArray(list)) return '';
      return list
        .map(a => (typeof a === 'object' && a !== null) ? a.id : a)
        .filter(Boolean)
        .map(Number)
        .sort((a, b) => a - b)
        .join(',');
    };
    if (getNormalizedAddons(itemA) !== getNormalizedAddons(itemB)) return false;

    // 4. Notes: items with different custom notes should stay on separate lines
    const noteA = (itemA.notes || '').trim();
    const noteB = (itemB.notes || '').trim();
    if (noteA !== noteB) return false;

    return true;
  };

  const { categories, menuItems, paymentTypes, printSettings, storeSettings, storeTables, currency, cartItems, searchQuery, selectedCategory, selectedItemId, drafts, customer, customerType, isLoading } = state;

  const posBillingMode = storeSettings?.pos_payment_mode || storeSettings?.posPaymentMode || "flexible";
  const isPrepaidOnly = posBillingMode === "prepaid";
  const isPostpaidOnly = posBillingMode === "postpaid";

  // Check if cart has duplicate identical lines that can be merged
  const hasDuplicateLines = React.useMemo(() => {
    if (!cartItems || cartItems.length < 2) return false;
    for (let i = 0; i < cartItems.length; i++) {
      for (let j = i + 1; j < cartItems.length; j++) {
        if (areItemsIdentical(cartItems[i], cartItems[j])) return true;
      }
    }
    return false;
  }, [cartItems]);

  // Consolidate duplicate identical lines into single lines with summed quantity
  const handleConsolidateCartLines = () => {
    if (!cartItems || cartItems.length < 2) return;
    const merged = [];
    cartItems.forEach(item => {
      const existingIndex = merged.findIndex(m => areItemsIdentical(m, item));
      if (existingIndex !== -1) {
        merged[existingIndex] = {
          ...merged[existingIndex],
          quantity: (Number(merged[existingIndex].quantity) || 1) + (Number(item.quantity) || 1)
        };
      } else {
        merged.push({ ...item });
      }
    });
    setState(prev => ({
      ...prev,
      cartItems: merged
    }));
    playTapSound();
    toast.success(t('pos.lines_consolidated', 'Duplicate lines consolidated into same lines'));
  };

  const categoryCounts = React.useMemo(() => {
    const counts = { all: 0 };
    (menuItems || []).forEach(item => {
      if (item.is_enabled) {
        counts.all = (counts.all || 0) + 1;
        if (item.category_id) {
          counts[item.category_id] = (counts[item.category_id] || 0) + 1;
        }
      }
    });
    return counts;
  }, [menuItems]);

  const handleMinusItemByMenuId = (menuItemId) => {
    const index = cartItems.findIndex(c => c.id === menuItemId && !c.variant && (!c.addons || c.addons.length === 0));
    if (index !== -1) {
      minusCartItemQuantity(index, cartItems[index].quantity);
    }
  };

  const btnClearCart = () => {
    if (!cartItems || cartItems.length === 0) return;
    setState(prev => ({
      ...prev,
      cartItems: [],
      selectedQrOrderItem: null,
      discountValue: 0,
      discountAmount: 0,
    }));
    playTapSound();
    toast.success(t('pos.cart_cleared', 'Cart cleared'));
  };

  const handleSelectDiningOption = (option) => {
    setSelectedDiningOption(option);
    if (diningOptionRef.current) {
      diningOptionRef.current.value = option;
    }
    broadcastOrderMeta(undefined, option, tableRef.current?.value);
  };

  useEffect(()=>{
    _initPOS();
    _initSocket();
  },[]);

  useEffect(() => {
    if (location.state?.selectedTableId && tableRef.current && state.storeTables?.length > 0) {
      tableRef.current.value = location.state.selectedTableId;
      const delType = location.state?.deliveryType || "dinein";
      setSelectedDiningOption(delType);
      if (diningOptionRef.current) {
        diningOptionRef.current.value = delType;
      }
      const tblObj = state.storeTables.find(t => String(t.id) === String(location.state.selectedTableId));
      if (tblObj) {
        setSelectedTableTitle(`${tblObj.table_title} (${tblObj.seating_capacity} ${t('pos.person')}) - ${tblObj.floor}`);
      }
      if (location.state?.activeTokenNo) {
        setActiveTableContext({
          tableTitle: tblObj?.table_title || location.state?.selectedTableTitle || "Table",
          tokenNo: location.state.activeTokenNo,
          orderId: location.state.activeOrderId,
        });
      }
      broadcastOrderMeta(undefined, delType, location.state.selectedTableId);
    }
  }, [location.state, state.storeTables]);

  // Global Keyboard Shortcuts for High-Speed Cashier Operations
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

      if (e.key === 'Escape') {
        if (isPaymentDrawerOpen) {
          setIsPaymentDrawerOpen(false);
          closePaymentModalSync();
        } else if (isModifierDrawerOpen) {
          setIsModifierDrawerOpen(false);
          closeVariantModalSync();
        } else if (isCustomerDrawerOpen) {
          setIsCustomerDrawerOpen(false);
          closeCustomerModalSync();
        } else if (isQrOrdersDrawerOpen) {
          setIsQrOrdersDrawerOpen(false);
        } else if (isDraftsDrawerOpen) {
          setIsDraftsDrawerOpen(false);
        } else if (editingNoteIndex !== null) {
          setEditingNoteIndex(null);
        } else if (state.searchQuery) {
          setState(prev => ({ ...prev, searchQuery: '' }));
        }
        return;
      }

      if (isTyping) return;

      if (e.key === 'F2' || e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        btnOpenSearchCustomerModal();
      } else if (e.key === 'F4') {
        e.preventDefault();
        const currentMode = state.storeSettings?.pos_payment_mode || state.storeSettings?.posPaymentMode || 'flexible';
        if (currentMode === 'postpaid') {
          toast(t('pos.postpaid_only_hint', 'Store is in Postpaid mode. Please send order to kitchen (F8).'), { icon: 'ℹ' });
          return;
        }
        if (cartItems && cartItems.length > 0) {
          btnShowPayAndSendToKitchenModal();
        } else {
          toast.error(t('pos.empty_cart'));
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        const currentMode = state.storeSettings?.pos_payment_mode || state.storeSettings?.posPaymentMode || 'flexible';
        if (currentMode === 'prepaid') {
          toast(t('pos.prepaid_only_hint', 'Store is in Prepaid mode. Please collect payment (F4).'), { icon: 'ℹ' });
          return;
        }
        if (cartItems && cartItems.length > 0) {
          handleDirectSendToKitchen();
        } else {
          toast.error(t('pos.empty_cart'));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaymentDrawerOpen, isModifierDrawerOpen, isCustomerDrawerOpen, isQrOrdersDrawerOpen, isDraftsDrawerOpen, editingNoteIndex, cartItems, state.searchQuery, state.storeSettings]);

  // Helper for dual screen cart summary calculations
  const getCartSummary = () => {
    let itemsTotal = 0;
    let taxTotal = 0;
    let serviceChargeTotal = 0;
    let payableTotal = 0;

    (cartItems || []).forEach((item) => {
      const taxRate = Number(item.tax_rate) || 0;
      const taxType = item.tax_type;
      const itemPrice = (Number(item.price) || 0) * (Number(item.quantity) || 1);

      if (taxType === "exclusive") {
        const tax = (itemPrice * taxRate) / 100;
        taxTotal += tax;
        itemsTotal += itemPrice;
        payableTotal += itemPrice + tax;
      } else if (taxType === "inclusive") {
        const tax = itemPrice - (itemPrice * (100 / (100 + taxRate)));
        taxTotal += tax;
        itemsTotal += itemPrice - tax;
        payableTotal += itemPrice;
      } else {
        itemsTotal += itemPrice;
        payableTotal += itemPrice;
      }
    });

    if (state.serviceCharge) {
      const serviceCharge = (Number(itemsTotal) * Number(state.serviceCharge)) / 100;
      serviceChargeTotal += serviceCharge;
      payableTotal += serviceCharge;
    }

    return { itemsTotal, taxTotal, serviceChargeTotal, payableTotal };
  };

  // Helper for order metadata (Customer, Dining Option, Table)
  const getOrderMeta = (customCustomer, customDining, customTable) => {
    const curCustomer = customCustomer !== undefined ? customCustomer : customer;
    const curDining = customDining !== undefined ? customDining : (diningOptionRef.current?.value || "");
    const curTableId = customTable !== undefined ? customTable : (tableRef.current?.value || "");

    const tableObj = storeTables?.find(t => String(t.id) === String(curTableId));
    const tableTitle = tableObj ? `${tableObj.table_title} (${tableObj.seating_capacity} ${t('pos.person')})` : "";

    return {
      customer: curCustomer,
      customerType: customerType,
      diningOption: curDining,
      tableId: curTableId,
      tableTitle: tableTitle,
    };
  };

  const broadcastOrderMeta = (customCustomer, customDining, customTable) => {
    if (dualScreenRoomId && isSocketConnected) {
      const meta = getOrderMeta(customCustomer, customDining, customTable);
      socket.emit('order_meta_update_backend', {
        roomId: dualScreenRoomId,
        ...meta,
      });
    }
  };

  // Dual Screen: Emit cart updates whenever cart items or order meta changes
  useEffect(() => {
    if (dualScreenRoomId && isSocketConnected) {
      const summary = getCartSummary();
      const meta = getOrderMeta();
      socket.emit('cart_update_backend', {
        roomId: dualScreenRoomId,
        cartItems: cartItems,
        itemsTotal: summary.itemsTotal,
        taxTotal: summary.taxTotal,
        serviceChargeTotal: summary.serviceChargeTotal,
        payableTotal: summary.payableTotal,
        ...meta,
      });
    }
  }, [cartItems, customer, customerType, dualScreenRoomId, isSocketConnected, state.serviceCharge]);

  // Dual Screen: Listen for display requesting current cart state
  useEffect(() => {
    if (!socket) return;
    const handleCartRequest = () => {
      if (dualScreenRoomId) {
        const summary = getCartSummary();
        const meta = getOrderMeta();
        socket.emit('cart_update_backend', {
          roomId: dualScreenRoomId,
          cartItems: cartItems,
          itemsTotal: summary.itemsTotal,
          taxTotal: summary.taxTotal,
          serviceChargeTotal: summary.serviceChargeTotal,
          payableTotal: summary.payableTotal,
          ...meta,
        });
      }
    };

    socket.on('cart_request', handleCartRequest);
    return () => {
      socket.off('cart_request', handleCartRequest);
    };
  }, [dualScreenRoomId, cartItems, customer, customerType, socket, state.serviceCharge]);

  // Dual Screen: Emit category filter, search query, and view mode changes
  useEffect(() => {
    if (dualScreenRoomId && isSocketConnected) {
      socket.emit('pos_filter_update_backend', {
        roomId: dualScreenRoomId,
        selectedCategory: selectedCategory,
        searchQuery: searchQuery,
        view: state.view,
      });
    }
  }, [selectedCategory, searchQuery, state.view, dualScreenRoomId, isSocketConnected]);

  // Dual Screen: Handle hovering menu item card
  const handleItemHover = (hoveredItemId) => {
    if (dualScreenRoomId && isSocketConnected) {
      socket.emit('item_hover_backend', {
        roomId: dualScreenRoomId,
        hoveredItemId: hoveredItemId,
      });
    }
  };

  // Dual Screen: Handle scrolling menu item list
  const lastScrollEmitRef = useRef(0);
  const handleMenuScroll = (e) => {
    if (!dualScreenRoomId || !isSocketConnected) return;
    const target = e.target;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 0) return;
    const scrollRatio = scrollTop / maxScroll;

    const now = Date.now();
    if (now - lastScrollEmitRef.current > 30) {
      lastScrollEmitRef.current = now;
      socket.emit('menu_scroll_backend', {
        roomId: dualScreenRoomId,
        scrollRatio,
        scrollTop,
      });
    }
  };

  // Dual Screen: Handle scrolling cart items list
  const lastCartScrollEmitRef = useRef(0);
  const handleCartScroll = (e) => {
    if (!dualScreenRoomId || !isSocketConnected) return;
    const target = e.target;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 0) return;
    const scrollRatio = scrollTop / maxScroll;

    const now = Date.now();
    if (now - lastCartScrollEmitRef.current > 30) {
      lastCartScrollEmitRef.current = now;
      socket.emit('cart_scroll_backend', {
        roomId: dualScreenRoomId,
        scrollRatio,
        scrollTop,
      });
    }
  };

  // Dual Screen: Storage & Room Catalog helpers
  const getCatalog = () => {
    try {
      return JSON.parse(localStorage.getItem('dual_screen_counters') || '{}');
    } catch (e) {
      return {};
    }
  };

  const setCatalog = (catalog) => {
    localStorage.setItem('dual_screen_counters', JSON.stringify(catalog));
  };

  // Mount: Auto-rejoin active counter if bound in sessionStorage
  useEffect(() => {
    const activeCounter = sessionStorage.getItem('active_counter');
    const catalog = getCatalog();
    if (activeCounter && catalog[activeCounter]) {
      const roomData = catalog[activeCounter];
      setDualScreenRoomId(roomData.roomId);
      setDualScreenUrl(roomData.url);
      if (socket && isSocketConnected) {
        socket.emit('join_pos_backend', { roomId: roomData.roomId });
      }
    }
  }, [isSocketConnected]);

  // Socket reconnect: Re-emit join_pos_backend automatically
  useEffect(() => {
    if (!socket) return;
    const handleConnect = () => {
      const activeCounter = sessionStorage.getItem('active_counter');
      const catalog = getCatalog();
      if (activeCounter && catalog[activeCounter]) {
        socket.emit('join_pos_backend', { roomId: catalog[activeCounter].roomId });
      }
    };
    socket.on('connect', handleConnect);
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket]);

  // Dialog State calculation
  const getDialogState = () => {
    const activeCounter = sessionStorage.getItem('active_counter');
    const catalog = getCatalog();

    if (activeCounter && catalog[activeCounter]) {
      return { mode: 'ACTIVE', activeCounter, data: catalog[activeCounter] };
    }
    if (Object.keys(catalog).length > 0) {
      return { mode: 'PICKER', catalog };
    }
    return { mode: 'FRESH' };
  };

  // Handle Dual Screen Modal Open Button
  function handleDualScreenClick() {
    document.getElementById('modal-dual-screen').showModal();
  }

  // Check if counter name already exists
  const isCounterNameDuplicate = (inputName) => {
    const catalog = getCatalog();
    const nameToCheck = (inputName !== undefined ? inputName : newCounterInput).trim().toLowerCase();
    if (!nameToCheck) return false;
    return Object.keys(catalog).some((existingName) => existingName.trim().toLowerCase() === nameToCheck);
  };

  // Create & Pair New Counter
  const handleCreateCounter = (customName) => {
    const catalog = getCatalog();
    const existingCount = Object.keys(catalog).length;
    const fallbackName = `Counter ${existingCount + 1}`;
    const name = (customName || newCounterInput || fallbackName).trim();

    if (!name) {
      toast.error(t('pos.counter_name_required', 'Counter name is required'));
      return;
    }

    if (isCounterNameDuplicate(name)) {
      toast.error(t('pos.counter_name_exists', `Counter name "${name}" already exists!`));
      return;
    }

    const roomId = crypto.randomUUID();
    const url = `${window.location.origin}/customer/pos/${roomId}`;
    const entry = { roomId, url, createdAt: Date.now() };

    catalog[name] = entry;
    setCatalog(catalog);
    sessionStorage.setItem('active_counter', name);

    setDualScreenRoomId(roomId);
    setDualScreenUrl(url);

    if (isSocketConnected) {
      socket.emit('join_pos_backend', { roomId });
    }

    setNewCounterInput('');
    toast.success(t('pos.counter_created', `Counter "${name}" created and paired!`));
  };

  // Join Existing Counter
  const handleJoinCounter = (counterName) => {
    const catalog = getCatalog();
    const entry = catalog[counterName];
    if (entry) {
      sessionStorage.setItem('active_counter', counterName);
      setDualScreenRoomId(entry.roomId);
      setDualScreenUrl(entry.url);

      if (isSocketConnected) {
        socket.emit('join_pos_backend', { roomId: entry.roomId });
      }

      toast.success(t('pos.counter_joined', `Joined as ${counterName}`));
    }
  };

  // Delete / Reset Counter
  const handleDeleteCounter = (counterName) => {
    const catalog = getCatalog();
    const entry = catalog[counterName];
    if (entry) {
      if (isSocketConnected) {
        socket.emit('close_room_backend', { roomId: entry.roomId });
      }
      delete catalog[counterName];
      setCatalog(catalog);

      const activeCounter = sessionStorage.getItem('active_counter');
      if (activeCounter === counterName) {
        sessionStorage.removeItem('active_counter');
        setDualScreenRoomId(null);
        setDualScreenUrl(null);
      }
      toast.success(t('pos.counter_deleted', `Counter "${counterName}" unpaired/deleted`));
    }
  };

  const sendNewOrderEvent = (tokenNo, orderId) => {
    if (isSocketConnected) {
      socket.emit('new_order_backend', {tokenNo, orderId}, user.tenant_id);
    } else {
      // Handle disconnected state (optional)
      initSocket();
      socket.emit('new_order_backend', {tokenNo, orderId}, user.tenant_id);
    }
  }

  const playTapSound = () => {
    tapSound.play();
  }

  async function _initPOS() {
    try {
      const res = await initPOS();
      let totalQROrders = 0;

      if(res.status == 200) {
        const data = res.data;

        // Initialize cloud storage config for image URLs
        if (data?.imageStorageConfig) {
          setImageStorageConfig(data.imageStorageConfig);
        }

        const currency = CURRENCIES.find((c)=>c.cc==data?.storeSettings?.currency);

        try {
          totalQROrders = await _getQROrdersCount();
        } catch (error) {
          console.log(error);
        }

        const savedView = sessionStorage.getItem('view') || 'compact';

        setState((prev) => ({
          ...prev,
          view:savedView,
          categories: data.categories,
          menuItems: data.menuItems,
          paymentTypes: data.paymentTypes,
          printSettings: data.printSettings,
          storeSettings: data.storeSettings,
          storeTables: data.storeTables,
          serviceCharge:data.serviceCharge,
          currency: currency?.symbol || "",
          qrOrdersCount: totalQROrders || 0,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error(error);
    }
  }

  const _getQROrdersCount = async () => {
    try {
      const res = await getQROrdersCount();
      if(res.status == 200) {
        const data = res.data;

        return data?.totalQROrders || 0;
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  const syncQrOrdersState = async () => {
    try {
      if (isQrOrdersDrawerOpenRef.current) {
        const res = await getQROrders();
        if (res.status == 200) {
          const list = Array.isArray(res.data) ? res.data : [];
          setState((prevState) => ({
            ...prevState,
            qrOrders: list,
            qrOrdersCount: list.length,
          }));
          return;
        }
      }
      const totalQROrders = await _getQROrdersCount();
      setState((prevState) => ({
        ...prevState,
        qrOrdersCount: totalQROrders || 0,
      }));
    } catch (error) {
      console.log(error);
    }
  };

  const _initSocket = () => {
    const qrOrderAudio = new Audio("/new_order_sound.mp3");
    if (!isSocketConnected) {
      initSocket();
    }
    if (!socket) return;

    socket.emit("authenticate", user.tenant_id);
    socket.off("new_qrorder");
    socket.on("new_qrorder", async (payload) => {
      try {
        qrOrderAudio.play().catch(() => {});
        await syncQrOrdersState();

        const tblText = payload?.tableTitle
          ? `${t("pos.table", "Table")} ${payload.tableTitle}`
          : payload?.tableId
          ? `${t("pos.table", "Table")} #${payload.tableId}`
          : t("pos.qr_orders", "QR Order");

        toast.success(
          (tObj) => (
            <div className="flex items-center justify-between gap-3 min-w-[230px]">
              <div className="flex items-center gap-2 min-w-0">

                <div className="flex flex-col leading-tight min-w-0">
                  <span className="font-extrabold text-xs text-restro-text truncate">
                    {t("pos.new_qr_order", "New QR Order")} · {tblText}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {t("pos.tap_view_to_approve", "Tap View to review or send to KDS")}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(tObj.id);
                  btnShowQROrdersModal();
                }}
                className="px-2.5 py-1 bg-restro-green text-white text-[11px] font-extrabold rounded-lg hover:bg-restro-green-button-hover transition active:scale-95 shadow-2xs cursor-pointer shrink-0"
              >
                {t("pos.view", "View")}
              </button>
            </div>
          ),
          { duration: 6000 }
        );
      } catch (error) {
        console.log(error);
      }
    });

    socket.off("table_status_update");
    socket.on("table_status_update", async (payload) => {
      if (
        payload?.action === "qr_order_approved" ||
        payload?.action === "qr_order_updated" ||
        payload?.action === "qr_orders_cleared"
      ) {
        await syncQrOrdersState();
      }
    });
  };

  if(isLoading) {
    return <Page className='px-4 py-3 flex flex-col min-h-0'>
      <div className='mt-4 h-[calc(100vh-136px)] flex gap-4 skeleton'>
        <div className='border border-restro-border-green-light rounded-2xl h-full w-[70%] overflow-y-auto'></div>
        <div className='border border-restro-border-green-light rounded-2xl h-full w-[30%] relative flex flex-col'></div>
      </div>
    </Page>
  }

  // cart
  function canPrepareMenuItem(menuItem, quantity = 1, selectedVariantId = null, selectedAddonIds = []) {
    const usageMap = {};

    menuItem.recipeItems.forEach((recipe) => {
      const appliesToBase = recipe.variant_id === 0 && recipe.addon_id === 0;
      const appliesToVariant = recipe.variant_id > 0 && recipe.variant_id == selectedVariantId;
      const appliesToAddon = recipe.addon_id > 0 && selectedAddonIds.includes(recipe.addon_id.toString());

      if (appliesToBase || appliesToVariant || appliesToAddon) {
        const invId = recipe.inventory_item_id;
        const requiredQty = parseFloat(recipe.recipe_quantity) * quantity;

        if (!usageMap[invId]) {
          usageMap[invId] = {
            ingredient_title: recipe.ingredient_title,
            total_required: 0,
            current_quantity: parseFloat(recipe.current_quantity || 0),
          };
        }

        usageMap[invId].total_required += requiredQty;
      }
    });

    for (const invId in usageMap) {
      const { ingredient_title, total_required, current_quantity } = usageMap[invId];
      if (current_quantity < total_required) {
        console.warn(
          `Cannot prepare '${menuItem.title}' - Ingredient '${ingredient_title}' is insufficient`
        );
        return false;
      }
    }

    return true;
  }

  function addItemToCart(item) {
    const quantityToAdd = Number(item.quantity) || 1;
    const modifiedItem = {
      ...item,
      quantity: quantityToAdd,
      notes: item.notes || null
    };

    if (!canPrepareMenuItem(item, quantityToAdd)) {
      toast.error(t('inventory.insufficient_stock_message_pos'));
      return;
    }

    if(!cartItems || cartItems.length === 0) {
      setState(prev => ({
        ...prev,
        cartItems: [modifiedItem]
      }));
      playTapSound();
      return;
    }

    // If 'Add to Same Line' is enabled, check if an identical item already exists in ticket
    if (isAddSameLine) {
      const existingIndex = cartItems.findIndex(c => areItemsIdentical(c, modifiedItem));
      if (existingIndex !== -1) {
        const currentQty = Number(cartItems[existingIndex].quantity) || 1;
        const newQty = currentQty + quantityToAdd;

        if (!canPrepareMenuItem(cartItems[existingIndex], newQty, cartItems[existingIndex].variant_id, cartItems[existingIndex].addons_ids)) {
          toast.error(t('inventory.insufficient_stock_message_pos'));
          return;
        }

        const updatedCart = [...cartItems];
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: newQty
        };

        setState(prev => ({
          ...prev,
          cartItems: updatedCart
        }));
        playTapSound();
        return;
      }
    }

    // Default or Same Line OFF: append as a separate line
    setState(prev => ({
      ...prev,
      cartItems: [...(prev.cartItems || []), modifiedItem]
    }));
    playTapSound();
  }

  function removeItemFromCart(index) {
    setState({
      ...state,
      cartItems: cartItems.filter((c,i)=> i !== index)
    })
    playTapSound();
  }

  function addCartItemQuantity(index, currentQuantity) {
    const newQuantity = currentQuantity + 1;
    const newCartItems = cartItems;

    if (!canPrepareMenuItem(newCartItems[index], newQuantity, newCartItems[index].variant_id, newCartItems[index].addons_ids)) {
      toast.error(t('inventory.insufficient_stock_message_pos'));
      return;
    }

    newCartItems[index].quantity = newQuantity;

    setState({
      ...state,
      cartItems: [...newCartItems]
    });
    playTapSound();
  }
  function minusCartItemQuantity(index, currentQuantity) {
    const newQuantity = currentQuantity - 1;
    let newCartItems = cartItems;

    newCartItems[index].quantity = newQuantity;

    if(newQuantity == 0) {
      newCartItems = cartItems.filter((v, i)=>i!=index);
    }

    setState({
      ...state,
      cartItems: [...newCartItems]
    });
    playTapSound();
  }
  // cart

  // order notes
  const btnOpenNotesModal = (index, notes) => {
    dialogNotesIndexRef.current.value = index;
    dialogNotesTextRef.current.value = notes;
    document.getElementById('modal-notes').showModal()
  }
  const btnAddNotes = () => {
    const index = dialogNotesIndexRef.current.value;
    const notes = dialogNotesTextRef.current.value || null;

    const newCartItems = [...cartItems];
    if (newCartItems[index]) {
      newCartItems[index] = {
        ...newCartItems[index],
        notes: notes,
      };
    }

    setState((prev) => ({
      ...prev,
      cartItems: newCartItems,
    }));
  };
  // order notes

  // category filter modal
  const btnOpenCategoryFilterModal = () => {
    categoryFilterDropdownRef.current.value = selectedCategory;
    document.getElementById('modal-categories').showModal()
  }
  const btnApplyCategoryFilter = () => {
    const selectedCategoryFromDropdown = categoryFilterDropdownRef.current.value || "";
    setState({
      ...state,
      selectedCategory: selectedCategoryFromDropdown
    })
  }
  const btnClearSelectedCategory = () => {
    setState({
      ...state,
      selectedCategory: "all"
    })
  };
  // category filter modal

  // variant, addon modal
  const broadcastVariantSelection = (targetItemId = null) => {
    if (!dualScreenRoomId || !isSocketConnected) return;
    const itemId = targetItemId || state.selectedItemId;
    if (!itemId) return;

    let selectedVariantId = null;
    const selectedAddonIds = [];

    const itemVariants = document.getElementsByName("variants");
    itemVariants.forEach((item) => {
      if (item.checked) {
        selectedVariantId = item.value;
      }
    });

    const itemAddons = document.getElementsByName("addons");
    itemAddons.forEach((item) => {
      if (item.checked) {
        selectedAddonIds.push(item.value);
      }
    });

    socket.emit("variant_modal_update_backend", {
      roomId: dualScreenRoomId,
      selectedItemId: itemId,
      selectedVariantId: selectedVariantId,
      selectedAddonIds: selectedAddonIds,
    });
  };

  const closeVariantModalSync = () => {
    if (dualScreenRoomId && isSocketConnected) {
      socket.emit("variant_modal_close_backend", { roomId: dualScreenRoomId });
    }
  };

  const resetVariantsAndAddons = () => {
    const itemVariants = document.getElementsByName("variants");
    itemVariants.forEach((item, index) => {
      item.checked = index === 0;
    });

    const itemAddons = document.getElementsByName("addons");
    itemAddons.forEach((item) => {
      item.checked = false;
    });
  };

  const btnOpenVariantAndAddonModal = (menuItemId) => {
    const selectedItem = menuItems.find((item) => String(item.id) === String(menuItemId));
    if (!selectedItem) return;

    setActiveCustomizingItem(selectedItem);
    setIsModifierDrawerOpen(true);

    setState(prev => ({
      ...prev,
      selectedItemId: menuItemId
    }));

    if (dualScreenRoomId && isSocketConnected) {
      const defaultVariantId = selectedItem?.variants?.[0]?.id || null;
      socket.emit("variant_modal_open_backend", {
        roomId: dualScreenRoomId,
        selectedItemId: menuItemId,
        selectedVariantId: defaultVariantId,
        selectedAddonIds: [],
      });
    }
  };

  const handleAddConfiguredItemToCart = (configuredItem) => {
    const quantityToAdd = Number(configuredItem.quantity) || 1;

    // If 'Add to Same Line' is enabled, check if identical configured item is already in cart
    if (isAddSameLine && state.cartItems && state.cartItems.length > 0) {
      const existingIndex = state.cartItems.findIndex(c => areItemsIdentical(c, configuredItem));
      if (existingIndex !== -1) {
        const currentQty = Number(state.cartItems[existingIndex].quantity) || 1;
        const newQty = currentQty + quantityToAdd;

        if (!canPrepareMenuItem(state.cartItems[existingIndex], newQty, state.cartItems[existingIndex].variant_id, state.cartItems[existingIndex].addons_ids)) {
          toast.error(t('inventory.insufficient_stock_message_pos'));
          return;
        }

        const updatedCart = [...state.cartItems];
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: newQty
        };

        setState(prev => ({
          ...prev,
          cartItems: updatedCart
        }));
        playTapSound();
        toast.success(t('pos.item_quantity_updated', 'Added to same line (+{{count}})', { count: quantityToAdd }));
        return;
      }
    }

    setState(prev => ({
      ...prev,
      cartItems: [...(prev.cartItems || []), configuredItem]
    }));
    playTapSound();
    toast.success(t('pos.item_added', 'Item added to ticket'));
  };

  const broadcastModifierDrawerSelection = (itemId, variantId, addonIds) => {
    if (!dualScreenRoomId || !isSocketConnected) return;
    socket.emit("variant_modal_update_backend", {
      roomId: dualScreenRoomId,
      selectedItemId: itemId,
      selectedVariantId: variantId,
      selectedAddonIds: addonIds,
    });
  };
  const btnAddMenuItemToCartWithVariantsAndAddon = () => {
    let price = 0;
    let selectedVariantId = null;
    const selectedAddonsId = [];

    const itemVariants = document.getElementsByName("variants");
    itemVariants.forEach((item)=>{
      if(item.checked) {
        selectedVariantId = item.value;
        return;
      }
    })

    const itemAddons = document.getElementsByName("addons");
    itemAddons.forEach((item)=>{
      if(item.checked) {
        selectedAddonsId.push(item.value);
      }
    })

    // get selected menu item
    const selectedItem = menuItems.find((item)=>item.id == selectedItemId);

    const addons = selectedItem?.addons || [];
    const variants = selectedItem?.variants || [];

    let selectedVariant = null;
    if(selectedVariantId) {
      selectedVariant = variants.find((v)=>v.id == selectedVariantId);
      price = parseFloat(selectedVariant.price);
    } else {
      price = parseFloat(selectedVariant?.price ?? selectedItem.price)
    }

    let selectedAddons = [];
    if(selectedAddonsId.length > 0) {
      selectedAddons = selectedAddonsId.map((addonId)=>addons.find((addon)=>addon.id == addonId))
      selectedAddons.forEach((addon)=>{
        const addonPrice = parseFloat(addon.price);
        price = price + addonPrice
      });
    }

    const canPrepare = canPrepareMenuItem(selectedItem, 1/**quantity */, selectedVariantId, selectedAddonsId);

    if (!canPrepare) {
      toast.error(t('inventory.insufficient_stock_message_pos'));
      closeVariantModalSync();
      document.getElementById('modal-variants-addons')?.close();
      return;
    }

    const itemCart = {...selectedItem, price: price, variant_id: selectedVariantId, variant: selectedVariant, addons_ids: selectedAddonsId, addons: selectedAddons}
    addItemToCart(itemCart)
    closeVariantModalSync();
  };
  // variant, addon modal

  // 1-Tap Quick Hold Draft (No popup or reference input required)
  const handleQuickHoldDraft = () => {
    if (!cartItems || cartItems.length === 0) {
      toast.error(t('pos.empty_cart'));
      return;
    }

    const drafts = getDrafts();

    // Intelligent auto-naming
    let autoTitle = "";
    if (currentSelectedTable) {
      autoTitle = `${currentSelectedTable.table_title}`;
    } else if (activeTableContext) {
      autoTitle = `${activeTableContext.tableTitle} #${activeTableContext.tokenNo}`;
    } else if (customer?.name || customer?.label) {
      const rawCust = customer.name || customer.label;
      autoTitle = rawCust.split(" - ")[0] || rawCust;
    } else if (customerType && customerType !== "WALKIN") {
      autoTitle = customerType;
    } else {
      autoTitle = `${t('pos.order', 'Order')} #${drafts.length + 1}`;
    }

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullRefName = `${autoTitle} (${nowTime})`;

    const draftItem = {
      nameRef: fullRefName,
      date: nowTime,
      cart: [...cartItems],
      tableId: tableRef.current?.value || null,
      tableTitle: currentSelectedTable?.table_title || selectedTableTitle || null,
      diningOption: diningOptionRef.current?.value || selectedDiningOption || "dinein",
      customer: customer || null,
      customerType: customerType || "WALKIN",
      payableTotal: liveCartSummary.payableTotal,
    };

    const nextDrafts = [draftItem, ...drafts];
    setDrafts(nextDrafts);

    if (dualScreenRoomId && isSocketConnected) {
      socket.emit('cart_clear_backend', { roomId: dualScreenRoomId });
      broadcastOrderMeta(null, "", "");
    }

    if (diningOptionRef.current) diningOptionRef.current.value = "";
    if (tableRef.current) tableRef.current.value = "";
    setSelectedTableTitle("");
    setActiveTableContext(null);

    setState((prev) => ({
      ...prev,
      cartItems: [],
      drafts: nextDrafts,
      customer: null,
      customerType: "WALKIN",
      discountType: "fixed",
      discountValue: 0,
      discountAmount: 0,
    }));

    playTapSound();
    toast.success(
      (tObj) => (
        <div className="flex items-center justify-between gap-3 min-w-[220px]">
          <div className="flex items-center gap-2">

            <div className="flex flex-col">
              <span className="font-bold text-xs">{t('pos.draft_saved', 'Order Saved to Drafts')}</span>
              <span className="text-[11px] text-gray-500">{fullRefName}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(tObj.id);
              btnOpenDraftsModal();
            }}
            className="px-2 py-1 bg-white dark:bg-zinc-800 text-restro-green text-[11px] font-extrabold rounded-md border border-restro-green/40 hover:bg-restro-green hover:text-white transition active:scale-95 shadow-2xs cursor-pointer"
          >
            {t('pos.view_drafts', 'View')}
          </button>
        </div>
      ),
      { duration: 4000 }
    );
  };

  const btnOpenSaveDraftModal = handleQuickHoldDraft;
  const btnAddtoDrafts = handleQuickHoldDraft;

  const btnInitNewOrder = () => {
    if (diningOptionRef.current) {
      diningOptionRef.current.value = "";
    }
    if (tableRef.current) {
      tableRef.current.value = "";
    }
    if (dualScreenRoomId && isSocketConnected) {
      socket.emit('cart_clear_backend', { roomId: dualScreenRoomId });
      broadcastOrderMeta(null, "", "");
    }
    setState({
      ...state,
      cartItems: [],
      customer: null,
      customerType: "WALKIN",
      selectedQrOrderItem: null,
      discountType: "fixed",
      discountValue: 0,
      discountAmount: 0,
    });
    playTapSound();
  };

  const btnOpenDraftsModal = () => {
    const drafts = getDrafts();
    setState({
      ...state,
      drafts: [...drafts]
    });
    setIsDraftsDrawerOpen(true);
  };

  const btnDeleteDraftItem = index => {
    const drafts = getDrafts();
    const newDrafts = drafts.filter((v,i)=>i!=index);

    setDrafts(newDrafts);

    setState({
      ...state,
      drafts: [...newDrafts]
    });
  };

  const btnClearDrafts = () => {
    setDrafts([]);
    setState({
      ...state,
      drafts: []
    });
  };

  const btnSelectDraftItemToCart = (draftItem, index) => {
    const { nameRef, cart, tableId, tableTitle, diningOption, customer: draftCust, customerType: draftCustType } = draftItem;

    if (diningOption && diningOptionRef.current) {
      diningOptionRef.current.value = diningOption;
      setSelectedDiningOption(diningOption);
    }
    if (tableId && tableRef.current) {
      tableRef.current.value = tableId;
      setSelectedTableTitle(tableTitle || `Table ${tableId}`);
    }

    // Remove the restored draft from drafts list
    const currentDrafts = getDrafts();
    const updatedDrafts = currentDrafts.filter((_, i) => i !== index);
    setDrafts(updatedDrafts);

    setState((prev) => ({
      ...prev,
      cartItems: [...(cart || [])],
      customer: draftCust || null,
      customerType: draftCustType || "WALKIN",
      drafts: updatedDrafts,
    }));

    playTapSound();
    toast.success(`${t('pos.draft_restored', 'Restored')}: ${nameRef}`);
    setIsDraftsDrawerOpen(false);
  };

  // Seamless auto-hold active cart and restore selected draft (Zero data loss)
  const handleHoldCurrentAndRestore = (draftItem, index) => {
    if (cartItems && cartItems.length > 0) {
      const drafts = getDrafts();
      let autoTitle = "";
      if (currentSelectedTable) {
        autoTitle = `${currentSelectedTable.table_title}`;
      } else if (activeTableContext) {
        autoTitle = `${activeTableContext.tableTitle} #${activeTableContext.tokenNo}`;
      } else if (customer?.name || customer?.label) {
        const rawCust = customer.name || customer.label;
        autoTitle = rawCust.split(" - ")[0] || rawCust;
      } else if (customerType && customerType !== "WALKIN") {
        autoTitle = customerType;
      } else {
        autoTitle = `${t('pos.order', 'Order')} #${drafts.length + 1}`;
      }
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const fullRefName = `${autoTitle} (${nowTime})`;

      const currentCartDraft = {
        nameRef: fullRefName,
        date: nowTime,
        cart: [...cartItems],
        tableId: tableRef.current?.value || null,
        tableTitle: currentSelectedTable?.table_title || selectedTableTitle || null,
        diningOption: diningOptionRef.current?.value || selectedDiningOption || "dinein",
        customer: customer || null,
        customerType: customerType || "WALKIN",
        payableTotal: liveCartSummary.payableTotal,
      };

      const remainingDrafts = drafts.filter((_, i) => i !== index);
      const nextDrafts = [currentCartDraft, ...remainingDrafts];
      setDrafts(nextDrafts);

      const { nameRef, cart, tableId, tableTitle, diningOption, customer: draftCust, customerType: draftCustType } = draftItem;
      if (diningOption && diningOptionRef.current) {
        diningOptionRef.current.value = diningOption;
        setSelectedDiningOption(diningOption);
      }
      if (tableId && tableRef.current) {
        tableRef.current.value = tableId;
        setSelectedTableTitle(tableTitle || `Table ${tableId}`);
      }

      setState((prev) => ({
        ...prev,
        cartItems: [...(cart || [])],
        customer: draftCust || null,
        customerType: draftCustType || "WALKIN",
        drafts: nextDrafts,
      }));

      playTapSound();
      toast.success(`${t('pos.draft_restored', 'Restored')}: ${nameRef}`);
      setIsDraftsDrawerOpen(false);
    } else {
      btnSelectDraftItemToCart(draftItem, index);
      setIsDraftsDrawerOpen(false);
    }
  };
  // drafts

  // QR Menu Orders
  const btnShowQROrdersModal = async () => {
    setIsQrOrdersDrawerOpen(true);
    playTapSound();
    try {
      const res = await getQROrders();
      if (res.status == 200) {
        const data = Array.isArray(res.data) ? res.data : [];
        setState((prev) => ({
          ...prev,
          qrOrders: [...data],
          qrOrdersCount: data.length,
        }));
      }
    } catch (error) {
      console.log(error);
    }
  };

  const btnClearQROrders = async () => {
    try {
      const res = await cancelAllQROrders();
      if (res.status == 200) {
        toast.success(res.data?.message || t('pos.qr_orders_cleared', 'All QR orders rejected'));
        setState((prevState) => ({
          ...prevState,
          qrOrders: [],
          qrOrdersCount: 0,
        }));
        playTapSound();
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('pos.getting_issues');
      console.log(error);
      toast.error(message);
    }
  };

  const btnCancelQROrder = async (orderId) => {
    try {
      const res = await cancelQROrder(orderId);
      if (res.status == 200) {
        toast.success(res.data?.message || t('pos.qr_order_rejected', 'QR Order rejected'));
        setState((prevState) => {
          const newQROrders = (prevState.qrOrders || []).filter((item) => item.id != orderId);
          return {
            ...prevState,
            qrOrders: [...newQROrders],
            qrOrdersCount: newQROrders.length,
          };
        });
        playTapSound();
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('pos.getting_issues');
      console.log(error);
      toast.error(message);
    }
  };

  const btnApproveQROrder = async (orderId) => {
    try {
      const res = await approveQROrder(orderId);
      if (res.status == 200) {
        toast.success(res.data?.message || "QR Order approved and sent to kitchen!");
        setState((prevState) => {
          const newQROrders = (prevState.qrOrders || []).filter((item) => item.id != orderId);
          if (newQROrders.length === 0) {
            setIsQrOrdersDrawerOpen(false);
          }
          return {
            ...prevState,
            qrOrders: [...newQROrders],
            qrOrdersCount: newQROrders.length,
          };
        });
        playTapSound();
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('pos.getting_issues');
      console.error(error);
      toast.error(message);
    }
  };

  const btnApproveAllQROrders = async () => {
    const ordersToApprove = [...(state.qrOrders || [])];
    if (ordersToApprove.length === 0) return;

    let approvedCount = 0;
    const failedIds = new Set();

    for (const qrOrder of ordersToApprove) {
      try {
        const res = await approveQROrder(qrOrder.id);
        if (res.status == 200) {
          approvedCount += 1;
        } else {
          failedIds.add(qrOrder.id);
        }
      } catch (err) {
        console.error(err);
        failedIds.add(qrOrder.id);
      }
    }

    const remaining = (state.qrOrders || []).filter((o) => failedIds.has(o.id));
    setState((prev) => ({
      ...prev,
      qrOrders: remaining,
      qrOrdersCount: remaining.length,
    }));

    playTapSound();
    if (approvedCount > 0) {
      toast.success(
        `${t('pos.approved_qr_orders', 'Approved & sent to KDS')}: ${approvedCount} ${
          approvedCount === 1 ? t('pos.order', 'order') : t('pos.orders', 'orders')
        }`
      );
    }
    if (remaining.length === 0) {
      setIsQrOrdersDrawerOpen(false);
    }
  };

  const btnSelectQROrder = (qrOrder) => {
    if (!qrOrder) return;

    // 1. Auto-hold active cart if non-empty so cashier never loses work
    let updatedDrafts = state.drafts || [];
    if (cartItems && cartItems.length > 0 && state.selectedQrOrderItem !== qrOrder.id) {
      const existingDrafts = getDrafts();
      let autoTitle = "";
      if (currentSelectedTable) {
        autoTitle = `${currentSelectedTable.table_title}`;
      } else if (activeTableContext) {
        autoTitle = `${activeTableContext.tableTitle} #${activeTableContext.tokenNo}`;
      } else if (customer?.name || customer?.label) {
        const rawCust = customer.name || customer.label;
        autoTitle = rawCust.split(" - ")[0] || rawCust;
      } else {
        autoTitle = `${t('pos.order', 'Order')} #${existingDrafts.length + 1}`;
      }
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const currentCartDraft = {
        nameRef: `${autoTitle} (${nowTime})`,
        date: nowTime,
        cart: [...cartItems],
        tableId: tableRef.current?.value || null,
        tableTitle: currentSelectedTable?.table_title || selectedTableTitle || null,
        diningOption: diningOptionRef.current?.value || selectedDiningOption || "dinein",
        customer: customer || null,
        customerType: customerType || "WALKIN",
        payableTotal: liveCartSummary.payableTotal,
      };
      updatedDrafts = [currentCartDraft, ...existingDrafts];
      setDrafts(updatedDrafts);
      toast(`${t('pos.auto_held_previous', 'Auto-held previous cart')}: ${autoTitle}`, { icon: '' });
    }

    // 2. Sync Dining Option & Table Header
    const delType = (qrOrder.delivery_type || (qrOrder.table_id ? "dinein" : "dinein")).toLowerCase();
    setSelectedDiningOption(delType);
    if (diningOptionRef.current) {
      diningOptionRef.current.value = delType;
    }

    if (qrOrder.table_id) {
      if (tableRef.current) {
        tableRef.current.value = qrOrder.table_id;
      }
      const tblObj = state.storeTables?.find((t) => String(t.id) === String(qrOrder.table_id));
      if (tblObj) {
        setSelectedTableTitle(`${tblObj.table_title} (${tblObj.seating_capacity} ${t('pos.person')}) - ${tblObj.floor}`);
      } else if (qrOrder.table_title) {
        setSelectedTableTitle(qrOrder.table_title);
      }
    } else {
      if (tableRef.current) {
        tableRef.current.value = "";
      }
      setSelectedTableTitle("");
    }

    // 3. Map QR order items into POS cart structure accurately
    const modifiedCart = (qrOrder.items || []).map((item) => {
      const id = item.item_id;
      const hasVariant = Boolean(item.variant_id);
      const selectedVariant = hasVariant
        ? {
            id: item.variant_id,
            item_id: id,
            price: item.variant_price,
            title: item.variant_title,
          }
        : null;

      const cleanAddons = Array.isArray(item.addons) ? item.addons.filter(Boolean) : [];

      return {
        ...item,
        id: id,
        title: item.item_title,
        addons: cleanAddons,
        addons_ids: cleanAddons.map((i) => i.id),
        variant: selectedVariant,
        variant_id: item.variant_id || null,
        notes: item.notes || null,
      };
    });

    const isCust = qrOrder.customer_type === "CUSTOMER" && (qrOrder.customer_id || qrOrder.customer_name);
    const attachedCust = isCust
      ? {
          phone: qrOrder.customer_id || "",
          name: qrOrder.customer_name || qrOrder.customer_id || "Guest",
          label: `${qrOrder.customer_name || "Guest"} - (${qrOrder.customer_id || ""})`,
          value: qrOrder.customer_id || "",
        }
      : null;

    setState((prev) => ({
      ...prev,
      cartItems: modifiedCart,
      selectedQrOrderItem: qrOrder.id,
      customerType: isCust ? "CUSTOMER" : "WALKIN",
      customer: attachedCust,
      drafts: updatedDrafts,
    }));

    broadcastOrderMeta(attachedCust, delType, qrOrder.table_id || "");
    playTapSound();
    setIsQrOrdersDrawerOpen(false);
    toast.success(
      `${t('pos.qr_loaded_to_cart', 'Loaded QR Order')} #${qrOrder.id}${
        qrOrder.table_title ? ` (${t('pos.table', 'Table')} ${qrOrder.table_title})` : ""
      }`
    );
  };
  // QR Menu Orders

  // search customer drawer & modal
  const btnOpenSearchCustomerModal = () => {
    setIsCustomerDrawerOpen(true);
    playTapSound();
    if (dualScreenRoomId && isSocketConnected) {
      socket.emit("customer_modal_open_backend", {
        roomId: dualScreenRoomId,
        customer: customer,
        customerType: customerType,
      });
    }
  };
  const closeCustomerModalSync = () => {
    setIsCustomerDrawerOpen(false);
    if (dualScreenRoomId && isSocketConnected) {
      socket.emit("customer_modal_close_backend", { roomId: dualScreenRoomId });
    }
  };
  const btnClearSearchCustomer = () => {
    setState(prev => ({
      ...prev,
      customerType: "WALKIN",
      customer: null
    }));
    playTapSound();
    closeCustomerModalSync();
  };
  const btnSearchCustomer = async () => {
    const phone = searchCustomerRef.current.value;

    if(!phone) {
      toast.error(t('pos.please_provide_phone'));
      return;
    }

    try {
      toast.loading(t('pos.please_wait'));
      const resp = await searchCustomer(phone);
      toast.dismiss();
      if(resp.status == 200) {
        setState({
          ...state,
          customer: resp.data,
          customerType: "CUSTOMER"
        })
        document.getElementById("modal-search-customer").close()
      }

    } catch (error) {
      console.log(error);
      const message = error.response.data.message || t('pos.error_getting_details');
      toast.dismiss();
      toast.error(message);
    }
  }
  // search customer modal

  // send to kitchen modal
  // send to kitchen modal
  const calculateOrderSummary = (discType = state?.discountType, discVal = state?.discountValue) => {
    let itemsTotal = 0; // without tax - net amount
    let taxTotal = 0;
    let serviceChargeTotal = 0;
    let payableTotal = 0;

    cartItems.forEach((item)=>{
      const taxId = item.tax_id;
      const taxTitle = item.tax_title;
      const taxRate = Number(item.tax_rate);
      const taxType = item.tax_type; // inclusive or exclusive or NULL

      const itemPrice = Number(item.price) * Number(item.quantity);

      if (taxType == "exclusive") {
        const tax = (itemPrice * taxRate) / 100;
        const priceWithTax = itemPrice + tax;

        taxTotal += tax;
        itemsTotal += itemPrice;
        payableTotal += priceWithTax;
      } else if (taxType == "inclusive") {
        const tax = itemPrice - (itemPrice * (100 / (100 + taxRate)));
        const priceWithoutTax = itemPrice - tax;

        taxTotal += tax;
        itemsTotal += priceWithoutTax;
        payableTotal += itemPrice;
      } else {
        itemsTotal += itemPrice;
        payableTotal += itemPrice;
      }
    });

    // Promotion Engine evaluation
    const promoEval = evaluateCartPromotions({
      promotions: activePromotionsList,
      cartItems: cartItems,
      diningOption: selectedDiningOption,
      enteredCode: enteredCouponCode,
      now: new Date()
    });

    const promotionDiscountTotal = promoEval?.totalPromotionDiscount || 0;
    const appliedPromotions = promoEval?.appliedPromotions || [];
    const eligiblePromotions = promoEval?.eligiblePromotions || [];

    let discountAmount = 0;
    const numDiscVal = Number(discVal) || 0;
    if (numDiscVal > 0) {
      if (discType === 'percentage') {
        const safePerc = Math.min(Math.max(numDiscVal, 0), 100);
        discountAmount = (itemsTotal * safePerc) / 100;
      } else {
        discountAmount = Math.min(Math.max(numDiscVal, 0), itemsTotal);
      }
    }

    const totalDeductions = discountAmount + promotionDiscountTotal;
    payableTotal = Math.max(0, payableTotal - totalDeductions);

    // Calculate Total Service charge % from items total
    if (state.serviceCharge) {
      let serviceCharge = (Number(itemsTotal) * Number(state.serviceCharge)) / 100;
      serviceChargeTotal += serviceCharge;
      payableTotal += serviceCharge;
    }

    return {
      itemsTotal,
      discountAmount,
      promotionDiscountTotal,
      appliedPromotions,
      eligiblePromotions,
      taxTotal,
      serviceChargeTotal,
      payableTotal
    };
  };

  const handleDiscountChange = (type, val) => {
    const newType = type !== undefined ? type : state.discountType;
    let rawVal = val !== undefined ? val : state.discountValue;

    if (rawVal !== "" && rawVal !== null && rawVal !== undefined) {
      let numVal = parseFloat(rawVal);
      if (isNaN(numVal) || numVal < 0) {
        numVal = 0;
      }
      if (newType === 'percentage' && numVal > 100) {
        numVal = 100;
      } else if (newType === 'fixed' && numVal > state.itemsTotal) {
        numVal = state.itemsTotal;
      }
      rawVal = numVal;
    }

    const summary = calculateOrderSummary(newType, rawVal);

    setState((prev) => ({
      ...prev,
      discountType: newType,
      discountValue: rawVal,
      ...summary
    }));
  };

  const broadcastPaymentModalOpen = (pTypes, selectedType) => {
    if (dualScreenRoomId && isSocketConnected) {
      socket.emit("payment_modal_open_backend", {
        roomId: dualScreenRoomId,
        paymentTypes: pTypes || paymentTypes,
        selectedPaymentType: selectedType !== undefined ? selectedType : state.selectedPaymentType,
      });
    }
  };

  const broadcastPaymentSelection = (selectedType) => {
    if (dualScreenRoomId && isSocketConnected) {
      socket.emit("payment_modal_update_backend", {
        roomId: dualScreenRoomId,
        selectedPaymentType: selectedType,
      });
    }
  };

  const closePaymentModalSync = () => {
    if (dualScreenRoomId && isSocketConnected) {
      socket.emit("payment_modal_close_backend", { roomId: dualScreenRoomId });
    }
  };

  const btnShowPayAndSendToKitchenModal = () => {
    if(cartItems?.length == 0) {
      toast.error(t('pos.empty_cart'));
      return;
    }

    const summary = calculateOrderSummary();
    const defaultPayType = state.selectedPaymentType || (paymentTypes?.length > 0 ? paymentTypes[0].id : null);

    setState(prev => ({
      ...prev,
      selectedPaymentType: defaultPayType,
      ...summary
    }));
    setTenderedAmount(summary.payableTotal > 0 ? summary.payableTotal.toFixed(2) : '');
    setIsPaymentDrawerOpen(true);
    broadcastPaymentModalOpen(paymentTypes, defaultPayType);
  };

  const handleOpenSplitFromPOS = () => {
    if (cartItems?.length === 0) {
      toast.error(t('pos.empty_cart'));
      return;
    }

    const summary = calculateOrderSummary();
    const formattedItems = cartItems.map((it, idx) => ({
      id: idx + 1,
      item_title: it.title,
      variant_title: it.variant?.title || null,
      price: Number(it.price || 0),
      quantity: Number(it.quantity || 1),
    }));

    setSplitBillOrder({
      id: Date.now(),
      table_title: selectedTableTitle || (tableRef.current?.value ? storeTables?.find(t => String(t.id) === String(tableRef.current.value))?.table_title : ''),
      token_no: 'POS',
      subtotal: summary.itemsTotal,
      total: summary.payableTotal,
      tax_total: summary.taxTotal,
      service_charge_total: summary.serviceChargeTotal,
      items: formattedItems,
    });
    setIsSplitDrawerOpen(true);
  };

  const handlePrintSubReceiptFromPOS = (sub, order) => {
    const formattedItems = (sub.items || []).map((it) => ({
      title: it.item_title,
      variant: it.variant_title ? { title: it.variant_title } : null,
      price: it.price,
      quantity: it.quantity,
    }));

    triggerPrintReceipt({
      order_id: `POS (${sub.seat_label})`,
      order_title: `${order?.table_title ? order.table_title + " - " : ""}${sub.seat_label}`,
      token_no: sub.sub_invoice_number,
      customer_type: selectedDiningOption || "dinein",
      customer_name: sub.seat_label,
      items: formattedItems,
      sub_total: sub.subtotal,
      tax_total: sub.tax_total,
      service_charge_total: sub.service_charge_total,
      discount_total: sub.discount_total,
      total: sub.payable_total,
      tip_amount: sub.tip_amount,
      payment_type: sub.payment_type_title || "Cash",
      date: sub.paid_at || new Date().toISOString(),
      printSettings: state.printSettings,
      storeSettings: state.storeSettings,
    });
  };

  const btnPayAndSendToKitchen = async (tenderData = null) => {
    if(!state.selectedPaymentType) {
      return toast.error(t('orders.select_payment_method'));
    }
    try {
      const deliveryType = diningOptionRef.current?.value || selectedDiningOption || "dinein";
      const tableId = tableRef.current?.value || null;
      const customerType = state.customerType;
      const customer = state.customer;

      toast.loading(t('pos.please_wait'));
      setIsSubmittingPayment(true);
      const summary = calculateOrderSummary();
      const loyaltyPointsRedeemed = tenderData?.loyaltyPointsRedeemed || 0;
      const res = await createOrderAndInvoice(
        cartItems, deliveryType, customerType, customer, tableId,
        summary.itemsTotal, summary.taxTotal, summary.serviceChargeTotal, summary.payableTotal,
        state.selectedQrOrderItem, state.selectedPaymentType,
        state.discountType, state.discountValue, summary.discountAmount,
        summary.appliedPromotions, summary.promotionDiscountTotal,
        loyaltyPointsRedeemed
      );
      toast.dismiss();
      setIsSubmittingPayment(false);
      if(res.status == 200) {
        const data = res.data;
        toast.success(res.data.message);
        setIsPaymentDrawerOpen(false);
        const oldPayModal = document.getElementById("modal-pay-and-send-kitchen-summary");
        if (oldPayModal?.open) oldPayModal.close();
        closePaymentModalSync();

        if (dualScreenRoomId && isSocketConnected) {
          socket.emit("order_success_backend", {
            roomId: dualScreenRoomId,
            tokenNo: data.tokenNo,
            orderId: data.orderId,
            payableTotal: state.payableTotal,
          });
        }

        const page_format = printSettings?.page_format || null;
        const is_enable_print = printSettings?.is_enable_print || 0;

        const paymentType = paymentTypes.find((v)=>v.id == state.selectedPaymentType);
        let paymentMethodText;
        if(paymentType) {
          paymentMethodText = paymentType.title;
        }

        const receiptPayload = {
          cartItems, deliveryType, customerType, customer, tableId, currency, storeSettings, printSettings,
          itemsTotal: summary.itemsTotal,
          discountType: state.discountType,
          discountValue: state.discountValue,
          discountAmount: summary.discountAmount,
          appliedPromotions: summary.appliedPromotions,
          promotionDiscountTotal: summary.promotionDiscountTotal,
          taxTotal: summary.taxTotal,
          serviceChargeTotal: summary.serviceChargeTotal,
          payableTotal: summary.payableTotal,
          tokenNo: data.tokenNo,
          orderId: data.orderId,
          paymentMethod: paymentMethodText,
          paymentStatus: "paid",
          billingMode: "prepaid",
          billingTag: "PAID (PREPAID)",
          dualTenderInfo: tenderData || null,
          loyaltyPointsRedeemed: tenderData?.loyaltyPointsRedeemed || 0,
          loyaltyDiscountAmount: tenderData?.loyaltyDiscountAmount || 0,
          loyaltyPointsEarned: tenderData?.loyaltyPointsEarned || 0,
        };

        if (customer?.phone) {
          mutate((key) => typeof key === 'string' && (key.startsWith('/customers') || key.startsWith('/loyalty')));
        }

        setDetailsForReceiptPrint(receiptPayload);

        sendNewOrderEvent(data.tokenNo, data.orderId);

        let newQROrderItemCount = state.qrOrdersCount;
        let newQROrders = [];
        if(state.selectedQrOrderItem) {
          newQROrderItemCount -= 1;
          newQROrders = state?.qrOrders?.filter((item)=>item.id != state.selectedQrOrderItem);
        }

        if (diningOptionRef.current) diningOptionRef.current.value = "";
        if (tableRef.current) tableRef.current.value = "";

        setState((prev) => ({
          ...prev,
          cartItems: [],
          customer: null,
          customerType: "WALKIN",
          tokenNo: data.tokenNo,
          orderId: data.orderId,
          selectedQrOrderItem: null,
          qrOrders: newQROrders,
          qrOrdersCount: newQROrderItemCount,
          selectedPaymentType: null,
          discountType: "fixed",
          discountValue: 0,
          discountAmount: 0,
        }))
        setEnteredCouponCode("");

        _initPOS()

        if(is_enable_print) {
          triggerPrintReceipt(receiptPayload);
        }

        const defaultRate = customExchangeRate || storeSettings?.exchange_rate_usd_to_khr || storeSettings?.exchangeRateUsdToKhr || 4100;
        const isKHR = currency === '៛' || String(currency).toLowerCase() === 'khr';

        setCompletedPaymentInfo({
          orderId: data.orderId,
          tokenNo: data.tokenNo,
          paymentMethod: paymentMethodText,
          payableTotal: state.payableTotal,
          tenderedUSD: tenderData?.tenderedUSD || (isKHR ? 0 : state.payableTotal),
          tenderedKHR: tenderData?.tenderedKHR || (isKHR ? state.payableTotal : 0),
          totalReceivedUSD: tenderData?.totalReceivedUSD || (isKHR ? state.payableTotal / defaultRate : state.payableTotal),
          totalReceivedKHR: tenderData?.totalReceivedKHR || (isKHR ? state.payableTotal : state.payableTotal * defaultRate),
          changeTotalUSD: tenderData?.changeTotalUSD || 0,
          changeTotalKHR: tenderData?.changeTotalKHR || 0,
          changeBreakdownUSD: tenderData?.changeBreakdownUSD || 0,
          changeBreakdownKHR: tenderData?.changeBreakdownKHR || 0,
          currency: currency,
          exchangeRate: defaultRate,
          isBaseKHR: isKHR,
          receiptPayload: receiptPayload,
        });
      }
    } catch (error) {
      setIsSubmittingPayment(false);
      const message = error?.response?.data?.message || t('pos.something_went_wrong');
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  };

  // Duplicate Cart Item (Speed action)
  const handleDuplicateCartItem = (index) => {
    const itemToDuplicate = cartItems[index];
    if (!itemToDuplicate) return;
    const newItem = { ...itemToDuplicate };
    setState(prev => ({
      ...prev,
      cartItems: [...prev.cartItems, newItem]
    }));
    playTapSound();
    toast.success(t('pos.item_duplicated', 'Item duplicated'));
  };

  // Save Inline Notes without modal
  const handleSaveInlineNote = (index, noteText) => {
    const updated = [...cartItems];
    if (updated[index]) {
      updated[index] = {
        ...updated[index],
        notes: noteText?.trim() || null
      };
      setState(prev => ({ ...prev, cartItems: updated }));
      playTapSound();
    }
    setEditingNoteIndex(null);
  };

  // 1-Tap Direct Send to Kitchen (No blocking popup, instant dispatch & auto table prompt)
  const handleDirectSendToKitchen = async () => {
    if (!cartItems || cartItems.length === 0) {
      toast.error(t('pos.empty_cart'));
      return;
    }

    const deliveryType = diningOptionRef.current?.value || selectedDiningOption || "dinein";
    const tableId = tableRef.current?.value;

    // Smart Table Prompt: if dine-in and no table selected, open Table Picker
    if (deliveryType === "dinein" && !tableId) {
      toast(t('pos.select_table_to_send', 'Please select a table to send order to kitchen'), {
        icon: '',
        duration: 3500,
      });
      setIsTablePickerOpen(true);
      return;
    }

    try {
      setIsSendingToKitchen(true);
      playTapSound();

      const customerType = state.customerType;
      const customer = state.customer;

      const summary = calculateOrderSummary();
      const res = await createOrder(cartItems, deliveryType, customerType, customer, tableId, state.selectedQrOrderItem, summary.appliedPromotions, summary.promotionDiscountTotal);

      if (res.status === 200) {
        const data = res.data;

        if (dualScreenRoomId && isSocketConnected) {
          socket.emit("order_success_backend", {
            roomId: dualScreenRoomId,
            tokenNo: data.tokenNo,
            orderId: data.orderId,
            payableTotal: summary.payableTotal,
          });
        }

        const is_enable_print = printSettings?.is_enable_print || 0;
        const paymentType = paymentTypes.find((v) => v.id == state.selectedPaymentType);
        let paymentMethodText = paymentType ? paymentType.title : (t('orders.unpaid', 'Unpaid') || 'Pay Later');

        const receiptPayload = {
          cartItems,
          deliveryType,
          customerType,
          customer,
          tableId,
          currency,
          storeSettings,
          printSettings,
          itemsTotal: summary.itemsTotal,
          discountType: state.discountType,
          discountValue: state.discountValue,
          discountAmount: summary.discountAmount,
          appliedPromotions: summary.appliedPromotions,
          promotionDiscountTotal: summary.promotionDiscountTotal,
          taxTotal: summary.taxTotal,
          serviceChargeTotal: summary.serviceChargeTotal,
          payableTotal: summary.payableTotal,
          tokenNo: data.tokenNo,
          orderId: data.orderId,
          paymentMethod: paymentMethodText,
          paymentStatus: "unpaid",
          billingMode: "postpaid",
          billingTag: "PAY LATER (POSTPAID)",
        };

        setDetailsForReceiptPrint(receiptPayload);
        sendNewOrderEvent(data.tokenNo, data.orderId);

        let newQROrderItemCount = state.qrOrdersCount;
        let newQROrders = [];
        if (state.selectedQrOrderItem) {
          newQROrderItemCount -= 1;
          newQROrders = state?.qrOrders?.filter((item) => item.id != state.selectedQrOrderItem);
        }

        const tableLabel = currentSelectedTable?.table_title || activeTableContext?.tableTitle || "";

        if (diningOptionRef.current) diningOptionRef.current.value = "";
        if (tableRef.current) tableRef.current.value = "";
        setSelectedTableTitle("");
        setActiveTableContext(null);

        setState((prev) => ({
          ...prev,
          cartItems: [],
          customer: null,
          customerType: "WALKIN",
          tokenNo: data.tokenNo,
          orderId: data.orderId,
          selectedQrOrderItem: null,
          qrOrders: newQROrders,
          qrOrdersCount: newQROrderItemCount,
          discountType: "fixed",
          discountValue: 0,
          discountAmount: 0,
        }));

        playTapSound();
        _initPOS();

        // Background auto print if enabled
        if (is_enable_print) {
          triggerPrintReceipt(receiptPayload);
        }

        // Sleek non-blocking success notification with fast Print KOT shortcut
        toast.success(
          (tObj) => (
            <div className="flex items-center justify-between gap-3 min-w-[240px]">
              <div className="flex items-center gap-2">

                <span className="font-bold text-xs">
                  {t('pos.order_sent_to_kitchen', 'Sent to Kitchen')} #{data.tokenNo}
                  {tableLabel ? ` (Table ${tableLabel})` : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(tObj.id);
                  triggerPrintToken(receiptPayload);
                }}
                className="px-2 py-1 bg-white dark:bg-zinc-800 text-restro-green text-[11px] font-extrabold rounded-md border border-restro-green/40 hover:bg-restro-green hover:text-white transition active:scale-95 shadow-2xs cursor-pointer"
              >
                {t('pos.print_token', 'Print KOT')}
              </button>
            </div>
          ),
          { duration: 4500 }
        );
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('pos.something_went_wrong');
      console.error(error);
      toast.dismiss();
      toast.error(message);
    } finally {
      setIsSendingToKitchen(false);
    }
  };

  const btnShowSendToKitchenModal = () => {
    handleDirectSendToKitchen();
  };

  const btnSendToKitchen = async () => {
    handleDirectSendToKitchen();
  };
  const btnPrintTokenOnly = () => {
    const details = getDetailsForReceiptPrint();
    if (details) {
      triggerPrintToken(details);
    }
  };
  // send to kitchen modal

  const setCustomer = (customerObj) => {
    if (customerObj) {
      const phone = customerObj.phone || customerObj.value || "";
      const rawName = customerObj.name || customerObj.label || "";
      const cleanName =
        phone && rawName.endsWith(` - (${phone})`)
          ? rawName.slice(0, -` - (${phone})`.length).trim()
          : rawName;

      const normalizedCustomer = {
        phone,
        name: cleanName || phone,
        email: customerObj.email || null,
        birth_date: customerObj.birth_date || null,
        gender: customerObj.gender || null,
        label: `${cleanName || phone} - (${phone})`,
        value: phone,
      };

      setState(prev => ({
        ...prev,
        customer: normalizedCustomer,
        customerType: "CUSTOMER"
      }));
      playTapSound();
      document.getElementById("modal-search-customer")?.close();
      closeCustomerModalSync();
    } else {
      btnClearSearchCustomer();
    }
  };

  const searchCustomersAsync = async (inputValue) => {
    try {
      if(inputValue) {
        const resp = await searchCustomer(inputValue);
        if(resp.status == 200) {
          return resp.data.map((data)=>( {label: `${data.name} - (${data.phone})`, value: data.phone} ));
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
  // search customer modal

  const cartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const liveCartSummary = calculateOrderSummary();

  const currentSelectedTable = storeTables.find(t => String(t.id) === String(tableRef.current?.value));

  return (
    <Page className='px-2 sm:px-3 pt-2 pb-2.5 flex flex-col min-h-0 h-full flex-1 overflow-hidden select-none'>
      {/* Hidden legacy select elements to preserve 100% backend, print, and ref compatibility */}
      <select ref={diningOptionRef} className="hidden" value={selectedDiningOption} onChange={() => broadcastOrderMeta()}>
        <option value="">{t('pos.select_dining_option')}</option>
        <option value="dinein">{t('pos.dinein')}</option>
        <option value="delivery">{t('pos.delivery')}</option>
        <option value="takeaway">{t('pos.takeaway')}</option>
      </select>

      <select ref={tableRef} className="hidden" onChange={() => broadcastOrderMeta()}>
        <option value="">{t('pos.select_table')}</option>
        {storeTables.map((table, index) => (
          <option value={table.id} key={index}>
            {table.table_title} ({table.seating_capacity} {t('pos.person')}) - {table.floor}
          </option>
        ))}
      </select>

      {/* Persistent Unified Order Context Header Bar */}
      <POSOrderHeader
        isNavCollapsed={isNavCollapsed}
        onToggleNav={onToggleNav}
        selectedDiningOption={selectedDiningOption}
        onSelectDiningOption={handleSelectDiningOption}
        currentSelectedTable={currentSelectedTable}
        onOpenTablePicker={() => setIsTablePickerOpen(true)}
        guestCount={guestCount}
        onUpdateGuestCount={setGuestCount}
        customer={customer}
        customerType={customerType}
        onOpenCustomerSearch={btnOpenSearchCustomerModal}
        onClearCustomer={btnClearSearchCustomer}
        user={user}
        searchQuery={searchQuery}
        onSearchChange={(query) => setState(prev => ({ ...prev, searchQuery: query }))}
        searchInputRef={searchInputRef}
        draftsCount={drafts?.length || 0}
        onOpenDrafts={btnOpenDraftsModal}
        qrOrdersCount={state.qrOrdersCount || 0}
        onOpenQrOrders={btnShowQROrdersModal}
        onDualScreenClick={handleDualScreenClick}
        onInitNewOrder={btnInitNewOrder}
      />

      {/* Main Split Layout: Catalog (Left) + Cart Sidebar (Right) - Fluid Edge-to-Edge Tablet Height */}
      <div className='mt-2 flex-1 min-h-0 h-full flex flex-col md:flex-row gap-2.5 sm:gap-3 overflow-hidden'>

        {/* Catalog Panel (70%) */}
        <div className="h-full md:w-[68%] lg:w-[70%] flex flex-col overflow-hidden border rounded-xl border-[#E3E5E8] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          {/* Sub-bar: Full-Width Category Rail + View Switcher */}
          <div className="bg-white dark:bg-slate-900 flex items-center justify-between gap-2 sticky top-0 w-full z-10 px-3 sm:px-4 py-2 border-b border-[#E3E5E8] dark:border-slate-800">
            {/* QBO Style Category horizontal pill bar with counts */}
            <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 touch-pan-x custom-scroll-div-horizon-smooth">
              <button
                type="button"
                className={`flex-shrink-0 min-w-fit min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold transition active:scale-95 flex items-center gap-2 border touch-manipulation select-none cursor-pointer ${
                  selectedCategory === "all" 
                    ? 'bg-[#0D233A] text-white border-[#0D233A] shadow-2xs font-bold' 
                    : 'bg-[#F4F5F8] hover:bg-[#E8EAED] dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border-[#D4D7DC] dark:border-slate-700'
                }`}
                onClick={() => {
                  setState({
                    ...state,
                    selectedCategory: 'all'
                  });
                }}
              >
                <span>{t('pos.all')}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  selectedCategory === "all" ? 'bg-white/20 text-white' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700'
                }`}>
                  {categoryCounts.all || 0}
                </span>
              </button>

              {categories.filter((category) => category.is_enabled).map((category, index) => {
                const count = categoryCounts[category.id] || 0;
                const isSelected = selectedCategory === category.id;
                return (
                  <button
                    key={index}
                    type="button"
                    className={`flex-shrink-0 min-w-fit min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold transition active:scale-95 flex items-center gap-2 border touch-manipulation select-none cursor-pointer ${
                      isSelected 
                        ? 'bg-[#0D233A] text-white border-[#0D233A] shadow-2xs font-bold' 
                        : 'bg-[#F4F5F8] hover:bg-[#E8EAED] dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border-[#D4D7DC] dark:border-slate-700'
                    }`}
                    onClick={() => {
                      setState({
                        ...state,
                        selectedCategory: category.id
                      });
                    }}
                  >
                    <span>{category.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* View Switcher Button (Compact vs Detailed Grid) */}
            <div className="flex items-center shrink-0 pl-1.5 border-l border-[#E3E5E8] dark:border-slate-800">
              <button
                type="button"
                className={clsx(
                  "min-h-[38px] min-w-[38px] p-2 rounded-lg border flex items-center justify-center transition active:scale-95 touch-manipulation cursor-pointer",
                  state.view === "compact" 
                    ? "text-[#0D233A] dark:text-white bg-[#F4F5F8] dark:bg-slate-800 border-[#0D233A] dark:border-slate-600" 
                    : "text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-900 border-[#D4D7DC] dark:border-slate-700 hover:bg-[#F4F5F8]"
                )}
                title={state.view === "compact" ? t('pos.compact_view', 'Compact View') : t('pos.detailed_view', 'Detailed View')}
                onClick={() => {
                  const newView = state.view === 'detailed' ? 'compact' : 'detailed';
                  setState((prev) => ({
                    ...prev,
                    view: newView
                  }));
                  sessionStorage.setItem('view', newView);
                }}
              >
                <IconLayout2 size={18} stroke={iconStroke} />
              </button>
            </div>
          </div>

          {/* Menu Catalog Grid / List */}
          <div className='flex-1 h-full overflow-hidden pt-2'>
            {state.view === 'detailed' ? (
              <POSMenuItemDetailedView
                menuItems={menuItems}
                selectedCategory={selectedCategory}
                categories={categories}
                searchQuery={searchQuery}
                currency={currency}
                btnOpenVariantAndAddonModal={btnOpenVariantAndAddonModal}
                addItemToCart={addItemToCart}
                onMinusItem={handleMinusItemByMenuId}
                cartItems={cartItems}
                onItemHover={handleItemHover}
                onScroll={handleMenuScroll}
              />
            ) : (
              <POSMenuItemCompactView
                menuItems={menuItems}
                selectedCategory={selectedCategory}
                categories={categories}
                searchQuery={searchQuery}
                currency={currency}
                btnOpenVariantAndAddonModal={btnOpenVariantAndAddonModal}
                addItemToCart={addItemToCart}
                onMinusItem={handleMinusItemByMenuId}
                cartItems={cartItems}
                onItemHover={handleItemHover}
                onScroll={handleMenuScroll}
              />
            )}
          </div>
        </div>

        {/* Mobile floating "view cart" bar */}
        {cartItemsCount > 0 && !isMobileCartOpen && (
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="md:hidden fixed bottom-20 inset-x-4 z-30 flex items-center justify-between gap-2 rounded-xl px-4 py-3 text-white bg-[#2CA01C] hover:bg-[#248417] shadow-xl transition active:scale-95 border border-white/20"
          >
            <span className="flex items-center gap-2.5">
              <span className="relative flex items-center justify-center">
                <IconShoppingCart size={22} stroke={iconStroke} />
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[#2CA01C] text-[10px] font-bold flex items-center justify-center shadow">
                  {cartItemsCount}
                </span>
              </span>
              <span className="font-bold text-base">{currency}{liveCartSummary.payableTotal.toFixed(2)}</span>
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold">
              {t('pos.view')} {t('pos.cart')} <IconChevronUp size={18} stroke={iconStroke} />
            </span>
          </button>
        )}

        {/* Mobile backdrop */}
        {isMobileCartOpen && (
          <button
            type="button"
            aria-label={t('pos.close')}
            onClick={() => setIsMobileCartOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
          />
        )}

        {/* Cart & Order Sidebar (30%) */}
        <div className={clsx(
          "flex flex-col border-[#E3E5E8] dark:border-slate-800 bg-white dark:bg-slate-900",
          "fixed inset-x-0 bottom-0 z-50 max-h-[88vh] rounded-t-3xl shadow-[0_24px_60px_rgba(15,23,42,0.25)] dark:shadow-none dark:max-md:border dark:max-md:border-b-0 transition-transform duration-300 ease-out",
          isMobileCartOpen ? "translate-y-0" : "translate-y-full",
          "md:static md:z-auto md:h-full md:w-[32%] lg:w-[30%] md:max-h-none md:rounded-xl md:border md:shadow-2xs md:translate-y-0 md:transition-none md:relative overflow-hidden"
        )}>
          {/* Mobile sheet drag handle */}
          <div className="md:hidden flex flex-col items-center flex-shrink-0 pt-2 pb-1">
            <div className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            <div className="w-full flex items-center justify-between px-4 pt-1">
              <h3 className="font-bold text-base">{t('pos.cart')} ({cartItemsCount})</h3>
              <button onClick={() => setIsMobileCartOpen(false)} className="text-red-600 p-1.5 rounded-full bg-[#F4F5F8] hover:bg-gray-200">
                <IconX size={18} stroke={iconStroke} />
              </button>
            </div>
          </div>

          {/* QBO Style Ticket Header Bar */}
          <div className="w-full px-3.5 py-2.5 border-b border-[#E3E5E8] dark:border-slate-800 flex items-center justify-between bg-[#F4F5F8] dark:bg-slate-800/80 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-slate-100 flex items-center gap-1.5 shrink-0">
                <IconReceipt size={16} className="text-[#008489]" stroke={iconStroke} />
                <span>{t('pos.order_ticket', 'Order Ticket')}</span>
              </span>
              <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#0D233A] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {cartItemsCount}
              </span>
              {isPrepaidOnly && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-in fade-in select-none whitespace-nowrap shrink-0">
                  {t('pos.prepaid_badge', 'Prepaid Mode')}
                </span>
              )}
              {isPostpaidOnly && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 animate-in fade-in select-none whitespace-nowrap shrink-0">
                  {t('pos.postpaid_badge', 'Postpaid Mode')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Consolidate Duplicate Lines (only shown if identical separate lines exist) */}
              {hasDuplicateLines && (
                <button 
                  type="button"
                  onClick={handleConsolidateCartLines}
                  className="h-8 w-8 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition active:scale-95 flex items-center justify-center cursor-pointer animate-in fade-in"
                  title={t('pos.merge_lines_tooltip', 'Merge duplicate item lines into single rows')}
                  aria-label={t('pos.merge_lines', 'Merge duplicate lines')}
                >
                  <IconLayersIntersect size={15} stroke={iconStroke} />
                </button>
              )}

              {/* Add to Same Line Toggle */}
              <button 
                type="button"
                onClick={toggleAddSameLine}
                className={clsx(
                  "h-8 px-2 rounded-full border transition active:scale-95 flex items-center gap-1.5 cursor-pointer",
                  isAddSameLine 
                    ? "bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 border-[#D4D7DC] dark:border-slate-700 shadow-2xs" 
                    : "bg-transparent text-gray-500 hover:text-gray-800 border-gray-200 dark:border-slate-700"
                )}
                title={isAddSameLine ? t('pos.add_same_line_enabled_tooltip', 'Same Line: ON (identical items combine quantity)') : t('pos.add_same_line_disabled_tooltip', 'Same Line: OFF (creates separate line for each tap)')}
                aria-label={isAddSameLine ? t('pos.add_same_line_enabled_tooltip', 'Same Line: ON') : t('pos.add_same_line_disabled_tooltip', 'Same Line: OFF')}
              >
                <IconLayersIntersect size={15} stroke={iconStroke} className={isAddSameLine ? "text-[#008489]" : "text-gray-400"} />
                <span className={clsx(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  isAddSameLine ? "bg-[#2CA01C]" : "bg-gray-300 dark:bg-gray-600"
                )} />
              </button>

              {cartItemsCount > 0 && (
                <button 
                  type="button"
                  onClick={btnClearCart}
                  className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10 transition active:scale-95 flex items-center justify-center cursor-pointer"
                  title={t('pos.clear_all', 'Clear ticket')}
                  aria-label={t('pos.clear_all', 'Clear ticket')}
                >
                  <IconTrash size={16} stroke={iconStroke} />
                </button>
              )}
            </div>
          </div>

          {/* Seated Table Context Banner (if active) */}
          {activeTableContext && (
            <div className="px-3.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold min-w-0">
                <IconArmchair size={15} className="shrink-0 text-amber-600" />
                <span className="truncate">
                  {t("pos.adding_to_table", "Adding to")} {activeTableContext.tableTitle}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-amber-200/80 dark:bg-amber-900/60 font-mono text-[10px] shrink-0">
                  #{activeTableContext.tokenNo}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTableContext(null)}
                className="text-amber-500 hover:text-amber-700 dark:hover:text-white p-0.5"
              >
                <IconX size={14} />
              </button>
            </div>
          )}

          {/* Editing QR Order Context Banner (if loaded from QR Orders Drawer) */}
          {state.selectedQrOrderItem && (
            <div className="px-3.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-800/50 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-bold min-w-0">
                <IconQrcode size={15} className="shrink-0 text-[#E11D48] dark:text-rose-400" />
                <span className="truncate">
                  {t("pos.editing_qr_order", "Editing QR Order")}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-rose-200/80 dark:bg-rose-900/60 font-mono text-[10px] shrink-0">
                  #{state.selectedQrOrderItem}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, selectedQrOrderItem: null }))}
                title={t("pos.unlink_qr_order", "Detach from QR Order")}
                className="text-rose-500 hover:text-rose-700 dark:hover:text-white p-0.5 cursor-pointer"
              >
                <IconX size={14} />
              </button>
            </div>
          )}

          {/* Attached Customer Context Banner OR Delivery Customer Prompt */}
          {customerType === "CUSTOMER" && customer ? (
            <div
              onClick={btnOpenSearchCustomerModal}
              className="px-3.5 py-2 bg-[#00A699]/10 dark:bg-[#00A699]/15 border-b border-[#00A699]/30 flex items-center justify-between gap-2 text-xs shrink-0 cursor-pointer hover:bg-[#00A699]/15 transition select-none"
              title={t('pos.view_customer_insights', 'Tap to view customer loyalty & favorites')}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-[#00A699] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                  {(customer.name || customer.phone || 'C').trim().slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="font-bold text-gray-900 dark:text-white truncate">
                    {customer.name}
                  </span>
                  {customer.phone && (
                    <span className="px-1.5 py-0.2 rounded bg-white/80 dark:bg-slate-900/70 text-[#00A699] font-mono text-[10px] font-bold border border-[#00A699]/20 shrink-0">
                      {customer.phone}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-bold text-[#00A699] hover:underline hidden sm:inline">
                  {t('pos.change', 'Profile')}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    btnClearSearchCustomer();
                  }}
                  className="w-5 h-5 rounded-full hover:bg-red-500/15 text-gray-400 hover:text-red-500 flex items-center justify-center transition"
                  title={t('pos.reset_walkin', 'Reset to Walk-in')}
                >
                  <IconX size={13} stroke={2.5} />
                </button>
              </div>
            </div>
          ) : selectedDiningOption === "delivery" ? (
            <button
              type="button"
              onClick={btnOpenSearchCustomerModal}
              className="w-full px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/70 border-b border-amber-200 dark:border-amber-800/50 flex items-center justify-between text-xs shrink-0 transition cursor-pointer text-left"
            >
              <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold truncate">
                <IconUser size={15} className="shrink-0 text-[#EA580C]" />
                <span className="truncate">
                  {t('pos.delivery_customer_prompt', 'Delivery Order — Tap to attach customer')}
                </span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#EA580C] text-white text-[10px] font-bold shrink-0">
                + {t('pos.assign', 'Assign')}
              </span>
            </button>
          ) : null}

          {/* Cart Items List Area */}
          <div onScroll={handleCartScroll} className='flex-1 flex flex-col gap-2 overflow-y-auto px-3 py-2.5 scrollbar-thin'>
            {cartItems?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4 opacity-80">
                <div className="w-14 h-14 rounded-full bg-[#F4F5F8] dark:bg-slate-800 border border-[#E3E5E8] dark:border-slate-700 flex items-center justify-center text-gray-400 mb-3">
                  <IconShoppingCart size={24} stroke={1.6} />
                </div>
                <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{t('pos.empty_cart_title', 'Ticket is empty')}</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
                  {t('pos.empty_cart_hint', 'Tap menu items to add them to this order ticket')}
                </p>
              </div>
            ) : (
              <>
                {cartItems.map((cartItem, i) => {
                  const { id, quantity, notes, title, price, variant, addons } = cartItem;
                  const itemTotal = price * quantity;
                  const itemDiscount = liveCartSummary.itemDiscounts?.[id] || 0;
                  const isEditingThisNote = editingNoteIndex === i;

                  return (
                    <div 
                      key={i} 
                      className="text-xs rounded-xl p-2.5 border border-[#E3E5E8] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition hover:border-gray-300 select-none"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 dark:text-slate-100 truncate text-[13px] leading-tight">
                            <span className="text-gray-400 text-xs font-normal mr-1">#{i + 1}</span>
                            {title}
                          </p>

                          {/* Variant & Addons Tag Chips */}
                          {(variant || (addons && addons.length > 0)) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {variant && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F4F5F8] dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-[#E3E5E8] dark:border-slate-700">
                                  {variant.title}
                                </span>
                              )}
                              {addons?.map((addon, aIdx) => (
                                <span key={aIdx} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F4F5F8] dark:bg-slate-800 text-[#008489] dark:text-emerald-400 border border-[#E3E5E8] dark:border-slate-700">
                                  +{addon.title}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Item-level promotion discount badge */}
                          {itemDiscount > 0 && (
                            <div className="mt-1 flex items-center gap-1">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 shadow-2xs">
                                <IconTag size={11} />
                                Deal: -{currency}{Number(itemDiscount).toFixed(2)}
                              </span>
                            </div>
                          )}

                          {/* Existing notes indicator */}
                          {notes && !isEditingThisNote && (
                            <div 
                              onClick={() => {
                                setEditingNoteIndex(i);
                                setInlineNoteText(notes || '');
                              }}
                              className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg cursor-pointer hover:bg-amber-500/25 transition"
                              title="Click to edit notes"
                            >
                              <IconNote size={12} className="shrink-0 text-amber-600" />
                              <span className="truncate">{notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Line Total & Unit Price */}
                        <div className="text-right shrink-0">
                          {itemDiscount > 0 ? (
                            <>
                              <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                                {currency}{Math.max(0, itemTotal - itemDiscount).toFixed(2)}
                              </p>
                              <p className="text-[10px] text-gray-400 line-through font-mono">
                                {currency}{itemTotal.toFixed(2)}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-black text-gray-900 dark:text-white text-sm font-mono">{currency}{itemTotal.toFixed(2)}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{currency}{Number(price).toFixed(2)} ea</p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Inline Note Editor Box */}
                      {isEditingThisNote && (
                        <div className="mt-2 p-2 rounded-xl bg-[#F4F5F8] dark:bg-slate-800 border border-[#E3E5E8] dark:border-slate-700 space-y-1.5 animate-in fade-in duration-150">
                          <div className="flex flex-wrap gap-1">
                            {["No onions", "Less spicy", "No ice", "Extra sauce", "Allergy alert"].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setInlineNoteText(prev => prev ? `${prev}, ${preset}` : preset)}
                                className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-gray-50 font-semibold text-gray-600 cursor-pointer"
                              >
                                +{preset}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              autoFocus
                              value={inlineNoteText}
                              onChange={(e) => setInlineNoteText(e.target.value)}
                              placeholder="Kitchen instructions..."
                              className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white outline-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveInlineNote(i, inlineNoteText);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveInlineNote(i, inlineNoteText)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#2CA01C] text-white text-xs font-bold hover:bg-[#248417] active:scale-95 cursor-pointer"
                              title="Save note"
                            >
                              <IconCheck size={14} stroke={3} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNoteIndex(null)}
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-900 text-gray-400 hover:text-gray-700 cursor-pointer"
                              title="Cancel"
                            >
                              <IconX size={14} stroke={iconStroke} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Steppers & Line Actions */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                        {/* Stepper: clean borderless and backgroundless icons */}
                        <div className="flex items-center gap-0.5 select-none">
                          <button
                            type="button"
                            onClick={() => minusCartItemQuantity(i, quantity)}
                            className="min-w-[32px] min-h-[32px] flex items-center justify-center text-gray-700 dark:text-slate-200 hover:text-red-500 active:scale-90 transition cursor-pointer touch-manipulation"
                            title="Decrease"
                          >
                            <IconMinus size={20} stroke={2.5} />
                          </button>
                          <span className="min-w-[26px] text-center font-bold text-xs sm:text-sm text-gray-900 dark:text-white font-mono">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => addCartItemQuantity(i, quantity)}
                            className="min-w-[32px] min-h-[32px] flex items-center justify-center text-gray-700 dark:text-slate-200 hover:text-[#2CA01C] dark:hover:text-[#2CA01C] active:scale-90 transition cursor-pointer touch-manipulation"
                            title="Increase"
                          >
                            <IconPlus size={20} stroke={2.5} />
                          </button>
                        </div>

                        {/* Note toggle, Duplicate, and Delete actions */}
                        <div className="flex items-center gap-1.5 select-none">
                          {/* Note Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditingThisNote) {
                                setEditingNoteIndex(null);
                              } else {
                                setEditingNoteIndex(i);
                                setInlineNoteText(notes || '');
                              }
                            }}
                            title={t('pos.add_notes', 'Note')}
                            className={clsx(
                              "min-w-[34px] min-h-[34px] rounded-lg transition text-xs flex items-center justify-center border cursor-pointer touch-manipulation active:scale-90",
                              notes 
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400 font-bold" 
                                : "bg-[#F4F5F8] dark:bg-slate-800 border-[#E3E5E8] dark:border-slate-700 text-gray-500 hover:text-gray-800"
                            )}
                          >
                            <IconNote size={15} stroke={iconStroke} />
                          </button>

                          {/* Duplicate Item Button */}
                          <button
                            type="button"
                            onClick={() => handleDuplicateCartItem(i)}
                            title={t('pos.duplicate', 'Duplicate item')}
                            className="min-w-[34px] min-h-[34px] rounded-lg bg-[#F4F5F8] dark:bg-slate-800 border border-[#E3E5E8] dark:border-slate-700 text-gray-500 hover:text-gray-800 flex items-center justify-center transition active:scale-90 cursor-pointer touch-manipulation"
                          >
                            <IconCopy size={15} stroke={iconStroke} />
                          </button>

                          {/* Remove Item Button */}
                          <button
                            type="button"
                            onClick={() => removeItemFromCart(i)}
                            title={t('pos.remove_item', 'Remove')}
                            className="min-w-[34px] min-h-[34px] rounded-lg bg-[#F4F5F8] dark:bg-slate-800 border border-[#E3E5E8] dark:border-slate-700 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition active:scale-90 cursor-pointer touch-manipulation"
                          >
                            <IconTrash size={15} stroke={iconStroke} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Persistent Live Financial Calculation Tray & Actions */}
          <div className="flex-shrink-0 w-full p-3.5 border-t border-[#E3E5E8] dark:border-slate-800 bg-[#F4F5F8]/70 dark:bg-slate-800/50 space-y-2.5">
            {/* Quick Upsell Encouragement Pill */}
            {(() => {
              const rawSub = liveCartSummary.rawSubtotal || liveCartSummary.itemsTotal || 0;
              const nextDeal = (liveCartSummary.eligiblePromotions || []).find((p) => {
                const minS = Number(p.min_order_amount) || 0;
                return minS > 0 && rawSub < minS && (minS - rawSub) <= 20;
              });
              if (!nextDeal) return null;
              const needed = Number(nextDeal.min_order_amount) - rawSub;
              return (
                <button
                  type="button"
                  onClick={() => setIsPromotionDrawerOpen(true)}
                  className="w-full p-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-300 dark:border-amber-700/60 text-left flex items-center justify-between text-xs transition active:scale-98 cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <IconFlame size={16} className="text-orange-500 animate-pulse shrink-0" />
                    <span className="text-gray-800 dark:text-gray-200">
                      Add <strong className="text-amber-600 dark:text-amber-400 font-mono font-black">{currency}{needed.toFixed(2)}</strong> more for <strong>{nextDeal.title}</strong>!
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 underline shrink-0">
                    View
                  </span>
                </button>
              );
            })()}

            {/* Live Financial Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-gray-500">
                <span>{t('pos.items_net_total', 'Subtotal')}</span>
                <span className="font-medium text-gray-800 dark:text-slate-100">{currency}{liveCartSummary.itemsTotal.toFixed(2)}</span>
              </div>

              {/* Discount line with quick toggle */}
              <div className="flex items-center justify-between text-gray-500">
                <div className="flex items-center gap-1">
                  <span>{t('pos.discount_total', 'Discount')}</span>
                  <button
                    type="button"
                    onClick={() => setIsDiscountDrawerOpen(!isDiscountDrawerOpen)}
                    className="text-[10px] text-[#0077C5] hover:underline font-semibold"
                  >
                    ({liveCartSummary.discountAmount > 0 ? `${currency}${liveCartSummary.discountAmount.toFixed(2)} applied` : '+ add'})
                  </button>
                </div>
                <span className={liveCartSummary.discountAmount > 0 ? "font-semibold text-[#2CA01C]" : "text-gray-400"}>
                  {liveCartSummary.discountAmount > 0 ? `-${currency}${liveCartSummary.discountAmount.toFixed(2)}` : `${currency}0.00`}
                </span>
              </div>

              {/* Promotions Touch-Friendly Row */}
              <button
                type="button"
                onClick={() => setIsPromotionDrawerOpen(true)}
                className={`w-full min-h-[42px] px-2.5 py-1.5 rounded-xl border flex items-center justify-between transition active:scale-98 cursor-pointer ${
                  (liveCartSummary.promotionDiscountTotal || 0) > 0
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 shadow-2xs"
                    : "bg-white dark:bg-slate-900 border-[#E3E5E8] dark:border-slate-700/80 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    (liveCartSummary.promotionDiscountTotal || 0) > 0
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400"
                  }`}>
                    {(liveCartSummary.promotionDiscountTotal || 0) > 0 ? (
                      <IconSparkles size={16} />
                    ) : (
                      <IconTag size={15} />
                    )}
                  </span>
                  <div className="text-left">
                    <span className="text-xs font-bold block leading-tight">
                      {t('pos.promotions', 'Promotions & Coupons')}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block leading-tight">
                      {(liveCartSummary.promotionDiscountTotal || 0) > 0
                        ? `${liveCartSummary.appliedPromotions?.length || 0} deal(s) active on cart`
                        : '+ Tap to enter voucher code'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  {(liveCartSummary.promotionDiscountTotal || 0) > 0 ? (
                    <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                      -{currency}{liveCartSummary.promotionDiscountTotal.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-gray-400">
                      {currency}0.00
                    </span>
                  )}
                </div>
              </button>

              {/* Inline Discount Adjuster */}
              {isDiscountDrawerOpen && (
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-[#D4D7DC] dark:border-slate-700 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-1">
                    <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-slate-700 p-0.5 bg-[#F4F5F8] dark:bg-slate-800 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDiscountChange('fixed', state.discountValue)}
                        className={clsx(
                          "px-2 py-0.5 text-[10px] font-semibold rounded transition",
                          state.discountType === 'fixed' ? "bg-[#0D233A] text-white" : "text-gray-500"
                        )}
                      >
                        Fixed
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDiscountChange('percentage', state.discountValue)}
                        className={clsx(
                          "px-2 py-0.5 text-[10px] font-semibold rounded transition",
                          state.discountType === 'percentage' ? "bg-[#0D233A] text-white" : "text-gray-500"
                        )}
                      >
                        %
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Amount"
                      value={state.discountValue || ''}
                      onChange={(e) => handleDiscountChange(state.discountType, e.target.value)}
                      className="flex-1 text-xs rounded-md px-2 py-1 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none"
                    />
                    {state.discountValue > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDiscountChange(state.discountType, 0)}
                        className="text-[10px] text-gray-400 hover:text-red-500 px-1 flex items-center"
                      >
                        <IconX size={12} stroke={iconStroke} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-gray-500">
                <span>{t('pos.tax_total', 'Taxes')}</span>
                <span className="font-medium text-gray-800 dark:text-slate-100">+{currency}{liveCartSummary.taxTotal.toFixed(2)}</span>
              </div>

              {state.serviceCharge && (
                <div className="flex items-center justify-between text-gray-500">
                  <span>{t('pos.service_charge_total', 'Service Charge')}</span>
                  <span className="font-medium text-gray-800 dark:text-slate-100">+{currency}{liveCartSummary.serviceChargeTotal.toFixed(2)}</span>
                </div>
              )}

              {/* Total Payable Prominent Highlight */}
              <div className="flex items-baseline justify-between pt-1.5 border-t border-[#E3E5E8] dark:border-slate-700">
                <span className="text-sm font-bold text-gray-900 dark:text-white">{t('pos.payable_total')}</span>
                <span className="text-xl font-extrabold text-[#2CA01C] tracking-tight">
                  {currency}{liveCartSummary.payableTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Action Buttons: Unified Single Row for High Tablet Efficiency */}
            <div className="flex items-center gap-2 pt-1 w-full">
              {/* 1. Hold Draft Button (Instant 1-Tap) */}
              <button 
                type="button"
                onClick={handleQuickHoldDraft} 
                disabled={cartItemsCount === 0}
                title={t('pos.draft', 'Hold Draft')}
                className={clsx(
                  "min-h-[46px] px-3 rounded-lg border flex items-center justify-center gap-1.5 transition active:scale-95 shadow-2xs touch-manipulation select-none shrink-0",
                  cartItemsCount === 0 
                    ? "opacity-50 cursor-not-allowed bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-400" 
                    : "bg-white dark:bg-slate-900 border-[#D4D7DC] dark:border-slate-700 hover:bg-gray-50 text-gray-800 dark:text-slate-200 cursor-pointer"
                )}
              >
                <IconDeviceFloppy size={16} stroke={iconStroke} /> 
                <span className="text-xs font-bold hidden xs:inline">{t('pos.draft', 'Draft')}</span>
              </button>

              {/* 2. Send to Kitchen Button (Hidden in Prepaid Only mode) */}
              {!isPrepaidOnly && (
                <button 
                  type="button"
                  onClick={handleDirectSendToKitchen} 
                  disabled={cartItemsCount === 0 || isSendingToKitchen || isSubmittingPayment}
                  className={clsx(
                    "flex-1 min-h-[46px] px-3 rounded-lg border flex items-center justify-between gap-1 transition active:scale-95 shadow-2xs touch-manipulation cursor-pointer select-none min-w-0",
                    cartItemsCount === 0 || isSendingToKitchen || isSubmittingPayment
                      ? "opacity-50 cursor-not-allowed bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-400" 
                      : "bg-[#0D233A] border-[#0D233A] hover:opacity-95 text-white"
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {isSendingToKitchen ? (
                      <IconLoader2 size={16} className="animate-spin text-white shrink-0" />
                    ) : (
                      <IconChefHat size={16} stroke={iconStroke} className="shrink-0" />
                    )}
                    <span className="text-xs font-bold truncate">
                      {isSendingToKitchen ? t('pos.sending', 'Sending...') : t('pos.kitchen', 'Kitchen')}
                    </span>
                    {isPostpaidOnly && (
                      <span className="text-[10px] font-semibold opacity-75 hidden sm:inline">
                        {t('pos.postpaid_parenthesis', '(Postpaid)')}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-1 py-0.5 rounded bg-white/15 text-white/80 shrink-0 hidden sm:inline">
                    F8
                  </span>
                </button>
              )}

              {/* 3. Pay & Settle Button (Hidden in Postpaid Only mode) */}
              {!isPostpaidOnly && (
                <button 
                  type="button"
                  onClick={btnShowPayAndSendToKitchenModal} 
                  disabled={cartItemsCount === 0 || isSubmittingPayment}
                  className={clsx(
                    isPrepaidOnly ? "flex-1" : "flex-[1.5] sm:flex-[1.6]",
                    "min-h-[46px] px-3.5 rounded-lg font-bold text-xs sm:text-sm text-white flex items-center justify-between gap-1 transition active:scale-[0.98] shadow-sm touch-manipulation cursor-pointer select-none min-w-0",
                    cartItemsCount === 0 || isSubmittingPayment
                      ? "opacity-50 cursor-not-allowed bg-gray-400" 
                      : "bg-[#2CA01C] hover:bg-[#248417]"
                  )}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <IconCash size={17} stroke={iconStroke} className="shrink-0" />
                    <span className="truncate">{t('pos.pay', 'Pay')}</span>
                    {isPrepaidOnly && (
                      <span className="text-[10px] font-semibold opacity-90 hidden sm:inline">
                        (Prepaid)
                      </span>
                    )}
                    <span className="text-[10px] font-mono font-bold px-1 py-0.2 rounded bg-white/20 text-white shrink-0 hidden sm:inline">
                      F4
                    </span>
                  </div>
                  <span className="font-mono text-xs sm:text-sm font-extrabold shrink-0 bg-white/20 px-2 py-0.5 rounded ml-1 tracking-tight">
                    {currency}{liveCartSummary.payableTotal.toFixed(2)}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tactile Bottom-Sheet / Drawer for Item Variants & Addons */}
      <POSModifierDrawer
        isOpen={isModifierDrawerOpen}
        onClose={() => {
          setIsModifierDrawerOpen(false);
          closeVariantModalSync();
        }}
        item={activeCustomizingItem}
        currency={currency}
        onAddToCart={handleAddConfiguredItemToCart}
        canPrepareMenuItem={canPrepareMenuItem}
        broadcastVariantSelection={broadcastModifierDrawerSelection}
      />

      {/* Slide-Over Payment Drawer with Built-in Touch Numpad & Quick Cash */}
      <POSPaymentDrawer
        isOpen={isPaymentDrawerOpen}
        onClose={() => {
          setIsPaymentDrawerOpen(false);
          closePaymentModalSync();
        }}
        paymentTypes={paymentTypes}
        selectedPaymentType={state.selectedPaymentType}
        onSelectPaymentType={(newType) => {
          setState(prev => ({ ...prev, selectedPaymentType: newType }));
          broadcastPaymentSelection(newType);
        }}
        payableTotal={liveCartSummary.payableTotal}
        itemsTotal={liveCartSummary.itemsTotal}
        taxTotal={liveCartSummary.taxTotal}
        serviceChargeTotal={liveCartSummary.serviceChargeTotal}
        discountAmount={liveCartSummary.discountAmount}
        promotionDiscountTotal={liveCartSummary.promotionDiscountTotal}
        appliedPromotions={liveCartSummary.appliedPromotions}
        discountType={state.discountType}
        discountValue={state.discountValue}
        onDiscountChange={handleDiscountChange}
        currency={currency}
        exchangeRateUsdToKhr={customExchangeRate || state.storeSettings?.exchange_rate_usd_to_khr || state.storeSettings?.exchangeRateUsdToKhr || 4100}
        onUpdateExchangeRate={(newRate) => setCustomExchangeRate(newRate)}
        tenderedAmount={tenderedAmount}
        onTenderedAmountChange={setTenderedAmount}
        onPayAndComplete={btnPayAndSendToKitchen}
        isProcessing={isSubmittingPayment}
        cartItems={cartItems}
        customer={customer}
        customerType={customerType}
        diningOption={selectedDiningOption}
        tableTitle={selectedTableTitle || (tableRef.current?.value ? storeTables?.find(t => String(t.id) === String(tableRef.current.value))?.table_title : '')}
        onOpenSplitBill={handleOpenSplitFromPOS}
      />

      {/* Advanced Bill Splitting Drawer */}
      <POSSplitBillDrawer
        isOpen={isSplitDrawerOpen}
        onClose={() => {
          setIsSplitDrawerOpen(false);
          setSplitBillOrder(null);
        }}
        order={splitBillOrder}
        currency={currency}
        paymentTypes={paymentTypes}
        onPaymentComplete={(settleResult) => {
          if (settleResult?.isFullyCompleted) {
            clearCart();
            setIsSplitDrawerOpen(false);
            setSplitBillOrder(null);
          }
        }}
        onPrintSubReceipt={handlePrintSubReceiptFromPOS}
      />

      {/* High-Impact Payment Success & Change Due Modal */}
      <POSPaymentSuccessModal
        isOpen={!!completedPaymentInfo}
        onClose={() => {
          setCompletedPaymentInfo(null);
          playTapSound();
        }}
        paymentInfo={completedPaymentInfo}
        onPrintReceipt={(payload) => triggerPrintReceipt(payload || detailsForReceiptPrint)}
        onPrintToken={(payload) => triggerPrintToken(payload || detailsForReceiptPrint)}
      />

      {/* Slide-Over Drafts Drawer */}
      <POSDraftsDrawer
        isOpen={isDraftsDrawerOpen}
        onClose={() => setIsDraftsDrawerOpen(false)}
        drafts={drafts}
        onRestoreDraft={btnSelectDraftItemToCart}
        onDeleteDraft={btnDeleteDraftItem}
        onClearAllDrafts={btnClearDrafts}
        currency={currency}
        exchangeRateUsdToKhr={customExchangeRate || state.storeSettings?.exchange_rate_usd_to_khr || state.storeSettings?.exchangeRateUsdToKhr || 4100}
        activeCartItemsCount={cartItems?.length || 0}
        onHoldCurrentAndRestore={handleHoldCurrentAndRestore}
      />

      {/* Slide-Over Promotions & Coupons Drawer */}
      <POSPromotionDrawer
        isOpen={isPromotionDrawerOpen}
        onClose={() => setIsPromotionDrawerOpen(false)}
        promotions={activePromotionsList}
        enteredCouponCode={enteredCouponCode}
        onApplyCouponCode={(code) => {
          setEnteredCouponCode(code);
          toast.success(`Coupon "${code}" applied to cart`);
        }}
        onRemoveCouponCode={() => {
          setEnteredCouponCode("");
          toast.success("Coupon code removed");
        }}
        appliedPromotions={liveCartSummary.appliedPromotions || []}
        eligiblePromotions={liveCartSummary.eligiblePromotions || []}
        totalPromotionDiscount={liveCartSummary.promotionDiscountTotal || 0}
        rawSubtotal={liveCartSummary.rawSubtotal || liveCartSummary.itemsTotal || 0}
        currency={currency}
        exchangeRateUsdToKhr={customExchangeRate || state.storeSettings?.exchange_rate_usd_to_khr || 4100}
      />

      {/* Slide-Over Customer & Loyalty Drawer */}
      <POSCustomerDrawer
        isOpen={isCustomerDrawerOpen}
        onClose={closeCustomerModalSync}
        selectedCustomer={customer}
        customerType={customerType}
        onSelectCustomer={(cust) => setCustomer(cust)}
        onClearCustomer={btnClearSearchCustomer}
        currency={currency}
        menuItems={menuItems}
        onQuickAddMenuItem={(favItem) => {
          const hasVariantsOrAddons =
            (favItem.variants && favItem.variants.length > 0) ||
            (favItem.addons && favItem.addons.length > 0);
          if (hasVariantsOrAddons) {
            closeCustomerModalSync();
            btnOpenVariantAndAddonModal(favItem.id);
          } else {
            addItemToCart({
              ...favItem,
              price: parseFloat(favItem.price),
              variant_id: null,
              variant: null,
              addons_ids: [],
              addons: [],
            });
            toast.success(`${t('pos.added', 'Added')}: ${favItem.title}`);
          }
        }}
      />

      {/* dialog: notes */}
      <dialog id="modal-notes" className="modal modal-bottom sm:modal-middle">
        <div className = "modal-box border border-restro-border-green dark:rounded-2xl">
          <div className='flex justify-between items-center'>
            <h3 className="font-bold text-lg">{t('pos.add_notes')}</h3>
            <button className = "text-restro-red p-2 rounded-full bg-restro-gray hover:bg-restro-button-hover" onClick={() => document.getElementById('modal-notes').close()}><IconX size={18} stroke={iconStroke}/></button>
          </div>

          <div className="my-4">
            <input type="hidden" ref={dialogNotesIndexRef} />
            <label htmlFor="dialogNotesText" className="mb-1 block text-gray-500 text-sm">{t('pos.notes')} <span className="text-xs text-gray-500">({t('pos.100_max_characters')})</span></label>
            <input ref={dialogNotesTextRef} type="text" name="dialogNotesText" id='dialogNotesText' className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green' placeholder={t('pos.notes_placeholder')}/>
          </div>

          <div className="modal-action">
            <form method="dialog" className='w-full'>
              {/* if there is a button in form, it will close the modal */}
              <button onClick={()=>{btnAddNotes();}} className='rounded-xl transition active:scale-95 hover:shadow-lg w-full px-4 py-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t('pos.save')}</button>
            </form>
          </div>
        </div>
      </dialog>
      {/* dialog: notes */}

      {/* dialog: category selection */}
      <dialog id="modal-categories" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg">{t('pos.filters')}</h3>

          <div className="my-4">
            <label htmlFor="select_category" className='mb-1 text-sm w-full border rounded-lg px-2 py-2 block text-gray-500'>{t('pos.select_category')}</label>
            <select ref={categoryFilterDropdownRef} type="text" name="select_category" id='select_category' className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green' placeholder={t('pos.select_category')} >
              <option value="all">{t('pos.all')}</option>
              {
                categories.filter((category) => category.is_enabled).map((category, index)=><option value={category.id} key={index}>{category.title}</option>)
              }
            </select>
          </div>

          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button onClick={()=>{btnClearSelectedCategory()}} className="rounded-lg hover:bg-gray-200 transition active:scale-95 hover:shadow-lg px-4 py-3 bg-gray-200 text-gray-500">{t('pos.close')}</button>
              <button onClick={()=>{btnApplyCategoryFilter();}} className="rounded-lg hover:bg-green-800 transition active:scale-95 hover:shadow-lg px-4 py-3 bg-restro-green text-white ml-3">{t('pos.apply')}</button>
            </form>
          </div>
        </div>
      </dialog>
      {/* dialog: category selection */}

      {/* dialog: variants & addons */}
      <dialog id="modal-variants-addons" className="modal modal-bottom sm:modal-middle" onClose={() => closeVariantModalSync()}>
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <div className='flex justify-between items-center'>
            <h3 className="font-bold text-lg">{t('pos.select_variant_addons')}</h3>
            <button className='text-red-500 p-2 rounded-full bg-restro-button-hover' onClick={() => { closeVariantModalSync(); document.getElementById('modal-variants-addons').close(); }}><IconX size={18} stroke={iconStroke}/></button>
          </div>
          <div className="my-8 flex gap-2">
            <div className="flex-1">
              <h3>{t('pos.variants')}</h3>
              <div className="flex flex-col gap-2 mt-2">
              {
                menuItems.find((item)=>item.id==selectedItemId)?.variants?.map((variant, index)=>{
                  const {id, item_id, title, price} = variant;

                  const fullItem = state.menuItems.find(item => item.id == selectedItemId);

                  const variantRecipeItems = fullItem.recipeItems?.filter(
                    r => r.variant_id === id && r.addon_id === 0
                  );

                  const isLowStock = variantRecipeItems?.some(
                    (r) => parseFloat(r.current_quantity) <= parseFloat(r.min_quantity_threshold)
                  );

                  const quantitiesPossible = variantRecipeItems?.map(r => {
                    const currentQty = parseFloat(r.current_quantity || "0");
                    const requiredQty = parseFloat(r.recipe_quantity || "1");
                    return Math.floor(currentQty / requiredQty);
                  });

                  const minItemsCanBeMade = quantitiesPossible?.length > 0
                    ? Math.min(...quantitiesPossible)
                    : null;

                  return (
                  <label key={index} className='cursor-pointer label justify-start gap-2'>
                    <input type="radio" className='radio' name="variants" id="" value={id} defaultChecked={index==0} onChange={() => broadcastVariantSelection()} />
                    <div>
                    <span className="label-text">{title} - {currency}{price}</span>
                    {isLowStock && (
                        <div className="mt-1 bg-yellow-100 text-yellow-800 text-[10px] font-medium px-1 py-[1px] z-10 w-full flex flex-col items-center gap-[2px] rounded-md">
                          <div className="flex items-center gap-1">
                            <IconAlertTriangleFilled size={12} />
                            <span>{t('inventory.low_stock')} - {minItemsCanBeMade} {t('inventory.qty')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                )})
              }
              </div>
            </div>
            <div className="flex-1">
              <h3>{t('pos.addons')}</h3>
              <div className="flex flex-col gap-2 mt-2">
              {
                state.menuItems.find((item)=>item.id==selectedItemId)?.addons?.map((addon, index)=>{
                  const {id, item_id, title, price} = addon;

                  const fullItem = menuItems.find(item => item.id == selectedItemId);

                  const addonRecipeItems = fullItem.recipeItems?.filter(
                    (r) => r.addon_id === id && r.variant_id === 0
                  );

                  const quantitiesPossible = addonRecipeItems?.map(r => {
                    const currentQty = parseFloat(r.current_quantity || "0");
                    const requiredQty = parseFloat(r.recipe_quantity || "1");
                    return Math.floor(currentQty / requiredQty);
                  });

                  const minItemsCanBeMade = quantitiesPossible?.length > 0
                    ? Math.min(...quantitiesPossible)
                    : null;

                  const isLowStock = addonRecipeItems?.some(
                    (r) => parseFloat(r.current_quantity) <= parseFloat(r.min_quantity_threshold)
                  );

                  return (
                  <label key={index} className='cursor-pointer label justify-start gap-2'>
                    <input type="checkbox" name="addons" id="" className='checkbox  checkbox-sm' value={id} onChange={() => broadcastVariantSelection()} />
                    <div>
                    <span className="label-text">{title} (+{currency}{price})</span>
                    {isLowStock && (
                      <div className="mt-1 bg-yellow-100 text-yellow-800 text-[10px] font-medium px-1 py-[1px] z-10 w-full flex flex-col items-center gap-[2px] rounded-md">
                        <div className="flex items-center gap-1">
                          <IconAlertTriangleFilled size={12} />
                          <span>{t('inventory.low_stock')} - {minItemsCanBeMade} {t('inventory.qty')}</span>
                        </div>
                      </div>
                    )}
                    </div>
                  </label>
                )})
              }
              </div>
            </div>
          </div>

          <div className="modal-action">
            <form method="dialog" className="w-full flex gap-2">
              {/* if there is a button in form, it will close the modal */}
              <button onClick={()=>{btnAddMenuItemToCartWithVariantsAndAddon()}} className='transition active:scale-95 hover:shadow-lg w-full px-4 py-3 text-white rounded-xl border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t('pos.add')}</button>
            </form>
          </div>
        </div>
      </dialog>
      {/* dialog: variants & addons */}

      {/* dialog: save draft (deprecated in favor of 1-tap direct hold) */}

      {/* dialog: drafts list (replaced by Slide-Over POSDraftsDrawer) */}
      {/* dialog: drafts list */}

      <DialogAddCustomer defaultValue={state.addCustomerDefaultValue} onSuccess={(phone, name)=>{
        setCustomer({value: phone, label: `${name} - (${phone})`})
        document.getElementById("modal-search-customer").close();
      }} />

      {/* dialog: search customer */}
      <dialog id="modal-search-customer" className="modal modal-bottom sm:modal-middle">
      <div className='modal-box border border-restro-border-green dark:rounded-2xl h-96'>
          <div className="flex items-center justify-between">

            <h3 className="font-bold text-lg">{t('pos.search_customer')}</h3>
            <form method="dialog">
              <button onClick={btnClearSearchCustomer} className='btn btn-circle btn-sm text-restro-text border-none bg-restro-gray hover:bg-restro-button-hover'><IconRotate size={18} stroke={iconStroke}/></button>
              <button className='ml-2 btn btn-circle btn-sm text-red-500 border-none bg-restro-gray hover:bg-restro-button-hover'><IconX size={18} stroke={iconStroke}/></button>
            </form>
          </div>

          <div className="my-4 flex items-end gap-2">
            <div className='flex-1'>
              <label htmlFor="searchCustomerRef" className="mb-1 block text-gray-500 text-sm">{t('pos.search_customer')}</label>
              {/* <input ref={searchCustomerRef} type="search" name="searchCustomerRef" id='searchCustomerRef' className="text-sm w-full border rounded-lg px-4 py-2 bg-gray-50 outline-restro-border-green-light" placeholder="Enter Customer Phone here..." /> */}
              <AsyncCreatableSelect
                menuPlacement='auto'
                loadOptions={searchCustomersAsync}
                isClearable
                noOptionsMessage={(v)=>{return t('pos.type_to_find')}}
                onChange={(v)=>{
                  setCustomer(v);
                }}
                onCreateOption={(inputValue)=>{
                  setState({
                    ...state,
                    addCustomerDefaultValue: inputValue,
                  })
                  document.getElementById("modal-add-customer").showModal();
                }}
                styles={{
                  control: (base) => ({
                    ...base,
                    backgroundColor: theme === "black" ? "" : "",
                    borderRadius: "0.5rem",
                    borderColor: theme === "black" ? "#232323" : "#f3f4f6",
                    height: 40,
                    boxShadow: "none",
                    color: theme === "black" ? "#ffffff" : "#111827", // text color
                    "&:hover": {
                      borderColor: theme === "black" ? "#23233" : "#9ca3af",
                    },
                  }),
                  menu: (base) => ({
                    ...base,
                    borderRadius: "0.5rem",
                  }),
                  menuList: (base) => ({
                    ...base,
                    maxHeight: 150,
                    overflowY: "auto",
                    borderRadius: "0.5rem",
                    backgroundColor: theme === "black" ? "#232323" : "white",
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused
                      ? theme === "black"
                        ? "#292929"
                        : "#e5e7eb"
                      : theme === "black"
                        ? "#232323"
                        : "white",
                    color: theme === "black" ? "#f9fafb" : "#111827",
                    "&:active": {
                      backgroundColor: theme === "black" ? "#6b7280" : "#d1d5db",
                    },
                  }),
                  indicatorSeparator: (base) => ({
                    ...base,
                    backgroundColor: theme === "black" ? "#ffffff" : "#d1d5db", // divider color based on theme
                  }),
                }}
              />
            </div>
          </div>
        </div>
      </dialog>
      {/* dialog: search customer */}

      {/* dialog: send to kitchen summary (deprecated in favor of 1-tap direct send) */}

      {/* dialog: collect payment & send to kitchen summary */}
      <dialog id="modal-pay-and-send-kitchen-summary" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl max-h-[88vh] overflow-y-auto scrollbar-thin'>
          <div className="flex items-center justify-between sticky top-0 bg-background z-10 pb-2 border-b border-restro-border-green/40">
            <h3 className="font-bold text-base md:text-lg text-restro-text">{t('pos.collect_payment_send_order_to_kitchen')}</h3>
            <form method='dialog'>
              <button onClick={closePaymentModalSync} className='text-red-500 p-1.5 rounded-full bg-restro-gray hover:bg-restro-button-hover'>
                <IconX size={18} stroke={iconStroke} />
              </button>
            </form>
          </div>

          <div className="my-4 space-y-3">
            {/* Total Payable Banner Card */}
            <div className="rounded-2xl border border-restro-border-green overflow-hidden bg-restro-gray/60">
              <button
                type="button"
                onClick={() => setIsPaySummaryExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <span className="flex items-center gap-1.5 text-base font-bold text-restro-text">
                  {t('pos.payable_total')}
                  <IconChevronUp size={16} stroke={iconStroke} className={clsx("transition-transform text-gray-400", !isPaySummaryExpanded && "rotate-180")} />
                </span>
                <span className="text-xl font-extrabold text-restro-green">{currency}{state.payableTotal.toFixed(2)}</span>
              </button>

              {isPaySummaryExpanded && (
                <div className="px-4 pb-3 pt-1 space-y-1.5 border-t border-restro-border-green/40 text-xs">
                  {[
                    { label: t('pos.items_net_total'), value: state.itemsTotal },
                    { label: t('pos.discount_total', 'Discount Total'), value: state.discountAmount || 0, prefix: "-" },
                    { label: t('pos.tax_total'), value: state.taxTotal, prefix: "+" },
                    { label: t('pos.service_charge_total'), value: state.serviceChargeTotal, prefix: "+" },
                  ].map(({ label, value, prefix = "" }, index) => (
                    <div key={index} className='flex items-center justify-between text-gray-500'>
                      <p>{label}</p>
                      <p className="font-semibold text-restro-text">{value > 0 ? prefix : ""}{currency}{value.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Method Selector Grid */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-restro-text uppercase tracking-wider block">
                {t('orders.select_payment_method', 'Payment Method')}
              </label>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                {paymentTypes.map((paymentType, i) => {
                  const uniqueId = `icon-${paymentType?.id}`;
                  const isSelected = state?.selectedPaymentType == paymentType?.id;
                  return (
                    <label key={i} className='cursor-pointer'>
                      <input
                        checked={isSelected}
                        onChange={e => {
                          const newSelected = e.target.value;
                          setState({
                            ...state,
                            selectedPaymentType: newSelected,
                          });
                          broadcastPaymentSelection(newSelected);
                        }} 
                        type="radio" 
                        name="payment_type" 
                        id={uniqueId} 
                        value={paymentType?.id} 
                        className='peer hidden' 
                      />
                      <div className={clsx(
                        "border rounded-xl flex items-center justify-center gap-1.5 flex-col px-3 py-2.5 transition relative shadow-xs",
                        isSelected
                          ? "border-restro-green bg-emerald-500/10 text-restro-green font-bold ring-2 ring-restro-green"
                          : "border-restro-border-green hover:bg-restro-button-hover text-restro-text bg-background"
                      )}>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-restro-green text-white flex items-center justify-center shadow">
                            <IconCheck size={10} stroke={3} />
                          </div>
                        )}
                        {paymentType?.icon ? <div className="text-xl">{PAYMENT_ICONS[paymentType?.icon]}</div> : null}
                        <p className='text-xs font-semibold text-center truncate w-full'>{paymentType.title}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Fast Cash Presets & Tendered Amount */}
            <div className="p-3 rounded-2xl border border-restro-border-green bg-restro-gray/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-restro-text uppercase tracking-wider">
                  {t('pos.cash_tendered', 'Cash Tendered')}
                </label>
                {tenderedAmount && (
                  <button 
                    type="button" 
                    onClick={() => setTenderedAmount('')}
                    className="text-[11px] text-gray-400 hover:text-restro-text font-medium"
                  >
                    {t('pos.clear', 'Clear')}
                  </button>
                )}
              </div>

              {/* Quick Cash Presets */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setTenderedAmount(state.payableTotal.toFixed(2))}
                  className={clsx(
                    "px-2.5 py-1 text-xs font-semibold rounded-lg border transition active:scale-95 shadow-xs",
                    parseFloat(tenderedAmount) === state.payableTotal
                      ? "bg-restro-green text-white border-restro-green"
                      : "bg-background border-restro-border-green text-restro-text hover:bg-restro-button-hover"
                  )}
                >
                  Exact ({currency}{state.payableTotal.toFixed(2)})
                </button>
                {[10, 20, 50, 100].map((step) => {
                  const targetVal = Math.ceil((state.payableTotal + 0.01) / step) * step;
                  if (targetVal <= state.payableTotal) return null;
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setTenderedAmount(targetVal.toFixed(2))}
                      className={clsx(
                        "px-2.5 py-1 text-xs font-semibold rounded-lg border transition active:scale-95 shadow-xs",
                        parseFloat(tenderedAmount) === targetVal
                          ? "bg-restro-green text-white border-restro-green"
                          : "bg-background border-restro-border-green text-restro-text hover:bg-restro-button-hover"
                      )}
                    >
                      {currency}{targetVal}
                    </button>
                  );
                })}
              </div>

              {/* Input field + Change calculation */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    {currency}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Enter tendered amount"
                    value={tenderedAmount}
                    onChange={(e) => setTenderedAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-semibold rounded-xl border border-restro-border-green bg-background text-restro-text focus:outline-restro-green"
                  />
                </div>

                {/* Change or remaining indicator */}
                {parseFloat(tenderedAmount) > 0 && (
                  <div className={clsx(
                    "px-3 py-1 rounded-xl border flex flex-col items-end shrink-0 shadow-xs",
                    parseFloat(tenderedAmount) >= state.payableTotal
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-600"
                  )}>
                    <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
                      {parseFloat(tenderedAmount) >= state.payableTotal ? t('pos.change_due', 'Change Due') : t('pos.due', 'Remaining')}
                    </span>
                    <span className="text-sm font-extrabold mt-0.5">
                      {currency}{Math.abs(parseFloat(tenderedAmount) - state.payableTotal).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Apply Discount Control */}
            <div className="p-2.5 rounded-xl border border-restro-border-green bg-restro-gray/40">
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">
                {t('pos.apply_discount', 'Apply Discount')}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-restro-border-green p-0.5 bg-background shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDiscountChange('fixed', state.discountValue)}
                    className={clsx(
                      "px-2.5 py-1 text-xs font-medium rounded-md transition",
                      state.discountType === 'fixed'
                        ? "bg-restro-green text-white font-semibold shadow-xs"
                        : "text-restro-text hover:bg-restro-button-hover"
                    )}
                  >
                    Fixed
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDiscountChange('percentage', state.discountValue)}
                    className={clsx(
                      "px-2.5 py-1 text-xs font-medium rounded-md transition",
                      state.discountType === 'percentage'
                        ? "bg-restro-green text-white font-semibold shadow-xs"
                        : "text-restro-text hover:bg-restro-button-hover"
                    )}
                  >
                    %
                  </button>
                </div>

                <div className="flex-1 relative">
                  <input
                    type="number"
                    min="0"
                    max={state.discountType === 'percentage' ? 100 : state.itemsTotal}
                    step="any"
                    placeholder={state.discountType === 'percentage' ? 'e.g. 10' : 'e.g. 50'}
                    value={state.discountValue || ''}
                    onChange={(e) => handleDiscountChange(state.discountType, e.target.value)}
                    className="w-full text-xs rounded-lg px-3 py-1.5 border border-restro-border-green bg-background focus:outline-restro-green"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div className="modal-action sticky bottom-0 bg-background pt-2 border-t border-restro-border-green/40 w-full">
            <button 
              onClick={() => btnPayAndSendToKitchen()} 
              className='w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-restro-green hover:bg-restro-green-button-hover transition active:scale-[0.98] shadow-md shadow-emerald-600/20 flex items-center justify-between'
            >
              <span className="flex items-center gap-2">
                <IconCash size={18} stroke={iconStroke} />
                <span>{t('pos.collect_payment_send_to_kitchen')}</span>
              </span>
              <span className="bg-white/20 px-2 py-0.5 rounded-lg text-sm font-extrabold">
                {currency}{state.payableTotal.toFixed(2)}
              </span>
            </button>
          </div>
        </div>
      </dialog>
      {/* dialog: collect payment & send to kitchen summary */}

      {/* dialog: print-token */}
      <dialog id="modal-print-token" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg text-center">{t('pos.order_sent_to_kitchen')}</h3>

          <div className="my-8 mx-auto w-fit">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 flex items-center justify-center bg-restro-green text-white rounded-full">
                <IconCheck stroke={iconStroke} size={32} />
              </div>
              <p className="font-bold text-5xl">#{state?.tokenNo}</p>
            </div>

            <p className="text-sm mt-4 text-center">{t('pos.order_id')}: {state?.orderId}</p>
          </div>

          <div className="modal-action justify-center">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 flex-1 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>{t('pos.close')}</button>
              <button onClick={btnPrintTokenOnly}className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t('pos.print_token')}</button>
            </form>
          </div>
        </div>
      </dialog>
      {/* dialog: print-token */}

      {/* Slide-Over QR Menu Orders Drawer */}
      <POSQROrdersDrawer
        isOpen={isQrOrdersDrawerOpen}
        onClose={() => setIsQrOrdersDrawerOpen(false)}
        qrOrders={state.qrOrders || []}
        onApproveOrder={btnApproveQROrder}
        onApproveAllOrders={btnApproveAllQROrders}
        onEditOrderInCart={btnSelectQROrder}
        onRejectOrder={btnCancelQROrder}
        onRejectAllOrders={btnClearQROrders}
        currency={currency}
        exchangeRateUsdToKhr={
          customExchangeRate ||
          state.storeSettings?.exchange_rate_usd_to_khr ||
          state.storeSettings?.exchangeRateUsdToKhr ||
          4100
        }
        activeCartItemsCount={cartItems?.length || 0}
      />
      {/* dialog: dual screen pairing */}
      <dialog id="modal-dual-screen" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box border border-restro-border-green dark:rounded-2xl max-w-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <IconScreenShare size={22} stroke={iconStroke} className="text-restro-green" />
              {t('pos.dual_screen_display', 'Dual Screen Customer Display')}
            </h3>
            <button className="text-restro-red p-2 rounded-full bg-restro-gray hover:bg-restro-button-hover" onClick={() => document.getElementById('modal-dual-screen').close()}>
              <IconX size={18} stroke={iconStroke} />
            </button>
          </div>

          {(() => {
            const dialogState = getDialogState();

            if (dialogState.mode === 'ACTIVE') {
              return (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-restro-green/10 border border-restro-green/30">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-restro-green animate-pulse" />
                      <span className="font-bold text-sm text-restro-text">
                        Active Counter: <span className="text-restro-green font-extrabold">{dialogState.activeCounter}</span>
                      </span>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-restro-green text-white font-semibold shadow-2xs">Paired</span>
                  </div>

                  <p className="text-xs text-gray-500">
                    {t('pos.dual_screen_desc', 'Open this link on a second monitor or tablet facing the customer to display live order items.')}
                  </p>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-restro-gray border border-restro-border-green">
                    <input
                      type="text"
                      readOnly
                      value={dualScreenUrl || dialogState.data?.url || ''}
                      className="w-full bg-transparent text-sm font-mono outline-none px-2 text-restro-text"
                    />
                    <button
                      onClick={() => {
                        const targetUrl = dualScreenUrl || dialogState.data?.url;
                        if (targetUrl) {
                          navigator.clipboard.writeText(targetUrl);
                          toast.success(t('pos.link_copied', 'Link copied to clipboard!'));
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-restro-green text-white hover:bg-restro-green-button-hover transition active:scale-95 flex-shrink-0"
                    >
                      {t('pos.copy', 'Copy')}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-restro-border-green/40">
                    <button
                      onClick={() => handleDeleteCounter(dialogState.activeCounter)}
                      className="px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition flex items-center gap-1.5"
                    >
                      <IconTrash size={16} />
                      {t('pos.reset_counter', 'Delete / Unpair Counter')}
                    </button>

                    <button
                      onClick={() => {
                        const targetUrl = dualScreenUrl || dialogState.data?.url;
                        if (targetUrl) {
                          window.open(targetUrl, '_blank');
                        }
                      }}
                      className="rounded-xl transition active:scale-95 px-4 py-2.5 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover text-sm font-semibold flex items-center gap-2 shadow-sm"
                    >
                      <IconScreenShare size={18} stroke={iconStroke} />
                      {t('pos.open_display', 'Open Display Screen')}
                    </button>
                  </div>
                </div>
              );
            }

            if (dialogState.mode === 'PICKER') {
              return (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-gray-500">
                    {t('pos.picker_desc', 'Select an existing counter to pair this tab, or create a new counter below.')}
                  </p>

                  {/* List of Existing Counters */}
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {Object.entries(dialogState.catalog).map(([counterName, data]) => (
                      <div key={counterName} className="flex items-center justify-between p-3 rounded-xl border border-restro-border-green bg-restro-gray/30">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-restro-text">{counterName}</span>
                          <span className="text-[10px] text-gray-400">Created: {new Date(data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleJoinCounter(counterName)}
                            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-restro-green text-white hover:bg-restro-green-button-hover transition active:scale-95 shadow-2xs"
                          >
                            {t('pos.join', 'Join')}
                          </button>
                          <button
                            onClick={() => handleDeleteCounter(counterName)}
                            className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-lg transition"
                            title="Delete counter"
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Create New Counter Section below Join list */}
                  <div className="pt-3 border-t border-restro-border-green flex flex-col gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('pos.create_new_counter', 'Or Create New Counter')}
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={t('pos.counter_name_placeholder', 'e.g. Counter 2')}
                          value={newCounterInput}
                          onChange={(e) => setNewCounterInput(e.target.value)}
                          className={clsx(
                            "flex-1 px-3.5 py-2 text-sm rounded-xl border bg-background outline-none transition-all",
                            isCounterNameDuplicate(newCounterInput)
                              ? "border-red-500 text-red-600 focus:ring-2 focus:ring-red-500/30"
                              : "border-restro-border-green focus:ring-2 focus:ring-restro-green/40"
                          )}
                        />
                        <button
                          disabled={isCounterNameDuplicate(newCounterInput)}
                          onClick={() => handleCreateCounter()}
                          className={clsx(
                            "px-4 py-2 text-xs font-semibold rounded-xl text-white transition active:scale-95 flex-shrink-0 shadow-2xs",
                            isCounterNameDuplicate(newCounterInput)
                              ? "bg-gray-400 cursor-not-allowed opacity-60"
                              : "bg-restro-green hover:bg-restro-green-button-hover"
                          )}
                        >
                          {t('pos.create_and_pair', 'Create & Pair')}
                        </button>
                      </div>
                      {isCounterNameDuplicate(newCounterInput) && (
                        <p className="text-xs text-red-500 font-semibold px-1">
                          {t('pos.counter_name_exists', 'Counter name already exists!')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Mode 3: FRESH
            const isDuplicateFresh = isCounterNameDuplicate(newCounterInput);
            return (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-gray-500">
                  {t('pos.fresh_desc', 'No dual screen room available. Enter a counter name to pair your Customer Display.')}
                </p>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-500">
                    {t('pos.counter_name', 'Counter Name')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('pos.counter_name_placeholder', 'e.g. Counter 1')}
                    value={newCounterInput}
                    onChange={(e) => setNewCounterInput(e.target.value)}
                    className={clsx(
                      "w-full px-3.5 py-2.5 text-sm rounded-xl border bg-background outline-none transition-all",
                      isDuplicateFresh
                        ? "border-red-500 text-red-600 focus:ring-2 focus:ring-red-500/30"
                        : "border-restro-border-green focus:ring-2 focus:ring-restro-green/40"
                    )}
                  />
                  {isDuplicateFresh && (
                    <p className="text-xs text-red-500 font-semibold px-1">
                      {t('pos.counter_name_exists', 'Counter name already exists!')}
                    </p>
                  )}
                </div>

                <div className="modal-action flex gap-2 justify-end pt-2">
                  <button
                    disabled={isDuplicateFresh}
                    onClick={() => handleCreateCounter()}
                    className={clsx(
                      "rounded-xl transition active:scale-95 px-5 py-2.5 text-white border border-restro-border-green text-sm font-semibold flex items-center gap-2 shadow-sm",
                      isDuplicateFresh
                        ? "bg-gray-400 cursor-not-allowed opacity-60"
                        : "bg-restro-green hover:bg-restro-green-button-hover"
                    )}
                  >
                    <IconScreenShare size={18} stroke={iconStroke} />
                    {t('pos.create_and_pair', 'Create Counter & Pair')}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </dialog>
      {/* dialog: dual screen pairing */}

      <DeleteModal
        isOpen={Boolean(posDeleteModalConfig)}
        onClose={() => setPosDeleteModalConfig(null)}
        onConfirm={posDeleteModalConfig?.onConfirm}
        title={posDeleteModalConfig?.title}
        description={posDeleteModalConfig?.description}
      />

      {/* Visual Table Picker Modal */}
      <TablePickerModal
        isOpen={isTablePickerOpen}
        onClose={() => setIsTablePickerOpen(false)}
        selectedTableId={tableRef.current?.value}
        currency={storeSettings?.currency || currency}
        onSelectTable={(tbl) => {
          if (tableRef.current) {
            tableRef.current.value = tbl.id;
          }
          if (diningOptionRef.current && (!diningOptionRef.current.value || diningOptionRef.current.value !== 'dinein')) {
            diningOptionRef.current.value = 'dinein';
          }
          setSelectedTableTitle(tbl.table_title);
          broadcastOrderMeta && broadcastOrderMeta(undefined, 'dinein', tbl.id);
          toast.success(`${t('tables.selected_table', 'Selected')}: ${tbl.table_title}`);
        }}
      />
    </Page>
  )
}
