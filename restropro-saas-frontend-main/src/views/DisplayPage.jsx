import React, { useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconShoppingCart, IconAlertCircle, IconCheck, IconLayout2, IconChefHat, IconUser, IconArmchair, IconTruck, IconShoppingBag, IconX, IconClock } from '@tabler/icons-react';
import { iconStroke } from '../config/config';
import { initPOS } from '../controllers/pos.controller';
import { CURRENCIES } from '../config/currencies.config';
import { SocketContext } from '../contexts/SocketContext';
import { useTheme } from '../contexts/ThemeContext';
import POSMenuItemCompactView from '../components/POSMenuItemCompactView';
import { PAYMENT_ICONS } from '../config/payment_icons';
import { getImageURL } from '../helpers/ImageHelper';
import { clsx } from 'clsx';


export default function DisplayPage() {
  const { roomId } = useParams();
  const { t } = useTranslation();
  const { socket, isSocketConnected } = useContext(SocketContext);
  const { theme } = useTheme();

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [storeSettings, setStoreSettings] = useState(null);
  const [currency, setCurrency] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState('compact');
  const [hoveredItemId, setHoveredItemId] = useState(null);
  const [scrollTopRatio, setScrollTopRatio] = useState(0);
  const [cartScrollTopRatio, setCartScrollTopRatio] = useState(0);
  const cartContainerRef = useRef(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [isAuthorized, setIsAuthorized] = useState(null); // null = checking, true = authorized, false = failed
  const [authError, setAuthError] = useState('');
  const [isRoomClosed, setIsRoomClosed] = useState(false);
  const [activeVariantModal, setActiveVariantModal] = useState(null);
  const [activeCustomerModal, setActiveCustomerModal] = useState({ isOpen: false, customer: null, customerType: 'WALKIN' });
  const [paymentModalState, setPaymentModalState] = useState({ isOpen: false, paymentTypes: [], selectedPaymentType: null });
  const [orderSuccessModal, setOrderSuccessModal] = useState({ isOpen: false, tokenNo: null, orderId: null, payableTotal: 0 });

  const [orderMeta, setOrderMeta] = useState({
    customer: null,
    customerType: 'WALKIN',
    diningOption: '',
    tableId: '',
    tableTitle: '',
  });
  const [cartState, setCartState] = useState({
    cartItems: [],
    itemsTotal: 0,
    taxTotal: 0,
    serviceChargeTotal: 0,
    payableTotal: 0,
  });

  // Fetch store menu data
  useEffect(() => {
    async function loadPOSData() {
      try {
        const res = await initPOS();
        if (res.status === 200) {
          const data = res.data;
          const curr = CURRENCIES.find((c) => c.cc === data?.storeSettings?.currency);
          setCategories(data.categories || []);
          setMenuItems(data.menuItems || []);
          setStoreSettings(data.storeSettings || null);
          setCurrency(curr?.symbol || '');
        }
      } catch (err) {
        console.error('Failed to load menu items for display page:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPOSData();
  }, []);


  // Socket room joining and listeners
  useEffect(() => {
    if (!socket || !isSocketConnected || !roomId) return;

    // Join display room
    socket.emit('join_display_backend', { roomId }, (res) => {
      if (res && res.ok) {
        setIsAuthorized(true);
        // Request current cart state immediately from POS
        socket.emit('cart_request_backend', { roomId });
      } else {
        setIsAuthorized(false);
        setAuthError(res?.error || t('pos.getting_issues', 'Not authorized for this display.'));
      }
    });

    const handleCartUpdate = (payload) => {
      if (payload) {
        setCartState({
          cartItems: payload.cartItems || [],
          itemsTotal: payload.itemsTotal || 0,
          taxTotal: payload.taxTotal || 0,
          serviceChargeTotal: payload.serviceChargeTotal || 0,
          payableTotal: payload.payableTotal || 0,
        });

        if (payload.customer !== undefined || payload.diningOption !== undefined || payload.tableTitle !== undefined) {
          setOrderMeta({
            customer: payload.customer !== undefined ? payload.customer : null,
            customerType: payload.customerType || 'WALKIN',
            diningOption: payload.diningOption || '',
            tableId: payload.tableId || '',
            tableTitle: payload.tableTitle || '',
          });
        }
      }
    };

    const handleCartClear = () => {
      setCartState({
        cartItems: [],
        itemsTotal: 0,
        taxTotal: 0,
        serviceChargeTotal: 0,
        payableTotal: 0,
      });
      setOrderMeta({
        customer: null,
        customerType: 'WALKIN',
        diningOption: '',
        tableId: '',
        tableTitle: '',
      });
      setOrderSuccessModal({ isOpen: false, tokenNo: null, orderId: null, payableTotal: 0 });
      setPaymentModalState({ isOpen: false, paymentTypes: [], selectedPaymentType: null });
    };

    const handleOrderMetaUpdate = (payload) => {
      if (payload) {
        setOrderMeta((prev) => ({
          ...prev,
          customer: payload.customer !== undefined ? payload.customer : prev.customer,
          customerType: payload.customerType !== undefined ? payload.customerType : prev.customerType,
          diningOption: payload.diningOption !== undefined ? payload.diningOption : prev.diningOption,
          tableId: payload.tableId !== undefined ? payload.tableId : prev.tableId,
          tableTitle: payload.tableTitle !== undefined ? payload.tableTitle : prev.tableTitle,
        }));
      }
    };

    const handleCustomerModalOpen = (payload) => {
      setActiveCustomerModal({
        isOpen: true,
        customer: payload?.customer || null,
        customerType: payload?.customerType || 'WALKIN',
      });
    };

    const handleCustomerModalUpdate = (payload) => {
      setActiveCustomerModal((prev) => ({
        ...prev,
        customer: payload?.customer !== undefined ? payload.customer : prev.customer,
        customerType: payload?.customerType !== undefined ? payload.customerType : prev.customerType,
      }));
    };

    const handleCustomerModalClose = () => {
      setActiveCustomerModal({ isOpen: false, customer: null, customerType: 'WALKIN' });
    };

    const handleVariantModalOpen = (payload) => {
      if (payload && payload.selectedItemId) {
        setActiveVariantModal({
          selectedItemId: payload.selectedItemId,
          selectedVariantId: payload.selectedVariantId || null,
          selectedAddonIds: (payload.selectedAddonIds || []).map(String),
        });
      }
    };

    const handleVariantModalUpdate = (payload) => {
      if (payload) {
        setActiveVariantModal((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            selectedVariantId: payload.selectedVariantId !== undefined ? payload.selectedVariantId : prev.selectedVariantId,
            selectedAddonIds: payload.selectedAddonIds ? payload.selectedAddonIds.map(String) : prev.selectedAddonIds,
          };
        });
      }
    };

    const handleVariantModalClose = () => {
      setActiveVariantModal(null);
    };

    const handlePosFilterUpdate = (payload) => {
      if (payload) {
        if (payload.selectedCategory !== undefined) {
          setSelectedCategory(payload.selectedCategory);
          setScrollTopRatio(0);
        }
        if (payload.searchQuery !== undefined) {
          setSearchQuery(payload.searchQuery);
          setScrollTopRatio(0);
        }
        if (payload.view !== undefined) {
          setView(payload.view);
        }
      }
    };

    const handleItemHover = (payload) => {
      if (payload) {
        setHoveredItemId(payload.hoveredItemId || null);
      }
    };

    const handleMenuScroll = (payload) => {
      if (payload && typeof payload.scrollRatio === 'number') {
        setScrollTopRatio(payload.scrollRatio);
      }
    };

    const handleCartScroll = (payload) => {
      if (payload && typeof payload.scrollRatio === 'number') {
        setCartScrollTopRatio(payload.scrollRatio);
      }
    };

    const handlePaymentModalOpen = (payload) => {
      if (payload) {
        setPaymentModalState({
          isOpen: true,
          paymentTypes: payload.paymentTypes || [],
          selectedPaymentType: payload.selectedPaymentType || null,
        });
      }
    };

    const handlePaymentModalUpdate = (payload) => {
      if (payload) {
        setPaymentModalState((prev) => ({
          ...prev,
          selectedPaymentType: payload.selectedPaymentType !== undefined ? payload.selectedPaymentType : prev.selectedPaymentType,
        }));
      }
    };

    const handlePaymentModalClose = () => {
      setPaymentModalState({ isOpen: false, paymentTypes: [], selectedPaymentType: null });
    };

    const handleOrderSuccess = (payload) => {
      if (payload) {
        setPaymentModalState({ isOpen: false, paymentTypes: [], selectedPaymentType: null });
        setOrderSuccessModal({
          isOpen: true,
          tokenNo: payload.tokenNo || null,
          orderId: payload.orderId || null,
          payableTotal: payload.payableTotal || 0,
        });
      }
    };

    const handleRoomClosed = () => {
      setIsRoomClosed(true);
    };

    const handleConnect = () => {
      if (roomId) {
        socket.emit('join_display_backend', { roomId }, (res) => {
          if (res && res.ok) {
            setIsAuthorized(true);
            socket.emit('cart_request_backend', { roomId });
          }
        });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('room_closed', handleRoomClosed);
    socket.on('cart_update', handleCartUpdate);
    socket.on('cart_clear', handleCartClear);
    socket.on('order_meta_update', handleOrderMetaUpdate);
    socket.on('customer_modal_open', handleCustomerModalOpen);
    socket.on('customer_modal_update', handleCustomerModalUpdate);
    socket.on('customer_modal_close', handleCustomerModalClose);
    socket.on('variant_modal_open', handleVariantModalOpen);
    socket.on('variant_modal_update', handleVariantModalUpdate);
    socket.on('variant_modal_close', handleVariantModalClose);
    socket.on('pos_filter_update', handlePosFilterUpdate);
    socket.on('item_hover', handleItemHover);
    socket.on('menu_scroll', handleMenuScroll);
    socket.on('cart_scroll', handleCartScroll);
    socket.on('payment_modal_open', handlePaymentModalOpen);
    socket.on('payment_modal_update', handlePaymentModalUpdate);
    socket.on('payment_modal_close', handlePaymentModalClose);
    socket.on('order_success', handleOrderSuccess);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('room_closed', handleRoomClosed);
      socket.off('cart_update', handleCartUpdate);
      socket.off('cart_clear', handleCartClear);
      socket.off('order_meta_update', handleOrderMetaUpdate);
      socket.off('customer_modal_open', handleCustomerModalOpen);
      socket.off('customer_modal_update', handleCustomerModalUpdate);
      socket.off('customer_modal_close', handleCustomerModalClose);
      socket.off('variant_modal_open', handleVariantModalOpen);
      socket.off('variant_modal_update', handleVariantModalUpdate);
      socket.off('variant_modal_close', handleVariantModalClose);
      socket.off('pos_filter_update', handlePosFilterUpdate);
      socket.off('item_hover', handleItemHover);
      socket.off('menu_scroll', handleMenuScroll);
      socket.off('cart_scroll', handleCartScroll);
      socket.off('payment_modal_open', handlePaymentModalOpen);
      socket.off('payment_modal_update', handlePaymentModalUpdate);
      socket.off('payment_modal_close', handlePaymentModalClose);
      socket.off('order_success', handleOrderSuccess);
    };
  }, [socket, isSocketConnected, roomId]);

  // Dual Screen: Synchronize cart list container scroll position
  useEffect(() => {
    if (cartContainerRef.current && typeof cartScrollTopRatio === 'number') {
      const { scrollHeight, clientHeight } = cartContainerRef.current;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll > 0) {
        cartContainerRef.current.scrollTop = cartScrollTopRatio * maxScroll;
      }
    }
  }, [cartScrollTopRatio, cartState.cartItems]);

  // Auto-close order success modal after 4 seconds
  useEffect(() => {
    if (!orderSuccessModal.isOpen) return;

    const timer = setTimeout(() => {
      setOrderSuccessModal({ isOpen: false, tokenNo: null, orderId: null, payableTotal: 0 });
    }, 4000);

    return () => clearTimeout(timer);
  }, [orderSuccessModal.isOpen]);

  // Read-only dummy handler for menu item clicks (customer view only)
  const noop = () => {};

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loading loading-spinner loading-lg text-restro-green"></div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center mb-4">
          <IconAlertCircle size={36} stroke={iconStroke} />
        </div>
        <h2 className="text-xl font-bold mb-2">{t('pos.display_pairing_failed', 'Display Pairing Failed')}</h2>
        <p className="text-gray-500 max-w-md text-sm">{authError}</p>
      </div>
    );
  }

  if (isRoomClosed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center mb-4">
          <IconAlertCircle size={36} stroke={iconStroke} />
        </div>
        <h2 className="text-xl font-bold mb-2">{t('pos.display_session_ended', 'Dual Screen Session Ended')}</h2>
        <p className="text-gray-500 max-w-md text-sm">{t('pos.display_session_ended_sub', 'This counter session has been reset or closed. Please ask staff to re-pair the dual screen.')}</p>
      </div>
    );
  }

  const { cartItems, payableTotal, itemsTotal, taxTotal, serviceChargeTotal } = cartState;
  const cartItemsCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <div className="h-screen max-h-screen flex flex-col bg-background text-restro-text overflow-hidden">
      {/* Customer Display Header (No standard Navbar) */}
      <header className="flex-shrink-0 px-6 py-3 border-b border-restro-border-green flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          {storeSettings?.store_image || storeSettings?.image || storeSettings?.logo ? (
            <img
              src={getImageURL(storeSettings.store_image || storeSettings.image || storeSettings.logo)}
              alt={storeSettings?.store_name || 'Restaurant Logo'}
              className="w-10 h-10 rounded-xl object-cover border border-restro-border-green shadow-sm flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-restro-green text-white flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
              <IconChefHat size={22} stroke={iconStroke} />
            </div>
          )}
          <div>
            <h1 className="font-bold text-gray-700 text-lg leading-tight">{storeSettings?.store_name || t('pos.store', 'Customer Display')}</h1>
            <p className="text-xs text-gray-500">{t('pos.welcome_message', 'Welcome! Review your order below.')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">


          {/* <button
            className={clsx(
              'px-3 py-2 rounded-xl text-sm transition',
              theme === 'black' ? 'bg-restro-bg-seconday-dark-mode' : 'bg-gray-100 hover:bg-gray-200'
            )}
            onClick={() => setView(view === 'detailed' ? 'compact' : 'detailed')}
            title={t('pos.toggle_view', 'Toggle View')}
          >
            <IconLayout2 size={20} stroke={iconStroke} />
          </button>
           */}
          <div className="flex flex-col items-end px-3 py-1">
            <span className="font-Nunito text-lg font-semibold text-gray-700 tracking-wide leading-tight">
              {time.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              })}
            </span>
            <span className="font-Nunito text-xs text-gray-500 font-medium leading-tight mt-0.5">
              {time.getDate()} {time.toLocaleDateString([], { month: 'long' })} {time.getFullYear().toString().slice(-2)}, {time.toLocaleDateString([], { weekday: 'long' })}
            </span>
          </div>
        </div>
      </header>

      {/* Main Dual-Column Content */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 min-h-0 overflow-hidden">
        {/* Left Column: Read-Only Menu Items Catalog */}
        <div className="flex-1 flex flex-col h-full md:w-[65%] lg:w-[70%] border border-restro-border-green rounded-2xl overflow-hidden bg-background shadow-sm">
          {/* Category Tabs */}
          <div className="bg-background flex flex-col sm:flex-row gap-2 sm:items-center justify-between px-4 py-3 border-b border-restro-border-green">
            <div className="flex overflow-x-auto space-x-2 text-sm scrollbar scrollbar-none custom-scroll-div-horizon-smooth">
              <button
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  selectedCategory === 'all'
                    ? theme === 'black'
                      ? 'bg-restro-green-dark-mode text-white'
                      : 'bg-restro-green text-white'
                    : theme === 'black'
                    ? 'bg-restro-bg-seconday-dark-mode text-gray-300'
                    : 'bg-gray-100 text-gray-600'
                }`}
                onClick={() => setSelectedCategory('all')}
              >
                {t('pos.all', 'All Categories')}
              </button>
              {categories
                .filter((cat) => cat.is_enabled)
                .map((cat, idx) => (
                  <button
                    key={idx}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${
                      selectedCategory === cat.id
                        ? theme === 'black'
                          ? 'bg-restro-green-dark-mode text-white'
                          : 'bg-restro-green text-white'
                        : theme === 'black'
                        ? 'bg-restro-bg-seconday-dark-mode text-gray-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.title}
                  </button>
                ))}
            </div>
          </div>

          {/* Menu Items List */}
          <div className="flex-1 overflow-y-auto p-4">
            <POSMenuItemCompactView
              menuItems={menuItems}
              selectedCategory={selectedCategory}
              categories={categories}
              searchQuery={searchQuery}
              currency={currency}
              btnOpenVariantAndAddonModal={noop}
              addItemToCart={noop}
              isReadOnly={true}
              hoveredItemId={hoveredItemId}
              scrollTopRatio={scrollTopRatio}
            />
          </div>
        </div>

        {/* Right Column: Real-Time Synchronized Cart */}
        <div className="flex flex-col h-full md:w-[35%] lg:w-[30%] border border-restro-border-green rounded-2xl bg-background overflow-hidden shadow-sm">
          {/* Cart Header & Order Metadata (Customer, Dining Option, Table) */}
          <div className="px-5 py-3 border-b border-restro-border-green flex flex-col gap-2.5 bg-restro-gray/40">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base flex items-center gap-2">
                <IconShoppingCart size={20} stroke={iconStroke} className="text-restro-green" />
                <span>{t('pos.your_order', 'Your Order')}</span>
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-restro-green/10 text-restro-green">
                {cartItemsCount} {t('pos.items', 'items')}
              </span>
            </div>

            {/* Customer, Dining Option, and Table Badges */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-restro-border-green/40 text-xs">
              {/* Customer Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-restro-border-green text-restro-text font-medium shadow-2xs">
                <IconUser size={14} className="text-restro-green flex-shrink-0" />
                <span>
                  {orderMeta.customer
                    ? (typeof orderMeta.customer === 'object'
                        ? orderMeta.customer.label || orderMeta.customer.name || `${orderMeta.customer.phone}`
                        : String(orderMeta.customer))
                    : t('pos.walkin_customer', 'Walk-in Customer')}
                </span>
              </div>

              {/* Dining Option Badge */}
              {orderMeta.diningOption && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-restro-green/10 border border-restro-green/30 text-restro-green font-semibold capitalize shadow-2xs">
                  {orderMeta.diningOption === 'delivery' ? <IconTruck size={14} /> : orderMeta.diningOption === 'takeaway' ? <IconShoppingBag size={14} /> : <IconArmchair size={14} />}
                  <span>{t(`pos.${orderMeta.diningOption}`, orderMeta.diningOption)}</span>
                </div>
              )}

              {/* Table Badge */}
              {orderMeta.tableTitle && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-restro-green/10 border  font-semibold shadow-2xs">
                  <IconArmchair size={14} />
                  <span>{orderMeta.tableTitle}</span>
                </div>
              )}
            </div>
          </div>

          {/* Cart Items List */}
          <div ref={cartContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-6">
                <div className="w-16 h-16 rounded-full bg-restro-gray flex items-center justify-center mb-3">
                  <IconShoppingCart size={32} stroke={iconStroke} className="text-gray-300 dark:text-gray-600" />
                </div>
                <p className="font-medium text-sm text-restro-text mb-1">{t('pos.cart_empty', 'Cart is currently empty')}</p>
                <p className="text-xs text-gray-400">{t('pos.cart_empty_sub', 'Your selected items will appear here in real-time.')}</p>
              </div>
            ) : (
              cartItems.map((item, idx) => {
                const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                return (
                  <div key={idx} className="p-3.5 rounded-xl border border-restro-border-green bg-restro-gray/30 flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm">
                        #{idx + 1} {item.title}
                      </span>
                      <span className="font-bold text-sm text-restro-green flex-shrink-0">
                        {currency}{itemTotal.toFixed(2)}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 flex items-center justify-between">
                      <span>
                        {currency}{Number(item.price).toFixed(2)} x {item.quantity}
                      </span>
                    </div>

                    {item.variant && (
                      <p className="text-xs text-gray-400">
                        {t('pos.variant', 'Variant')}: {item.variant.title}
                      </p>
                    )}

                    {item.addons && item.addons.length > 0 && (
                      <p className="text-xs text-gray-400">
                        {t('pos.addons', 'Addons')}: {item.addons.map((a) => a.title).join(', ')}
                      </p>
                    )}

                    {item.notes && (
                      <span className="text-sm text-gray-500">
                        <span className="font-semibold">{t('pos.notes', 'Note')}:</span>{' '}
                        <span className="italic">{item.notes}</span>
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Order Totals Summary Footer */}
          {cartItems.length > 0 && (
            <div className="p-4 border-t border-restro-border-green bg-restro-gray/30 flex flex-col gap-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{t('pos.subtotal', 'Subtotal')}</span>
                <span>{currency}{(itemsTotal || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>{t('pos.tax', 'Tax')}</span>
                <span>{currency}{(taxTotal || 0).toFixed(2)}</span>
              </div>

              {serviceChargeTotal > 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{t('pos.service_charge', 'Service Charge')}</span>
                  <span>{currency}{serviceChargeTotal.toFixed(2)}</span>
                </div>
              )}

              <div className="mt-2 p-3.5 rounded-xl bg-restro-green/10 border border-restro-border-green bg-restro-green flex justify-between items-center text-base font-bold text-white shadow-2xs">
                <span>{t('pos.payable_total', 'Payable Total')}</span>
                <span className="text-xl font-extrabold text-white">{currency} {(payableTotal || 0).toFixed(2)}</span>
              </div>

              {/* Payment Options Grid below Payable Total */}
              {paymentModalState.isOpen && paymentModalState.paymentTypes?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-restro-border-green flex flex-col gap-2 animate-in fade-in duration-200">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('orders.select_payment_method', 'Payment Options')}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {paymentModalState.paymentTypes.map((pt, idx) => {
                      const isSelected = String(pt.id) === String(paymentModalState.selectedPaymentType);
                      return (
                        <div
                          key={idx}
                          className={clsx(
                            "border rounded-2xl flex flex-col items-center justify-center gap-1.5 px-3 py-3 transition-all",
                            isSelected
                              ? "border-restro-green bg-restro-green/10 text-restro-green font-bold shadow-sm ring-2 ring-restro-green/30"
                              : "border-restro-border-green text-gray-500 dark:text-gray-400 bg-background opacity-75"
                          )}
                        >
                          {pt.icon && PAYMENT_ICONS[pt.icon] ? (
                            <div className="text-xl">{PAYMENT_ICONS[pt.icon]}</div>
                          ) : null}
                          <p className="text-xs text-center leading-tight">{pt.title}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Synchronized Read-Only Variant & Addons Modal Overlay */}
      {activeVariantModal && (() => {
        const selectedItem = menuItems.find((item) => item.id == activeVariantModal.selectedItemId);
        if (!selectedItem) return null;

        const variants = selectedItem.variants || [];
        const addons = selectedItem.addons || [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-none">
            <div className="bg-background border border-restro-border-green rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center pb-3 border-b border-restro-border-green">
                <div>
                  <h3 className="font-bold text-lg text-restro-text flex items-center gap-2">
                    {t('pos.select_variant_addons', 'Select Variant & Addons')}
                  </h3>
                  <p className="text-xs text-restro-green font-semibold mt-0.5">{selectedItem.title}</p>
                </div>
              </div>

              <div className="my-5 flex flex-col sm:flex-row gap-5 max-h-[60vh] overflow-y-auto pr-1">
                {variants.length > 0 && (
                  <div className="flex-1">
                    <h4 className="font-semibold text-xs mb-2.5 text-gray-500 uppercase tracking-wider">{t('pos.variants', 'Variants')}</h4>
                    <div className="flex flex-col gap-2">
                      {variants.map((v, idx) => {
                        const isChecked = String(v.id) === String(activeVariantModal.selectedVariantId);
                        return (
                          <div key={idx} className={clsx(
                            "flex items-center gap-3 p-3 rounded-xl  transition-all",
                            isChecked ? " bg-restro-green/10 text-restro-text font-bold shadow-sm" : " text-gray-500 opacity-60"
                          )}>
                            <input
                              type="radio"
                              readOnly
                              checked={isChecked}
                              className={`radio radio-sm flex-shrink-0 ${
                                      isChecked ? "radio-neutral" : "radio-success"
                                    }`}
                            />
                            <span className="text-sm flex-1">{v.title}</span>
                            <span className="text-xs font-semibold text-restro-green">{currency}{v.price}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {addons.length > 0 && (
                  <div className="flex-1">
                    <h4 className="font-semibold text-xs mb-2.5 text-gray-500 uppercase tracking-wider">{t('pos.addons', 'Addons')}</h4>
                    <div className="flex flex-col gap-2">
                      {addons.map((a, idx) => {
                        const isChecked = activeVariantModal.selectedAddonIds?.includes(String(a.id));
                        return (
                          <div key={idx} className={clsx(
                            "flex items-center gap-3 p-3 rounded-xl  transition-all",
                            isChecked ? " bg-restro-green/10 text-restro-text font-bold shadow-sm" : " text-gray-500 opacity-60"
                          )}>
                            <input
                              type="checkbox"
                              readOnly
                              checked={isChecked}
                               className={`checkbox checkbox-sm rounded-md flex-shrink-0 ${
                                  isChecked ? "checkbox-neutral" : "checkbox-success"
                                }`}
                            />
                            <span className="text-sm flex-1">{a.title}</span>
                            <span className="text-xs font-semibold text-restro-green">+{currency}{a.price}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Synchronized Read-Only Customer Selection Modal Overlay */}
      {activeCustomerModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-none">
          <div className="bg-background border border-restro-border-green rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-restro-border-green">
              <div>
                <h3 className="font-bold text-lg text-restro-text flex items-center gap-2">
                  <IconUser size={20} className="text-restro-green" />
                  {t('pos.search_customer', 'Customer Selection')}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{t('pos.customizing_item', 'Selecting customer live from POS cashier screen...')}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-restro-green/10 text-restro-green flex items-center justify-center text-xs font-bold animate-pulse">
                Live
              </div>
            </div>

            <div className="my-6 flex flex-col items-center justify-center py-6 text-center gap-3 bg-restro-gray/40 rounded-2xl border border-restro-border-green/40">
              <div className="w-14 h-14 rounded-full bg-restro-green/10 text-restro-green flex items-center justify-center">
                <IconUser size={28} />
              </div>
              <div>
                <h4 className="font-bold text-base text-restro-text">
                  {activeCustomerModal.customer
                    ? (typeof activeCustomerModal.customer === 'object'
                        ? activeCustomerModal.customer.label || activeCustomerModal.customer.name || activeCustomerModal.customer.phone
                        : String(activeCustomerModal.customer))
                    : t('pos.walkin_customer', 'Walk-in Customer')}
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  {activeCustomerModal.customer ? t('pos.customer_selected', 'Customer attached to order') : t('pos.searching_customer', 'Searching & selecting customer on cashier screen...')}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-restro-border-green flex items-center justify-between text-xs text-gray-400">
              <span>{t('pos.customer_selection_sync', 'Syncing customer details in real-time...')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Order Token Success Dialog Overlay */}
      {orderSuccessModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-restro-border-green rounded-3xl p-8 max-w-md w-full shadow-2xl relative text-center flex flex-col items-center gap-5">
            <button
              onClick={() => setOrderSuccessModal({ isOpen: false, tokenNo: null, orderId: null, payableTotal: 0 })}
              className="absolute top-4 right-4 text-gray-400 hover:text-restro-red p-2 rounded-full bg-restro-gray transition"
            >
              <IconX size={18} stroke={iconStroke} />
            </button>

            {/* Success Icon */}
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-500 flex items-center justify-center shadow-lg animate-bounce">
              <IconCheck size={44} stroke={3} />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-restro-text">
                {t('pos.order_sent_to_kitchen', 'Order Sent to Kitchen!')}
              </h3>
              <p className="text-xs text-gray-400">
                {t('pos.thank_you', 'Thank you! Your order is being prepared.')}
              </p>
            </div>

            {/* Token Number Highlight Card */}
            {orderSuccessModal.tokenNo && (
              <div className="w-full bg-restro-green/10 border-2 border-restro-green/40 rounded-2xl p-5 flex flex-col items-center justify-center gap-1 shadow-sm">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  {t('pos.token_no', 'Token Number')}
                </span>
                <span className="text-4xl font-extrabold text-restro-green">
                  #{orderSuccessModal.tokenNo}
                </span>
              </div>
            )}

            {orderSuccessModal.orderId && (
              <p className="text-xs text-gray-400">
                {t('pos.order_id', 'Order ID')}: <span className="font-semibold text-restro-text">#{orderSuccessModal.orderId}</span>
              </p>
            )}

            <button
              onClick={() => setOrderSuccessModal({ isOpen: false, tokenNo: null, orderId: null, payableTotal: 0 })}
              className="w-full rounded-2xl py-3 px-4 font-semibold text-white bg-restro-green hover:bg-restro-green-button-hover shadow-md transition active:scale-95"
            >
              {t('pos.close', 'Close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
