import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconX,
  IconUser,
  IconUserPlus,
  IconSearch,
  IconPhone,
  IconMail,
  IconCalendar,
  IconCheck,
  IconSparkles,
  IconReceipt,
  IconCoin,
  IconPlus,
  IconPencil,
  IconUserCheck,
  IconUsers,
  IconArrowLeft,
  IconLoader2,
  IconShoppingBag,
  IconHistory,
} from '@tabler/icons-react';
import { clsx } from 'clsx';
import { toast } from 'react-hot-toast';
import { mutate } from 'swr';
import { iconStroke } from '../../config/config';
import {
  useCustomers,
  useCustomerInsights,
  searchCustomer,
  addCustomer,
  updateCustomer,
} from '../../controllers/customers.controller';
import { useCustomerGroups } from '../../controllers/customer_groups.controller';
import { validateEmail } from '../../utils/emailValidator';
import { validatePhone } from '../../utils/phoneValidator';

export default function POSCustomerDrawer({
  isOpen,
  onClose,
  selectedCustomer,
  customerType = 'WALKIN',
  onSelectCustomer,
  onClearCustomer,
  currency = '$',
  menuItems = [],
  onQuickAddMenuItem,
}) {
  const { t } = useTranslation();
  const searchInputRef = useRef(null);

  // Modes: 'SEARCH' | 'CREATE' | 'EDIT'
  const [mode, setMode] = useState('SEARCH');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Create / Edit
  const [formPhone, setFormPhone] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formGender, setFormGender] = useState('');
  const [formGroupId, setFormGroupId] = useState('');

  const { customerGroups = [] } = useCustomerGroups();

  // Recent customers via SWR (loaded when drawer opens)
  const { data: recentData, APIURL: recentApiUrl, isLoading: isLoadingRecent } = useCustomers({
    page: 1,
    perPage: 15,
    filter: '',
  });

  const activePhone =
    customerType === 'CUSTOMER' && selectedCustomer?.phone ? selectedCustomer.phone : null;

  // Insights for currently attached customer
  const { data: insightsData, isLoading: isLoadingInsights } = useCustomerInsights(
    isOpen && activePhone ? activePhone : null
  );

  // Focus search input when drawer opens in SEARCH mode
  useEffect(() => {
    if (isOpen) {
      setMode('SEARCH');
      setSearchQuery('');
      setSearchResults([]);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
    }
  }, [isOpen]);

  // Debounced live search
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const res = await searchCustomer(trimmed);
        if (!isCancelled && res?.status === 200) {
          setSearchResults(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        if (!isCancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }, 220);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, isOpen]);

  if (!isOpen) return null;

  const recentCustomers = recentData?.customers || [];
  const displayedCustomers = searchQuery.trim() ? searchResults : recentCustomers;

  // Helper to clean customer display name (strip trailing " - (phone)" if legacy format was stored)
  const getCleanName = (cust) => {
    if (!cust) return '';
    const rawName = cust.name || cust.label || '';
    if (cust.phone && rawName.endsWith(` - (${cust.phone})`)) {
      return rawName.slice(0, -` - (${cust.phone})`.length).trim();
    }
    return rawName;
  };

  const getInitials = (nameStr) => {
    if (!nameStr) return 'C';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return nameStr.slice(0, 2).toUpperCase();
  };

  const handleOpenCreateForm = (prefillValue = '') => {
    const val = String(prefillValue || searchQuery || '').trim();
    const isNumericLike = /^[0-9+\-\s()]+$/.test(val) && val.length >= 3;

    setFormPhone(isNumericLike ? val : '');
    setFormName(!isNumericLike ? val : '');
    setFormEmail('');
    setFormBirthDate('');
    setFormGender('');
    setFormGroupId('');
    setMode('CREATE');
  };

  const handleOpenEditForm = (cust) => {
    if (!cust) return;
    setFormPhone(cust.phone || '');
    setFormName(getCleanName(cust) || '');
    setFormEmail(cust.email || '');
    setFormBirthDate(
      cust.birth_date ? String(cust.birth_date).substring(0, 10) : ''
    );
    setFormGender(cust.gender || '');
    setFormGroupId(cust.customer_group_id ? String(cust.customer_group_id) : '');
    setMode('EDIT');
  };

  const handlePickCustomer = (cust) => {
    if (!cust) return;
    const cleanName = getCleanName(cust);
    onSelectCustomer({
      phone: cust.phone,
      name: cleanName,
      email: cust.email || null,
      birth_date: cust.birth_date || null,
      gender: cust.gender || null,
      customer_group_id: cust.customer_group_id || null,
      customer_group_name: cust.customer_group_name || null,
      customer_group_code: cust.customer_group_code || null,
      customer_group_color: cust.customer_group_color || null,
      group_discount_type: cust.group_discount_type || null,
      group_discount_value: cust.group_discount_value || 0,
      group_apply_to: cust.group_apply_to || 'ALL',
      group_target_category_ids: cust.group_target_category_ids || null,
      group_min_order_amount: cust.group_min_order_amount || 0,
      group_max_discount_cap: cust.group_max_discount_cap || null,
      label: `${cleanName} - (${cust.phone})`,
      value: cust.phone,
    });
  };

  const handleSaveCustomer = async (e) => {
    e?.preventDefault();
    const phone = formPhone.trim();
    const name = formName.trim();
    const email = formEmail.trim() || null;
    const birthDate = formBirthDate || null;
    const gender = formGender || null;
    const customerGroupId = formGroupId ? Number(formGroupId) : null;

    if (!phone) {
      toast.error(t('customers.please_provide_phone', 'Please provide customer phone number'));
      return;
    }
    if (!name) {
      toast.error(t('customers.please_provide_name', 'Please provide customer name'));
      return;
    }
    if (!validatePhone(phone)) {
      toast.error(t('customers.please_provide_valid_phone', 'Please provide a valid phone number'));
      return;
    }
    if (email && !validateEmail(email)) {
      toast.error(t('customers.please_provide_valid_email', 'Please provide a valid email'));
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedGroup = customerGroups.find((g) => Number(g.id) === customerGroupId);
      if (mode === 'EDIT') {
        const res = await updateCustomer(phone, name, email, birthDate, gender, customerGroupId);
        if (res.status === 200) {
          if (recentApiUrl) await mutate(recentApiUrl);
          toast.success(res.data?.message || t('customers.updated', 'Customer updated'));
          handlePickCustomer({
            phone,
            name,
            email,
            birth_date: birthDate,
            gender,
            customer_group_id: customerGroupId,
            customer_group_name: selectedGroup?.name || null,
            customer_group_color: selectedGroup?.color || null,
            group_discount_type: selectedGroup?.discount_type || null,
            group_discount_value: selectedGroup?.discount_value || 0,
            group_apply_to: selectedGroup?.apply_to || 'ALL',
            group_target_category_ids: selectedGroup?.target_category_ids || null,
            group_min_order_amount: selectedGroup?.min_order_amount || 0,
            group_max_discount_cap: selectedGroup?.max_discount_cap || null,
          });
          setMode('SEARCH');
        }
      } else {
        const res = await addCustomer(phone, name, email, birthDate, gender, customerGroupId);
        if (res.status === 200) {
          if (recentApiUrl) await mutate(recentApiUrl);
          toast.success(res.data?.message || t('customers.added', 'Customer created & attached'));
          handlePickCustomer({
            // The server stores the number in its normalised form
            phone: res.data?.phone || phone,
            name,
            email,
            birth_date: birthDate,
            gender,
            customer_group_id: customerGroupId,
            customer_group_name: selectedGroup?.name || null,
            customer_group_color: selectedGroup?.color || null,
            group_discount_type: selectedGroup?.discount_type || null,
            group_discount_value: selectedGroup?.discount_value || 0,
            group_apply_to: selectedGroup?.apply_to || 'ALL',
            group_target_category_ids: selectedGroup?.target_category_ids || null,
            group_min_order_amount: selectedGroup?.min_order_amount || 0,
            group_max_discount_cap: selectedGroup?.max_discount_cap || null,
          });
          onClose();
        }
      }
    } catch (error) {
      const msg = error?.response?.data?.message || t('toast.something_went_wrong', 'Something went wrong');
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCleanName = getCleanName(selectedCustomer);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      />

      {/* Slide-over Drawer Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('pos.customer', 'Customer Selection')}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] md:w-[540px] bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 border-l border-[#E3E5E8] dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 select-none"
      >
        {/* Top Header */}
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-[#E3E5E8] dark:border-slate-800 bg-[#F4F5F8] dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {mode !== 'SEARCH' ? (
              <button
                type="button"
                onClick={() => setMode('SEARCH')}
                className="w-10 h-10 min-h-[42px] min-w-[42px] rounded-xl bg-white dark:bg-slate-900 border border-[#D4D7DC] dark:border-slate-700 flex items-center justify-center text-gray-700 dark:text-slate-200 hover:bg-gray-50 transition active:scale-95 cursor-pointer"
                title={t('common.back', 'Back')}
              >
                <IconArrowLeft size={18} stroke={iconStroke} />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-[#00A699]/15 text-[#00A699] flex items-center justify-center font-bold shrink-0 shadow-2xs">
                <IconUsers size={22} stroke={iconStroke} />
              </div>
            )}

            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white leading-tight truncate">
                {mode === 'CREATE'
                  ? t('customers.new', 'New Customer')
                  : mode === 'EDIT'
                  ? t('customers.edit', 'Edit Customer')
                  : t('pos.customer_directory', 'Customer & Loyalty')}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                {mode === 'CREATE'
                  ? t('pos.create_customer_subtitle', 'Add customer profile & attach to current ticket')
                  : mode === 'EDIT'
                  ? t('pos.edit_customer_subtitle', 'Update customer contact details')
                  : t('pos.search_customer_subtitle', 'Search by phone or name, or 1-tap a recent guest')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {mode === 'SEARCH' && (
              <button
                type="button"
                onClick={() => handleOpenCreateForm('')}
                className="min-h-[42px] px-3.5 rounded-xl bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
              >
                <IconUserPlus size={16} stroke={2.2} />
                <span>{t('customers.new', 'New Customer')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 min-h-[42px] min-w-[42px] rounded-xl bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 border border-[#D4D7DC] dark:border-slate-700 flex items-center justify-center text-gray-700 dark:text-slate-200 transition active:scale-95 cursor-pointer shadow-2xs"
              title={t('common.close', 'Close (Esc)')}
            >
              <IconX size={18} stroke={iconStroke} />
            </button>
          </div>
        </header>

        {/* BODY: SEARCH & DIRECTORY MODE */}
        {mode === 'SEARCH' ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Search Input Bar */}
            <div className="p-4 border-b border-[#E3E5E8] dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-gray-400 pointer-events-none">
                  {isSearching ? (
                    <IconLoader2 size={18} className="animate-spin text-[#00A699]" />
                  ) : (
                    <IconSearch size={18} stroke={2} />
                  )}
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t(
                    'pos.search_customer_placeholder',
                    'Enter phone number or customer name...'
                  )}
                  className="w-full min-h-[46px] pl-10 pr-10 py-2 rounded-xl text-sm font-semibold bg-[#F4F5F8] dark:bg-slate-800 border border-[#D4D7DC] dark:border-slate-700 focus:border-[#008489] focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 outline-none transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-200 hover:bg-gray-300 flex items-center justify-center transition active:scale-90 cursor-pointer"
                  >
                    <IconX size={14} stroke={2.5} />
                  </button>
                )}
              </div>

              {/* Quick 1-Tap Create Banner when typing a new phone/name */}
              {searchQuery.trim().length >= 2 && (
                <div className="mt-2.5 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#2CA01C]/10 border border-[#2CA01C]/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#2CA01C] text-white flex items-center justify-center shrink-0">
                      <IconUserPlus size={16} stroke={2.2} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {t('pos.create_new_for', 'Create new customer')} &ldquo;{searchQuery.trim()}&rdquo;
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400">
                        {/^[0-9+\-\s()]+$/.test(searchQuery.trim())
                          ? t('pos.prefill_phone_hint', 'Pre-fills phone number & attaches to order')
                          : t('pos.prefill_name_hint', 'Pre-fills customer name & attaches to order')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateForm(searchQuery)}
                    className="min-h-[38px] px-3 rounded-lg bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-bold shrink-0 transition active:scale-95 cursor-pointer shadow-2xs"
                  >
                    + {t('common.create', 'Create')}
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {/* Currently Attached Customer Profile + Live Insights Card */}
              {customerType === 'CUSTOMER' && selectedCustomer && (
                <div className="rounded-2xl border-2 border-[#00A699] bg-[#00A699]/5 dark:bg-[#00A699]/10 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-[#00A699] text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                        {getInitials(activeCleanName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full bg-[#00A699] text-white text-[10px] font-extrabold uppercase tracking-wider">
                            {t('pos.attached_to_ticket', 'Attached')}
                          </span>
                          <h4 className="text-base font-extrabold text-gray-900 dark:text-white truncate">
                            {activeCleanName}
                          </h4>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-600 dark:text-slate-300 font-medium flex-wrap">
                          {selectedCustomer.phone && (
                            <span className="flex items-center gap-1 font-mono font-bold text-gray-800 dark:text-slate-200">
                              <IconPhone size={13} className="text-[#00A699]" />
                              {selectedCustomer.phone}
                            </span>
                          )}
                          {selectedCustomer.email && (
                            <span className="flex items-center gap-1 truncate max-w-[180px]">
                              <IconMail size={13} className="text-gray-400" />
                              {selectedCustomer.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditForm(selectedCustomer)}
                        className="min-h-[38px] px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#D4D7DC] dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                        title={t('customers.edit', 'Edit Customer')}
                      >
                        <IconPencil size={14} stroke={iconStroke} />
                        <span className="hidden sm:inline">{t('common.edit', 'Edit')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClearCustomer();
                          toast.success(t('pos.switched_to_walkin', 'Switched to Walk-in Customer'));
                        }}
                        className="min-h-[38px] px-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                        title={t('pos.reset_walkin', 'Reset to Walk-in')}
                      >
                        <IconX size={14} stroke={2.2} />
                        <span>{t('pos.walkin_short', 'Walk-in')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Customer Loyalty & Spend Metrics */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-lg bg-amber-500 text-white">
                        <IconSparkles size={15} stroke={2.2} />
                      </span>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                          {t('customers.loyalty_points', 'Loyalty Balance')}
                        </span>
                        <p className="text-base font-black text-amber-900 dark:text-amber-200 font-mono leading-none mt-0.5">
                          {isLoadingInsights ? '...' : (insightsData?.pointsBalance ?? selectedCustomer?.points_balance ?? 0)} <span className="text-xs font-normal">pts</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/25 text-amber-900 dark:text-amber-200 text-xs font-extrabold uppercase">
                        {insightsData?.membershipTier || selectedCustomer?.membership_tier || 'Standard'}
                      </span>
                      <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 font-mono mt-0.5">
                        Lifetime: {insightsData?.lifetimePointsEarned ?? selectedCustomer?.lifetime_points_earned ?? 0} pts
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#00A699]/20">
                    <div className="rounded-xl bg-white/80 dark:bg-slate-900/70 p-2.5 border border-[#E3E5E8] dark:border-slate-800">
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400">
                        <IconHistory size={12} className="text-[#00A699]" />
                        <span>{t('customers.visits', 'Visits')}</span>
                      </div>
                      <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5 font-mono">
                        {isLoadingInsights ? '...' : insightsData?.visits || 0}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/80 dark:bg-slate-900/70 p-2.5 border border-[#E3E5E8] dark:border-slate-800">
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400">
                        <IconCoin size={12} className="text-[#2CA01C]" />
                        <span>{t('customers.total_spend', 'Total Spend')}</span>
                      </div>
                      <p className="text-sm font-black text-[#2CA01C] mt-0.5 font-mono">
                        {isLoadingInsights
                          ? '...'
                          : `${currency}${Number(insightsData?.totalSpend || 0).toFixed(2)}`}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/80 dark:bg-slate-900/70 p-2.5 border border-[#E3E5E8] dark:border-slate-800">
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400">
                        <IconReceipt size={12} className="text-amber-500" />
                        <span>{t('customers.avg_bill', 'Avg Ticket')}</span>
                      </div>
                      <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5 font-mono">
                        {isLoadingInsights
                          ? '...'
                          : `${currency}${Number(insightsData?.avgBill || 0).toFixed(2)}`}
                      </p>
                    </div>
                  </div>

                  {/* Top Ordered Favorites with 1-Tap Add to Cart */}
                  {insightsData?.topBuys?.length > 0 && (
                    <div className="pt-2 border-t border-[#00A699]/20 space-y-1.5">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center gap-1">
                        <IconSparkles size={13} className="text-amber-500" />
                        <span>{t('pos.customer_favorites', 'Usual Favorites (1-Tap Add)')}</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {insightsData.topBuys.slice(0, 4).map((fav, idx) => {
                          const matchedMenuItem = (menuItems || []).find(
                            (m) =>
                              m.is_enabled &&
                              m.title?.toLowerCase() === fav.title?.toLowerCase()
                          );
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={!matchedMenuItem || !onQuickAddMenuItem}
                              onClick={() => {
                                if (matchedMenuItem && onQuickAddMenuItem) {
                                  onQuickAddMenuItem(matchedMenuItem);
                                }
                              }}
                              className={clsx(
                                'min-h-[36px] px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition active:scale-95',
                                matchedMenuItem && onQuickAddMenuItem
                                  ? 'bg-white dark:bg-slate-900 border-[#D4D7DC] dark:border-slate-700 hover:border-[#2CA01C] text-gray-800 dark:text-slate-100 cursor-pointer shadow-2xs'
                                  : 'bg-gray-100 dark:bg-slate-800 border-transparent text-gray-400 cursor-default'
                              )}
                              title={
                                matchedMenuItem
                                  ? t('pos.tap_to_add_favorite', 'Tap to add to ticket')
                                  : fav.title
                              }
                            >
                              <span className="truncate max-w-[140px]">{fav.title}</span>
                              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold">
                                {fav.total_quantity}x
                              </span>
                              {matchedMenuItem && onQuickAddMenuItem && (
                                <IconPlus size={13} className="text-[#2CA01C] shrink-0" stroke={2.5} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Walk-in Default Option Card */}
              <button
                type="button"
                onClick={() => {
                  onClearCustomer();
                  onClose();
                }}
                className={clsx(
                  'w-full min-h-[52px] px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 transition active:scale-[0.99] cursor-pointer text-left',
                  customerType === 'WALKIN'
                    ? 'border-[#0D233A] dark:border-emerald-500 bg-[#F4F5F8] dark:bg-slate-800/90 shadow-2xs'
                    : 'border-[#E3E5E8] dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-[#F4F5F8] dark:hover:bg-slate-800/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      customerType === 'WALKIN'
                        ? 'bg-[#0D233A] text-white'
                        : 'bg-[#F4F5F8] dark:bg-slate-800 text-gray-500'
                    )}
                  >
                    <IconShoppingBag size={18} stroke={iconStroke} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {t('pos.walkin_customer', 'Walk-in Customer')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {t('pos.walkin_subtitle', 'Standard counter or dine-in guest without profile')}
                    </p>
                  </div>
                </div>
                {customerType === 'WALKIN' && (
                  <span className="w-6 h-6 rounded-full bg-[#2CA01C] text-white flex items-center justify-center shrink-0">
                    <IconCheck size={14} stroke={3} />
                  </span>
                )}
              </button>

              {/* Directory Section Header */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  {searchQuery.trim()
                    ? `${t('pos.search_results', 'Search Results')} (${displayedCustomers.length})`
                    : t('pos.recent_customers', 'Recent Customers (1-Tap Select)')}
                </span>
              </div>

              {/* Customer Cards List */}
              {isLoadingRecent && !searchQuery.trim() ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                  <IconLoader2 size={24} className="animate-spin text-[#00A699]" />
                  <span className="text-xs font-medium">{t('pos.please_wait', 'Loading customers...')}</span>
                </div>
              ) : displayedCustomers.length === 0 ? (
                <div className="py-10 px-4 text-center rounded-2xl border border-dashed border-[#D4D7DC] dark:border-slate-700 bg-[#F4F5F8]/50 dark:bg-slate-800/30 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 border border-[#E3E5E8] dark:border-slate-700 flex items-center justify-center mx-auto text-gray-400">
                    <IconUser size={22} stroke={1.6} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-slate-200">
                      {searchQuery.trim()
                        ? t('pos.no_customer_found', 'No matching customer found')
                        : t('pos.no_customers_yet', 'No customers registered yet')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {t(
                        'pos.add_customer_prompt',
                        'Create a new customer profile in seconds to track orders and loyalty.'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateForm(searchQuery)}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#2CA01C] hover:bg-[#248417] text-white text-xs font-bold inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <IconUserPlus size={16} stroke={2.2} />
                    <span>
                      {searchQuery.trim()
                        ? `${t('customers.new', 'Add')} "${searchQuery.trim()}"`
                        : t('customers.new', 'New Customer')}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedCustomers.map((cust, index) => {
                    const cleanName = getCleanName(cust);
                    const isSelected =
                      customerType === 'CUSTOMER' &&
                      String(selectedCustomer?.phone) === String(cust.phone);

                    return (
                      <div
                        key={`${cust.phone}-${index}`}
                        onClick={() => {
                          handlePickCustomer(cust);
                          onClose();
                        }}
                        className={clsx(
                          'group min-h-[60px] p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all active:scale-[0.99] cursor-pointer',
                          isSelected
                            ? 'border-[#00A699] bg-[#00A699]/10 shadow-2xs'
                            : 'border-[#E3E5E8] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#00A699]/60 hover:bg-[#F4F5F8]/60 dark:hover:bg-slate-800/60'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={clsx(
                              'w-11 h-11 rounded-xl font-extrabold text-sm flex items-center justify-center shrink-0 transition-colors',
                              isSelected
                                ? 'bg-[#00A699] text-white'
                                : 'bg-[#F4F5F8] dark:bg-slate-800 text-[#0D233A] dark:text-slate-200 group-hover:bg-[#00A699]/15 group-hover:text-[#00A699]'
                            )}
                          >
                            {getInitials(cleanName)}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {cleanName}
                              </p>
                              {cust.membership_tier && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold uppercase">
                                  {cust.membership_tier}
                                </span>
                              )}
                              {Number(cust.points_balance || 0) > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold font-mono">
                                  {cust.points_balance} pts
                                </span>
                              )}
                              {cust.customer_group_name && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-white text-[10px] font-bold shadow-xs inline-flex items-center gap-1"
                                  style={{ backgroundColor: cust.customer_group_color || "#6366f1" }}
                                >
                                  {cust.customer_group_name}
                                  {cust.group_discount_value > 0 && (
                                    <span>
                                      • {cust.group_discount_type === "PERCENTAGE" ? `${cust.group_discount_value}%` : `$${cust.group_discount_value}`} Off
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                              <span className="flex items-center gap-1 font-mono font-semibold text-gray-700 dark:text-slate-300">
                                <IconPhone size={12} stroke={2} className="text-[#00A699]" />
                                {cust.phone}
                              </span>
                              {cust.email && (
                                <span className="truncate max-w-[160px] hidden sm:inline">
                                  {cust.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditForm(cust);
                            }}
                            className="w-9 h-9 rounded-xl border border-transparent hover:border-[#D4D7DC] dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-gray-400 hover:text-gray-700 dark:hover:text-white flex items-center justify-center transition active:scale-90 cursor-pointer"
                            title={t('customers.edit', 'Edit Customer')}
                          >
                            <IconPencil size={15} stroke={iconStroke} />
                          </button>

                          {isSelected ? (
                            <span className="px-2.5 py-1 rounded-xl bg-[#00A699] text-white text-xs font-bold flex items-center gap-1">
                              <IconCheck size={14} stroke={3} />
                              <span>{t('common.selected', 'Active')}</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1.5 rounded-xl bg-[#F4F5F8] dark:bg-slate-800 group-hover:bg-[#0D233A] group-hover:text-white text-gray-700 dark:text-slate-200 text-xs font-bold transition-colors">
                              {t('common.select', 'Select')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* BODY: INLINE CREATE OR EDIT CUSTOMER FORM */
          <form onSubmit={handleSaveCustomer} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 scrollbar-thin">
              {/* Phone Input */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 mb-1.5">
                  {t('customers.phone', 'Phone Number')}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <IconPhone size={18} stroke={iconStroke} />
                  </span>
                  <input
                    type="tel"
                    required
                    disabled={mode === 'EDIT'}
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder={t('customers.phone_placeholder', 'e.g. 012 345 678')}
                    className={clsx(
                      'w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-xl text-sm font-mono font-bold border outline-none transition',
                      mode === 'EDIT'
                        ? 'bg-gray-100 dark:bg-slate-800/60 border-gray-200 dark:border-slate-800 text-gray-500 cursor-not-allowed'
                        : 'bg-[#F4F5F8] dark:bg-slate-800 border-[#D4D7DC] dark:border-slate-700 focus:border-[#008489] focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white'
                    )}
                  />
                </div>
              </div>

              {/* Full Name Input */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 mb-1.5">
                  {t('customers.name', 'Customer Name')}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <IconUser size={18} stroke={iconStroke} />
                  </span>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('customers.name_placeholder', 'Enter full name...')}
                    className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-xl text-sm font-semibold bg-[#F4F5F8] dark:bg-slate-800 border border-[#D4D7DC] dark:border-slate-700 focus:border-[#008489] focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white outline-none transition"
                  />
                </div>
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 mb-1.5">
                  {t('customers.email', 'Email Address')}{' '}
                  <span className="text-gray-400 font-normal lowercase">
                    ({t('common.optional', 'optional')})
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <IconMail size={18} stroke={iconStroke} />
                  </span>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder={t('customers.email_placeholder', 'customer@example.com')}
                    className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium bg-[#F4F5F8] dark:bg-slate-800 border border-[#D4D7DC] dark:border-slate-700 focus:border-[#008489] focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white outline-none transition"
                  />
                </div>
              </div>

              {/* Customer Group Selector */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 mb-1.5">
                  {t('customer_groups.customer_group', 'Customer Group')}
                </label>
                <select
                  value={formGroupId}
                  onChange={(e) => setFormGroupId(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-[#F4F5F8] dark:bg-slate-800 border border-[#D4D7DC] dark:border-slate-700 focus:border-[#008489] focus:bg-white dark:focus:bg-slate-900 text-gray-900 dark:text-white outline-none transition"
                >
                  <option value="">{t('customer_groups.select_group', 'Select a customer group...')}</option>
                  {customerGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} {g.is_default ? `(${t('common.default', 'Default')})` : ''} {g.discount_value > 0 ? `• ${g.discount_type === 'PERCENTAGE' ? `${g.discount_value}%` : `$${g.discount_value}`} Off` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender Touch Pills & Birth Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 mb-1.5">
                    {t('customers.gender', 'Gender')}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: 'male', label: t('customers.male', 'Male') },
                      { key: 'female', label: t('customers.female', 'Female') },
                      { key: 'other', label: t('customers.other', 'Other') },
                    ].map((g) => {
                      const active = formGender === g.key;
                      return (
                        <button
                          key={g.key}
                          type="button"
                          onClick={() => setFormGender(active ? '' : g.key)}
                          className={clsx(
                            'min-h-[44px] px-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer',
                            active
                              ? 'bg-[#0D233A] text-white border-[#0D233A]'
                              : 'bg-[#F4F5F8] dark:bg-slate-800 border-[#D4D7DC] dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200'
                          )}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 mb-1.5">
                    {t('customers.birth_date', 'Birth Date')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <IconCalendar size={16} stroke={iconStroke} />
                    </span>
                    <input
                      type="date"
                      max={new Date().toISOString().substring(0, 10)}
                      value={formBirthDate}
                      onChange={(e) => setFormBirthDate(e.target.value)}
                      className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl text-xs font-semibold bg-[#F4F5F8] dark:bg-slate-800 border border-[#D4D7DC] dark:border-slate-700 focus:border-[#008489] text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Bottom Actions */}
            <footer className="p-4 border-t border-[#E3E5E8] dark:border-slate-800 bg-[#F4F5F8]/80 dark:bg-slate-800/80 backdrop-blur-md flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setMode('SEARCH')}
                className="min-h-[48px] px-5 rounded-xl border border-[#D4D7DC] dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 text-sm font-bold hover:bg-gray-50 transition active:scale-95 cursor-pointer"
              >
                {t('common.cancel', 'Cancel')}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 min-h-[48px] px-5 rounded-xl bg-[#2CA01C] hover:bg-[#248417] text-white text-sm font-extrabold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <IconLoader2 size={18} className="animate-spin" />
                ) : (
                  <IconUserCheck size={18} stroke={2.2} />
                )}
                <span>
                  {mode === 'EDIT'
                    ? t('customers.save_changes', 'Save Changes')
                    : t('pos.save_and_attach', 'Save & Attach to Ticket')}
                </span>
              </button>
            </footer>
          </form>
        )}
      </aside>
    </>
  );
}
