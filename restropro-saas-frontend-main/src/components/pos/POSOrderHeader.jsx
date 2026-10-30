import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  IconArmchair2, 
  IconUser, 
  IconSearch, 
  IconNotes, 
  IconQrcode, 
  IconScreenShare, 
  IconPlus, 
  IconX, 
  IconUsers, 
  IconToolsKitchen2,
  IconShoppingBag,
  IconTruckDelivery,
  IconBuildingStore,
  IconChevronDown
} from '@tabler/icons-react';
import { iconStroke } from '../../config/config';
import { clsx } from 'clsx';

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
}) {
  const { t } = useTranslation();

  const diningOptions = [
    { key: 'dinein', label: t('pos.dinein', 'Dine-In'), icon: IconToolsKitchen2, badgeBg: 'bg-[#008489]' },
    { key: 'takeaway', label: t('pos.takeaway', 'Takeaway'), icon: IconShoppingBag, badgeBg: 'bg-[#0077C5]' },
    { key: 'delivery', label: t('pos.delivery', 'Delivery'), icon: IconTruckDelivery, badgeBg: 'bg-[#EA580C]' }
  ];

  return (
    <header className="w-full bg-white dark:bg-[#0D1829] border-b border-[#E3E5E8] dark:border-slate-800 px-2.5 sm:px-3.5 py-2 select-none shrink-0">
      <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none py-0.5 touch-pan-x">
        
        {/* Left Segment: Navigation Trigger (When Collapsed), Dining Mode Tabs & Table / Guests */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Collapsed Operational Navigation Trigger Button */}
          {isNavCollapsed && onToggleNav && (
            <button
              type="button"
              onClick={onToggleNav}
              className="min-h-[42px] px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 hover:bg-[#F4F5F8] dark:hover:bg-slate-800 text-gray-800 dark:text-slate-100 border border-[#D4D7DC] dark:border-slate-700 text-xs font-bold transition active:scale-95 flex items-center gap-1.5 shadow-2xs touch-manipulation cursor-pointer select-none shrink-0"
              title={t('navbar.expand_nav', 'Open Navigation')}
            >
              <div className="w-5 h-5 rounded-full bg-[#2CA01C] flex items-center justify-center text-white shrink-0 shadow-2xs">
                <IconBuildingStore size={12} stroke={2.2} />
              </div>
              <span className="hidden sm:inline font-bold text-[11px]">
                {t('navbar.nav', 'Nav')}
              </span>
              <IconChevronDown size={14} stroke={2} className="text-gray-500" />
            </button>
          )}

          {/* QBO Style Dining Type Pill Selector */}
          <div className="flex items-center p-1 rounded-full bg-[#F4F5F8] dark:bg-slate-800/80 border border-[#E3E5E8] dark:border-slate-700 shrink-0 gap-1">
            {diningOptions.map(({ key, label, icon: IconComponent, badgeBg }) => {
              const isActive = selectedDiningOption === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectDiningOption(key)}
                  className={clsx(
                    "min-h-[36px] pl-1.5 pr-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 touch-manipulation cursor-pointer select-none shrink-0",
                    isActive 
                      ? "bg-[#0D233A] text-white shadow-xs font-bold" 
                      : "text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700"
                  )}
                  aria-pressed={isActive}
                >
                  <span className={clsx("w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0", badgeBg)}>
                    <IconComponent size={12} stroke={2.2} />
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Dine-In Context: Table & Guest Covers */}
          {selectedDiningOption === 'dinein' && (
            <div className="flex items-center gap-2 shrink-0">
              {/* Table Picker Pill */}
              <button
                type="button"
                onClick={onOpenTablePicker}
                className={clsx(
                  "min-h-[42px] px-3 py-1.5 rounded-xl border transition active:scale-95 flex items-center gap-2 touch-manipulation cursor-pointer shadow-2xs select-none shrink-0",
                  currentSelectedTable
                    ? "bg-[#F4F5F8] dark:bg-slate-800 border-[#0D233A] dark:border-emerald-500 text-gray-900 dark:text-white font-bold"
                    : "bg-white dark:bg-slate-900 border-[#D4D7DC] dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-[#F4F5F8] dark:hover:bg-slate-800"
                )}
                title={t('pos.select_table', 'Select Table')}
              >
                <IconArmchair2 size={17} className={currentSelectedTable ? "text-[#008489]" : "text-gray-400"} stroke={iconStroke} />
                <div className="text-left leading-tight min-w-0 max-w-[85px] sm:max-w-[120px] md:max-w-[150px]">
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider leading-none">
                    {t('pos.table', 'Table')}
                  </p>
                  <p className="text-xs font-bold truncate mt-0.5">
                    {currentSelectedTable 
                      ? `${currentSelectedTable.table_title} (${currentSelectedTable.seating_capacity}s)`
                      : t('pos.select_table', 'Select Table')}
                  </p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F4F5F8] dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 font-semibold hidden md:inline">
                  {currentSelectedTable ? t('pos.change', 'Change') : t('tables.floor_plan', 'Floor')}
                </span>
              </button>

              {/* Guest Covers Stepper */}
              <div className="hidden sm:flex items-center min-h-[42px] px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-[#D4D7DC] dark:border-slate-700 gap-1 text-xs select-none shrink-0 shadow-2xs">
                <span className="text-gray-500 dark:text-slate-400 flex items-center gap-1 pr-1 font-semibold text-[11px]">
                  <IconUsers size={14} stroke={iconStroke} />
                  <span className="hidden lg:inline">{t('pos.covers', 'Guests')}:</span>
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateGuestCount && onUpdateGuestCount(Math.max(1, guestCount - 1))}
                  className="w-7 h-7 rounded-lg bg-[#F4F5F8] dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 font-bold flex items-center justify-center transition active:scale-90 cursor-pointer"
                  title="Decrease guest count"
                >
                  -
                </button>
                <span className="font-bold text-gray-900 dark:text-white px-1.5 text-center min-w-[18px]">{guestCount}</span>
                <button
                  type="button"
                  onClick={() => onUpdateGuestCount && onUpdateGuestCount(guestCount + 1)}
                  className="w-7 h-7 rounded-lg bg-[#F4F5F8] dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 font-bold flex items-center justify-center transition active:scale-90 cursor-pointer"
                  title="Increase guest count"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Customer Quick Chip */}
          {(() => {
            const isAttached = customerType !== 'WALKIN' && Boolean(customer);
            const isDeliveryNeedsCustomer = selectedDiningOption === 'delivery' && !isAttached;
            const rawName = customer?.name || customer?.label || '';
            const cleanName =
              customer?.phone && rawName.endsWith(` - (${customer.phone})`)
                ? rawName.slice(0, -` - (${customer.phone})`.length).trim()
                : rawName;

            return (
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
                className={clsx(
                  "flex items-center min-h-[42px] px-3 py-1.5 rounded-xl border cursor-pointer transition active:scale-95 shadow-2xs gap-2 select-none shrink-0 touch-manipulation",
                  isAttached
                    ? "bg-[#00A699]/10 dark:bg-[#00A699]/15 border-[#00A699] text-gray-900 dark:text-white"
                    : isDeliveryNeedsCustomer
                    ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200 animate-pulse"
                    : "border-[#D4D7DC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#F4F5F8] dark:hover:bg-slate-800"
                )}
                title={t('pos.customer_shortcut', 'Customer & Loyalty (F3)')}
              >
                <div
                  className={clsx(
                    "w-6 h-6 rounded-full text-white flex items-center justify-center shrink-0 text-[10px] font-black",
                    isAttached
                      ? "bg-[#00A699]"
                      : isDeliveryNeedsCustomer
                      ? "bg-[#EA580C]"
                      : "bg-gray-500 dark:bg-slate-700"
                  )}
                >
                  {isAttached && cleanName ? (
                    cleanName.trim().slice(0, 2).toUpperCase()
                  ) : (
                    <IconUser size={13} stroke={2.2} />
                  )}
                </div>
                <div className="text-left leading-tight min-w-0 max-w-[90px] sm:max-w-[130px] md:max-w-[165px]">
                  <p
                    className={clsx(
                      "text-[10px] uppercase font-bold tracking-wider leading-none truncate",
                      isAttached
                        ? "text-[#00A699] font-mono"
                        : isDeliveryNeedsCustomer
                        ? "text-[#EA580C]"
                        : "text-gray-500"
                    )}
                  >
                    {isAttached && customer?.phone
                      ? customer.phone
                      : isDeliveryNeedsCustomer
                      ? t('pos.required', 'Required')
                      : t('pos.customer', 'Customer')}
                  </p>
                  <p className="text-xs font-bold text-gray-800 dark:text-slate-100 truncate mt-0.5">
                    {isAttached
                      ? cleanName || customer?.phone
                      : isDeliveryNeedsCustomer
                      ? t('pos.assign_customer', 'Assign Customer')
                      : t('pos.walkin_customer', 'Walk-in')}
                  </p>
                </div>
                {isAttached ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearCustomer();
                    }}
                    className="w-5 h-5 rounded-full hover:bg-red-500/15 text-gray-400 hover:text-red-500 flex items-center justify-center transition active:scale-90"
                    title={t('pos.reset_walkin', 'Reset to Walk-in')}
                  >
                    <IconX size={13} stroke={2.5} />
                  </button>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F4F5F8] dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 font-semibold hidden xl:inline">
                    {t('pos.add', '+ Add')}
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* Center / Right Segment: QBO Search & Register Controls */}
        <div className="flex items-center gap-2 shrink-0 justify-end ml-auto">
          
          {/* QBO Style Gray Search Input */}
          <div className="relative w-36 sm:w-48 md:w-56 lg:w-64 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
              <IconSearch size={15} stroke={2} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('pos.search_items_placeholder', 'Search menu items...')}
              className="w-full pl-9 pr-9 py-1.5 min-h-[42px] rounded-lg text-xs font-medium border border-transparent focus:border-[#008489] bg-[#F4F5F8] hover:bg-[#ECEEF1] dark:bg-slate-800 text-gray-800 dark:text-slate-100 placeholder-gray-500 outline-none transition"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white dark:bg-slate-700 text-gray-500 hover:text-gray-900 flex items-center justify-center cursor-pointer active:scale-90"
              >
                <IconX size={13} stroke={iconStroke} />
              </button>
            ) : (
              <span className="hidden md:flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-[10px] font-mono font-bold text-gray-400 border border-gray-200 dark:border-slate-700 pointer-events-none">
                /
              </span>
            )}
          </div>

          {/* Quick Register Actions (QBO Bordered Pill Toolbar) */}
          <div className="flex items-center p-0.5 rounded-xl bg-[#F4F5F8] dark:bg-slate-800 border border-[#E3E5E8] dark:border-slate-700 shrink-0 gap-0.5">
            {/* Drafts Drawer Trigger */}
            <button
              type="button"
              onClick={onOpenDrafts}
              className="relative min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer select-none shrink-0"
              title={t('pos.drafts_list', 'Held Orders & Drafts')}
            >
              <IconNotes size={16} stroke={iconStroke} />
              <span className="hidden xl:inline">{t('pos.drafts', 'Drafts')}</span>
              {draftsCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">
                  {draftsCount}
                </span>
              )}
            </button>

            {/* QR Orders Trigger */}
            <button
              type="button"
              onClick={onOpenQrOrders}
              className="relative min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer select-none shrink-0"
              title={t('pos.qr_menu_orders', 'QR Menu Orders')}
            >
              <IconQrcode size={16} stroke={iconStroke} />
              <span className="hidden xl:inline">QR</span>
              {qrOrdersCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#E11D48] text-white text-[10px] font-black flex items-center justify-center animate-pulse shadow-2xs">
                  {qrOrdersCount}
                </span>
              )}
            </button>

            {/* Customer Dual Screen Display */}
            {onDualScreenClick && (
              <button
                type="button"
                onClick={onDualScreenClick}
                className="min-h-[40px] px-2.5 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer select-none shrink-0"
                title={t('pos.dual_screen', 'Customer Dual Screen Display')}
              >
                <IconScreenShare size={16} stroke={iconStroke} />
                <span className="hidden 2xl:inline">{t('pos.dual_screen', 'Display')}</span>
              </button>
            )}
          </div>

          {/* QBO Green '+ New' Order Trigger */}
          <button
            type="button"
            onClick={onInitNewOrder}
            className="min-h-[42px] px-3.5 sm:px-4 py-1.5 rounded-lg bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs touch-manipulation cursor-pointer select-none shrink-0"
            title={t('pos.new_order', 'New Ticket')}
          >
            <IconPlus size={16} stroke={2.5} />
            <span className="hidden sm:inline">{t('pos.new_order', 'New')}</span>
          </button>

        </div>
      </div>
    </header>
  );
}
