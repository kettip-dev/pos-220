import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconArmchair2,
  IconUser,
  IconSearch,
  IconNotes,
  IconQrcode,
  IconScreenShare,
  IconPlus,
  IconMinus,
  IconX,
  IconUsers,
  IconToolsKitchen2,
  IconShoppingBag,
  IconTruckDelivery,
  IconBuildingStore,
  IconChevronDown,
  IconCashRegister,
  IconBed,
} from '@tabler/icons-react';
import { iconStroke } from '../../config/config';
import { clsx } from 'clsx';

// Phones get a stacked header instead of one horizontally-scrolling row
const MOBILE_QUERY = '(max-width: 767px)';
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

/* ------------------------------------------------------------------ */
/* Shared design tokens: one height, one radius, one border colour.    */
/* Every top-level control is 48px tall; inner tap targets are 42px.   */
/* ------------------------------------------------------------------ */
const GROUP =
  'h-12 flex items-stretch rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shrink-0';
const DIVIDER = 'w-px self-stretch my-2 bg-slate-200 dark:bg-slate-700 shrink-0';
const SEGMENT =
  'flex items-center gap-2.5 px-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800 touch-manipulation cursor-pointer select-none outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800 min-w-0';
const ICON_BTN =
  'relative w-[42px] h-[42px] rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition active:scale-95 touch-manipulation cursor-pointer select-none shrink-0';
const LABEL = 'text-[11px] font-medium leading-none text-slate-500 dark:text-slate-400 truncate';
const VALUE = 'text-[13px] font-semibold leading-tight text-slate-900 dark:text-white truncate mt-1';

