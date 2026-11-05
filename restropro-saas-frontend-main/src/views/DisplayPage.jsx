import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconShoppingCart,
  IconAlertCircle,
  IconCheck,
  IconLayout2,
  IconChefHat,
  IconUser,
  IconArmchair,
  IconTruck,
  IconShoppingBag,
  IconX,
  IconSparkles,
  IconPresentation,
  IconToolsKitchen2,
  IconCoffee,
  IconSoup,
} from '@tabler/icons-react';
import { iconStroke } from '../config/config';
import { initPOS } from '../controllers/pos.controller';
import { CURRENCIES } from '../config/currencies.config';
import { SocketContext } from '../contexts/SocketContext';
import { useTheme } from '../contexts/ThemeContext';
import POSMenuItemCompactView, {
  formatPOSPrice,
  getCategoryFallbackIcon,
} from '../components/POSMenuItemCompactView';
import { PAYMENT_ICONS } from '../config/payment_icons';
import { getImageURL } from '../helpers/ImageHelper';
import { clsx } from 'clsx';

// Curated fallback demo slides when a store has no menu photos or no menu items yet
const DEFAULT_DEMO_SLIDES = [
  {
    id: 'demo-1',
    isDemo: true,
    badge: 'Signature Culinary Selection',
    title: 'Freshly Prepared Chef Specials',
    subtitle: 'Crafted daily with authentic ingredients and served hot from our kitchen.',
    priceLabel: 'Popular Choice',
    image:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80',
    accent: 'from-emerald-950/95 via-slate-900/80 to-transparent',
    Icon: IconChefHat,
  },
  {
    id: 'demo-2',
    isDemo: true,
    badge: 'Artisanal Café & Beverages',
    title: 'Handcrafted Iced Coffee & Refreshers',
    subtitle: 'Rich espresso blends, creamy lattes, and refreshing house-brewed teas.',
    priceLabel: 'Freshly Brewed',
    image:
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1400&q=80',
    accent: 'from-slate-950/95 via-amber-950/75 to-transparent',
    Icon: IconCoffee,
  },
  {
    id: 'demo-3',
    isDemo: true,
    badge: 'Authentic Comfort Bowls',
    title: 'Steaming Noodle Soups & Wok Favorites',
    subtitle: 'Slow-simmered broths, tender cuts, and fragrant herbs made to order.',
    priceLabel: 'House Favorite',
    image:
      'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1400&q=80',
    accent: 'from-slate-950/95 via-emerald-950/75 to-transparent',
    Icon: IconSoup,
  },
  {
    id: 'demo-4',
    isDemo: true,
    badge: 'Fast & Seamless Experience',
    title: 'Welcome! Review Your Order Live',
    subtitle: 'Watch your selections, customizations, and total update in real time.',
    priceLabel: 'Live Display',
    image:
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1400&q=80',
    accent: 'from-slate-950/95 via-slate-900/80 to-transparent',
    Icon: IconToolsKitchen2,
  },
];

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

  // Idle / Showcase slideshow states
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [isCashierInteracting, setIsCashierInteracting] = useState(false);
  const [manualShowcaseMode, setManualShowcaseMode] = useState(false);
  const interactionTimeoutRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [isAuthorized, setIsAuthorized] = useState(null); // null = checking, true = authorized, false = failed
  const [authError, setAuthError] = useState('');
  const [isRoomClosed, setIsRoomClosed] = useState(false);
  const [activeVariantModal, setActiveVariantModal] = useState(null);
  const [activeCustomerModal, setActiveCustomerModal] = useState({
    isOpen: false,
    customer: null,
    customerType: 'WALKIN',
  });
  const [paymentModalState, setPaymentModalState] = useState({
    isOpen: false,
    paymentTypes: [],
    selectedPaymentType: null,
  });
  const [orderSuccessModal, setOrderSuccessModal] = useState({
    isOpen: false,
    tokenNo: null,
    orderId: null,
    payableTotal: 0,
  });

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

  // Wake screen from idle showcase for 15 seconds when cashier interacts on POS
  const triggerCashierActivity = () => {
    setIsCashierInteracting(true);
    setManualShowcaseMode(false);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsCashierInteracting(false);
    }, 15000);
  };

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);

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
        const incomingItems = payload.cartItems || [];
        if (incomingItems.length > 0) {
          setManualShowcaseMode(false);
        }
        setCartState({
          cartItems: incomingItems,
          itemsTotal: payload.itemsTotal || 0,
          taxTotal: payload.taxTotal || 0,
          serviceChargeTotal: payload.serviceChargeTotal || 0,
          payableTotal: payload.payableTotal || 0,
        });

        if (
          payload.customer !== undefined ||
          payload.diningOption !== undefined ||
          payload.tableTitle !== undefined
        ) {
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
      setIsCashierInteracting(false);
    };

    const handleOrderMetaUpdate = (payload) => {
      if (payload) {
        triggerCashierActivity();
        setOrderMeta((prev) => ({
          ...prev,
          customer: payload.customer !== undefined ? payload.customer : prev.customer,
          customerType:
            payload.customerType !== undefined ? payload.customerType : prev.customerType,
          diningOption:
            payload.diningOption !== undefined ? payload.diningOption : prev.diningOption,
          tableId: payload.tableId !== undefined ? payload.tableId : prev.tableId,
          tableTitle: payload.tableTitle !== undefined ? payload.tableTitle : prev.tableTitle,
        }));
      }
    };

    const handleCustomerModalOpen = (payload) => {
      triggerCashierActivity();
      setActiveCustomerModal({
        isOpen: true,
        customer: payload?.customer || null,
        customerType: payload?.customerType || 'WALKIN',
      });
    };

    const handleCustomerModalUpdate = (payload) => {
      triggerCashierActivity();
      setActiveCustomerModal((prev) => ({
        ...prev,
        customer: payload?.customer !== undefined ? payload.customer : prev.customer,
        customerType:
          payload?.customerType !== undefined ? payload.customerType : prev.customerType,
      }));
    };

    const handleCustomerModalClose = () => {
      setActiveCustomerModal({ isOpen: false, customer: null, customerType: 'WALKIN' });
    };

    const handleVariantModalOpen = (payload) => {
      if (payload && payload.selectedItemId) {
        triggerCashierActivity();
        setActiveVariantModal({
          selectedItemId: payload.selectedItemId,
          selectedVariantId: payload.selectedVariantId || null,
          selectedAddonIds: (payload.selectedAddonIds || []).map(String),
        });
      }
    };

    const handleVariantModalUpdate = (payload) => {
      if (payload) {
        triggerCashierActivity();
        setActiveVariantModal((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            selectedVariantId:
              payload.selectedVariantId !== undefined
                ? payload.selectedVariantId
                : prev.selectedVariantId,
            selectedAddonIds: payload.selectedAddonIds
              ? payload.selectedAddonIds.map(String)
              : prev.selectedAddonIds,
          };
        });
      }
    };

    const handleVariantModalClose = () => {
      setActiveVariantModal(null);
    };

    const handlePosFilterUpdate = (payload) => {
      if (payload) {
        triggerCashierActivity();
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
        if (payload.hoveredItemId) {
          triggerCashierActivity();
        }
        setHoveredItemId(payload.hoveredItemId || null);
      }
    };

    const handleMenuScroll = (payload) => {
      if (payload && typeof payload.scrollRatio === 'number') {
        triggerCashierActivity();
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
        triggerCashierActivity();
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
          selectedPaymentType:
            payload.selectedPaymentType !== undefined
              ? payload.selectedPaymentType
              : prev.selectedPaymentType,
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

  // Build showcase slides: prefer store menu items with images, fallback to curated demo slides
  const showcaseSlides = useMemo(() => {
    const enabledItemsWithImages = (menuItems || []).filter(
      (item) => item.is_enabled && item.image
    );

    if (enabledItemsWithImages.length > 0) {
      return enabledItemsWithImages.slice(0, 8).map((item) => {
        const cat = categories.find((c) => c.id === item.category_id);
        const badgeText =
          item.category_title || cat?.title || t('pos.featured_item', 'Featured Menu');
        const variantsCount = item.variants?.length || 0;
        const addonsCount = item.addons?.length || 0;
        const extraTags = [];
        if (variantsCount > 0) extraTags.push(`${variantsCount} ${t('pos.variants', 'Variants')}`);
        if (addonsCount > 0) extraTags.push(`+${addonsCount} ${t('pos.addons', 'Addons')}`);

        return {
          id: `item-${item.id}`,
          isDemo: false,
          badge: badgeText,
          title: item.title,
          subtitle:
            extraTags.length > 0
              ? extraTags.join(' • ')
              : t(
                  'pos.welcome_message',
                  'Freshly prepared to order. Ask our staff for recommendations!'
                ),
          priceLabel: formatPOSPrice(item.price, currency),
          image: getImageURL(item.image),
          accent: 'from-slate-950/95 via-slate-900/75 to-transparent',
          Icon: getCategoryFallbackIcon(badgeText, item.title),
        };
      });
    }

    return DEFAULT_DEMO_SLIDES;
  }, [menuItems, categories, currency, t]);

  // Auto-advance showcase slides every 4.5 seconds
  useEffect(() => {
    if (showcaseSlides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlideIdx((prev) => (prev + 1) % showcaseSlides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [showcaseSlides.length]);

  // Keep slide index within bounds if slides change
  useEffect(() => {
    if (activeSlideIdx >= showcaseSlides.length) {
      setActiveSlideIdx(0);
    }
  }, [showcaseSlides.length, activeSlideIdx]);

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
        <h2 className="text-xl font-bold mb-2">
          {t('pos.display_pairing_failed', 'Display Pairing Failed')}
        </h2>
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
        <h2 className="text-xl font-bold mb-2">
          {t('pos.display_session_ended', 'Dual Screen Session Ended')}
        </h2>
        <p className="text-gray-500 max-w-md text-sm">
          {t(
            'pos.display_session_ended_sub',
            'This counter session has been reset or closed. Please ask staff to re-pair the dual screen.'
          )}
        </p>
      </div>
    );
  }

  const { cartItems, payableTotal, itemsTotal, taxTotal, serviceChargeTotal } = cartState;
  const cartItemsCount = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const enabledMenuItems = (menuItems || []).filter((m) => m.is_enabled);
  const hasAnyModalOpen = Boolean(
    activeVariantModal ||
      activeCustomerModal.isOpen ||
      paymentModalState.isOpen ||
      orderSuccessModal.isOpen
  );

  // Show Full-Screen Idle Showcase when cart is empty & no active POS interaction (or manually toggled)
  const showFullScreenShowcase =
    manualShowcaseMode ||
    (cartItems.length === 0 && !isCashierInteracting && !hasAnyModalOpen);

  const currentSlide = showcaseSlides[activeSlideIdx] || showcaseSlides[0] || DEFAULT_DEMO_SLIDES[0];
  const storeLogoUrl =
    storeSettings?.store_image || storeSettings?.image || storeSettings?.logo
      ? getImageURL(storeSettings.store_image || storeSettings.image || storeSettings.logo)
      : null;
  const storeName = storeSettings?.store_name || t('pos.store', 'Bong POS');

  return (
    <div className="h-screen max-h-screen w-screen flex flex-col bg-background text-restro-text overflow-hidden select-none">
      {showFullScreenShowcase ? (
        /* ============================================================================
         * IDLE MODE: FULL-SCREEN AUTO-PLAYING MENU SHOWCASE & PROMO BANNER SLIDESHOW
         * ============================================================================ */
        <div className="relative flex-1 w-full h-full bg-slate-950 text-white overflow-hidden flex flex-col justify-between p-6 lg:p-8">
          {/* Background Slide Image with Smooth Zoom & Gradient Scrim */}
          <div key={currentSlide.id} className="absolute inset-0 z-0 overflow-hidden">
            {currentSlide.image && (
              <img
                src={currentSlide.image}
                alt={currentSlide.title}
                className="w-full h-full object-cover object-center scale-105 transition-transform duration-1000 ease-out opacity-80"
              />
            )}
            <div
              className={`absolute inset-0 bg-gradient-to-r ${
                currentSlide.accent || 'from-slate-950/95 via-slate-900/75 to-transparent'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-slate-950/60" />
          </div>

          {/* Top Floating Glass Bar: Store Identity on Left + Clock & Menu Toggle on Right */}
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 bg-black/45 backdrop-blur-md border border-white/15 px-4 py-2.5 rounded-2xl shadow-lg">
              {storeLogoUrl ? (
                <img
                  src={storeLogoUrl}
                  alt={storeName}
                  className="w-11 h-11 rounded-xl object-cover border border-white/20 shadow-sm flex-shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-restro-green text-white flex items-center justify-center font-bold shadow-sm flex-shrink-0">
                  <IconChefHat size={24} stroke={iconStroke} />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-white text-lg leading-tight tracking-tight">
                    {storeName}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    {t('pos.welcome', 'Welcome')}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {t('pos.welcome_message', 'Welcome! Review your order below.')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Manual button to switch to Split Menu View */}
              <button
                type="button"
                onClick={() => {
                  setManualShowcaseMode(false);
                  triggerCashierActivity();
                }}
                className="min-h-[42px] px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-md border border-white/15 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg"
              >
                <IconLayout2 size={16} stroke={2} />
                <span>{t('pos.browse_menu', 'View Menu')}</span>
              </button>

              <div className="bg-black/45 backdrop-blur-md border border-white/15 px-4 py-2 rounded-2xl text-right shadow-lg">
                <div className="font-mono text-base font-bold text-white leading-tight">
                  {time.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </div>
                <div className="text-[11px] text-slate-300 font-medium leading-tight mt-0.5">
                  {time.toLocaleDateString([], {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Center-Left Hero Content + Right Featured Strip */}
          <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-start lg:items-end justify-end lg:justify-between gap-8 py-6">
            {/* Hero Slide Details */}
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-restro-green/90 text-white text-xs font-extrabold uppercase tracking-wider shadow-md">
                <IconSparkles size={14} stroke={2.2} />
                <span>{currentSlide.badge}</span>
              </div>

              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08] drop-shadow-md">
                {currentSlide.title}
              </h2>

              <p className="text-sm sm:text-base lg:text-lg text-slate-200 max-w-xl leading-relaxed font-medium">
                {currentSlide.subtitle}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                {currentSlide.priceLabel && (
                  <div className="px-5 py-2.5 rounded-2xl bg-white text-slate-950 font-black text-xl sm:text-2xl tracking-tight shadow-xl font-mono">
                    {currentSlide.priceLabel}
                  </div>
                )}
                <div className="px-4 py-2.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/15 text-xs sm:text-sm text-slate-200 font-medium flex items-center gap-2">
                  <IconShoppingCart size={17} className="text-emerald-400" />
                  <span>
                    {t(
                      'pos.idle_order_hint',
                      'Your order summary will appear automatically once items are added'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Right-Side Featured Menu Preview Deck (4 cards) */}
            <div className="hidden lg:flex flex-col gap-2.5 w-[360px] xl:w-[400px] bg-black/45 backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-2xl">
              <div className="flex items-center justify-between px-1 pb-1 border-b border-white/10">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <IconSparkles size={14} />
                  {enabledMenuItems.length > 0
                    ? t('pos.menu_highlights', 'Menu Highlights')
                    : t('pos.demo_showcase', 'Featured Preview')}
                </span>
                <span className="text-[11px] text-slate-300 font-mono">
                  {activeSlideIdx + 1} / {showcaseSlides.length}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {showcaseSlides.slice(0, 4).map((slide, idx) => {
                  const isCurrent = idx === activeSlideIdx % 4;
                  const SlideIcon = slide.Icon || IconChefHat;
                  return (
                    <div
                      key={slide.id}
                      onClick={() => setActiveSlideIdx(idx)}
                      className={clsx(
                        'flex items-center gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer',
                        isCurrent
                          ? 'bg-white/15 border-emerald-400/60 shadow-md scale-[1.01]'
                          : 'bg-white/5 border-white/10 opacity-75 hover:opacity-100'
                      )}
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 border border-white/15 flex items-center justify-center">
                        {slide.image ? (
                          <img
                            src={slide.image}
                            alt={slide.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <SlideIcon size={20} className="text-emerald-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{slide.title}</p>
                        <p className="text-[11px] text-slate-300 truncate">{slide.badge}</p>
                      </div>
                      <span className="text-xs font-extrabold font-mono text-emerald-300 flex-shrink-0 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/20">
                        {slide.priceLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Slide Progress Bars */}
          <div className="relative z-10 flex items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              {showcaseSlides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSlideIdx(idx)}
                  aria-label={`Slide ${idx + 1}`}
                  className={clsx(
                    'h-1.5 rounded-full transition-all duration-300 cursor-pointer',
                    idx === activeSlideIdx
                      ? 'w-10 bg-emerald-400'
                      : 'w-2.5 bg-white/30 hover:bg-white/50'
                  )}
                />
              ))}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {storeSettings?.address || storeSettings?.phone || ''}
            </span>
          </div>
        </div>
      ) : (
        /* ============================================================================
         * ACTIVE ORDER MODE: FULL-HEIGHT 2-COLUMN SPLIT VIEW (NO TOP BAR)
         * ============================================================================ */
        <div className="flex-1 flex flex-col md:flex-row gap-3.5 p-3.5 min-h-0 h-full overflow-hidden">
          {/* Left Column: Full-Height Read-Only Menu Catalog (or Demo Banner Grid if 0 items) */}
          <div className="flex-1 flex flex-col h-full md:w-[64%] lg:w-[68%] border border-restro-border-green rounded-2xl overflow-hidden bg-background shadow-sm">
            {/* Clean Category Pills Row + Optional Showcase Toggle */}
            <div className="bg-background flex items-center justify-between gap-2 px-4 py-2.5 border-b border-restro-border-green flex-shrink-0">
              <div className="flex overflow-x-auto space-x-2 text-sm scrollbar scrollbar-none custom-scroll-div-horizon-smooth py-0.5">
                <button
                  className={`flex-shrink-0 min-h-[38px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition ${
                    selectedCategory === 'all'
                      ? theme === 'black'
                        ? 'bg-restro-green-dark-mode text-white shadow-2xs'
                        : 'bg-restro-green text-white shadow-2xs'
                      : theme === 'black'
                      ? 'bg-restro-bg-seconday-dark-mode text-gray-300'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                  onClick={() => setSelectedCategory('all')}
                >
                  {t('pos.all', 'All')}
                </button>
                {categories
                  .filter((cat) => cat.is_enabled)
                  .map((cat, idx) => (
                    <button
                      key={idx}
                      className={`flex-shrink-0 min-h-[38px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition ${
                        selectedCategory === cat.id
                          ? theme === 'black'
                            ? 'bg-restro-green-dark-mode text-white shadow-2xs'
                            : 'bg-restro-green text-white shadow-2xs'
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

              {/* Quick Toggle to view Full-Screen Banner Showcase when cart is empty */}
              {cartItems.length === 0 && (
                <button
                  type="button"
                  onClick={() => setManualShowcaseMode(true)}
                  className="flex-shrink-0 min-h-[38px] px-3 py-1.5 rounded-xl border border-restro-border-green bg-restro-gray/60 hover:bg-restro-green/10 text-xs font-semibold text-restro-text flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  title={t('pos.showcase_mode', 'Banner Showcase')}
                >
                  <IconPresentation size={15} className="text-restro-green" />
                  <span className="hidden sm:inline">{t('pos.showcase', 'Showcase')}</span>
                </button>
              )}
            </div>

            {/* Menu Items Area: Real Catalog OR Curated Demo Banner & Sample Cards when store has 0 menu items */}
            <div className="flex-1 overflow-y-auto p-3.5">
              {enabledMenuItems.length === 0 ? (
                /* Fallback Menu Demo Banner & Sample Cards when store has no menu items yet */
                <div className="h-full flex flex-col gap-4">
                  <div className="relative rounded-2xl overflow-hidden min-h-[210px] flex items-end p-6 text-white shadow-md bg-slate-900">
                    <img
                      src={currentSlide.image}
                      alt={currentSlide.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-75"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-transparent" />
                    <div className="relative z-10 space-y-1.5 max-w-lg">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-restro-green text-white">
                        {currentSlide.badge}
                      </span>
                      <h3 className="text-2xl font-black leading-tight">{currentSlide.title}</h3>
                      <p className="text-xs text-slate-200">{currentSlide.subtitle}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                    {DEFAULT_DEMO_SLIDES.map((demo) => (
                      <div
                        key={demo.id}
                        className="rounded-xl border border-restro-border-green bg-background overflow-hidden flex flex-col justify-between shadow-2xs"
                      >
                        <div className="h-28 w-full overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                          <img
                            src={demo.image}
                            alt={demo.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-3 flex flex-col justify-between flex-1 gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-restro-green uppercase">
                              {demo.badge}
                            </span>
                            <p className="text-xs font-bold text-restro-text line-clamp-2 mt-0.5">
                              {demo.title}
                            </p>
                          </div>
                          <span className="text-[11px] font-extrabold text-gray-500 font-mono">
                            {demo.priceLabel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <POSMenuItemCompactView
                  menuItems={menuItems}
                  selectedCategory={selectedCategory}
                  categories={categories}
                  searchQuery={searchQuery}
                  currency={currency}
                  btnOpenVariantAndAddonModal={noop}
                  addItemToCart={noop}
                  cartItems={cartItems}
                  isReadOnly={true}
                  hoveredItemId={hoveredItemId}
                  scrollTopRatio={scrollTopRatio}
                />
              )}
            </div>
          </div>

          {/* Right Column: Compact Store Identity + Real-Time Synchronized Order Panel */}
          <div className="flex flex-col h-full md:w-[36%] lg:w-[32%] border border-restro-border-green rounded-2xl bg-background overflow-hidden shadow-sm">
            {/* Compact Store Identity + Order Header */}
            <div className="px-4 py-3 border-b border-restro-border-green flex flex-col gap-2.5 bg-restro-gray/40 flex-shrink-0">
              {/* Top Row: Store Brand Identity + Live Clock */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-restro-border-green/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  {storeLogoUrl ? (
                    <img
                      src={storeLogoUrl}
                      alt={storeName}
                      className="w-8 h-8 rounded-lg object-cover border border-restro-border-green shadow-2xs flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-restro-green text-white flex items-center justify-center font-bold shadow-2xs flex-shrink-0">
                      <IconChefHat size={18} stroke={iconStroke} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="font-extrabold text-sm text-restro-text truncate leading-tight">
                      {storeName}
                    </h1>
                    <p className="text-[11px] text-gray-400 truncate leading-tight">
                      {t('pos.your_order', 'Your Order')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] font-mono font-semibold text-gray-500">
                    {time.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-extrabold bg-restro-green text-white shadow-2xs">
                    {cartItemsCount} {t('pos.items', 'Items')}
                  </span>
                </div>
              </div>

              {/* Customer, Dining Option, and Table Badges */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {/* Customer Badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-restro-border-green text-restro-text font-semibold shadow-2xs">
                  <IconUser size={13} className="text-restro-green flex-shrink-0" />
                  <span className="truncate max-w-[150px]">
                    {orderMeta.customer
                      ? typeof orderMeta.customer === 'object'
                        ? orderMeta.customer.label ||
                          orderMeta.customer.name ||
                          `${orderMeta.customer.phone}`
                        : String(orderMeta.customer)
                      : t('pos.walkin_customer', 'Walk-in Customer')}
                  </span>
                </div>

                {/* Dining Option Badge */}
                {orderMeta.diningOption && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-restro-green/10 border border-restro-green/30 text-restro-green font-bold capitalize shadow-2xs">
                    {orderMeta.diningOption === 'delivery' ? (
                      <IconTruck size={13} />
                    ) : orderMeta.diningOption === 'takeaway' ? (
                      <IconShoppingBag size={13} />
                    ) : (
                      <IconArmchair size={13} />
                    )}
                    <span>{t(`pos.${orderMeta.diningOption}`, orderMeta.diningOption)}</span>
                  </div>
                )}

                {/* Table Badge */}
                {orderMeta.tableTitle && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-restro-green/10 border border-restro-green/30 text-restro-green font-bold shadow-2xs">
                    <IconArmchair size={13} />
                    <span>{orderMeta.tableTitle}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cart Items List (or Mini Promo Banner Card when empty) */}
            <div
              ref={cartContainerRef}
              className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2.5"
            >
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col justify-between gap-3">
                  {/* Rotating Featured Dish / Promo Banner inside empty cart panel */}
                  <div className="relative flex-1 min-h-[220px] rounded-2xl overflow-hidden border border-restro-border-green shadow-sm flex flex-col justify-end p-5 text-white bg-slate-900">
                    {currentSlide.image && (
                      <img
                        src={currentSlide.image}
                        alt={currentSlide.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-80 transition-all duration-700"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-transparent" />

                    <div className="relative z-10 space-y-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-restro-green text-white shadow-2xs">
                        <IconSparkles size={11} />
                        {currentSlide.badge}
                      </span>
                      <h3 className="text-lg font-black leading-snug text-white">
                        {currentSlide.title}
                      </h3>
                      <p className="text-xs text-slate-200 line-clamp-2">{currentSlide.subtitle}</p>
                      {currentSlide.priceLabel && (
                        <div className="pt-1">
                          <span className="inline-block px-3 py-1 rounded-lg bg-white text-slate-950 font-extrabold text-sm font-mono shadow-sm">
                            {currentSlide.priceLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subtle Ready-to-Order Footer Card */}
                  <div className="p-3.5 rounded-2xl border border-restro-border-green bg-restro-gray/30 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-restro-green/10 text-restro-green flex items-center justify-center flex-shrink-0">
                      <IconShoppingCart size={20} stroke={iconStroke} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-restro-text">
                        {t('pos.cart_empty', 'Ready for your order')}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {t(
                          'pos.cart_empty_sub',
                          'Your selected items will appear here in real-time.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                cartItems.map((item, idx) => {
                  const qty = Number(item.quantity) || 1;
                  const unitPrice = Number(item.price) || 0;
                  const itemTotal = unitPrice * qty;
                  const matchedMenuItem = menuItems.find((m) => m.id === item.id);
                  const rawImg = item.image || matchedMenuItem?.image;
                  const itemImgUrl = rawImg ? getImageURL(rawImg) : null;
                  const ItemFallbackIcon = getCategoryFallbackIcon(
                    matchedMenuItem?.category_title || '',
                    item.title || ''
                  );
                  const isLatestItem = idx === cartItems.length - 1;

                  return (
                    <div
                      key={`${item.id || idx}-${idx}`}
                      className={clsx(
                        'p-3 rounded-2xl border transition-all flex items-start gap-3',
                        isLatestItem
                          ? 'border-restro-green bg-restro-green/[0.05] shadow-2xs'
                          : 'border-restro-border-green bg-restro-gray/30'
                      )}
                    >
                      {/* Item Thumbnail or Culinary Fallback Icon */}
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-restro-border-green flex items-center justify-center flex-shrink-0">
                        {itemImgUrl ? (
                          <img
                            src={itemImgUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ItemFallbackIcon size={20} className="text-restro-green" />
                        )}
                      </div>

                      {/* Item Info & Customizations */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-restro-text leading-snug line-clamp-2">
                              {item.title}
                            </span>
                          </div>
                          <span className="font-extrabold text-sm text-restro-green font-mono flex-shrink-0">
                            {formatPOSPrice(itemTotal, currency)}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-restro-green text-white font-extrabold font-mono text-[11px]">
                            {qty}×
                          </span>
                          <span className="font-mono text-[11px]">
                            {formatPOSPrice(unitPrice, currency)}
                          </span>

                          {item.variant && (
                            <span className="px-2 py-0.5 rounded-md bg-background border border-restro-border-green text-[11px] font-medium text-restro-text">
                              {item.variant.title}
                            </span>
                          )}
                        </div>

                        {item.addons && item.addons.length > 0 && (
                          <p className="mt-1 text-[11px] text-gray-400 line-clamp-1">
                            + {item.addons.map((a) => a.title).join(', ')}
                          </p>
                        )}

                        {item.notes && (
                          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 italic">
                            “{item.notes}”
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart Order Totals Summary Footer */}
            {cartItems.length > 0 && (
              <div className="p-3.5 border-t border-restro-border-green bg-restro-gray/30 flex flex-col gap-1.5 flex-shrink-0">
                <div className="flex justify-between text-xs text-gray-500 font-medium">
                  <span>{t('pos.subtotal', 'Subtotal')}</span>
                  <span className="font-mono">{formatPOSPrice(itemsTotal || 0, currency)}</span>
                </div>

                <div className="flex justify-between text-xs text-gray-500 font-medium">
                  <span>{t('pos.tax', 'Tax')}</span>
                  <span className="font-mono">{formatPOSPrice(taxTotal || 0, currency)}</span>
                </div>

                {serviceChargeTotal > 0 && (
                  <div className="flex justify-between text-xs text-gray-500 font-medium">
                    <span>{t('pos.service_charge', 'Service Charge')}</span>
                    <span className="font-mono">
                      {formatPOSPrice(serviceChargeTotal, currency)}
                    </span>
                  </div>
                )}

                <div className="mt-1.5 p-3.5 rounded-xl bg-restro-green flex justify-between items-center text-base font-bold text-white shadow-sm">
                  <span>{t('pos.payable_total', 'Payable Total')}</span>
                  <span className="text-xl font-black text-white font-mono tracking-tight">
                    {formatPOSPrice(payableTotal || 0, currency)}
                  </span>
                </div>

                {/* Payment Options Grid below Payable Total */}
                {paymentModalState.isOpen && paymentModalState.paymentTypes?.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-restro-border-green flex flex-col gap-2 animate-in fade-in duration-200">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      {t('orders.select_payment_method', 'Payment Options')}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {paymentModalState.paymentTypes.map((pt, idx) => {
                        const isSelected =
                          String(pt.id) === String(paymentModalState.selectedPaymentType);
                        return (
                          <div
                            key={idx}
                            className={clsx(
                              'border rounded-xl flex flex-col items-center justify-center gap-1 px-2.5 py-2.5 transition-all',
                              isSelected
                                ? 'border-restro-green bg-restro-green/10 text-restro-green font-bold shadow-sm ring-2 ring-restro-green/30'
                                : 'border-restro-border-green text-gray-500 dark:text-gray-400 bg-background opacity-75'
                            )}
                          >
                            {pt.icon && PAYMENT_ICONS[pt.icon] ? (
                              <div className="text-lg">{PAYMENT_ICONS[pt.icon]}</div>
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
      )}

      {/* Synchronized Read-Only Variant & Addons Modal Overlay */}
      {activeVariantModal &&
        (() => {
          const selectedItem = menuItems.find(
            (item) => item.id == activeVariantModal.selectedItemId
          );
          if (!selectedItem) return null;

          const variants = selectedItem.variants || [];
          const addons = selectedItem.addons || [];

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs">
              <div className="bg-background border border-restro-border-green rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center pb-3 border-b border-restro-border-green">
                  <div>
                    <h3 className="font-bold text-lg text-restro-text flex items-center gap-2">
                      {t('pos.select_variant_addons', 'Select Variant & Addons')}
                    </h3>
                    <p className="text-xs text-restro-green font-semibold mt-0.5">
                      {selectedItem.title}
                    </p>
                  </div>
                </div>

                <div className="my-5 flex flex-col sm:flex-row gap-5 max-h-[60vh] overflow-y-auto pr-1">
                  {variants.length > 0 && (
                    <div className="flex-1">
                      <h4 className="font-semibold text-xs mb-2.5 text-gray-500 uppercase tracking-wider">
                        {t('pos.variants', 'Variants')}
                      </h4>
                      <div className="flex flex-col gap-2">
                        {variants.map((v, idx) => {
                          const isChecked =
                            String(v.id) === String(activeVariantModal.selectedVariantId);
                          return (
                            <div
                              key={idx}
                              className={clsx(
                                'flex items-center gap-3 p-3 rounded-xl transition-all',
                                isChecked
                                  ? 'bg-restro-green/10 text-restro-text font-bold shadow-sm'
                                  : 'text-gray-500 opacity-60'
                              )}
                            >
                              <input
                                type="radio"
                                readOnly
                                checked={isChecked}
                                className={`radio radio-sm flex-shrink-0 ${
                                  isChecked ? 'radio-neutral' : 'radio-success'
                                }`}
                              />
                              <span className="text-sm flex-1">{v.title}</span>
                              <span className="text-xs font-semibold text-restro-green font-mono">
                                {formatPOSPrice(v.price, currency)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {addons.length > 0 && (
                    <div className="flex-1">
                      <h4 className="font-semibold text-xs mb-2.5 text-gray-500 uppercase tracking-wider">
                        {t('pos.addons', 'Addons')}
                      </h4>
                      <div className="flex flex-col gap-2">
                        {addons.map((a, idx) => {
                          const isChecked = activeVariantModal.selectedAddonIds?.includes(
                            String(a.id)
                          );
                          return (
                            <div
                              key={idx}
                              className={clsx(
                                'flex items-center gap-3 p-3 rounded-xl transition-all',
                                isChecked
                                  ? 'bg-restro-green/10 text-restro-text font-bold shadow-sm'
                                  : 'text-gray-500 opacity-60'
                              )}
                            >
                              <input
                                type="checkbox"
                                readOnly
                                checked={isChecked}
                                className={`checkbox checkbox-sm rounded-md flex-shrink-0 ${
                                  isChecked ? 'checkbox-neutral' : 'checkbox-success'
                                }`}
                              />
                              <span className="text-sm flex-1">{a.title}</span>
                              <span className="text-xs font-semibold text-restro-green font-mono">
                                +{formatPOSPrice(a.price, currency)}
                              </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs">
          <div className="bg-background border border-restro-border-green rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-restro-border-green">
              <div>
                <h3 className="font-bold text-lg text-restro-text flex items-center gap-2">
                  <IconUser size={20} className="text-restro-green" />
                  {t('pos.search_customer', 'Customer Selection')}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t('pos.customizing_item', 'Selecting customer live from POS cashier screen...')}
                </p>
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
                    ? typeof activeCustomerModal.customer === 'object'
                      ? activeCustomerModal.customer.label ||
                        activeCustomerModal.customer.name ||
                        activeCustomerModal.customer.phone
                      : String(activeCustomerModal.customer)
                    : t('pos.walkin_customer', 'Walk-in Customer')}
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  {activeCustomerModal.customer
                    ? t('pos.customer_selected', 'Customer attached to order')
                    : t(
                        'pos.searching_customer',
                        'Searching & selecting customer on cashier screen...'
                      )}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-restro-border-green flex items-center justify-between text-xs text-gray-400">
              <span>
                {t('pos.customer_selection_sync', 'Syncing customer details in real-time...')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Order Token Success Dialog Overlay */}
      {orderSuccessModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-restro-border-green rounded-3xl p-8 max-w-md w-full shadow-2xl relative text-center flex flex-col items-center gap-5">
            <button
              onClick={() =>
                setOrderSuccessModal({
                  isOpen: false,
                  tokenNo: null,
                  orderId: null,
                  payableTotal: 0,
                })
              }
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
                {t('pos.order_id', 'Order ID')}:{' '}
                <span className="font-semibold text-restro-text">#{orderSuccessModal.orderId}</span>
              </p>
            )}

            <button
              onClick={() =>
                setOrderSuccessModal({
                  isOpen: false,
                  tokenNo: null,
                  orderId: null,
                  payableTotal: 0,
                })
              }
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
