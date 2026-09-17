import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  IconX,
  IconUser,
  IconSearch,
  IconUserPlus,
  IconPhone,
  IconMail,
  IconCheck,
  IconUserCheck,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { searchCustomer, addCustomer } from "../../controllers/customers.controller";

export default function TableCustomerModal({
  isOpen,
  onClose,
  currentCustomer = null,
  onSelectCustomer = () => {},
  onResetToWalkin = () => {},
}) {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState("search"); // 'search' | 'create'
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // Create customer fields
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await searchCustomer(searchQuery.trim());
        if (res?.data) {
          setSearchResults(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        console.error("Customer search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  if (!isOpen) return null;

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newPhone.trim() || !newName.trim()) {
      return toast.error(t("customers.phone_name_required", "Name and Phone number are required."));
    }

    try {
      setIsCreating(true);
      const res = await addCustomer(newPhone.trim(), newName.trim(), newEmail.trim() || null);
      if (res?.status === 200) {
        toast.success(t("customers.added_successfully", "Customer created successfully!"));
        onSelectCustomer({ name: newName.trim(), phone: newPhone.trim(), email: newEmail.trim() });
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || t("common.error", "Failed to create customer"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-[#0ea5e9] flex items-center justify-center font-bold">
              <IconUser size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white">
                {t("customers.assign_customer", "Assign Table Customer")}
              </h3>
              <p className="text-[11px] text-slate-400">
                {currentCustomer?.name
                  ? `${t("customers.current", "Current:")} ${currentCustomer.name} (${currentCustomer.phone || "No phone"})`
                  : t("pos.walkin_customer", "Currently Walk-in Guest")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-500 transition cursor-pointer"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-2 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-900 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "search"
                ? "bg-white dark:bg-zinc-800 text-[#0ea5e9] shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <IconSearch size={14} />
            <span>{t("common.search", "Search Customer")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "create"
                ? "bg-white dark:bg-zinc-800 text-[#0ea5e9] shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            <IconUserPlus size={14} />
            <span>{t("customers.add_new", "Add New")}</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === "search" ? (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("customers.search_placeholder", "Search name or phone number...")}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-900 dark:text-white outline-none focus:border-[#0ea5e9]"
                  autoFocus
                />
              </div>

              {/* Reset to Walk-in option */}
              {currentCustomer?.name && (
                <button
                  type="button"
                  onClick={() => {
                    onResetToWalkin();
                    onClose();
                  }}
                  className="w-full p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-between hover:bg-amber-100/60 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <IconUser size={15} />
                    {t("customers.reset_to_walkin", "Clear & Reset to Walk-in Guest")}
                  </span>
                  <span className="text-[10px] uppercase font-semibold">Reset</span>
                </button>
              )}

              {/* Results List */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {isSearching ? (
                  <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                    <div className="w-5 h-5 border-2 border-[#0ea5e9] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs">{t("common.searching", "Searching...")}</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((cust, idx) => (
                    <div
                      key={cust.id || idx}
                      onClick={() => {
                        onSelectCustomer(cust);
                        onClose();
                      }}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 hover:border-[#0ea5e9] bg-slate-50/50 dark:bg-zinc-800/50 hover:bg-sky-50/40 dark:hover:bg-sky-950/20 flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-800 dark:text-white truncate">
                          {cust.name}
                        </p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <IconPhone size={11} /> {cust.phone}
                          {cust.email && ` • ${cust.email}`}
                        </p>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1 shrink-0">
                        <IconUserCheck size={12} />
                        <span>{t("common.select", "Select")}</span>
                      </span>
                    </div>
                  ))
                ) : searchQuery.trim() ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <p>{t("customers.no_customer_found", "No customers found.")}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setNewName(searchQuery.trim());
                        setActiveTab("create");
                      }}
                      className="mt-2 text-[#0ea5e9] font-bold underline"
                    >
                      {t("customers.create_now", "Create customer now")}
                    </button>
                  </div>
                ) : (
                  <p className="text-center py-8 text-xs text-slate-400">
                    {t("customers.search_prompt", "Type name or phone to search customers.")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Create Form */
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {t("customers.name", "Full Name")} *
                </label>
                <div className="relative">
                  <IconUser size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-white outline-none focus:border-[#0ea5e9]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {t("customers.phone", "Phone Number")} *
                </label>
                <div className="relative">
                  <IconPhone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. +1 555 123 4567"
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-white outline-none focus:border-[#0ea5e9]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {t("customers.email", "Email Address")} ({t("common.optional", "Optional")})
                </label>
                <div className="relative">
                  <IconMail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. guest@example.com"
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-white outline-none focus:border-[#0ea5e9]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full mt-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCreating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <IconCheck size={16} />
                    <span>{t("customers.save_and_assign", "Create & Assign to Table")}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
