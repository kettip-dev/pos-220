import React from "react";
import { getDetailsForReceiptPrint } from "../helpers/ReceiptHelper";
import { useTranslation } from "react-i18next";

export default function PrintTokenPage() {
  const { t } = useTranslation();
  const receiptDetails = getDetailsForReceiptPrint();

  const {
    cartItems,
    deliveryType,
    customerType,
    customer,
    tableId,
    storeSettings,
    printSettings,
    itemsTotal,
    taxTotal,
    payableTotal,
    tokenNo,
    orderId,
  } = receiptDetails;

  const {
    page_format,
    header,
    footer,
    show_notes,
    print_token,
  } = printSettings || {};

  return (
    <div className={`w-[${page_format || 80}mm] font-sans px-2 bg-white text-black`}>
      <h2 className="text-center font-bold text-xl mt-4 pb-2 border-b border-dashed">*** KOT ***</h2>

      {header && <div className=''>
        <p className='my-2 text-center'>{header}</p>
        <div className="border-b border-dashed"></div>
      </div>}

      <div className="mt-4 py-4 text-center">
        {t("print_token.token_no")}
        <div className="w-28 h-28 mx-auto border-black border-2 text-black flex items-center justify-center font-bold text-4xl rounded-full">
          {tokenNo}
        </div>
      </div>

      <p className="mt-2 text-center">{new Date().toLocaleString('en-US', {hour12: true, dateStyle: "long", timeStyle: "short"})}</p>

      {deliveryType && <p className="mt-1 text-center font-bold text-lg">{deliveryType}</p>}
      <div className="border-b border-dashed mt-2"></div>

      {cartItems?.map((cartItem, index)=>{
        const {title, quantity, notes, price, addons_ids, addons, variant } = cartItem;

        return <div key={index} className='w-full my-1'>
          <p className="font-bold">{title} {variant && <span>- {variant.title}</span>}</p>
          {addons_ids?.length > 0 && <p className='text-xs'>Addons:
          {addons_ids.map((addonId, index)=>{
            const addon = addons?.find((a)=>a.id==addonId);
            return addon?.title;
          })?.join(", ")}
          </p>}
          {(show_notes == 1 && notes) ? <p className='mb-2 text-xs font-bold'>** Note: {notes} **</p>:<></>}
          <div className='flex justify-between w-full'>
            <p className='text-sm'>{quantity}x {Number(price).toFixed(2)}</p>
            <p className='text-end'>{Number(quantity*price).toFixed(2)}</p>
          </div>
        </div>
      })}
      
      <div className="border-b border-dashed mt-2"></div>

      {footer && <div className='my-2'>
        <p className='my-2 text-center'>{footer}</p>
      </div>}
    </div>
  );
}
