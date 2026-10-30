import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import {
  IconChevronRight,
  IconCarrot,
  IconTrash,
  IconMinus,
  IconPlus,
  IconShoppingCartX,
  IconChevronLeft,
  IconX,
  IconNote,
  IconShieldCheck,
  IconLock,
  IconUser,
  IconPhone,
  IconArmchair,
  IconTag,
  IconSparkles,
  IconFlame,
  IconTicket,
  IconCheck,
  IconGift,
} from "@tabler/icons-react";
import {
  createOrderFromQrMenu,
  getCart,
  getQRMenuInit,
  getQRTableSession,
  setCart,
  setLastQROrderReceipt,
  setQRTableSession,
  verifyQRTablePin,
} from "../controllers/qrmenu.controller";
import { CURRENCIES } from "../config/currencies.config";
import { getImageURL, setImageStorageConfig } from "../helpers/ImageHelper";
import { iconStroke } from "../config/config";
import { useLocation, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { validatePhone } from "../utils/phoneValidator";
import { SocketContext } from "../contexts/SocketContext";
import { initSocket } from "../utils/socket";
import { useTranslation } from "react-i18next";
import { evaluateCartPromotions } from "../helpers/promotionEvaluator";

const CartPage = () => {
  const { t } = useTranslation();
  const { socket, isSocketConnected } = useContext(SocketContext);

  const params = useParams();
  const qrcode = params.qrcode;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTableParam = searchParams.get("table") || null;

  const savedSession = useMemo(() => getQRTableSession(qrcode), [qrcode]);

  const [cartItems, setCartItems] = useState(() => getCart() || []);
  const [storeTable, setStoreTable] = useState(
    location.state?.storeTable ||
      (savedSession?.tableId
        ? {
            id: savedSession.tableId,
            encrypted_id: savedSession.encryptedTableId,
            table_title: savedSession.tableTitle,
            floor: savedSession.floor,
          }
        : null)
  );
  const [publicTables, setPublicTables] = useState(location.state?.publicTables || []);
  const [currency, setCurrency] = useState(
    location.state?.currency || savedSession?.currency || "$"
  );
  const [serviceCharge, setServiceCharge] = useState(
    location.state?.serviceCharge ?? savedSession?.serviceCharge ?? null
  );
  const [isTablePinVerified, setIsTablePinVerified] = useState(
    Boolean(location.state?.isTablePinVerified || savedSession?.sessionToken)
  );
  const [sessionToken, setSessionToken] = useState(
    location.state?.sessionToken || savedSession?.sessionToken || null
  );
  const [selectedTableRef, setSelectedTableRef] = useState(
    location.state?.storeTable?.encrypted_id ||
      urlTableParam ||
      savedSession?.encryptedTableId ||
      ""
  );
  const [tablePinInput, setTablePinInput] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const [showPhoneFields, setShowPhoneFields] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

  // Promotions & Discounts state
  const [promotions, setPromotions] = useState([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [showCouponInput, setShowCouponInput] = useState(false);

  // Notes modal state
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  const nameRef = useRef(null);
  const phoneRef = useRef(null);

  // Self-heal state on page reload
  useEffect(() => {
    let isMounted = true;
    const syncInitData = async () => {
      try {
        const currentSession = getQRTableSession(qrcode);
        const tableParam =
          urlTableParam ||
          location.state?.storeTable?.encrypted_id ||
          currentSession?.encryptedTableId ||
          null;
        const tokenParam =
          location.state?.sessionToken || currentSession?.sessionToken || null;

        const res = await getQRMenuInit(qrcode, tableParam, tokenParam);
        if (!isMounted || res.status !== 200) return;

        const data = res.data;
        if (data?.imageStorageConfig) {
          setImageStorageConfig(data.imageStorageConfig);
        }

        const currencyObj = CURRENCIES.find((c) => c.cc == data?.storeSettings?.currency);
        const resolvedCurrency = currencyObj?.symbol || data?.storeSettings?.currency || "$";

        setCurrency(resolvedCurrency);
        setServiceCharge(data?.serviceCharge ?? null);
        setPublicTables(data?.publicTables || []);
        if (Array.isArray(data?.promotions)) {
          setPromotions(data.promotions);
        }

        if (data?.storeTable) {
          setStoreTable(data.storeTable);
          setSelectedTableRef(data.storeTable.encrypted_id || String(data.storeTable.id));
        }

        const verified = Boolean(data?.isTablePinVerified && data?.storeTable);
        setIsTablePinVerified(verified);
        setSessionToken(verified ? data?.verifiedSessionToken : null);

        if (data?.storeTable && verified && data?.verifiedSessionToken) {
          setQRTableSession(qrcode, {
            tableId: data.storeTable.id,
            encryptedTableId: data.storeTable.encrypted_id,
            tableTitle: data.storeTable.table_title,
            floor: data.storeTable.floor,
            sessionToken: data.verifiedSessionToken,
            currency: resolvedCurrency,
            serviceCharge: data?.serviceCharge ?? null,
            storeName: data?.storeSettings?.store_name || "",
          });
        }
      } catch (err) {
        console.error("Cart init sync error:", err);
      }
    };

    syncInitData();
    return () => {
      isMounted = false;
    };
  }, [qrcode, urlTableParam]);

  // Client-side pure promotion evaluation
  const promoEvaluation = useMemo(() => {
    return evaluateCartPromotions({
      promotions: promotions || [],
      cartItems: cartItems || [],
      diningOption: "dinein",
      enteredCode: couponCode,
      now: new Date(),
    });
  }, [promotions, cartItems, couponCode]);

  const promotionDiscountTotal = promoEvaluation?.totalPromotionDiscount || 0;
  const appliedPromotions = promoEvaluation?.appliedPromotions || [];
  const eligiblePromotions = promoEvaluation?.eligiblePromotions || [];
  const itemDiscounts = promoEvaluation?.itemDiscounts || {};

  // Find next potential unlockable promotion (Toast-style upsell)
  const unlockablePromo = eligiblePromotions.find((promo) => {
    const minSpend = Number(promo.min_order_amount) || 0;
    const rawSub = promoEvaluation?.rawSubtotal || 0;
    return minSpend > 0 && rawSub < minSpend;
  });

  const shortfall = unlockablePromo
    ? Number(unlockablePromo.min_order_amount) - (promoEvaluation?.rawSubtotal || 0)
    : 0;

  const orderSummary = useMemo(() => {
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
        const tax = itemPrice - itemPrice * (100 / (100 + taxRate));
        taxTotal += tax;
        itemsTotal += itemPrice - tax;
        payableTotal += itemPrice;
      } else {
        itemsTotal += itemPrice;
        payableTotal += itemPrice;
      }
    });

    if (serviceCharge) {
      const calculatedServiceCharge = (Number(itemsTotal) * Number(serviceCharge)) / 100;
      serviceChargeTotal += calculatedServiceCharge;
      payableTotal += calculatedServiceCharge;
    }

    payableTotal = Math.max(0, payableTotal - (promotionDiscountTotal || 0));

    return { itemsTotal, taxTotal, serviceChargeTotal, payableTotal };
  }, [cartItems, serviceCharge, promotionDiscountTotal]);

  const { itemsTotal, taxTotal, serviceChargeTotal, payableTotal } = orderSummary;

  const sendNewOrderEvent = () => {
    if (isSocketConnected) {
      socket.emit("new_qrorder_backend", {}, qrcode);
    } else {
      initSocket();
      socket.emit("new_qrorder_backend", {}, qrcode);
    }
  };

  const updateCartItems = (nextItems) => {
    setCart(nextItems);
    setCartItems([...nextItems]);
  };

  const removeItemFromCart = (index) => {
    const next = cartItems.filter((_, i) => i !== index);
    updateCartItems(next);
  };

  const addCartItemQuantity = (index, currentQuantity) => {
    const next = [...cartItems];
    next[index] = { ...next[index], quantity: currentQuantity + 1 };
    updateCartItems(next);
  };

  const minusCartItemQuantity = (index, currentQuantity) => {
    const newQuantity = currentQuantity - 1;
    let next = [...cartItems];
    if (newQuantity <= 0) {
      next = next.filter((_, i) => i !== index);
    } else {
      next[index] = { ...next[index], quantity: newQuantity };
    }
    updateCartItems(next);
  };

  const handleInlineVerifyPin = async () => {
    const targetTable = selectedTableRef || storeTable?.encrypted_id || storeTable?.id;
    if (!targetTable) {
      toast.error(t("qr_menu.select_table_prompt", "Please select your table first"));
      return false;
    }
    if (!tablePinInput || tablePinInput.trim().length < 4) {
      toast.error(t("qr_menu.enter_4digit_pin", "Please enter the 4-digit Table PIN"));
      return false;
    }

    try {
      setIsVerifyingPin(true);
      const res = await verifyQRTablePin(qrcode, targetTable, tablePinInput.trim());
      if (res.status === 200 && res.data?.success) {
        const verifiedTbl = res.data.storeTable;
        const verifiedTok = res.data.sessionToken;

        setStoreTable(verifiedTbl);
        setSelectedTableRef(verifiedTbl.encrypted_id);
        setIsTablePinVerified(true);
        setSessionToken(verifiedTok);
        setSearchParams({ table: verifiedTbl.encrypted_id }, { replace: true });

        setQRTableSession(qrcode, {
          tableId: verifiedTbl.id,
          encryptedTableId: verifiedTbl.encrypted_id,
          tableTitle: verifiedTbl.table_title,
          floor: verifiedTbl.floor,
          sessionToken: verifiedTok,
          currency,
          serviceCharge,
        });

        toast.success(`Table ${verifiedTbl.table_title} PIN verified!`);
        return { table: verifiedTbl, token: verifiedTok };
      }
      return false;
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        "Invalid 4-digit Table PIN. Please check your table slip or ask your server.";
      toast.error(msg);
      return false;
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const btnPlaceOrder = async () => {
    if (showPhoneFields) {
      const phone = phoneRef.current?.value || "";
      const name = nameRef.current?.value || "";

      if (!name.trim()) {
        toast.error(t("cart.name_required", "Please enter your name"));
        return;
      }

      if (!validatePhone(phone)) {
        toast.error(t("cart.valid_phone_error", "Please enter a valid phone number"));
        return;
      }
    }

    const effectiveTableRef =
      storeTable?.encrypted_id || storeTable?.id || selectedTableRef || urlTableParam;

    if (!effectiveTableRef) {
      toast.error(t("qr_menu.select_table_prompt", "Please select your table to place an order"));
      return;
    }

    let activeToken = isTablePinVerified ? sessionToken : null;
    if (!activeToken && (!tablePinInput || tablePinInput.trim().length < 4)) {
      toast.error(
        t(
          "qr_menu.enter_4digit_pin",
          "Please enter the 4-digit Table PIN for your table to place an order"
        )
      );
      return;
    }

    try {
      setIsSubmittingOrder(true);
      const deliveryType = "dinein";
      const customerType = showPhoneFields ? "CUSTOMER" : "WALKIN";
      const customer = showPhoneFields
        ? {
            name: nameRef.current?.value || "",
            phone: phoneRef.current?.value || "",
          }
        : { name: "Guest", phone: "" };

      toast.loading(t("cart.please_wait", "Submitting your order..."));

      const res = await createOrderFromQrMenu(
        deliveryType,
        cartItems,
        customerType,
        customer,
        effectiveTableRef,
        qrcode,
        tablePinInput.trim() || null,
        activeToken
      );

      toast.dismiss();
      if (res.status == 200) {
        const data = res.data;
        const confirmedTable = data.storeTable || storeTable;
        const confirmedToken = data.sessionToken || activeToken;

        if (confirmedTable && confirmedToken) {
          setQRTableSession(qrcode, {
            tableId: confirmedTable.id,
            encryptedTableId: confirmedTable.encrypted_id,
            tableTitle: confirmedTable.table_title,
            floor: confirmedTable.floor,
            sessionToken: confirmedToken,
            currency,
            serviceCharge,
          });
        }

        setLastQROrderReceipt({
          qrcode,
          orderId: data.orderId,
          kitchenOrderId: data.kitchenOrderId || null,
          tokenNo: data.tokenNo || null,
          autoSentToKitchen: Boolean(data.autoSentToKitchen),
          storeTable: confirmedTable,
          sessionToken: confirmedToken,
          currency,
          serviceCharge,
          items: [...cartItems],
          itemsTotal,
          taxTotal,
          serviceChargeTotal,
          promotionDiscountTotal: promotionDiscountTotal || 0,
          appliedPromotions: appliedPromotions || [],
          payableTotal,
          placedAt: new Date().toISOString(),
        });

        toast.success(t("cart.order_success", "Order placed successfully!"));
        setIsCheckoutModalOpen(false);
        setCart([]);
        setCartItems([]);
        sendNewOrderEvent();

        const nextTableParam = confirmedTable?.encrypted_id || effectiveTableRef || "";
        navigate(
          `/m/order-success?qrcode=${encodeURIComponent(qrcode)}&table=${encodeURIComponent(
            nextTableParam
          )}&orderId=${encodeURIComponent(data.orderId)}`
        );
      }
    } catch (error) {
      toast.dismiss();
      const code = error?.response?.data?.code;
      const message =
        error?.response?.data?.message || t("cart.something_went_wrong", "Something went wrong");
      console.error(error);

      if (code === "INVALID_TABLE_PIN" || error?.response?.status === 403) {
        // Clear stale session token and keep guest on cart modal to enter current PIN
        setIsTablePinVerified(false);
        setSessionToken(null);
        toast.error(message);
        return;
      }

      toast.error(message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const goBackToMenu = () => {
    const tblParam = storeTable?.encrypted_id || selectedTableRef || urlTableParam;
    navigate(`/m/${qrcode}${tblParam ? `?table=${encodeURIComponent(tblParam)}` : ""}`);
  };

  const handleSaveNotes = (e) => {
    if (e) e.preventDefault();
    if (editingNoteIndex === null) return;
    const next = [...cartItems];
    if (next[editingNoteIndex]) {
      next[editingNoteIndex] = {
        ...next[editingNoteIndex],
        notes: editingNoteText.trim() || null,
      };
      updateCartItems(next);
    }
    setEditingNoteIndex(null);
  };

  return (
    <div className="min-h-screen w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 pb-32">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={goBackToMenu}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-xs font-bold active:scale-95 transition cursor-pointer"
          >
            <IconChevronLeft size={18} stroke={2.2} />
            <span>{t("qr_menu.menu", "Menu")}</span>
          </button>

          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
            {t("cart.title", "Your Order Cart")}
          </h1>

          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        {/* Table & Security Status Banner */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  storeTable && isTablePinVerified
                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600"
                    : "bg-amber-50 dark:bg-amber-950/50 text-amber-600"
                }`}
              >
                {storeTable && isTablePinVerified ? (
                  <IconShieldCheck size={22} />
                ) : (
                  <IconArmchair size={20} />
                )}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {t("tables.table", "Dining Table")}
                </p>
                {storeTable ? (
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Table {storeTable.table_title}
                    {storeTable.floor ? ` • ${storeTable.floor}` : ""}
                  </p>
                ) : (
                  <p className="text-sm font-bold text-amber-600">
                    {t("qr_menu.select_table_prompt", "Select your table below")}
                  </p>
                )}
              </div>
            </div>

            {storeTable && isTablePinVerified ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold">
                <IconShieldCheck size={15} />
                <span>{t("qr_menu.pin_verified", "Table PIN Verified")}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-extrabold">
                <IconLock size={14} />
                <span>{t("qr_menu.pin_required", "4-Digit PIN Required")}</span>
              </span>
            )}
          </div>

          {/* If no table or PIN not verified yet, allow inline selection + PIN verification right on CartPage */}
          {(!storeTable || !isTablePinVerified) && (
            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              {!storeTable && (
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                    Select Table
                  </label>
                  <select
                    value={selectedTableRef}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedTableRef(val);
                      const found = publicTables.find(
                        (tObj) =>
                          String(tObj.encrypted_id) === String(val) ||
                          String(tObj.id) === String(val)
                      );
                      if (found) setStoreTable(found);
                    }}
                    className="w-full min-h-[42px] rounded-xl px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700"
                  >
                    <option value="">-- Choose Table --</option>
                    {publicTables.map((tbl) => (
                      <option key={tbl.id} value={tbl.encrypted_id || tbl.id}>
                        Table {tbl.table_title} {tbl.floor ? `(${tbl.floor})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={storeTable ? "sm:col-span-8" : "sm:col-span-4"}>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  4-Digit Table PIN (Ask Server or Check Table Slip)
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  value={tablePinInput}
                  onChange={(e) => setTablePinInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 4-digit PIN"
                  className="w-full min-h-[42px] rounded-xl px-3.5 py-2 text-sm font-extrabold tracking-widest bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:border-emerald-600"
                />
              </div>

              <div className={storeTable ? "sm:col-span-4" : "sm:col-span-3"}>
                <button
                  type="button"
                  disabled={isVerifyingPin}
                  onClick={handleInlineVerifyPin}
                  className="w-full min-h-[42px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 transition active:scale-95 cursor-pointer"
                >
                  {isVerifyingPin ? "Checking..." : "Verify PIN"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Upsell / Unlock Progress Banner */}
        {cartItems.length > 0 && unlockablePromo && shortfall > 0 && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300 dark:border-amber-700/60 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                <IconFlame size={16} className="text-orange-500 animate-pulse" />
                <span>Special Deal Within Reach</span>
              </div>
              <span className="font-mono text-amber-700 dark:text-amber-300">
                {currency}{itemsTotal.toFixed(2)} / {currency}{Number(unlockablePromo.min_order_amount).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-200">
              Add <strong className="text-amber-600 dark:text-amber-400 font-mono font-black">{currency}{shortfall.toFixed(2)}</strong> more to unlock{" "}
              <strong>{unlockablePromo.title}</strong>!
            </p>
            <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden mt-2">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(8, (itemsTotal / Number(unlockablePromo.min_order_amount)) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Cart Items List */}
        {cartItems.length > 0 ? (
          <div className="space-y-3">
            {cartItems.map((item, i) => {
              const { title, price, quantity, image, notes, variant, addons } = item;
              const imageURL = getImageURL(image);
              const discountInfo = itemDiscounts[item.id];

              return (
                <div
                  key={`${item.id}-${i}`}
                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-3.5 shadow-2xs flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-800 rounded-xl overflow-hidden flex items-center justify-center text-slate-400 shrink-0">
                      {image ? (
                        <img src={imageURL} alt={title} className="object-cover w-full h-full" />
                      ) : (
                        <IconCarrot size={24} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                          {title}
                        </h4>
                        {discountInfo && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                            <IconSparkles size={11} /> PROMO
                          </span>
                        )}
                      </div>

                      {variant?.title && (
                        <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300">
                          {variant.title}
                        </span>
                      )}

                      {addons?.length > 0 && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                          + {addons.map((a) => a.title).join(", ")}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1.5">
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {currency}
                          {(Number(price) * Number(quantity)).toFixed(2)}
                        </p>
                        {discountInfo && (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            (-{currency}{Number(discountInfo.discount_amount).toFixed(2)})
                          </span>
                        )}
                      </div>

                      {notes && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 italic">
                          “{notes}”
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteIndex(i);
                          setEditingNoteText(notes || "");
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 transition cursor-pointer"
                      >
                        <IconNote size={14} stroke={iconStroke} />
                        <span>{notes ? "Edit note" : t("cart.add_notes", "Add note")}</span>
                      </button>
                    </div>
                  </div>

                  {/* Stepper & Delete */}
                  <div className="flex flex-col items-end justify-between gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => removeItemFromCart(i)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                      title="Remove item"
                    >
                      <IconTrash stroke={iconStroke} size={17} />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => minusCartItemQuantity(i, quantity)}
                        className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-red-500 active:scale-95 transition cursor-pointer"
                      >
                        <IconMinus stroke={2.5} size={20} />
                      </button>

                      <span className="w-6 text-center text-xs sm:text-sm font-extrabold">{quantity}</span>

                      <button
                        type="button"
                        onClick={() => addCartItemQuantity(i, quantity)}
                        className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-[#2CA01C] active:scale-95 transition cursor-pointer"
                      >
                        <IconPlus stroke={2.5} size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add More Items Button */}
            <button
              type="button"
              onClick={goBackToMenu}
              className="w-full min-h-[44px] rounded-2xl border border-dashed border-emerald-500/60 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition cursor-pointer"
            >
              <IconPlus size={16} />
              <span>{t("qr_menu.add_more_items", "Add More Items from Menu")}</span>
            </button>
          </div>
        ) : (
          <div className="py-20 text-center text-slate-400 flex flex-col justify-center items-center gap-4">
            <IconShoppingCartX size={56} stroke={1.5} />
            <p className="text-base font-bold text-slate-600 dark:text-slate-300">
              {t("cart.empty_cart", "Your cart is empty")}
            </p>
            <button
              type="button"
              onClick={goBackToMenu}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-extrabold shadow-sm active:scale-95 transition cursor-pointer"
            >
              {t("qr_menu.browse_menu", "Browse Menu")}
            </button>
          </div>
        )}

        {/* Promotions & Coupons Card for QR Guests */}
        {cartItems.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <IconTicket size={18} />
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {t("cart.coupons_and_offers", "Promotions & Offers")}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {couponCode ? `Applied: ${couponCode}` : "Apply discount voucher or enjoy specials"}
                  </p>
                </div>
              </div>

              {couponCode ? (
                <button
                  type="button"
                  onClick={() => {
                    setCouponCode("");
                    setCouponInput("");
                    toast.success("Coupon removed");
                  }}
                  className="min-h-[36px] px-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 text-xs font-bold hover:bg-red-100 transition active:scale-95 flex items-center gap-1 border border-red-200 dark:border-red-800"
                >
                  <IconTrash size={14} /> Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCouponInput(!showCouponInput)}
                  className="min-h-[36px] px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 transition active:scale-95 flex items-center gap-1 border border-emerald-200 dark:border-emerald-800"
                >
                  <IconTag size={14} /> {showCouponInput ? "Hide" : "Have a code?"}
                </button>
              )}
            </div>

            {/* Expandable coupon input */}
            {showCouponInput && !couponCode && (
              <div className="pt-2 flex items-center gap-2 animate-fadeIn">
                <input
                  type="text"
                  placeholder="e.g. SAVE20"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const clean = couponInput.trim().toUpperCase();
                      if (clean) {
                        setCouponCode(clean);
                        setShowCouponInput(false);
                        toast.success(`Coupon "${clean}" applied!`);
                      }
                    }
                  }}
                  className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs font-mono uppercase font-bold focus:outline-emerald-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = couponInput.trim().toUpperCase();
                    if (!clean) {
                      toast.error("Please enter a voucher code");
                      return;
                    }
                    setCouponCode(clean);
                    setShowCouponInput(false);
                    toast.success(`Coupon "${clean}" applied!`);
                  }}
                  className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition active:scale-95 flex items-center gap-1"
                >
                  <IconCheck size={16} /> Apply
                </button>
              </div>
            )}

            {/* Applied promotion breakdown */}
            {appliedPromotions.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-1.5">
                {appliedPromotions.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5 font-bold">
                      <IconSparkles size={14} />
                      {p.title}
                    </span>
                    <span className="font-mono font-black">
                      -{currency}{Number(p.discount_amount || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Order Summary Card */}
        {cartItems.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 shadow-2xs space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              {t("cart.order_summary", "Bill Summary")}
            </h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>{t("cart.items_total", "Items Subtotal")}</span>
                <span className="font-semibold">
                  {currency}
                  {itemsTotal.toFixed(2)}
                </span>
              </div>

              {promotionDiscountTotal > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span className="flex items-center gap-1">
                    <IconSparkles size={14} />
                    {t("cart.promotions_discount", "Promotions & Offers")}
                  </span>
                  <span className="font-mono">
                    -{currency}{promotionDiscountTotal.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>{t("cart.tax_total", "Tax")}</span>
                <span className="font-semibold">
                  {currency}
                  {taxTotal.toFixed(2)}
                </span>
              </div>
              {serviceChargeTotal > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{t("cart.service_charge_total", "Service Charge")}</span>
                  <span className="font-semibold">
                    {currency}
                    {serviceChargeTotal.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center text-base font-extrabold text-slate-900 dark:text-white">
                <span>{t("cart.payable_total", "Total Payable")}</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-lg">
                  {currency}
                  {payableTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Checkout Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95">
          <div className="max-w-3xl mx-auto">
            <button
              type="button"
              onClick={() => setIsCheckoutModalOpen(true)}
              className="w-full min-h-[56px] bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 px-5 rounded-2xl shadow-lg flex justify-between items-center active:scale-98 transition cursor-pointer"
            >
              <div>
                <p className="text-xs font-medium text-emerald-100 text-left">
                  {t("cart.total", "Total")}
                </p>
                <p className="text-lg font-extrabold">
                  {currency}
                  {payableTotal.toFixed(2)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-base font-extrabold">
                <span>{t("cart.checkout", "Confirm & Place Order")}</span>
                <IconChevronRight size={20} stroke={2.5} />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Checkout & PIN Confirmation Modal */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {t("cart.confirm_order", "Confirm Your Order")}
              </h3>
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Step 1: Table & 4-Digit PIN Verification */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Table Verification
                </span>
                {storeTable && isTablePinVerified && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <IconShieldCheck size={15} />
                    Verified
                  </span>
                )}
              </div>

              {!storeTable && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Select Your Table
                  </label>
                  <select
                    value={selectedTableRef}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedTableRef(val);
                      const found = publicTables.find(
                        (tObj) =>
                          String(tObj.encrypted_id) === String(val) ||
                          String(tObj.id) === String(val)
                      );
                      if (found) setStoreTable(found);
                    }}
                    className="w-full min-h-[44px] rounded-xl px-3 py-2 text-sm font-bold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700"
                  >
                    <option value="">-- Choose Table --</option>
                    {publicTables.map((tbl) => (
                      <option key={tbl.id} value={tbl.encrypted_id || tbl.id}>
                        Table {tbl.table_title} {tbl.floor ? `(${tbl.floor})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {storeTable && (
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Ordering for Table {storeTable.table_title}
                  {storeTable.floor ? ` (${storeTable.floor})` : ""}
                </p>
              )}

              {!isTablePinVerified && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    Enter 4-Digit Table PIN{" "}
                    <span className="text-slate-400 font-normal">
                      (Check table slip or ask server)
                    </span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    value={tablePinInput}
                    onChange={(e) => setTablePinInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="• • • •"
                    className="w-full min-h-[48px] rounded-xl px-4 py-2.5 text-center text-xl font-black tracking-[0.5em] bg-white dark:bg-zinc-900 border-2 border-emerald-500/60 outline-none focus:border-emerald-600"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Step 2: Guest vs Customer Phone */}
            <div className="space-y-2.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                {t("cart.continue_as", "Guest Details")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowPhoneFields(false)}
                  className={`min-h-[44px] rounded-xl px-3 py-2 text-xs font-extrabold border transition cursor-pointer ${
                    !showPhoneFields
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {t("cart.guest", "Order as Guest")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPhoneFields(true)}
                  className={`min-h-[44px] rounded-xl px-3 py-2 text-xs font-extrabold border transition cursor-pointer ${
                    showPhoneFields
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {t("cart.using_phone_number", "Add Name & Phone")}
                </button>
              </div>

              {showPhoneFields && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {t("cart.name_label", "Your Name")} *
                    </label>
                    <div className="relative flex items-center">
                      <IconUser size={16} className="absolute left-3 text-slate-400" />
                      <input
                        type="text"
                        ref={nameRef}
                        className="w-full min-h-[42px] rounded-xl pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:border-emerald-500"
                        placeholder={t("cart.name_placeholder", "Enter your name")}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {t("cart.phone_label", "Phone Number")} *
                    </label>
                    <div className="relative flex items-center">
                      <IconPhone size={16} className="absolute left-3 text-slate-400" />
                      <input
                        type="tel"
                        ref={phoneRef}
                        className="w-full min-h-[42px] rounded-xl pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:border-emerald-500"
                        placeholder={t("cart.phone_placeholder", "Enter phone number")}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={isSubmittingOrder}
              onClick={btnPlaceOrder}
              className="w-full min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-base font-extrabold py-3.5 shadow-lg active:scale-98 transition cursor-pointer"
            >
              {isSubmittingOrder
                ? t("cart.please_wait", "Submitting...")
                : `${t("cart.place_order", "Place Order")} • ${currency}${payableTotal.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {/* Item Notes Modal */}
      {editingNoteIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveNotes}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {t("cart.add_notes", "Special Instructions")}
              </h3>
              <button
                type="button"
                onClick={() => setEditingNoteIndex(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500"
              >
                <IconX size={17} />
              </button>
            </div>

            <div>
              <input
                type="text"
                maxLength={150}
                value={editingNoteText}
                onChange={(e) => setEditingNoteText(e.target.value)}
                placeholder={t("cart.notes_placeholder", "E.g. No onions, extra sauce...")}
                className="w-full min-h-[44px] rounded-xl px-3.5 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingNoteIndex(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                {t("cart.close", "Cancel")}
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold"
              >
                {t("cart.save", "Save Note")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CartPage;
