import React, { useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next';
import Page from "../components/Page";
import DeleteModal from "../components/DeleteModal";
import { IconPlus, IconNotes, IconArmchair, IconScreenShare, IconSearch, IconDeviceFloppy, IconChefHat, IconCash, IconMinus, IconNote, IconTrash, IconFilter, IconPhoto, IconFilterFilled, IconClipboardList, IconX, IconClearAll, IconPencil, IconCheck, IconCarrot, IconRotate, IconQrcode, IconArmchair2, IconUser, IconCategory, IconGridDots, IconLayoutGrid, IconListDetails, IconListTree, IconMenu4, IconLayoutGridFilled, IconMenu2, IconLayoutList, IconLayout2, IconLayout2Filled, IconAlertTriangleFilled, IconChevronUp, IconShoppingCart } from "@tabler/icons-react";
import { VITE_BACKEND_SOCKET_IO, iconStroke } from "../config/config";
import { cancelAllQROrders, cancelQROrder, createOrder, createOrderAndInvoice, getDrafts, getQROrders, getQROrdersCount, initPOS, setDrafts } from "../controllers/pos.controller";
import { CURRENCIES } from '../config/currencies.config';
import { PAYMENT_ICONS } from "../config/payment_icons";
import { toast } from "react-hot-toast";
import { searchCustomer } from '../controllers/customers.controller';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
import { clsx } from "clsx";
import { useTheme } from '../contexts/ThemeContext';

export default function POSPage() {
  const { t } = useTranslation();
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

  const { categories, menuItems, paymentTypes, printSettings, storeSettings, storeTables, currency, cartItems, searchQuery, selectedCategory, selectedItemId, drafts, customer, customerType, isLoading } = state;

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
  const _initSocket = () => {
    if(isSocketConnected) {
      socket.emit("authenticate", user.tenant_id);
      socket.on('new_qrorder', async (payload)=>{
        try {
          const totalQROrders = await _getQROrdersCount();

          setState((prevState)=>({
            ...prevState,
            qrOrdersCount: totalQROrders || 0
          }))
        } catch (error) {
          console.log(error);
        }
      })
    } else {
      initSocket();
      socket.emit("authenticate", user.tenant_id);
      socket.on('new_qrorder', async (payload)=>{
        try {
          const totalQROrders = await _getQROrdersCount();

          setState((prevState)=>({
            ...prevState,
            qrOrdersCount: totalQROrders || 0
          }))
        } catch (error) {
          console.log(error);
        }
      })
    }
  }

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
    const modifiedItem = {
      ...item,
      quantity: 1,
      notes: null
    }

    if (!canPrepareMenuItem(item, 1)) {
      toast.error(t('inventory.insufficient_stock_message_pos'));
      return;
    }

    if(!cartItems) {
      setState({
        ...state,
        cartItems: [modifiedItem]
      })
      return;
    }
    setState({
      ...state,
      cartItems: [...cartItems, modifiedItem]
    })
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

    resetVariantsAndAddons();

    setState({
      ...state,
      selectedItemId: menuItemId
    });
    document.getElementById('modal-variants-addons').showModal();

    if (dualScreenRoomId && isSocketConnected) {
      const selectedItem = menuItems.find((item) => item.id == menuItemId);
      const defaultVariantId = selectedItem?.variants?.[0]?.id || null;
      socket.emit("variant_modal_open_backend", {
        roomId: dualScreenRoomId,
        selectedItemId: menuItemId,
        selectedVariantId: defaultVariantId,
        selectedAddonIds: [],
      });
    }
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

  // drafts
  const btnOpenSaveDraftModal = () => {
    if(cartItems.length == 0) {
      toast.error(t('pos.empty_cart'));
      return;
    }
    document.getElementById('modal-save-draft').showModal()
  }
  const btnAddtoDrafts = () => {
    const drafts = getDrafts();

    const nameRef = draftTitleRef.current.value || "";
    const date = new Date().toLocaleString();

    const draftItem = {
      nameRef: nameRef,
      date,
      cart: cartItems,
      
    };

    drafts.push(draftItem);

    setDrafts(drafts);
    setState({
      ...state,
      cartItems: []
    })
  };

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
    document.getElementById("modal-drafts").showModal();
  }

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
  const btnSelectDraftItemToCart = draftItem => {
    const {nameRef, date, cart} = draftItem;

    setState({
      ...state,
      cartItems: [...cart]
    });

    document.getElementById("modal-drafts").close();
  };
  // drafts

  // QR Menu Orders
  const btnShowQROrdersModal = async () => {
    try {
      const res = await getQROrders();
      if(res.status == 200) {
        const data = res.data;
        setState({
          ...state,
          qrOrders: [...data]
        })
        document.getElementById("modal-qrorders").showModal();
      }
    } catch (error) {
      console.log(error);
    }
  };

  const btnClearQROrders = async () => {
    setPosDeleteModalConfig({
      title: t('pos.clear_qr_orders', 'Clear All QR Orders'),
      description: t('pos.delete_confirm'),
      onConfirm: async () => {
        setPosDeleteModalConfig(null);
        try {
          toast.loading(t('pos.please_wait'));
          const res = await cancelAllQROrders();
          if(res.status == 200) {
            toast.dismiss();
            toast.success(res.data.message);
            setState((prevState)=>({
              ...prevState, qrOrders: [], qrOrdersCount: 0,
            }));
            playTapSound();
          }
        } catch (error) {
          const message = error?.response?.data?.message || t('pos.getting_issues');
          console.log(error);
          toast.dismiss();
          toast.error(message);
        }
      }
    });
  };
  const btnCancelQROrder = async (orderId) => {
    setPosDeleteModalConfig({
      title: t('pos.cancel_qr_order', 'Cancel QR Order'),
      description: t('pos.delete_confirm'),
      onConfirm: async () => {
        setPosDeleteModalConfig(null);
        try {
          toast.loading(t('pos.please_wait'));
          const res = await cancelQROrder(orderId);
          if(res.status == 200) {
            toast.dismiss();
            toast.success(res.data.message);

            const newQROrders = state.qrOrders.filter((item)=>item.id != orderId);
            setState((prevState)=>({
              ...prevState,
              qrOrders: [...newQROrders],
              qrOrdersCount: newQROrders.length
            }));

            playTapSound();
          }
        } catch (error) {
          const message = error?.response?.data?.message || t('pos.getting_issues');
          console.log(error);
          toast.dismiss();
          toast.error(message);
        }
      }
    });
  };
  const btnSelectQROrder = (qrOrder) => {
    console.log(qrOrder);

    if(qrOrder.table_id) {
      tableRef.current.value = qrOrder.table_id;
    }

    // const itemCart = {...selectedItem, price: price, variant_id: selectedVariantId, variant: selectedVariant, addons_ids: selectedAddonsId, addons: selectedAddons}

    const modifiedCart = qrOrder.items.map((item)=>{
      const id = item.item_id;

      let selectedVariant = {
        id: item.variant_id,
        item_id: id,
        price: item.variant_price,
        title: item.variant_title,
      }

      return {
        ...item,
        id: id,
        title: item.item_title,
        addons_ids: item?.addons?.map((i)=>i.id),
        variant: selectedVariant || null,
        variant_id: item.variant_id || null,
      }
    })

    setState({
      ...state,
      cartItems: modifiedCart,
      selectedQrOrderItem: qrOrder.id,
      customerType: qrOrder.customer_type,
      customer: {phone: qrOrder.customer_id, name: qrOrder.customer_name},
    })
    playTapSound();

    document.getElementById('modal-qrorders').close();
  };
  // QR MEnu Orders

  // search customer modal
  const btnOpenSearchCustomerModal = () => {
    document.getElementById("modal-search-customer").showModal();
    if (dualScreenRoomId && isSocketConnected) {
      socket.emit("customer_modal_open_backend", {
        roomId: dualScreenRoomId,
        customer: customer,
        customerType: customerType,
      });
    }
  };
  const closeCustomerModalSync = () => {
    if (dualScreenRoomId && isSocketConnected) {
      socket.emit("customer_modal_close_backend", { roomId: dualScreenRoomId });
    }
  };
  const btnClearSearchCustomer = () => {
    setState({
      ...state,
      customerType: "WALKIN",
      customer: null
    });
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

    payableTotal = Math.max(0, payableTotal - discountAmount);

    // Calculate Total Service charge % from items total
    if (state.serviceCharge) {
      let serviceCharge = (Number(itemsTotal) * Number(state.serviceCharge)) / 100;
      serviceChargeTotal += serviceCharge;
      payableTotal += serviceCharge;
    }

    return {
      itemsTotal, discountAmount, taxTotal, serviceChargeTotal, payableTotal
    }
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
    // calculate the item - total, tax, incl. tax, excl. tax, tax total, payable total

    if(cartItems?.length == 0) {
      toast.error(t('pos.empty_cart'));
      return;
    }

    const summary = calculateOrderSummary();
    const defaultPayType = state.selectedPaymentType || (paymentTypes?.length > 0 ? paymentTypes[0].id : null);

    setState({
      ...state,
      selectedPaymentType: defaultPayType,
      ...summary
    });
    setTenderedAmount(summary.payableTotal > 0 ? summary.payableTotal.toFixed(2) : '');
    document.getElementById('modal-pay-and-send-kitchen-summary').showModal();
    broadcastPaymentModalOpen(paymentTypes, defaultPayType);
  };
  const btnPayAndSendToKitchen = async () => {
    if(!state.selectedPaymentType) {
      return toast.error(t('orders.select_payment_method'));
    }
    try {
      const deliveryType = diningOptionRef.current.value;
      const tableId = tableRef.current.value;
      const customerType = state.customerType;
      const customer = state.customer;

      toast.loading(t('pos.please_wait'));
      const res = await createOrderAndInvoice(
        cartItems, deliveryType, customerType, customer, tableId,
        state.itemsTotal, state.taxTotal, state.serviceChargeTotal, state.payableTotal,
        state.selectedQrOrderItem, state.selectedPaymentType,
        state.discountType, state.discountValue, state.discountAmount
      );
      toast.dismiss();
      if(res.status == 200) {
        const data = res.data;
        toast.success(res.data.message);
        document.getElementById("modal-pay-and-send-kitchen-summary").close();
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

        setDetailsForReceiptPrint({
          cartItems, deliveryType, customerType, customer, tableId, currency, storeSettings, printSettings,
          itemsTotal: state.itemsTotal,
          discountType: state.discountType,
          discountValue: state.discountValue,
          discountAmount: state.discountAmount,
          taxTotal: state.taxTotal,
          serviceChargeTotal:state.serviceChargeTotal,
          payableTotal: state.payableTotal,
          tokenNo: data.tokenNo,
          orderId: data.orderId,
          paymentMethod: paymentMethodText
        });

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

        _initPOS()

        if(is_enable_print) {
          triggerPrintReceipt({
            cartItems, deliveryType, customerType, customer, tableId, currency, storeSettings, printSettings,
            itemsTotal: state.itemsTotal,
            discountType: state.discountType,
            discountValue: state.discountValue,
            discountAmount: state.discountAmount,
            taxTotal: state.taxTotal,
            serviceChargeTotal:state.serviceChargeTotal,
            payableTotal: state.payableTotal,
            tokenNo: data.tokenNo,
            orderId: data.orderId,
            paymentMethod: paymentMethodText
          });
          return;
        }

        // show print token dialog
        document.getElementById("modal-print-token").showModal();
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('pos.something_went_wrong');
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  };

  const btnShowSendToKitchenModal = () => {
    // calculate the item - total, tax, incl. tax, excl. tax, tax total, payable total

    if(cartItems?.length == 0) {
      toast.error(t('pos.empty_cart'));
      return;
    }

    const summary = calculateOrderSummary();

    setState({
      ...state,
      ...summary
    });
    document.getElementById('modal-send-kitchen-summary').showModal();
  }

  const btnSendToKitchen = async () => {
    try {
      const deliveryType = diningOptionRef.current.value;
      const tableId = tableRef.current.value;
      const customerType = state.customerType;
      const customer = state.customer;

      toast.loading(t('pos.please_wait'));
      const res = await createOrder(cartItems, deliveryType, customerType, customer, tableId, state.selectedQrOrderItem);
      toast.dismiss();
      if(res.status == 200) {
        const data = res.data;
        toast.success(res.data.message);
        document.getElementById("modal-send-kitchen-summary").close();

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

        const paymentType = paymentTypes.find((v) => v.id == state.selectedPaymentType);
        let paymentMethodText = paymentType ? paymentType.title : (t('orders.unpaid', 'Unpaid') || 'Pay Later');

        setDetailsForReceiptPrint({
          cartItems, deliveryType, customerType, customer, tableId, currency, storeSettings, printSettings,
          itemsTotal: state.itemsTotal,
          discountType: state.discountType,
          discountValue: state.discountValue,
          discountAmount: state.discountAmount,
          taxTotal: state.taxTotal,
          serviceChargeTotal:state.serviceChargeTotal,
          payableTotal: state.payableTotal,
          tokenNo: data.tokenNo,
          orderId: data.orderId,
          paymentMethod: paymentMethodText
        });

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
          qrOrdersCount: newQROrderItemCount
        }))

        _initPOS()

        if(is_enable_print) {
          triggerPrintReceipt({
            cartItems, deliveryType, customerType, customer, tableId, currency, storeSettings, printSettings,
            itemsTotal: state.itemsTotal,
            discountType: state.discountType,
            discountValue: state.discountValue,
            discountAmount: state.discountAmount,
            taxTotal: state.taxTotal,
            serviceChargeTotal:state.serviceChargeTotal,
            payableTotal: state.payableTotal,
            tokenNo: data.tokenNo,
            orderId: data.orderId,
            paymentMethod: paymentMethodText
          });
          return;
        }

        // show print token dialog
        const tokenModal = document.getElementById("modal-print-token");
        tokenModal?.showModal();
        setTimeout(() => {
          if (tokenModal?.open) {
            tokenModal.close();
          }
        }, 4000);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('pos.something_went_wrong');
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  };
  const btnPrintTokenOnly = () => {
    const details = getDetailsForReceiptPrint();
    if (details) {
      triggerPrintToken(details);
    }
  };
  // send to kitchen modal


  const setCustomer = (customer) => {

    if(customer) {
      setState({
        ...state,
        customer: {phone: customer.value, name:customer.label},
        customerType: "CUSTOMER"
      })
      document.getElementById("modal-search-customer").close()
      closeCustomerModalSync();
    } else {
      btnClearSearchCustomer();
    }
  }

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
    <Page className='px-4 py-3 flex flex-col min-h-0'>
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

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-base font-bold truncate">{t('pos.title')}</h3>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleDualScreenClick} aria-label={t('pos.dual_screen', 'Dual Screen')} className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-restro-text bg-restro-gray hover:bg-restro-button-hover active:scale-95 transition">
            <IconScreenShare size={18} stroke={iconStroke} />
          </button>
          <button onClick={btnInitNewOrder} aria-label={t('pos.new_order')} className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-white bg-restro-green hover:bg-restro-green-button-hover active:scale-95 transition shadow-sm">
            <IconPlus size={18} stroke={iconStroke} />
          </button>
          <button onClick={btnShowQROrdersModal} aria-label={t('pos.qr_menu_orders')} className="relative w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-restro-text bg-restro-gray hover:bg-restro-button-hover active:scale-95 transition">
            <IconQrcode size={18} stroke={iconStroke} />
            {state.qrOrdersCount > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{state.qrOrdersCount}</span>}
          </button>
          <button onClick={btnOpenDraftsModal} aria-label={t('pos.drafts_list')} className="relative w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-restro-text bg-restro-gray hover:bg-restro-button-hover active:scale-95 transition">
            <IconNotes size={18} stroke={iconStroke} />
            {drafts?.length > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{drafts.length}</span>}
          </button>
          <Link to="/dashboard/orders" aria-label={t('pos.table_orders')} className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-restro-text bg-restro-gray hover:bg-restro-button-hover active:scale-95 transition">
            <IconArmchair size={18} stroke={iconStroke} />
          </Link>
        </div>
      </div>

      {/* Desktop modern unified action bar */}
      <div className="hidden md:flex md:items-center justify-between flex-row gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold tracking-tight text-restro-text">{t('pos.title')}</h2>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Terminal</span>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <button 
            onClick={handleDualScreenClick} 
            className="text-xs font-medium rounded-xl border transition active:scale-95 px-3 py-2 flex items-center gap-1.5 text-restro-text bg-restro-gray border-restro-border-green hover:bg-restro-button-hover shadow-sm"
          >
            <IconScreenShare size={16} stroke={iconStroke} /> 
            <span>{t('pos.dual_screen', 'Dual Screen')}</span>
            {dualScreenRoomId && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
          </button>

          <button 
            onClick={btnShowQROrdersModal}
            className="relative text-xs font-medium rounded-xl border transition active:scale-95 px-3 py-2 flex items-center gap-1.5 text-restro-text bg-restro-gray border-restro-border-green hover:bg-restro-button-hover shadow-sm"
          >
            <IconQrcode size={16} stroke={iconStroke} /> 
            <span>{t('pos.qr_menu_orders')}</span>
            {state.qrOrdersCount > 0 && (
              <span className='min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center'>
                {state.qrOrdersCount}
              </span>
            )}
          </button>

          <button 
            onClick={btnOpenDraftsModal} 
            className="relative text-xs font-medium rounded-xl border transition active:scale-95 px-3 py-2 flex items-center gap-1.5 text-restro-text bg-restro-gray border-restro-border-green hover:bg-restro-button-hover shadow-sm"
          >
            <IconNotes size={16} stroke={iconStroke} /> 
            <span>{t('pos.drafts_list')}</span>
            {drafts?.length > 0 && (
              <span className='min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center'>
                {drafts.length}
              </span>
            )}
          </button>

          <Link 
            to="/dashboard/orders" 
            className="text-xs font-medium rounded-xl border transition active:scale-95 px-3 py-2 flex items-center gap-1.5 text-restro-text bg-restro-gray border-restro-border-green hover:bg-restro-button-hover shadow-sm"
          >
            <IconArmchair size={16} stroke={iconStroke} /> 
            <span>{t('pos.table_orders')}</span>
          </Link>

          <button 
            onClick={btnInitNewOrder} 
            className="text-xs font-semibold rounded-xl transition active:scale-95 px-3.5 py-2 flex items-center gap-1.5 text-white bg-restro-green hover:bg-restro-green-button-hover shadow-sm"
          >
            <IconPlus size={16} stroke={iconStroke} /> 
            <span>{t('pos.new_order')}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Catalog (Left) + Cart Sidebar (Right) */}
      <div className='mt-2.5 h-[calc(100vh-175px)] md:h-[calc(100vh-125px)] flex flex-col md:flex-row gap-3.5'>

        {/* Catalog Panel (70%) */}
        <div className="h-full md:w-[68%] lg:w-[70%] flex flex-col overflow-hidden border rounded-2xl border-restro-border-green bg-background shadow-sm">
          {/* Sub-bar: Category Tabs + Search + View Toggle */}
          <div className="bg-background flex flex-col md:flex-row gap-2.5 md:gap-3 md:items-center justify-between sticky top-0 w-full z-10 px-4 py-2.5 border-b border-restro-border-green">
            {/* Category horizontal pill bar with counts */}
            <div className={clsx(
              "flex overflow-x-auto space-x-1.5 text-sm custom-scroll-wrapper scrollbar scrollbar-none custom-scroll-div-horizon-smooth -mx-2 px-2 md:mx-0 md:px-0 py-0.5",
              isMobileSearchOpen && "max-md:hidden"
            )}>
              <button
                className={`flex-shrink-0 min-w-fit px-3.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 shadow-sm ${
                  selectedCategory === "all" 
                    ? 'bg-restro-green text-white shadow-emerald-500/20' 
                    : theme === 'black' 
                    ? 'bg-restro-bg-seconday-dark-mode text-gray-300 hover:bg-restro-bg-hover-dark-mode' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => {
                  setState({
                    ...state,
                    selectedCategory: 'all'
                  });
                }}
              >
                <span>{t('pos.all')}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedCategory === "all" ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10 text-gray-500'
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
                    className={`flex-shrink-0 min-w-fit px-3.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 shadow-sm ${
                      isSelected 
                        ? 'bg-restro-green text-white shadow-emerald-500/20' 
                        : theme === 'black' 
                        ? 'bg-restro-bg-seconday-dark-mode text-gray-300 hover:bg-restro-bg-hover-dark-mode' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    onClick={() => {
                      setState({
                        ...state,
                        selectedCategory: category.id
                      });
                    }}
                  >
                    <span>{category.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search + View Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Mobile Search */}
              <div className="md:hidden flex items-center gap-2 flex-1 min-w-0">
                {!isMobileSearchOpen ? (
                  <button
                    onClick={() => setIsMobileSearchOpen(true)}
                    aria-label={t('appbar.search_placeholder')}
                    className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center bg-restro-gray border border-restro-border-green text-restro-text active:scale-90 transition"
                  >
                    <IconSearch size={16} stroke={iconStroke} />
                  </button>
                ) : (
                  <label className="flex flex-1 min-w-0 items-center rounded-xl px-3 py-1.5 gap-2 bg-restro-gray border border-restro-green">
                    <IconSearch size={16} stroke={iconStroke} className="flex-shrink-0 text-restro-green" />
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={e => setState({...state, searchQuery: e.target.value})}
                      type="search"
                      placeholder={t('appbar.search_placeholder')}
                      className='w-full min-w-0 bg-transparent text-xs outline-none'
                    />
                    <button
                      onClick={() => {
                        setState({...state, searchQuery: ''});
                        setIsMobileSearchOpen(false);
                      }}
                      aria-label={t('pos.close')}
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-restro-button-hover text-restro-text"
                    >
                      <IconX size={12} stroke={iconStroke} />
                    </button>
                  </label>
                )}
              </div>

              {/* Desktop Search */}
              <label className="hidden md:flex items-center w-52 rounded-xl px-3 py-1.5 gap-2 bg-restro-gray border border-restro-border-green focus-within:border-restro-green transition">
                <IconSearch size={16} stroke={iconStroke} className="flex-shrink-0 text-gray-400" />
                <input 
                  value={searchQuery} 
                  onChange={e => setState({...state, searchQuery: e.target.value})} 
                  type="search" 
                  placeholder={t('appbar.search_placeholder')} 
                  className='w-full min-w-0 bg-transparent text-xs outline-none text-restro-text' 
                />
                {searchQuery && (
                  <button 
                    type="button"
                    onClick={() => setState({...state, searchQuery: ''})}
                    className="text-gray-400 hover:text-restro-text"
                  >
                    <IconX size={14} stroke={iconStroke} />
                  </button>
                )}
              </label>

              {/* View Switcher Button */}
              <button
                className={clsx(
                  "flex-shrink-0 px-2.5 py-1.5 rounded-xl border border-restro-border-green text-xs font-medium flex items-center gap-1 transition active:scale-95",
                  isMobileSearchOpen && "max-md:hidden",
                  state.view === "compact" 
                    ? "text-restro-green bg-emerald-500/10" 
                    : "text-restro-text bg-restro-gray hover:bg-restro-button-hover"
                )}
                title="Toggle Grid / List View"
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
            className="md:hidden fixed bottom-20 inset-x-4 z-30 flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-white bg-restro-green hover:bg-restro-green-button-hover shadow-xl transition active:scale-95 border border-white/20"
          >
            <span className="flex items-center gap-2.5">
              <span className="relative flex items-center justify-center">
                <IconShoppingCart size={22} stroke={iconStroke} />
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-restro-green text-[10px] font-bold flex items-center justify-center shadow">
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
          "flex flex-col border-restro-border-green bg-background",
          "fixed inset-x-0 bottom-0 z-50 max-h-[88vh] rounded-t-3xl shadow-[0_24px_60px_rgba(15,23,42,0.25)] dark:shadow-none dark:max-md:border dark:max-md:border-b-0 transition-transform duration-300 ease-out",
          isMobileCartOpen ? "translate-y-0" : "translate-y-full",
          "md:static md:z-auto md:h-full md:w-[32%] lg:w-[30%] md:max-h-none md:rounded-2xl md:border md:shadow-sm md:translate-y-0 md:transition-none md:relative overflow-hidden"
        )}>
          {/* Mobile sheet drag handle */}
          <div className="md:hidden flex flex-col items-center flex-shrink-0 pt-2 pb-1">
            <div className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            <div className="w-full flex items-center justify-between px-4 pt-1">
              <h3 className="font-bold text-base">{t('pos.cart')} ({cartItemsCount})</h3>
              <button onClick={() => setIsMobileCartOpen(false)} className="text-restro-red p-1.5 rounded-full bg-restro-gray hover:bg-restro-button-hover">
                <IconX size={18} stroke={iconStroke} />
              </button>
            </div>
          </div>

          {/* Cart Header: Customer + Dining Segmented Tabs + Table Chip */}
          <div className="w-full px-3.5 pt-3 pb-2.5 border-b border-restro-border-green space-y-2.5 bg-restro-gray/40">
            {/* Customer Chip / Search Trigger */}
            <div 
              onClick={btnOpenSearchCustomerModal} 
              className="flex items-center justify-between p-2 rounded-xl border border-restro-border-green bg-background hover:bg-restro-button-hover cursor-pointer transition active:scale-[0.99] shadow-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-restro-green/10 text-restro-green flex items-center justify-center shrink-0">
                  <IconUser size={18} stroke={iconStroke} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[11px] text-gray-500 leading-none">{t('pos.customer', 'Customer')}</p>
                  <p className="text-xs font-semibold text-restro-text truncate mt-0.5">
                    {customerType === "WALKIN" ? t('pos.walkin_customer') : `${customer.name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {customerType !== "WALKIN" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      btnClearSearchCustomer();
                    }}
                    title="Reset to Walk-in"
                    className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-restro-red hover:bg-restro-gray"
                  >
                    <IconX size={14} stroke={iconStroke} />
                  </button>
                )}
                <span className="text-[11px] text-restro-green font-medium px-2 py-0.5 rounded-md bg-restro-green/10">
                  {customerType === "WALKIN" ? t('pos.change', 'Change') : t('pos.edit', 'Edit')}
                </span>
              </div>
            </div>

            {/* Segmented Dining Option Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-restro-gray border border-restro-border-green/80">
              {[
                { key: 'dinein', label: t('pos.dinein'), icon: '🍽️' },
                { key: 'takeaway', label: t('pos.takeaway'), icon: '🛍️' },
                { key: 'delivery', label: t('pos.delivery'), icon: '🛵' }
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectDiningOption(key)}
                  className={clsx(
                    "py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1",
                    selectedDiningOption === key
                      ? "bg-restro-green text-white shadow-xs"
                      : "text-restro-text hover:bg-background/80"
                  )}
                >
                  <span>{icon}</span>
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            {/* Table Selector / Floor Plan Launcher (for Dine-in) */}
            {selectedDiningOption === 'dinein' && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <div 
                  onClick={() => setIsTablePickerOpen(true)}
                  className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                >
                  <IconArmchair2 size={18} className="text-restro-green shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider leading-none">
                      {t('pos.table', 'Table')}
                    </p>
                    <p className="text-xs font-semibold text-restro-text truncate mt-0.5">
                      {currentSelectedTable 
                        ? `${currentSelectedTable.table_title} (${currentSelectedTable.seating_capacity} seats) - Floor ${currentSelectedTable.floor}`
                        : t('pos.select_table')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsTablePickerOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition active:scale-95 shrink-0 shadow-xs flex items-center gap-1"
                >
                  <IconArmchair2 size={14} />
                  <span>{currentSelectedTable ? t('pos.change', 'Change') : t('tables.floor_plan', 'Floor Plan')}</span>
                </button>
              </div>
            )}

            {/* Context Banner: Adding items to an existing seated table */}
            {activeTableContext && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold min-w-0">
                  <IconArmchair size={16} className="shrink-0 text-amber-600" />
                  <span className="truncate">
                    {t("pos.adding_to_table", "Adding items to")} {activeTableContext.tableTitle}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/60 font-mono text-[10px] shrink-0">
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
          </div>

          {/* Cart Items List Area */}
          <div onScroll={handleCartScroll} className='flex-1 flex flex-col gap-2.5 overflow-y-auto px-3.5 py-3 scrollbar-thin'>
            {cartItems?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4 opacity-75">
                <div className="w-16 h-16 rounded-full bg-restro-gray border border-restro-border-green flex items-center justify-center text-gray-400 mb-3 shadow-inner">
                  <IconShoppingCart size={28} stroke={1.5} />
                </div>
                <p className="text-sm font-bold text-restro-text">{t('pos.empty_cart_title', 'Order ticket is empty')}</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                  {t('pos.empty_cart_hint', 'Tap items on the menu catalog to build your order')}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {t('pos.order_items', 'Order Items')} ({cartItemsCount})
                  </span>
                  <button 
                    type="button"
                    onClick={btnClearCart}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-600 flex items-center gap-0.5 hover:underline"
                  >
                    <IconTrash size={12} />
                    <span>{t('pos.clear_all', 'Clear')}</span>
                  </button>
                </div>

                {cartItems.map((cartItem, i) => {
                  const { quantity, notes, title, price, variant, addons } = cartItem;
                  const itemTotal = price * quantity;

                  return (
                    <div 
                      key={i} 
                      className="text-xs rounded-xl p-2.5 border border-restro-border-green bg-restro-card-bg shadow-xs transition hover:border-restro-green/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-restro-text truncate text-[13px]">
                            <span className="text-gray-400 text-xs font-normal mr-1">#{i + 1}</span>
                            {title}
                          </p>

                          {/* Variant & Addons Tag Chips */}
                          {(variant || (addons && addons.length > 0)) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {variant && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-restro-gray text-gray-600 dark:text-gray-300">
                                  {variant.title}
                                </span>
                              )}
                              {addons?.map((addon, aIdx) => (
                                <span key={aIdx} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                  +{addon.title}
                                </span>
                              ))}
                            </div>
                          )}

                          {notes && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                              <IconNote size={12} className="shrink-0" />
                              <span className="truncate">{notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Line Total */}
                        <div className="text-right shrink-0">
                          <p className="font-bold text-restro-text text-sm">{currency}{itemTotal.toFixed(2)}</p>
                          <p className="text-[10px] text-gray-400">{currency}{Number(price).toFixed(2)} ea</p>
                        </div>
                      </div>

                      {/* Stepper & Actions */}
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-restro-border-green/60">
                        {/* Stepper */}
                        <div className="flex items-center gap-1.5 rounded-lg bg-restro-gray border border-restro-border-green/80 p-0.5">
                          <button
                            type="button"
                            onClick={() => minusCartItemQuantity(i, quantity)}
                            className="w-6 h-6 rounded-md flex items-center justify-center bg-background hover:bg-restro-button-hover text-restro-text transition active:scale-90"
                          >
                            <IconMinus size={13} stroke={2.5} />
                          </button>
                          <span className="w-5 text-center font-bold text-xs text-restro-text">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => addCartItemQuantity(i, quantity)}
                            className="w-6 h-6 rounded-md flex items-center justify-center bg-background hover:bg-restro-button-hover text-restro-text transition active:scale-90"
                          >
                            <IconPlus size={13} stroke={2.5} />
                          </button>
                        </div>

                        {/* Add note & Delete */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => btnOpenNotesModal(i, notes)}
                            title={t('pos.add_notes')}
                            className={clsx(
                              "p-1.5 rounded-lg transition text-xs flex items-center gap-1 border",
                              notes 
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-600" 
                                : "bg-restro-gray border-restro-border-green text-gray-400 hover:text-restro-text hover:bg-restro-button-hover"
                            )}
                          >
                            <IconNote size={14} stroke={iconStroke} />
                          </button>

                          <button
                            type="button"
                            onClick={() => removeItemFromCart(i)}
                            title={t('pos.remove_item', 'Remove')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-500/20 transition active:scale-90"
                          >
                            <IconTrash size={14} stroke={iconStroke} />
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
          <div className="flex-shrink-0 w-full p-3.5 border-t border-restro-border-green bg-restro-gray/40 backdrop-blur-md space-y-2.5">
            {/* Live Financial Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-gray-500">
                <span>{t('pos.items_net_total', 'Subtotal')}</span>
                <span className="font-medium text-restro-text">{currency}{liveCartSummary.itemsTotal.toFixed(2)}</span>
              </div>

              {/* Discount line with quick toggle */}
              <div className="flex items-center justify-between text-gray-500">
                <div className="flex items-center gap-1">
                  <span>{t('pos.discount_total', 'Discount')}</span>
                  <button
                    type="button"
                    onClick={() => setIsDiscountDrawerOpen(!isDiscountDrawerOpen)}
                    className="text-[10px] text-restro-green hover:underline font-semibold"
                  >
                    ({liveCartSummary.discountAmount > 0 ? `${currency}${liveCartSummary.discountAmount.toFixed(2)} applied` : '+ add'})
                  </button>
                </div>
                <span className={liveCartSummary.discountAmount > 0 ? "font-semibold text-emerald-600" : "text-gray-400"}>
                  {liveCartSummary.discountAmount > 0 ? `-${currency}${liveCartSummary.discountAmount.toFixed(2)}` : `${currency}0.00`}
                </span>
              </div>

              {/* Inline Discount Adjuster */}
              {isDiscountDrawerOpen && (
                <div className="p-2 rounded-xl bg-background border border-restro-border-green space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-1">
                    <div className="flex rounded-lg overflow-hidden border border-restro-border-green p-0.5 bg-restro-gray shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDiscountChange('fixed', state.discountValue)}
                        className={clsx(
                          "px-2 py-0.5 text-[10px] font-semibold rounded transition",
                          state.discountType === 'fixed' ? "bg-restro-green text-white" : "text-gray-500"
                        )}
                      >
                        Fixed
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDiscountChange('percentage', state.discountValue)}
                        className={clsx(
                          "px-2 py-0.5 text-[10px] font-semibold rounded transition",
                          state.discountType === 'percentage' ? "bg-restro-green text-white" : "text-gray-500"
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
                      className="flex-1 text-xs rounded-lg px-2 py-1 border border-restro-border-green bg-background focus:outline-restro-green"
                    />
                    {state.discountValue > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDiscountChange(state.discountType, 0)}
                        className="text-[10px] text-gray-400 hover:text-red-500 px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-gray-500">
                <span>{t('pos.tax_total', 'Taxes')}</span>
                <span className="font-medium text-restro-text">+{currency}{liveCartSummary.taxTotal.toFixed(2)}</span>
              </div>

              {state.serviceCharge && (
                <div className="flex items-center justify-between text-gray-500">
                  <span>{t('pos.service_charge_total', 'Service Charge')}</span>
                  <span className="font-medium text-restro-text">+{currency}{liveCartSummary.serviceChargeTotal.toFixed(2)}</span>
                </div>
              )}

              {/* Total Payable Prominent Highlight */}
              <div className="flex items-baseline justify-between pt-1.5 border-t border-restro-border-green">
                <span className="text-sm font-bold text-restro-text">{t('pos.payable_total')}</span>
                <span className="text-xl font-extrabold text-restro-green tracking-tight">
                  {currency}{liveCartSummary.payableTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={btnOpenSaveDraftModal} 
                  disabled={cartItemsCount === 0}
                  className={clsx(
                    "text-xs font-semibold py-2 px-3 rounded-xl border border-restro-border-green flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs",
                    cartItemsCount === 0 
                      ? "opacity-50 cursor-not-allowed bg-restro-gray text-gray-400" 
                      : "bg-restro-gray hover:bg-restro-button-hover text-restro-text"
                  )}
                >
                  <IconDeviceFloppy size={16} stroke={iconStroke} /> 
                  <span>{t('pos.draft')}</span>
                </button>

                <button 
                  type="button"
                  onClick={btnShowSendToKitchenModal} 
                  disabled={cartItemsCount === 0}
                  className={clsx(
                    "text-xs font-semibold py-2 px-3 rounded-xl border border-restro-border-green flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs",
                    cartItemsCount === 0 
                      ? "opacity-50 cursor-not-allowed bg-restro-gray text-gray-400" 
                      : "bg-restro-gray hover:bg-restro-button-hover text-restro-text"
                  )}
                >
                  <IconChefHat size={16} stroke={iconStroke} /> 
                  <span>{t('pos.send_to_kitchen')}</span>
                </button>
              </div>

              {/* Pay & Settle Full Width Primary Action */}
              <button 
                type="button"
                onClick={btnShowPayAndSendToKitchenModal} 
                disabled={cartItemsCount === 0}
                className={clsx(
                  "w-full py-3 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-between transition active:scale-[0.98] shadow-md",
                  cartItemsCount === 0 
                    ? "opacity-50 cursor-not-allowed bg-gray-400" 
                    : "bg-restro-green hover:bg-restro-green-button-hover shadow-emerald-600/20"
                )}
              >
                <span className="flex items-center gap-2">
                  <IconCash size={20} stroke={iconStroke} />
                  <span>{t('pos.create_receipt_pay')}</span>
                </span>
                <span className="font-extrabold text-base bg-white/20 px-2.5 py-0.5 rounded-lg">
                  {currency}{liveCartSummary.payableTotal.toFixed(2)}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>


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


      {/* dialog: save draft */}
      <dialog id="modal-save-draft" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg">{t('pos.save_cart_items_to_drafts')}</h3>

          <div className="my-4">
            <label htmlFor="draftTitleRef" className="mb-1 block text-gray-500 text-sm">{t('pos.reference')}</label>
            <input ref={draftTitleRef} type="text" name="draftTitleRef" id='draftTitleRef' className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green' placeholder={t('pos.enter_reference_name')} />
          </div>

          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 flex-1 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>{t('pos.close')}</button>
              <button onClick={()=>{btnAddtoDrafts();}} className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t('pos.save')}</button>
            </form>
          </div>
        </div>
      </dialog>
      {/* dialog: save draft */}

      {/* dialog: drafts list */}
      <dialog id="modal-drafts" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box p-0 border border-restro-border-green dark:rounded-2xl'>
          <div className='flex justify-between items-center sticky top-0 backdrop-blur px-6 py-4 bg-restro-gray'>
            <h3 className="font-bold text-lg">{t('pos.drafts')}</h3>
            <form method="dialog" className='flex gap-1'>
              {/* if there is a button in form, it will close the modal */}
              <button onClick={btnClearDrafts} className='transition active:scale-95 text-red-500 p-2 rounded-ful rounded-full w-9 h-9 flex items-center justify-center hover:bg-restro-button-hover'><IconClearAll stroke={iconStroke} /></button>
              <button className='transition active:scale-95 text-restro-text p-2 rounded-ful rounded-full w-9 h-9 flex items-center justify-center hover:bg-restro-button-hover'><IconX stroke={iconStroke} /></button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 pb-6 pt-4">
            {drafts.map((draftItem, index)=>{
              const {nameRef, date, cart} = draftItem;

              return <div key={index} className='flex items-center gap-1 rounded-2xl p-2 border border-restro-border-green'>
                <div className='w-12 h-12 rounded-full flex items-center justify-center text-restro-text bg-restro-bg-gray'>
                  <IconClipboardList stroke={iconStroke} />
                </div>
                <div className='flex-1'>
                  <p>{t('pos.ref')}: {nameRef}</p>
                  <p className='text-xs'>{cart?.length} {t('pos.cart_items')}</p>
                  <p className='text-xs text-gray-500'>{date}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={()=>{btnSelectDraftItemToCart(draftItem)}}  className='rounded-full transition active:scale-95 w-6 h-6 flex items-center justify-center text-restro-text bg-restro-gray hover:bg-restro-button-hover'><IconPencil size={14} stroke={iconStroke} /></button>

                  <button onClick={()=>{btnDeleteDraftItem(index)}} className='rounded-full transition active:scale-95 text-red-500 w-6 h-6 flex items-center justify-center bg-restro-gray hover:bg-restro-button-hover'><IconTrash size={14} stroke={iconStroke} /></button>
                </div>
              </div>
            })}
          </div>


        </div>
      </dialog>
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

      {/* dialog: send to kitchen summary */}
      <dialog id="modal-send-kitchen-summary" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-bold text-lg">{t('pos.send_order_to_kitchen')}</h3>
            <form method='dialog'>
              <button className='text-red-500 p-2 rounded-full bg-restro-gray hover:bg-restro-button-hover'><IconX size={18} stroke={iconStroke} /></button>
            </form>
          </div>

          <div className="my-8 space-y-4 px-1">
            {[
              { label: t('pos.items_net_total'), value: state.itemsTotal },
              { label: t('pos.discount_total', 'Discount Total'), value: state.discountAmount || 0, prefix: "-" },
              { label: t('pos.tax_total'), value: state.taxTotal, prefix: "+" },
              { label: t('pos.service_charge_total'), value: state.serviceChargeTotal, prefix: "+" },
            ].map(({ label, value, prefix = "" }, index) => (
              <div key={index} className='flex items-center justify-between text-restro-text'>
                <p>{label}</p>
                <p className="text-lg">
                  {value > 0 ? prefix : ""}{currency}{value.toFixed(2)}
                </p>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-gray-300 dark:border-restro-bg-gray pt-2 mt-2">
              <p className="text-xl font-medium">{t('pos.payable_total')}</p>
              <p className="text-xl font-bold text-restro-green">
                {currency}{state.payableTotal.toFixed(2)}
              </p>
            </div>
          </div>


          <div className="modal-action">
            <form method="dialog" className="w-full">
              {/* if there is a button in form, it will close the modal */}
              <button onClick={btnSendToKitchen} className='w-full rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>{t('pos.send_to_kitchen')}</button>
            </form>
          </div>
        </div>
      </dialog>
      {/* dialog: send to kitchen summary */}

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

      {/* dialog: qrorders */}
      <dialog id="modal-qrorders" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl p-0'>
          <div className="flex justify-between items-center sticky top-0 px-6 py-4">
            <h3 className="font-bold text-lg">{t('pos.qr_orders')}</h3>
            <form method="dialog" className='flex gap-2'>
              {/* if there is a button in form, it will close the modal */}
              <button onClick={btnClearQROrders} className="rounded-full hover:bg-red-200 transition active:scale-95 bg-red-50 dark:bg-red-500 dark:text-white text-red-500 w-9 h-9 flex items-center justify-center"><IconClearAll stroke={iconStroke} /></button>
              <button className="rounded-full hover:bg-gray-200 dark:hover:bg-black transition active:scale-95 bg-gray-100 dark:bg-restro-gray text-gray-500 dark:text-white w-9 h-9 flex items-center justify-center"><IconX stroke={iconStroke} /></button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 pb-6">
            {state?.qrOrders?.map((qrOrder, index)=>{
              const { customer_type, customer_id, customer_name, table_id, table_title, items, id } = qrOrder;

              return <div key={index} className='flex items-center gap-1 rounded-2xl p-2 border dark:border-restro-gray'>
                <div className='w-12 h-12 rounded-full bg-gray-100 dark:bg-restro-gray dark:text-white text-gray-500 flex items-center justify-center'>
                  <IconClipboardList stroke={iconStroke} />
                </div>
                <div className='flex-1'>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <IconArmchair2 stroke={iconStroke} size={14} />
                    <p className=''>{table_title || "N/A"}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <IconUser stroke={iconStroke} size={14} />
                    <p className=''>{customer_type == "WALKIN" ? "WALKIN" : customer_name}</p>
                  </div>
                  <p className='text-xs'>{items?.length} {t('pos.cart_items')}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={()=>{btnSelectQROrder(qrOrder)}} className='rounded-full transition active:scale-95 w-6 h-6 flex items-center justify-center text-restro-text bg-restro-gray hover:bg-restro-button-hover'><IconPencil size={14} stroke={iconStroke} /></button>

                  <button onClick={()=>{btnCancelQROrder(id)}} className='rounded-full transition active:scale-95 text-red-500 w-6 h-6 flex items-center justify-center bg-restro-gray hover:bg-restro-button-hover'><IconTrash size={14} stroke={iconStroke} /></button>
                </div>
              </div>
            })}
          </div>
        </div>
      </dialog>
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
        currency={currency}
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
