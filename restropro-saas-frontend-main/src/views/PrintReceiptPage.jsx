import React from 'react'
import { getDetailsForReceiptPrint } from '../helpers/ReceiptHelper'
import { getImageURL } from "../helpers/ImageHelper";
import { useTranslation } from "react-i18next";

export default function PrintReceiptPage() {
  const { t } = useTranslation();
  const receiptDetails = getDetailsForReceiptPrint();

  if (!receiptDetails) {
    return <div className="p-4 text-center">No receipt data found.</div>;
  }

  const {
    cartItems = [],
    deliveryType,
    customerType,
    customer,
    tableId,
    storeSettings = {},
    printSettings = {},
    itemsTotal = 0,
    discountType,
    discountValue,
    discountAmount = 0,
    taxTotal = 0,
    serviceChargeTotal = 0,
    payableTotal = 0,
    tokenNo,
    orderId,
    paymentMethod,
    currency = "$",
    dualTenderInfo = null,
  } = receiptDetails;

  const {
    store_name,
    address,
    phone,
    email,
    store_image: storeImage,
  } = storeSettings;

  const {
    page_format,
    header,
    footer,
    show_notes,
    show_store_details,
    show_customer_details,
    print_token,
  } = printSettings;

  const pageFormat = page_format || 80;

  // Dual Currency calculations (Cambodia USD & KHR)
  const exchangeRate = dualTenderInfo?.exchangeRate || storeSettings?.exchange_rate_usd_to_khr || storeSettings?.exchangeRateUsdToKhr || 4100;
  const isBaseKHR = currency === '៛' || String(currency).toLowerCase() === 'khr';
  const totalInKHR = isBaseKHR ? Number(payableTotal) : Math.round(Number(payableTotal) * exchangeRate);
  const totalInUSD = isBaseKHR ? (Number(payableTotal) / exchangeRate) : Number(payableTotal);

  return (
    <div className={`w-[${pageFormat}mm] font-sans px-2 bg-white text-black`}>

      {show_store_details == 1 ? <>
        {storeImage && (
          <img
            src={getImageURL(storeImage)}
            className='w-12 h-12 mx-auto filter grayscale mt-2 rounded-xl'
            alt="Store Image"
          />
        )}
        <p className="text-center mt-2 text-xs leading-relaxed">
          <span className="font-bold text-sm">{store_name}</span><br/>
          {address}<br/>
          {t("print_receipt.phone")}: {phone}, {t("print_receipt.email")}: {email}<br/>
        </p>
      </> : null}

      {header && (
        <div>
          <div className="border-b border-dashed"></div>
          <p className='my-2 text-center text-xs'>{header}</p>
        </div>
      )}

      {show_customer_details == 1 ? (
        <>
          <div className="border-b border-dashed"></div>
          <p className='text-center text-xs mt-1'>{customerType}{customer && <span>, {customer?.name}</span>}</p>
          <p className='mt-0.5 text-xs'>{t("print_receipt.order_type")}: {deliveryType}</p>
        </>
      ) : null}

      {paymentMethod && (
        <>
          <div className="border-b border-dashed"></div>
          <p className='mt-1 text-xs'>{t("print_receipt.payment_method")}: <span className="font-semibold uppercase">{paymentMethod}</span></p>
        </>
      )}

      <div className="border-b border-dashed mt-2"></div>
      <p className="text-xs">{t("print_receipt.receipt_no")}: {tokenNo}-{new Date().toISOString().substring(0,10)}</p>
      <p className="text-xs">{new Date().toLocaleString()}</p>

      <div className="border-b border-dashed mt-2"></div>
      {cartItems.map((cartItem, index) => {
        const { title, quantity, notes, price, addons, addons_ids, variant } = cartItem;

        return (
          <div key={index} className='w-full my-1 text-xs'>
            <p className="font-semibold">{title} {variant && <span>- {variant.title}</span>}</p>
            {addons_ids?.length > 0 && (
              <p className='text-[11px] text-gray-600'>{t("print_receipt.addons")}: {
                addons_ids.map((addonId) => {
                  const addon = addons?.find((a) => a.id == addonId);
                  return addon?.title || addon?.name || "";
                }).filter(Boolean).join(", ")
              }</p>
            )}
            {(show_notes == 1 && notes) ? <p className='mb-1 text-[11px] text-gray-500 italic'>{t("print_receipt.notes")}: {notes}</p> : null}
            <div className='flex justify-between w-full font-mono text-xs'>
              <p>{quantity}x {currency}{Number(price).toFixed(2)}</p>
              <p className='text-end'>{currency}{Number(quantity * price).toFixed(2)}</p>
            </div>
          </div>
        );
      })}
      <div className="border-b border-dashed mt-2"></div>

      <div className="flex justify-between text-xs py-0.5">
        <p>{t("print_receipt.subtotal")}: </p>
        <p className="font-mono">{currency}{Number(itemsTotal).toFixed(2)}</p>
      </div>
      {Number(discountAmount || 0) > 0 && (
        <div className="flex justify-between text-xs py-0.5">
          <p>
            {t("print_receipt.discount", "Discount")}
            {discountType === 'percentage' && discountValue ? ` (${discountValue}%)` : ''}:
          </p>
          <p className="font-mono">-{currency}{Number(discountAmount).toFixed(2)}</p>
        </div>
      )}
      {Number(taxTotal || 0) > 0 && (
        <div className="flex justify-between text-xs py-0.5">
          <p>{t("print_receipt.tax")}: </p>
          <p className="font-mono">{currency}{Number(taxTotal).toFixed(2)}</p>
        </div>
      )}
      {Number(serviceChargeTotal || 0) > 0 && (
        <div className="flex justify-between text-xs py-0.5">
          <p>{t("print_receipt.service_charge")}: </p>
          <p className="font-mono">{currency}{Number(serviceChargeTotal).toFixed(2)}</p>
        </div>
      )}

      {/* Primary Grand Total */}
      <div className="border-t border-dashed mt-2 pt-2">
        <div className="flex justify-between text-base font-black">
          <p>{t("print_receipt.total")}: </p>
          <p className="font-mono">{isBaseKHR ? `៛${Math.round(totalInKHR).toLocaleString()}` : `$${totalInUSD.toFixed(2)}`}</p>
        </div>

        {/* Dual Converted Total & Exchange Rate */}
        <div className="flex justify-between text-xs font-bold text-gray-700 mt-1">
          <p>{isBaseKHR ? "Total in USD:" : "Total in Riel (៛):"}</p>
          <p className="font-mono">{isBaseKHR ? `$${totalInUSD.toFixed(2)}` : `៛${Math.round(totalInKHR).toLocaleString()}`}</p>
        </div>

        <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
          <p>Exchange Rate:</p>
          <p className="font-mono">1 USD = ៛{Number(exchangeRate).toLocaleString()}</p>
        </div>
      </div>

      {/* Dual Cash Tender & Change Breakdown */}
      {dualTenderInfo && (
        <div className="border-t border-dashed mt-2 pt-2 text-xs space-y-1">
          <div className="font-bold uppercase tracking-wider text-[10px] text-gray-500">Cash Tender & Change</div>
          {Number(dualTenderInfo.tenderedUSD) > 0 && (
            <div className="flex justify-between text-xs">
              <p>Cash Tendered (USD):</p>
              <p className="font-mono font-medium">${Number(dualTenderInfo.tenderedUSD).toFixed(2)}</p>
            </div>
          )}
          {Number(dualTenderInfo.tenderedKHR) > 0 && (
            <div className="flex justify-between text-xs">
              <p>Cash Tendered (KHR):</p>
              <p className="font-mono font-medium">៛{Math.round(Number(dualTenderInfo.tenderedKHR)).toLocaleString()}</p>
            </div>
          )}
          {(Number(dualTenderInfo.changeTotalKHR) > 0 || Number(dualTenderInfo.changeTotalUSD) > 0) && (
            <div className="flex justify-between font-bold text-xs pt-1 border-t border-dotted">
              <p>Change Due:</p>
              <p className="font-mono">
                {dualTenderInfo.changeMode === 'MIXED' && Number(dualTenderInfo.changeBreakdownUSD) > 0
                  ? `$${Number(dualTenderInfo.changeBreakdownUSD).toFixed(2)} + ៛${Math.round(Number(dualTenderInfo.changeBreakdownKHR)).toLocaleString()}`
                  : `៛${Math.round(Number(dualTenderInfo.changeTotalKHR)).toLocaleString()}`}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="border-b border-dashed mt-2"></div>

      {footer && (
        <div className='my-2'>
          <p className='my-2 text-center text-xs'>{footer}</p>
        </div>
      )}

      {print_token == 1 && tokenNo ? (
        <div className='border-t border-dashed mt-4 py-8 text-center bg-white'>
          <p className="text-xs font-semibold uppercase tracking-wider">{t("print_receipt.token_no")}</p>
          <div className="w-20 h-20 mx-auto mt-2 border-black border-2 text-black flex items-center justify-center font-bold text-3xl rounded-full">
            {tokenNo}
          </div>
        </div>
      ) : null}

    </div>
  )
}
