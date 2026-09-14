import React, { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Page from "../components/Page";
import { iconStroke } from "../config/config";
import { IconArmchair, IconBoxSeam, IconCheck, IconChecks, IconClock, IconDotsVertical, IconRefresh, IconX } from "@tabler/icons-react";
import { bulkUpdateKitchenOrderItemStatus, getKitchenOrders, markOrderAllItemsStatus, updateKitchenOrderItemStatus, useKitchenOrders } from "../controllers/kitchen.controller";
import { toast } from "react-hot-toast";
import { SocketContext } from "../contexts/SocketContext";
import { initSocket } from "../utils/socket";
import { textToSpeech } from "../utils/textToSpeech";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { useTheme } from "../contexts/ThemeContext";

export default function KitchenPage() {
  const { t } = useTranslation();
  const user = getUserDetailsInLocalStorage();
  const { socket, isSocketConnected } = useContext(SocketContext);
  const { theme } = useTheme();
  
  const [state, setState] = useState({
    kitchenOrders: [],
    isLoading: true,
  })

  useEffect(()=>{
    _init();
    _initSocket();

    return () => {
      // socket.disconnect()
      socket.off('new_order')
      socket.off('order_update')
    }
  },[])

  const { kitchenOrders, isLoading } = state;

  const _init = async () => {
    try {
      const res = await getKitchenOrders();

      if(res.status == 200) {
        const orders = res?.data || [];

        setState({
          ...state,
          kitchenOrders: orders || [],
          isLoading: false,
        });
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error(t('kitchen.error_loading_orders'));

      setState({
        ...state,
        isLoading: false,
      });
    }
  }

  const _initSocket = () => {
    const audio = new Audio("/new_order_sound.mp3");
    if(isSocketConnected) {
      socket.emit("authenticate", user.tenant_id);
      socket.on('new_order', (payload)=>{
        console.log(payload);
        // textToSpeech(`New order received, token number: ${payload}`)
        audio.play();
        btnRefresh();
      })

      socket.on("order_update", ()=>{
        console.log("Order update");
        btnRefresh();
      });
    } else {
      initSocket();
      socket.emit("authenticate", user.tenant_id);
      socket.on('new_order', (payload)=>{
        console.log(payload);
        // textToSpeech(`New order received, token number: ${payload}`)
        audio.play();
        btnRefresh();
      })

      socket.on("order_update", ()=>{
        console.log("Order update");
        btnRefresh();
      });
    }
  }

  const sendOrderUpdateEvent = () => {
    const user = getUserDetailsInLocalStorage();

    if (isSocketConnected) {
      socket.emit('order_update_backend', {}, user.tenant_id);
    } else {
      // Handle disconnected state (optional)
      initSocket();
      socket.emit('order_update_backend', {}, user.tenant_id);
    }
  }

  async function btnRefresh() {
    try {
      toast.loading(t('kitchen.loading_message'));
      const res = await getKitchenOrders();

      if(res.status == 200) {
        toast.dismiss();
        const orders = res?.data || [];

        setState({
          ...state,
          kitchenOrders: orders || [],
          isLoading: false,
        });
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error(t('kitchen.error_loading_orders'));

      setState({
        ...state,
        isLoading: false,
      });
    }
  }

  const btnStartPreparingOrderItem = async (orderItemId) => {
    try {
      toast.loading(t('kitchen.loading_message'));
      const res = await updateKitchenOrderItemStatus(orderItemId, 'preparing');
      toast.dismiss();
      if(res.status == 200) {
        await btnRefresh();
        sendOrderUpdateEvent();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('kitchen.error_processing_request');
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  }

  const btnCompletePreparingOrderItem = async (orderItemId) => {
    try {
      toast.loading(t('kitchen.loading_message'));
      const res = await updateKitchenOrderItemStatus(orderItemId, 'completed');
      toast.dismiss();
      if(res.status == 200) {
        sendOrderUpdateEvent();
        await btnRefresh();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('kitchen.error_processing_request');
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  }

  const btnMarkOrderAllItems = async (orderId, targetStatus, fromStatuses) => {
    try {
      toast.loading(t('kitchen.loading_message'));
      const res = await markOrderAllItemsStatus(orderId, targetStatus, fromStatuses);
      toast.dismiss();
      if (res.status === 200) {
        sendOrderUpdateEvent();
        await btnRefresh();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('kitchen.error_processing_request');
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const btnBulkUpdateAllOrders = async (targetStatus, fromStatuses) => {
    try {
      const matchingItemIds = [];
      filteredOrders.forEach((order) => {
        order.items.forEach((item) => {
          if (!fromStatuses || fromStatuses.includes(item.status)) {
            matchingItemIds.push(item.id);
          }
        });
      });

      if (matchingItemIds.length === 0) {
        toast.error(t('kitchen.no_matching_items', 'No items available to update'));
        return;
      }

      toast.loading(t('kitchen.loading_message'));
      const res = await bulkUpdateKitchenOrderItemStatus(matchingItemIds, targetStatus);
      toast.dismiss();
      if (res.status === 200) {
        sendOrderUpdateEvent();
        await btnRefresh();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('kitchen.error_processing_request');
      toast.dismiss();
      console.error(error);
      toast.error(message);
    }
  };

  const filteredOrders = kitchenOrders.filter(order => {
    return !order.items.every(item => item.status === 'completed' || item.status === 'delivered');
  });

  return (
    <Page>
      <div className="flex items-center gap-6">
        <h3 className="text-3xl font-light">{t('kitchen.title')}</h3>
        <button
          onClick={btnRefresh}
          className={`dark:rounded-lg border-none b shadow-none transition active:scale-95 text-gray-500 px-2 py-1 flex items-center gap-1 ${theme === 'black' ? 'bg-restro-bg-seconday-dark-mode hover:bg-restro-bg-hover-dark-mode text-white' : 'bg-gray-50 hover:bg-gray-100 rounded-lg'}`}
        >
          <IconRefresh size={22} stroke={iconStroke} /> {t('kitchen.refresh')}
        </button>
      </div>

      {isLoading && <p className="mt-4">{t('kitchen.loading_message')}</p>}

      {filteredOrders?.length == 0 && (
        <div className="w-full h-[calc(100vh-15vh)] flex gap-4 flex-col items-center justify-center">
          <img
            src="/assets/illustrations/kitchen-order-not-found.webp"
            alt={t('kitchen.no_orders_img_alt')}
            className="w-1/2 md:w-60"
          />
          <p className="text-gray-400 text-center">{t('kitchen.no_pending_orders')}</p>
        </div>
      )}

      {
        filteredOrders?.length > 0 && <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">

        {
          filteredOrders.map((order, index)=>{

            const {
              id,
              date,
              delivery_type,
              customer_type,
              customer_id,
              customer_name,
              table_id,
              table_title,
              floor,
              status,
              payment_status,
              token_no,
              items,
            } = order;

            return <div key={index} className='border rounded-2xl px-4 py-5 flex flex-col border-restro-border-green'>
              <div className="flex items-center flex-col md:flex-row md:justify-between text-center gap-2">
                <div className="flex items-center gap-2">
                  <div className='flex w-12 h-12 rounded-full items-center justify-center bg-restro-gray text-restro-text'>
                    {delivery_type == "dinein" ? <IconArmchair size={24} stroke={iconStroke} />:<IconBoxSeam size={24} stroke={iconStroke} />}
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{table_id?`${table_title}`:new String(`${delivery_type} ${customer_type}`).toUpperCase()}</p>
                    {floor && <p className="text-sm">{floor}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-end">
                    <p className="font-bold">{t('kitchen.token')} #{token_no}</p>
                  </div>
                  {(items.some(i => i.status === 'created') || items.some(i => i.status === 'preparing')) && (
                    <div className="dropdown dropdown-end">
                      <div
                        tabIndex={0}
                        role="button"
                        className="m-1 btn btn-sm btn-circle bg-transparent border-none shadow-none p-2 rounded-full hover:bg-restro-button-hover"
                      >
                        <IconDotsVertical size={18} stroke={iconStroke} />
                      </div>
                      <ul
                        tabIndex={0}
                        className="dropdown-content z-[10] menu p-2 shadow bg-base-100 rounded-lg w-52 border border-restro-border-green"
                      >
                        {items.some(i => i.status === 'created') && (
                          <li>
                            <button
                              className="flex items-center gap-2 bg-transparent border-none shadow-none text-amber-500"
                              onClick={() => {
                                if (document.activeElement && typeof document.activeElement.blur === "function") {
                                  document.activeElement.blur();
                                }
                                btnMarkOrderAllItems(id, 'preparing', ['created']);
                              }}
                            >
                              <IconClock size={18} stroke={iconStroke} /> {t('kitchen.start_all', 'Start All')}
                            </button>
                          </li>
                        )}
                        {items.some(i => i.status === 'created' || i.status === 'preparing') && (
                          <li>
                            <button
                              className="flex items-center gap-2 bg-transparent border-none shadow-none text-restro-green"
                              onClick={() => {
                                if (document.activeElement && typeof document.activeElement.blur === "function") {
                                  document.activeElement.blur();
                                }
                                btnMarkOrderAllItems(id, 'completed', ['created', 'preparing']);
                              }}
                            >
                              <IconCheck size={18} stroke={iconStroke} /> {t('kitchen.complete_all', 'Complete All')}
                            </button>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* order items */}
              <div className="mt-4 flex flex-col divide-y dark:divide-restro-gray">
                {
                  items.map((item, index)=>{
                    const {
                      id: orderItemId,
                      order_id,
                      item_id,
                      item_title,
                      variant_id,
                      variant_title,
                      quantity,
                      status,
                      date,
                      addons,
                      notes,
                    } = item;

                    const addonsText = addons?.length > 0 ? addons?.map((a)=>a.title)?.join(", "):null;

                    return  <div key={index} className="flex items-center gap-2 py-2">
                      {/* status */}
                      {status == "preparing" && <IconClock stroke={iconStroke} className="text-amber-500 flex-shrink-0" />}
                      {status == "completed" && <IconCheck stroke={iconStroke} className="text-green-500 flex-shrink-0" />}
                      {status == "cancelled" && <IconX stroke={iconStroke} className="text-red-500 flex-shrink-0" />}
                      {status == "delivered" && <IconChecks stroke={iconStroke} className="text-green-500 flex-shrink-0" />}
                      {/* status */}

                      {/* item title */}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{item_title} {variant_title} x {quantity}</p>
                        {addonsText && <p className="text-xs text-gray-500 dark:text-gray-400">{t('kitchen.notes')} {addonsText}</p>}
                        {notes && <p className="text-xs text-gray-500 dark:text-gray-400">{t('kitchen.notes')} {notes}</p>}
                      </div>
                      {/* item title */}

                      {/* action */}
                      {status == "created" && <button onClick={()=>{btnStartPreparingOrderItem(orderItemId)}} className='btn btn-xs border transition active:scale-95 rounded-lg border-restro-border-green text-restro-text hover:bg-restro-button-hover'>{t('kitchen.start_making')}</button>}
                      {status == "preparing" && <button onClick={()=>{btnCompletePreparingOrderItem(orderItemId)}}  className='btn btn-xs border transition active:scale-95 rounded-lg border-restro-border-green text-restro-text hover:bg-restro-button-hover'>{t('kitchen.complete')}</button>}
                      {/* action */}
                    </div>
                  })
                }

              </div>
              {/* order items */}
            </div>

          })
        }

      </div>
      }
    </Page>
  );
}