function CountBadge({ count, tone = 'bg-slate-900 dark:bg-white dark:text-slate-900', pulse = false }) {
  if (!count) return null;
  return (
    <span
      className={clsx(
        'absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold tabular-nums flex items-center justify-center ring-2 ring-white dark:ring-slate-900',
        tone,
        pulse && 'animate-pulse'
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function RequiredDot() {
  return (
    <span className="relative flex w-2 h-2 shrink-0">
      <span className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-60" />
      <span className="relative w-2 h-2 rounded-full bg-amber-500" />
    </span>
  );
}

export default function POSOrderHeader({
  isNavCollapsed = false,
  onToggleNav,
  selectedDiningOption = 'dinein',
  onSelectDiningOption,
  currentSelectedTable,
  onOpenTablePicker,
  guestCount = 1,
  onUpdateGuestCount,
  customer,
  customerType = 'WALKIN',
  onOpenCustomerSearch,
  onClearCustomer,
  user,
  searchQuery = '',
  onSearchChange,
  searchInputRef,
  draftsCount = 0,
  onOpenDrafts,
  qrOrdersCount = 0,
  onOpenQrOrders,
  onDualScreenClick,
  onInitNewOrder,
  registerSession = null,
  isRegisterEnforced = false,
  onOpenRegister,
  isRoomServiceEnabled = false,
  roomService = null,
  onOpenRoomPicker,
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  // `accent` tints the icon only, so modes stay recognisable without a rainbow of badges
  const diningOptions = [
    { key: 'dinein', label: t('pos.dinein', 'Dine-In'), icon: IconToolsKitchen2, accent: 'text-teal-600 dark:text-teal-400' },
    { key: 'takeaway', label: t('pos.takeaway', 'Takeaway'), icon: IconShoppingBag, accent: 'text-sky-600 dark:text-sky-400' },
    { key: 'delivery', label: t('pos.delivery', 'Delivery'), icon: IconTruckDelivery, accent: 'text-orange-600 dark:text-orange-400' },
    ...(isRoomServiceEnabled
      ? [{ key: 'roomservice', label: t('pos.room_service', 'Room Service'), icon: IconBed, accent: 'text-violet-600 dark:text-violet-400' }]
      : []),
  ];

  const isCustomerAttached = customerType !== 'WALKIN' && Boolean(customer);
  const isDeliveryNeedsCustomer = selectedDiningOption === 'delivery' && !isCustomerAttached;
  const rawCustomerName = customer?.name || customer?.label || '';
  const customerName =
    customer?.phone && rawCustomerName.endsWith(` - (${customer.phone})`)
      ? rawCustomerName.slice(0, -` - (${customer.phone})`.length).trim()
      : rawCustomerName;

  const registerLabel = registerSession ? registerSession.register_name : t('register.closed', 'Register closed');

  /* ---------------- building blocks (shared by phone + tablet) ---------------- */

  const renderDiningSelector = ({ fluid = false } = {}) => (
    <div
      role="radiogroup"
      aria-label={t('pos.order_type', 'Order type')}
      className={clsx(
        'h-12 p-[3px] rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
        fluid ? 'flex-1 min-w-0 grid gap-[3px]' : 'flex items-stretch gap-[3px] shrink-0',
        fluid && (diningOptions.length > 3 ? 'grid-cols-4' : 'grid-cols-3')
      )}
    >
      {diningOptions.map(({ key, label, icon: IconComponent, accent }) => {
        const isActive = selectedDiningOption === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelectDiningOption(key)}
            title={label}
            className={clsx(
              'min-h-[40px] min-w-[42px] rounded-[9px] px-2.5 flex items-center justify-center gap-1.5 text-[13px] transition active:scale-95 touch-manipulation cursor-pointer select-none',
              fluid && 'min-w-0 px-1',
              isActive
                ? 'bg-[#0D233A] dark:bg-white text-white dark:text-slate-900 font-semibold shadow-sm'
                : 'text-slate-600 dark:text-slate-300 font-medium hover:bg-white/70 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <IconComponent size={17} stroke={2} className={clsx('shrink-0', !isActive && accent)} />
            <span
              className={clsx(
                'truncate',
                fluid ? 'text-xs' : isActive ? 'inline' : 'hidden xl:inline'
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderTableSegment = ({ className = '' } = {}) => (
    <button
      type="button"
      onClick={onOpenTablePicker}
      className={clsx(SEGMENT, className)}
      title={t('pos.select_table', 'Select Table')}
    >
      <IconArmchair2
        size={20}
        stroke={iconStroke}
        className={clsx('shrink-0', currentSelectedTable ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400')}
      />
      <div className="min-w-0 max-w-[140px]">
        <p className={LABEL}>{t('pos.table', 'Table')}</p>
        <p className={clsx(VALUE, !currentSelectedTable && '!text-slate-500 dark:!text-slate-400 !font-medium')}>
          {currentSelectedTable
            ? `${currentSelectedTable.table_title} · ${currentSelectedTable.seating_capacity} ${t('pos.seats_short', 'seats')}`
            : t('pos.select_table', 'Select Table')}
        </p>
      </div>
      <IconChevronDown size={16} stroke={2} className="text-slate-400 shrink-0 ml-auto" />
    </button>
  );

  const renderGuestStepper = () => (
    <div
      className="flex items-center gap-0.5 pl-3 pr-[3px] shrink-0"
      role="group"
      aria-label={t('pos.covers', 'Guests')}
      title={t('pos.covers', 'Guests')}
    >
      <IconUsers size={19} stroke={iconStroke} className="text-slate-400 shrink-0 mr-1" />
      <button
        type="button"
        onClick={() => onUpdateGuestCount && onUpdateGuestCount(Math.max(1, guestCount - 1))}
        disabled={guestCount <= 1}
        className={clsx(ICON_BTN, 'disabled:opacity-35 disabled:pointer-events-none')}
        aria-label={t('pos.decrease_guests', 'Decrease guest count')}
      >
        <IconMinus size={16} stroke={2.4} />
      </button>
      <span className="min-w-[22px] text-center text-[15px] font-semibold tabular-nums text-slate-900 dark:text-white">
        {guestCount}
      </span>
      <button
        type="button"
        onClick={() => onUpdateGuestCount && onUpdateGuestCount(guestCount + 1)}
        className={ICON_BTN}
        aria-label={t('pos.increase_guests', 'Increase guest count')}
      >
        <IconPlus size={16} stroke={2.4} />
      </button>
    </div>
  );

  // Room service: which room the tray goes to (mirrors the table segment for dine-in)
  const renderRoomSegment = ({ className = '' } = {}) => (
    <button
      type="button"
      onClick={onOpenRoomPicker}
      className={clsx(SEGMENT, !roomService && 'bg-amber-50/70 dark:bg-amber-500/10', className)}
      title={t('room_service.pick_room', 'Pick guest room')}
    >
      <IconBed
        size={20}
        stroke={iconStroke}
        className={clsx('shrink-0', roomService ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600')}
      />
      <div className="min-w-0 max-w-[150px]">
        <p className={clsx(LABEL, 'flex items-center gap-1.5', !roomService && '!text-amber-700 dark:!text-amber-300')}>
          {roomService ? `${t('room_service.room', 'Room')} ${roomService.roomNumber}` : (
            <>
              <RequiredDot />
              {t('pos.required', 'Required')}
            </>
          )}
        </p>
        <p className={VALUE}>
          {roomService ? roomService.guestName || t('room_service.guest', 'Guest') : t('room_service.pick_room', 'Pick guest room')}
        </p>
      </div>
      <IconChevronDown size={16} stroke={2} className="text-slate-400 shrink-0 ml-auto" />
    </button>
  );

  const renderCustomerSegment = ({ className = '', fluid = false } = {}) => (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenCustomerSearch}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenCustomerSearch && onOpenCustomerSearch();
        }
      }}
      className={clsx(SEGMENT, isDeliveryNeedsCustomer && 'bg-amber-50/70 dark:bg-amber-500/10', className)}
      title={t('pos.customer_shortcut', 'Customer & Loyalty (F3)')}
    >
      <span
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold',
          isCustomerAttached
            ? 'bg-teal-600 text-white'
            : isDeliveryNeedsCustomer
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        )}
      >
        {isCustomerAttached && customerName ? customerName.trim().slice(0, 2).toUpperCase() : <IconUser size={16} stroke={2} />}
      </span>
      <div className={clsx('min-w-0', fluid ? 'flex-1' : 'max-w-[150px]')}>
        <p
          className={clsx(
            LABEL,
            'flex items-center gap-1.5',
            isDeliveryNeedsCustomer && '!text-amber-700 dark:!text-amber-300'
          )}
        >
          {isCustomerAttached ? (
            <>
              <span className="truncate tabular-nums">{customer?.phone || t('pos.customer', 'Customer')}</span>
              {customer?.customer_group_name && (
                <span
                  className="shrink-0 px-1.5 py-px rounded text-white text-[9px] font-bold leading-tight"
                  style={{ backgroundColor: customer.customer_group_color || '#6366f1' }}
                >
                  {customer.customer_group_name}
                  {customer.group_discount_value > 0 &&
                    ` · ${customer.group_discount_type === 'PERCENTAGE' ? `${customer.group_discount_value}%` : `$${customer.group_discount_value}`}`}
                </span>
              )}
            </>
          ) : isDeliveryNeedsCustomer ? (
            <>
              <RequiredDot />
              {t('pos.required', 'Required')}
            </>
          ) : (
            t('pos.customer', 'Customer')
          )}
        </p>
        <p className={VALUE}>
          {isCustomerAttached
            ? customerName || customer?.phone
            : isDeliveryNeedsCustomer
              ? t('pos.assign_customer', 'Assign Customer')
              : t('pos.walkin_customer', 'Walk-in')}
        </p>
      </div>
      {isCustomerAttached ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClearCustomer();
          }}
          className="w-8 h-8 -mr-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15 flex items-center justify-center transition active:scale-90 shrink-0 ml-auto"
          title={t('pos.reset_walkin', 'Reset to Walk-in')}
          aria-label={t('pos.reset_walkin', 'Reset to Walk-in')}
        >
          <IconX size={15} stroke={2.4} />
        </button>
      ) : (
        <IconChevronDown size={16} stroke={2} className="text-slate-400 shrink-0 ml-auto" />
      )}
    </div>
  );

  const renderQuickActions = () => (
    <div className={clsx(GROUP, 'items-center gap-0.5 px-[2px]')}>
      <button type="button" onClick={onOpenDrafts} className={ICON_BTN} title={t('pos.drafts_list', 'Held Orders & Drafts')} aria-label={t('pos.drafts_list', 'Held Orders & Drafts')}>
        <IconNotes size={20} stroke={iconStroke} />
        <CountBadge count={draftsCount} tone="bg-amber-500" />
      </button>
      <button type="button" onClick={onOpenQrOrders} className={ICON_BTN} title={t('pos.qr_menu_orders', 'QR Menu Orders')} aria-label={t('pos.qr_menu_orders', 'QR Menu Orders')}>
        <IconQrcode size={20} stroke={iconStroke} />
        <CountBadge count={qrOrdersCount} tone="bg-rose-600" pulse />
      </button>
      {onDualScreenClick && (
        <button type="button" onClick={onDualScreenClick} className={clsx(ICON_BTN, 'hidden md:flex')} title={t('pos.dual_screen', 'Customer Dual Screen Display')} aria-label={t('pos.dual_screen', 'Customer Dual Screen Display')}>
          <IconScreenShare size={20} stroke={iconStroke} />
        </button>
      )}
      {onOpenRegister && (
        <>
          <span className={clsx(DIVIDER, 'mx-0.5')} />
          <button
            type="button"
            onClick={onOpenRegister}
            className={clsx(
              ICON_BTN,
              !registerSession && isRegisterEnforced && '!text-rose-600 bg-rose-50 dark:bg-rose-500/10 animate-pulse'
            )}
            title={registerLabel}
            aria-label={registerLabel}
          >
            <IconCashRegister size={20} stroke={iconStroke} />
            <span
              className={clsx(
                'absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900',
                registerSession ? 'bg-emerald-500' : 'bg-rose-500'
              )}
            />
          </button>
        </>
      )}
    </div>
  );

  /* ---------------------------------- phone ---------------------------------- */

  if (isMobile) {
    return (
      <header className="w-full bg-white dark:bg-[#0D1829] border-b border-slate-200 dark:border-slate-800 px-1 pt-1 pb-2 space-y-2 select-none shrink-0">
        {/* Row 1: order type + new ticket */}
        <div className="flex items-center gap-2">
          {renderDiningSelector({ fluid: true })}
          <button
            type="button"
            onClick={onInitNewOrder}
            className="w-12 h-12 rounded-xl bg-[#2CA01C] hover:bg-[#248417] text-white flex items-center justify-center active:scale-95 transition touch-manipulation cursor-pointer shrink-0"
            title={t('pos.new_order', 'New Ticket')}
            aria-label={t('pos.new_order', 'New Ticket')}
          >
            <IconPlus size={22} stroke={2.5} />
          </button>
        </div>

        {/* Row 2: order context (table / room + customer) */}
        <div className={clsx(GROUP, 'w-full')}>
          {selectedDiningOption === 'dinein' && (
            <>
              {renderTableSegment({ className: 'flex-1' })}
              <span className={DIVIDER} />
            </>
          )}
          {selectedDiningOption === 'roomservice' && (
            <>
              {renderRoomSegment({ className: 'flex-1' })}
              <span className={DIVIDER} />
            </>
          )}
          {renderCustomerSegment({ className: 'flex-1', fluid: true })}
        </div>

        {/* Row 3: search + quick actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <IconSearch size={17} stroke={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('pos.search_items_placeholder', 'Search menu items...')}
              className="w-full h-12 pl-10 pr-11 rounded-xl text-sm border border-slate-200 dark:border-slate-700 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-[3px] top-1/2 -translate-y-1/2 w-[42px] h-[42px] rounded-lg text-slate-500 flex items-center justify-center active:scale-90"
                aria-label={t('pos.clear_search', 'Clear search')}
              >
                <IconX size={16} stroke={iconStroke} />
              </button>
            )}
          </div>
          {renderQuickActions()}
        </div>
      </header>
    );
  }

  /* ------------------------------ tablet / desktop ------------------------------ */

  return (
    <header className="w-full bg-white dark:bg-[#0D1829] border-b border-slate-200 dark:border-slate-800 px-2 sm:px-3 py-2 select-none shrink-0">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x">
        {isNavCollapsed && onToggleNav && (
          <button
            type="button"
            onClick={onToggleNav}
            className={clsx(GROUP, 'items-center gap-1.5 px-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer')}
            title={t('navbar.expand_nav', 'Open Navigation')}
            aria-label={t('navbar.expand_nav', 'Open Navigation')}
          >
            <IconBuildingStore size={20} stroke={iconStroke} className="text-[#2CA01C]" />
            <IconChevronDown size={15} stroke={2} className="text-slate-400" />
          </button>
        )}

        {renderDiningSelector()}

        {/* Order context: everything that describes *this* ticket, in one bar */}
        <div className={GROUP}>
          {selectedDiningOption === 'dinein' && (
            <>
              {renderTableSegment()}
              <span className={clsx(DIVIDER, 'hidden sm:block')} />
              <div className="hidden sm:flex">{renderGuestStepper()}</div>
              <span className={DIVIDER} />
            </>
          )}
          {selectedDiningOption === 'roomservice' && (
            <>
              {renderRoomSegment()}
              <span className={DIVIDER} />
            </>
          )}
          {renderCustomerSegment()}
        </div>

        <div className="flex-1" />

        {renderQuickActions()}

        <button
          type="button"
          onClick={onInitNewOrder}
          className="h-12 min-w-12 px-3 lg:px-4 rounded-xl bg-[#2CA01C] hover:bg-[#248417] text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 touch-manipulation cursor-pointer select-none shrink-0"
          title={t('pos.new_order', 'New Ticket')}
          aria-label={t('pos.new_order', 'New Ticket')}
        >
          <IconPlus size={20} stroke={2.5} />
          <span className="hidden lg:inline">{t('pos.new_short', 'New')}</span>
        </button>
      </div>
    </header>
  );
}
