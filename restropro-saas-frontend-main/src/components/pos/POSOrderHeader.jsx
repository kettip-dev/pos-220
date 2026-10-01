import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { 
  IconArmchair, 
  IconArmchair2, 
  IconUser, 
  IconSearch, 
  IconNotes, 
  IconQrcode, 
  IconScreenShare, 
  IconPlus, 
  IconX, 
  IconUsers, 
  IconChefHat,
  IconToolsKitchen2,
  IconShoppingBag,
  IconTruckDelivery,
  IconBuildingStore,
  IconChevronDown
} from '@tabler/icons-react';
import { iconStroke } from '../../config/config';
import { clsx } from 'clsx';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { theme } = useTheme();

  const diningOptions = [
    { key: 'dinein', label: t('pos.dinein', 'Dine-In'), icon: IconToolsKitchen2 },
    { key: 'takeaway', label: t('pos.takeaway', 'Takeaway'), icon: IconShoppingBag },
    { key: 'delivery', label: t('pos.delivery', 'Delivery'), icon: IconTruckDelivery }
  ];

  return (
    <header className="w-full bg-background border-b border-restro-border-green/80 px-2 sm:px-3 py-1.5 sm:py-2 select-none shrink-0">
      <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 overflow-x-auto scrollbar-none py-0.5 touch-pan-x">
        
        {/* Left Segment: Navigation Trigger (When Collapsed), Dining Mode Tabs & Table / Guests */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Collapsed Operational Navigation Trigger Button */}
          {isNavCollapsed && onToggleNav && (
            <button
              type="button"
              onClick={onToggleNav}
              className="min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-2xl bg-[#0D233A] hover:bg-[#16385c] text-white border border-[#1C3550] text-xs font-bold transition active:scale-95 flex items-center gap-1.5 shadow-xs touch-manipulation cursor-pointer select-none shrink-0"
              title={t('navbar.expand_nav', 'Open Navigation')}
            >
              <div className="w-5 h-5 rounded-md bg-[#2CA01C] flex items-center justify-center text-white shrink-0 shadow-2xs">
                <IconBuildingStore size={13} stroke={2.2} />
              </div>
              <span className="hidden sm:inline font-bold text-[11px] text-slate-200">
                {t('navbar.nav', 'Nav')}
              </span>
              <IconChevronDown size={14} stroke={2.5} className="text-emerald-400" />
            </button>
          )}

          {/* Dining Type Pill Selector (Tablet touch height & tactile feedback) */}
          <div className="flex items-center p-0.5 sm:p-1 rounded-2xl bg-restro-gray border border-restro-border-green shadow-xs shrink-0">
            {diningOptions.map(({ key, label, icon: IconComponent }) => {
              const isActive = selectedDiningOption === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectDiningOption(key)}
                  className={clsx(
                    "min-h-[42px] px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 touch-manipulation cursor-pointer select-none shrink-0",
                    isActive 
                      ? "bg-restro-green text-white shadow-sm" 
                      : "text-restro-text hover:bg-background/80"
                  )}
                  aria-pressed={isActive}
                >
                  <IconComponent size={16} stroke={iconStroke} className="shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Dine-In Context: Table & Guest Covers */}
          {selectedDiningOption === 'dinein' && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Table Picker Pill */}
              <button
                type="button"
                onClick={onOpenTablePicker}
                className={clsx(
                  "min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-2xl border transition active:scale-95 flex items-center gap-1.5 sm:gap-2 touch-manipulation cursor-pointer shadow-xs select-none shrink-0",
                  currentSelectedTable
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold"
                    : "bg-restro-gray border-restro-border-green text-restro-text hover:bg-restro-button-hover"
                )}
                title={t('pos.select_table', 'Select Table')}
              >
                <IconArmchair2 size={18} className={currentSelectedTable ? "text-restro-green" : "text-gray-400"} stroke={iconStroke} />
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
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500 font-mono font-semibold hidden md:inline">
                  {currentSelectedTable ? t('pos.change', 'Change') : t('tables.floor_plan', 'Floor')}
                </span>
              </button>

              {/* Guest Covers Stepper */}
              <div className="hidden sm:flex items-center min-h-[42px] px-2 rounded-2xl bg-restro-gray border border-restro-border-green gap-1 text-xs select-none shrink-0">
                <span className="text-gray-400 flex items-center gap-1 pl-0.5 pr-0.5 font-semibold text-[11px]">
                  <IconUsers size={14} stroke={iconStroke} />
                  <span className="hidden lg:inline">{t('pos.covers', 'Guests')}:</span>
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateGuestCount && onUpdateGuestCount(Math.max(1, guestCount - 1))}
                  className="w-7 h-7 rounded-lg bg-background hover:bg-restro-button-hover text-restro-text font-bold flex items-center justify-center transition active:scale-90 cursor-pointer shadow-2xs"
                  title="Decrease guest count"
                >
                  -
                </button>
                <span className="font-extrabold px-1.5 text-center min-w-[18px]">{guestCount}</span>
                <button
                  type="button"
                  onClick={() => onUpdateGuestCount && onUpdateGuestCount(guestCount + 1)}
                  className="w-7 h-7 rounded-lg bg-background hover:bg-restro-button-hover text-restro-text font-bold flex items-center justify-center transition active:scale-90 cursor-pointer shadow-2xs"
                  title="Increase guest count"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Customer Quick Chip */}
          <div 
            onClick={onOpenCustomerSearch}
            className="flex items-center min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-2xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover cursor-pointer transition active:scale-95 shadow-xs gap-1.5 sm:gap-2 select-none shrink-0"
            title={t('pos.customer', 'Customer')}
          >
            <div className="w-6 h-6 rounded-lg bg-restro-green/15 text-restro-green flex items-center justify-center shrink-0">
              <IconUser size={15} stroke={iconStroke} />
            </div>
            <div className="text-left leading-tight min-w-0 max-w-[75px] sm:max-w-[110px] md:max-w-[140px]">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider leading-none">
                {t('pos.customer', 'Customer')}
              </p>
              <p className="text-xs font-bold text-restro-text truncate mt-0.5">
                {customerType === 'WALKIN' ? t('pos.walkin_customer', 'Walk-in') : customer?.name}
              </p>
            </div>
            {customerType !== 'WALKIN' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearCustomer();
                }}
                className="w-5 h-5 rounded-full hover:bg-red-500/10 text-gray-400 hover:text-red-500 flex items-center justify-center"
                title="Reset to Walk-in"
              >
                <IconX size={13} stroke={2.5} />
              </button>
            )}
          </div>
        </div>

        {/* Center / Right Segment: Fast Search & Register Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end ml-auto">
          
          {/* Fast Search Input with Keyboard Shortcut Badge */}
          <div className="relative w-32 sm:w-44 md:w-52 lg:w-60 shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <IconSearch size={15} stroke={iconStroke} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('pos.search_items_placeholder', 'Search...')}
              className="w-full pl-8 pr-10 py-1.5 min-h-[42px] rounded-2xl text-xs font-medium border border-restro-border-green bg-background text-restro-text placeholder-gray-400 focus:outline-restro-green transition shadow-xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-restro-gray hover:bg-restro-button-hover text-gray-400 hover:text-restro-text flex items-center justify-center cursor-pointer active:scale-90"
              >
                <IconX size={13} stroke={iconStroke} />
              </button>
            ) : (
              <span className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 items-center px-1.5 py-0.5 rounded bg-restro-gray text-[10px] font-mono font-bold text-gray-400 border border-restro-border-green pointer-events-none">
                /
              </span>
            )}
          </div>

          {/* Action Quick Badges: Drafts */}
          <button
            type="button"
            onClick={onOpenDrafts}
            className="relative min-h-[42px] min-w-[42px] px-2.5 sm:px-3 py-1.5 rounded-2xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs touch-manipulation cursor-pointer select-none shrink-0"
            title={t('pos.drafts_list', 'Drafts')}
          >
            <IconNotes size={16} stroke={iconStroke} />
            <span className="hidden 2xl:inline">{t('pos.drafts', 'Drafts')}</span>
            {draftsCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                {draftsCount}
              </span>
            )}
          </button>

          {/* QR Orders Notification Badge */}
          <button
            type="button"
            onClick={onOpenQrOrders}
            className="relative min-h-[42px] min-w-[42px] px-2.5 sm:px-3 py-1.5 rounded-2xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs touch-manipulation cursor-pointer select-none shrink-0"
            title={t('pos.qr_menu_orders', 'QR Orders')}
          >
            <IconQrcode size={16} stroke={iconStroke} />
            <span className="hidden 2xl:inline">QR</span>
            {qrOrdersCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center animate-bounce">
                {qrOrdersCount}
              </span>
            )}
          </button>

          {/* Live Orders Route Link */}
          <Link
            to="/dashboard/orders"
            className="min-h-[42px] min-w-[42px] px-2.5 sm:px-3 py-1.5 rounded-2xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs touch-manipulation select-none shrink-0"
            title={t('pos.table_orders', 'Live Orders')}
          >
            <IconArmchair size={16} stroke={iconStroke} />
            <span className="hidden 2xl:inline">{t('pos.table_orders', 'Orders')}</span>
          </Link>

          {/* Dual Screen Launcher */}
          {onDualScreenClick && (
            <button
              type="button"
              onClick={onDualScreenClick}
              className="min-h-[42px] min-w-[42px] px-2 sm:px-3 py-1.5 rounded-2xl border border-restro-border-green bg-restro-gray hover:bg-restro-button-hover text-restro-text text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs touch-manipulation cursor-pointer select-none shrink-0"
              title={t('pos.dual_screen', 'Dual Screen Display')}
            >
              <IconScreenShare size={16} stroke={iconStroke} />
              <span className="hidden 2xl:inline">{t('pos.dual_screen', 'Display')}</span>
            </button>
          )}

          {/* New Order Trigger */}
          <button
            type="button"
            onClick={onInitNewOrder}
            className="min-h-[42px] px-3 sm:px-4 py-1.5 rounded-2xl bg-restro-green hover:bg-restro-green-button-hover text-white text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 shadow-sm touch-manipulation cursor-pointer select-none shrink-0"
            title={t('pos.new_order', 'New Ticket')}
          >
            <IconPlus size={16} stroke={2.5} />
            <span className="hidden sm:inline">{t('pos.new_order', 'New Order')}</span>
          </button>

        </div>
      </div>
    </header>
  );
}
