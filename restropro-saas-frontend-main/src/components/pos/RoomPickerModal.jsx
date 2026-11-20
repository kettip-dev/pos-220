import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  IconBed,
  IconSearch,
  IconX,
  IconRefresh,
  IconMinus,
  IconPlus,
  IconUsers,
  IconAlertTriangle,
  IconCheck,
} from '@tabler/icons-react';
import { getCheckedInRooms, verifyRoom } from '../../controllers/pms.controller';

const toRoom = (r) => ({
  reservationId: r.reservation_id,
  roomNumber: r.room_number,
  guestName: r.guest_display_name || null,
  roomType: r.room_type_name || null,
  checkoutDate: r.checkout_date || null,
  canPostCharges: r.can_post_charges !== false,
  remainingCents: r.room_charge_remaining_usd_cents ?? null,
});

const formatUsd = (cents) => `$${(Number(cents) / 100).toFixed(2)}`;

/**
 * Picks the hotel room (checked-in guest) for a room service order, plus the
 * delivery details the runner and kitchen need.
 */
export default function RoomPickerModal({ isOpen, onClose, selectedRoom = null, onConfirm }) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const [guestCount, setGuestCount] = useState(1);
  const [note, setNote] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await getCheckedInRooms();
      setRooms(list.map(toRoom));
    } catch (error) {
      setLoadError(error?.response?.data?.message || t('room_service.pms_unreachable', 'Could not reach the hotel PMS.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setCheckMessage(null);
    setPicked(selectedRoom);
    setGuestCount(selectedRoom?.guestCount || 1);
    setNote(selectedRoom?.note || '');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) => String(r.roomNumber).toLowerCase().includes(q) || (r.guestName || '').toLowerCase().includes(q)
    );
  }, [rooms, query]);

  const exactMatch = rooms.some((r) => String(r.roomNumber).toLowerCase() === query.trim().toLowerCase());

  // A room typed by hand that is not in the list (list may be stale): ask the PMS directly.
  const checkTypedRoom = async () => {
    const roomNumber = query.trim();
    if (!roomNumber) return;
    setIsChecking(true);
    setCheckMessage(null);
    try {
      const res = await verifyRoom(roomNumber);
      if (res?.valid) {
        const room = toRoom(res);
        setRooms((prev) => [room, ...prev.filter((r) => r.reservationId !== room.reservationId)]);
        setPicked(room);
      } else {
        setCheckMessage(res?.message || t('room_service.room_not_occupied', 'No checked-in guest in that room.'));
      }
    } catch (error) {
      setCheckMessage(error?.response?.data?.message || t('room_service.pms_unreachable', 'Could not reach the hotel PMS.'));
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOpen) return null;

  const confirm = () => {
    if (!picked) return;
    onConfirm({ ...picked, guestCount, note: note.trim() });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="w-full sm:max-w-3xl max-h-[92vh] flex flex-col bg-white dark:bg-[#0D1829] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#E3E5E8] dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('room_service.pick_room', 'Pick guest room')}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E3E5E8] dark:border-slate-800">
          <span className="w-10 h-10 rounded-full bg-[#7C3AED] text-white flex items-center justify-center shrink-0">
            <IconBed size={20} stroke={2} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('room_service.title', 'Room Service')}</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">{t('room_service.subtitle', 'Rooms with a checked-in guest')}</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="w-[42px] h-[42px] rounded-xl border border-[#D4D7DC] dark:border-slate-700 text-gray-600 dark:text-slate-300 flex items-center justify-center active:scale-95 transition"
            aria-label={t('room_service.refresh', 'Refresh rooms')}
          >
            <IconRefresh size={18} className={clsx(isLoading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-[42px] h-[42px] rounded-xl border border-[#D4D7DC] dark:border-slate-700 text-gray-600 dark:text-slate-300 flex items-center justify-center active:scale-95 transition"
            aria-label={t('common.close', 'Close')}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <IconSearch size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setCheckMessage(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && query.trim() && !exactMatch) checkTypedRoom(); }}
              placeholder={t('room_service.search', 'Room number or guest name')}
              className="w-full pl-10 pr-3 min-h-[46px] rounded-xl text-sm font-medium bg-[#F4F5F8] dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-transparent focus:border-[#7C3AED] outline-none"
              autoFocus
            />
          </div>
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={checkTypedRoom}
              disabled={isChecking}
              className="mt-2 min-h-[42px] px-3 rounded-xl text-xs font-bold border border-[#7C3AED] text-[#7C3AED] dark:text-violet-300 active:scale-95 transition disabled:opacity-50"
            >
              {isChecking
                ? t('room_service.checking', 'Checking...')
                : t('room_service.check_room', 'Check room {{room}} with the hotel', { room: query.trim() })}
            </button>
          )}
          {checkMessage && (
            <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <IconAlertTriangle size={14} /> {checkMessage}
            </p>
          )}
        </div>

        {/* Room grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[180px]">
          {loadError ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-8">
              <IconAlertTriangle size={28} className="text-amber-500" />
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{loadError}</p>
              <button type="button" onClick={load} className="min-h-[42px] px-4 rounded-xl bg-[#0D233A] text-white text-sm font-bold active:scale-95 transition">
                {t('common.retry', 'Retry')}
              </button>
            </div>
          ) : isLoading && rooms.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">{t('room_service.loading', 'Loading rooms...')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">
              {rooms.length === 0 ? t('room_service.no_guests', 'No guests are checked in right now.') : t('room_service.no_match', 'No room matches your search.')}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filtered.map((room) => {
                const isPicked = picked?.reservationId === room.reservationId;
                return (
                  <button
                    key={room.reservationId}
                    type="button"
                    onClick={() => setPicked(room)}
                    aria-pressed={isPicked}
                    className={clsx(
                      'relative min-h-[88px] p-3 rounded-2xl border-2 text-left transition active:scale-95 touch-manipulation',
                      isPicked
                        ? 'border-[#7C3AED] bg-violet-50 dark:bg-violet-500/15'
                        : 'border-[#E3E5E8] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-violet-300'
                    )}
                  >
                    {isPicked && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#7C3AED] text-white flex items-center justify-center">
                        <IconCheck size={13} stroke={3} />
                      </span>
                    )}
                    <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white leading-none">{room.roomNumber}</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate mt-1.5">{room.guestName || t('room_service.guest', 'Guest')}</p>
                    {room.roomType && <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{room.roomType}</p>}
                    {!room.canPostCharges ? (
                      <span className="mt-1.5 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                        {t('room_service.no_room_charge', 'Pay at POS only')}
                      </span>
                    ) : room.remainingCents !== null ? (
                      <span className="mt-1.5 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {t('room_service.limit_left', '{{amount}} charge limit left', { amount: formatUsd(room.remainingCents) })}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Delivery details + confirm */}
        <div className="border-t border-[#E3E5E8] dark:border-slate-800 px-4 py-3 space-y-3 bg-[#FAFAFB] dark:bg-slate-900/60">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-1 shrink-0" role="group" aria-label={t('room_service.guests', 'Guests')}>
              <IconUsers size={20} className="text-gray-500 mr-1" />
              <button
                type="button"
                onClick={() => setGuestCount((n) => Math.max(1, n - 1))}
                className="w-[42px] h-[42px] rounded-lg bg-white dark:bg-slate-800 border border-[#D4D7DC] dark:border-slate-700 flex items-center justify-center active:scale-95 transition"
                aria-label={t('room_service.fewer_guests', 'Fewer guests')}
              >
                <IconMinus size={16} stroke={2.6} />
              </button>
              <span className="min-w-[28px] text-center font-bold tabular-nums text-gray-900 dark:text-white">{guestCount}</span>
              <button
                type="button"
                onClick={() => setGuestCount((n) => Math.min(99, n + 1))}
                className="w-[42px] h-[42px] rounded-lg bg-white dark:bg-slate-800 border border-[#D4D7DC] dark:border-slate-700 flex items-center justify-center active:scale-95 transition"
                aria-label={t('room_service.more_guests', 'More guests')}
              >
                <IconPlus size={16} stroke={2.6} />
              </button>
            </div>
            <input
              type="text"
              value={note}
              maxLength={255}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('room_service.note', 'Delivery note (e.g. no ice, cutlery for 2)')}
              className="flex-1 min-h-[42px] px-3 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-[#D4D7DC] dark:border-slate-700 focus:border-[#7C3AED] outline-none"
            />
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={!picked}
            className="w-full min-h-[48px] rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-bold active:scale-95 transition disabled:opacity-40 disabled:active:scale-100"
          >
            {picked
              ? t('room_service.confirm', 'Deliver to Room {{room}}', { room: picked.roomNumber })
              : t('room_service.pick_first', 'Pick a room')}
          </button>
        </div>
      </div>
    </div>
  );
}
