import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import clsx from "clsx";
import {
  IconPlus,
  IconUsers,
  IconBell,
  IconBellRinging,
  IconArmchair,
  IconClock,
  IconDots,
  IconPencil,
  IconX,
  IconUserOff,
  IconArrowBackUp,
  IconPhone,
  IconMessageCheck,
  IconMessageX,
  IconMessageOff,
  IconMinus,
  IconQrcode,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react";
import Page from "../components/Page";
import { iconStroke } from "../config/config";
import { SocketContext } from "../contexts/SocketContext";
import { useStoreTablesLiveStatus } from "../controllers/settings.controller";
import {
  useWaitlist,
  addWaitlistEntry,
  updateWaitlistEntry,
  setWaitlistStatus,
  notifyWaitlistEntry,
  deleteWaitlistEntry,
} from "../controllers/waitlist.controller";

const QUOTE_CHOICES = [5, 10, 15, 20, 30, 45, 60];
const PARTY_CHOICES = [1, 2, 3, 4, 5, 6, 8, 10];

const minutesSince = (value, now) => {
  if (!value) return 0;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 60000));
};

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

/** Short form of a stored "+85512345678" for display: "012 345 678". */
const displayPhone = (phone) => {
  if (!phone) return "";
  const m = String(phone).match(/^\+855(\d+)$/);
  if (!m) return phone;
  const local = `0${m[1]}`;
  return local.replace(/^(\d{3})(\d{3})(\d+)$/, "$1 $2 $3");
};

export default function WaitlistPage() {
  const { t } = useTranslation();
  const { socket, isSocketConnected } = useContext(SocketContext);
  const { data, isLoading, mutate } = useWaitlist();
  const [now, setNow] = useState(Date.now());
  const [editing, setEditing] = useState(null); // null | {} (new) | entry
  const [seating, setSeating] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [addedQr, setAddedQr] = useState(null);
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!socket || !isSocketConnected) return undefined;
    const onUpdate = () => mutate();
    socket.on("waitlist_update", onUpdate);
    return () => socket.off("waitlist_update", onUpdate);
  }, [socket, isSocketConnected, mutate]);

  const active = data?.active || [];
  const closed = data?.closed || [];
  const stats = data?.stats || {};
  const smsEnabled = Boolean(data?.smsEnabled);

  const run = async (id, fn, okMessage) => {
    setBusyId(id);
    setMenuFor(null);
    try {
      const res = await fn();
      if (okMessage) toast.success(okMessage);
      await mutate();
      return res;
    } catch (err) {
      toast.error(errorMessage(err, t("waitlist.error", "Something went wrong")));
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const handleNotify = async (entry) => {
    const res = await run(entry.id, () => notifyWaitlistEntry(entry.id));
    const sms = res?.data?.sms;
    if (!sms) return;
    if (sms.status === "sent") {
      toast.success(t("waitlist.sms_sent", "Text sent to {{name}}", { name: entry.guest_name }));
    } else if (sms.status === "failed") {
      toast.error(`${t("waitlist.sms_failed", "Text failed")}: ${sms.error || ""}`);
    } else {
      toast.success(t("waitlist.marked_notified", "Marked as notified. Call out their name."));
    }
  };

  const handleSaved = async (res, isNew) => {
    setEditing(null);
    await mutate();
    if (!isNew) {
      toast.success(t("waitlist.updated", "Updated"));
      return;
    }
    const sms = res?.data?.sms;
    if (sms?.status === "failed") toast.error(`${t("waitlist.sms_failed", "Text failed")}: ${sms.error || ""}`);
    const url = res?.data?.statusUrl;
    if (url) {
      try {
        const img = await QRCode.toDataURL(url, { width: 360, margin: 1 });
        setAddedQr({ img, url, name: res.data.entry?.guest_name, position: active.length + 1 });
      } catch {
        toast.success(t("waitlist.added", "Added to waitlist"));
      }
    }
  };

  const avgWait = stats.avgWaitRecent ?? stats.avgWaitToday;

  return (
    <Page className="flex flex-col h-full max-h-screen overflow-hidden p-3 md:p-4 gap-3 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col gap-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-2xl font-black leading-snug tracking-tight text-gray-900 dark:text-white truncate">
              {t("waitlist.title", "Waitlist")}
            </h2>
            <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-emerald-500/10 px-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {active.length}
            </span>
          </div>
          <button
            onClick={() => setEditing({})}
            className="flex h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-restro-green px-4 text-sm font-bold text-white shadow-sm transition active:scale-95 hover:bg-restro-green-button-hover"
          >
            <IconPlus size={18} stroke={iconStroke} />
            <span>{t("waitlist.add_guest", "Add guest")}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label={t("waitlist.stat_parties", "Parties waiting")} value={stats.waiting ?? 0} />
          <Stat label={t("waitlist.stat_guests", "Guests waiting")} value={stats.guestsWaiting ?? 0} />
          <Stat
            label={t("waitlist.stat_avg_wait", "Avg. wait")}
            value={avgWait == null ? "–" : `${avgWait} ${t("waitlist.min", "min")}`}
          />
          <Stat label={t("waitlist.stat_seated", "Seated today")} value={stats.seatedToday ?? 0} />
        </div>

        {!isLoading && !smsEnabled && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <span className="flex items-center gap-2">
              <IconMessageOff size={18} stroke={iconStroke} />
              {t("waitlist.sms_off_banner", "SMS is off. Guests can still follow their place in line with the QR code.")}
            </span>
            <Link
              to="/dashboard/settings/sms"
              className="flex min-h-[42px] items-center gap-1.5 rounded-xl px-3 font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20 active:scale-95"
            >
              <IconSettings size={16} stroke={iconStroke} />
              {t("waitlist.set_up_sms", "Set up SMS")}
            </Link>
          </div>
        )}
      </div>

      {/* Queue */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 pb-4">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-restro-green" />
          </div>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-gray-300 py-14 text-center dark:border-zinc-700">
            <IconUsers size={40} stroke={1.4} className="text-gray-400" />
            <p className="text-base font-semibold text-gray-700 dark:text-gray-200">
              {t("waitlist.empty_title", "No one is waiting")}
            </p>
            <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
              {t("waitlist.empty_body", "When tables are full, add walk-in guests here and text them when their table is ready.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
            {active.map((entry, index) => (
              <WaitlistCard
                key={entry.id}
                entry={entry}
                position={index + 1}
                now={now}
                busy={busyId === entry.id}
                menuOpen={menuFor === entry.id}
                onToggleMenu={() => setMenuFor(menuFor === entry.id ? null : entry.id)}
                onNotify={() => handleNotify(entry)}
                onSeat={() => setSeating(entry)}
                onEdit={() => { setMenuFor(null); setEditing(entry); }}
                onNoShow={() => run(entry.id, () => setWaitlistStatus(entry.id, "no_show"), t("waitlist.marked_no_show", "Marked as no-show"))}
                onCancel={() => run(entry.id, () => setWaitlistStatus(entry.id, "cancelled"), t("waitlist.removed", "Removed from waitlist"))}
                t={t}
              />
            ))}
          </div>
        )}

        {closed.length > 0 && (
          <div className="mt-5">
            <button
              onClick={() => setShowClosed((v) => !v)}
              className="flex min-h-[42px] items-center gap-2 rounded-xl px-2 text-sm font-bold text-gray-600 dark:text-gray-300 active:scale-95"
            >
              {showClosed ? t("waitlist.hide_today", "Hide today's finished") : t("waitlist.show_today", "Today's finished")}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{closed.length}</span>
            </button>
            {showClosed && (
              <div className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                {closed.map((entry) => (
                  <ClosedRow
                    key={entry.id}
                    entry={entry}
                    busy={busyId === entry.id}
                    onUndo={() => run(entry.id, () => setWaitlistStatus(entry.id, "waiting"), t("waitlist.back_in_line", "Back in line"))}
                    onDelete={() => run(entry.id, () => deleteWaitlistEntry(entry.id))}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {editing && (
        <EntryModal
          entry={editing}
          smsEnabled={smsEnabled}
          suggestedQuote={avgWait}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          t={t}
        />
      )}

      {seating && (
        <SeatModal
          entry={seating}
          onClose={() => setSeating(null)}
          onSeat={async (tableId) => {
            const entry = seating;
            setSeating(null);
            await run(entry.id, () => setWaitlistStatus(entry.id, "seated", tableId), t("waitlist.seated", "Seated"));
          }}
          t={t}
        />
      )}

      {addedQr && <AddedQrModal data={addedQr} onClose={() => setAddedQr(null)} t={t} />}
    </Page>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">{label}</div>
      <div className="text-xl font-black text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

function SmsBadge({ entry, t }) {
  if (entry.sms_status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <IconMessageCheck size={14} stroke={iconStroke} /> {t("waitlist.sms_status_sent", "Text sent")}
      </span>
    );
  }
  if (entry.sms_status === "failed") {
    return (
      <span title={entry.sms_error || ""} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
        <IconMessageX size={14} stroke={iconStroke} /> {t("waitlist.sms_status_failed", "Text failed")}
      </span>
    );
  }
  return null;
}

function WaitlistCard({ entry, position, now, busy, menuOpen, onToggleMenu, onNotify, onSeat, onEdit, onNoShow, onCancel, t }) {
  const waited = minutesSince(entry.created_at, now);
  const quote = entry.quoted_wait_minutes;
  const isNotified = entry.status === "notified";
  const sinceNotified = minutesSince(entry.notified_at, now);
  const over = quote != null && waited > quote;
  const near = quote != null && !over && waited >= quote * 0.8;
  const progress = quote ? Math.min(100, Math.round((waited / Math.max(quote, 1)) * 100)) : 0;

  return (
    <div
      className={clsx(
        "relative flex flex-col gap-3 rounded-3xl border bg-white p-4 shadow-sm dark:bg-zinc-900",
        isNotified ? "border-amber-400 ring-2 ring-amber-300/40 dark:border-amber-500/70" : "border-gray-200 dark:border-zinc-800"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-lg font-black text-gray-700 dark:bg-zinc-800 dark:text-gray-200">
          {position}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-bold text-gray-900 dark:text-white">{entry.guest_name}</span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-restro-green/10 px-2 py-0.5 text-sm font-bold text-restro-green">
              <IconUsers size={14} stroke={iconStroke} /> {entry.party_size}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            {entry.phone ? (
              <a href={`tel:${entry.phone}`} className="inline-flex items-center gap-1 hover:underline">
                <IconPhone size={14} stroke={iconStroke} /> {displayPhone(entry.phone)}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1"><IconMessageOff size={14} stroke={iconStroke} /> {t("waitlist.no_phone", "No phone")}</span>
            )}
            <SmsBadge entry={entry} t={t} />
          </div>
        </div>
        <div className="relative">
          <button
            onClick={onToggleMenu}
            aria-label={t("waitlist.more", "More")}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 active:scale-95 dark:hover:bg-zinc-800"
          >
            <IconDots size={20} stroke={iconStroke} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-2xl border border-gray-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
              <MenuItem icon={IconPencil} label={t("waitlist.edit", "Edit")} onClick={onEdit} />
              <MenuItem icon={IconUserOff} label={t("waitlist.no_show", "No-show")} onClick={onNoShow} />
              <MenuItem icon={IconX} label={t("waitlist.cancel_entry", "Left / cancel")} onClick={onCancel} danger />
            </div>
          )}
        </div>
      </div>

      {entry.notes && (
        <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-zinc-800/60 dark:text-gray-300">{entry.notes}</p>
      )}

      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className={clsx("inline-flex items-center gap-1 font-bold", over ? "text-red-600 dark:text-red-400" : near ? "text-amber-600 dark:text-amber-400" : "text-gray-800 dark:text-gray-100")}>
            <IconClock size={16} stroke={iconStroke} />
            {waited} {t("waitlist.min", "min")}
            {quote != null && (
              <span className="font-medium text-gray-500 dark:text-gray-400">
                {" "}/ {quote} {t("waitlist.min_quoted", "min quoted")}
              </span>
            )}
          </span>
          {isNotified && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
              <IconBellRinging size={14} stroke={iconStroke} />
              {t("waitlist.notified_ago", "Notified {{n}} min ago", { n: sinceNotified })}
            </span>
          )}
        </div>
        {quote != null && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
            <div
              className={clsx("h-full rounded-full transition-all", over ? "bg-red-500" : near ? "bg-amber-500" : "bg-restro-green")}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onNotify}
          disabled={busy}
          className={clsx(
            "flex h-[48px] items-center justify-center gap-2 rounded-2xl text-sm font-bold transition active:scale-95 disabled:opacity-50",
            isNotified
              ? "border border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10"
              : "bg-amber-500 text-white hover:bg-amber-600"
          )}
        >
          <IconBell size={18} stroke={iconStroke} />
          {isNotified ? t("waitlist.notify_again", "Notify again") : t("waitlist.table_ready", "Table ready")}
        </button>
        <button
          onClick={onSeat}
          disabled={busy}
          className="flex h-[48px] items-center justify-center gap-2 rounded-2xl bg-restro-green text-sm font-bold text-white transition hover:bg-restro-green-button-hover active:scale-95 disabled:opacity-50"
        >
          <IconArmchair size={18} stroke={iconStroke} />
          {t("waitlist.seat", "Seat")}
        </button>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left text-sm font-semibold active:scale-[0.98]",
        danger ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-800"
      )}
    >
      <Icon size={18} stroke={iconStroke} />
      {label}
    </button>
  );
}

function ClosedRow({ entry, busy, onUndo, onDelete, t }) {
  const labels = {
    seated: t("waitlist.status_seated", "Seated"),
    cancelled: t("waitlist.status_cancelled", "Left"),
    no_show: t("waitlist.status_no_show", "No-show"),
  };
  const colors = {
    seated: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    cancelled: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300",
    no_show: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-gray-900 dark:text-white">{entry.guest_name}</span>
          <span className="text-sm text-gray-500">· {entry.party_size}</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {t("waitlist.waited", "Waited {{n}} min", { n: entry.waited_minutes ?? 0 })}
          {entry.table_title ? ` · ${entry.table_title}` : ""}
        </div>
      </div>
      <span className={clsx("rounded-full px-2.5 py-1 text-xs font-bold", colors[entry.status])}>{labels[entry.status] || entry.status}</span>
      <button
        onClick={onUndo}
        disabled={busy}
        title={t("waitlist.undo", "Put back in line")}
        className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 active:scale-95 disabled:opacity-50 dark:hover:bg-zinc-800"
      >
        <IconArrowBackUp size={18} stroke={iconStroke} />
      </button>
      <button
        onClick={onDelete}
        disabled={busy}
        title={t("waitlist.delete", "Delete")}
        className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-600 active:scale-95 disabled:opacity-50 dark:hover:bg-red-500/10"
      >
        <IconTrash size={18} stroke={iconStroke} />
      </button>
    </div>
  );
}

function ModalShell({ title, onClose, children, footer, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className={clsx(
          "flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl dark:bg-zinc-900",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-zinc-800">
          <h3 className="text-lg font-black text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 active:scale-95 dark:hover:bg-zinc-800">
            <IconX size={20} stroke={iconStroke} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-gray-100 px-5 py-3 dark:border-zinc-800">{footer}</div>}
      </div>
    </div>
  );
}

const inputClass =
  "w-full h-[46px] px-4 rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-base text-gray-900 dark:text-white focus:outline-none focus:border-restro-green";

const chipClass = (selected) =>
  clsx(
    "min-h-[44px] min-w-[52px] rounded-xl px-3 text-base font-bold transition active:scale-95",
    selected ? "bg-restro-green text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700"
  );

function EntryModal({ entry, smsEnabled, suggestedQuote, onClose, onSaved, t }) {
  const isNew = !entry.id;
  const [guestName, setGuestName] = useState(entry.guest_name || "");
  const [phone, setPhone] = useState(entry.phone ? displayPhone(entry.phone) : "");
  const [partySize, setPartySize] = useState(entry.party_size || 2);
  const [quote, setQuote] = useState(
    entry.id ? entry.quoted_wait_minutes : QUOTE_CHOICES.reduce((best, q) => (suggestedQuote != null && Math.abs(q - suggestedQuote) < Math.abs(best - suggestedQuote) ? q : best), 15)
  );
  const [notes, setNotes] = useState(entry.notes || "");
  const [sendSms, setSendSms] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error(t("waitlist.name_required", "Enter the guest's name"));
      return;
    }
    setSaving(true);
    const payload = { guestName, phone, partySize, quotedWaitMinutes: quote, notes, sendSms };
    try {
      const res = isNew ? await addWaitlistEntry(payload) : await updateWaitlistEntry(entry.id, payload);
      await onSaved(res, isNew);
    } catch (err) {
      toast.error(errorMessage(err, t("waitlist.error", "Something went wrong")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={isNew ? t("waitlist.add_guest", "Add guest") : t("waitlist.edit_guest", "Edit guest")}
      onClose={onClose}
      footer={
        <button
          type="submit"
          form="waitlist-entry-form"
          disabled={saving}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-restro-green text-base font-bold text-white transition hover:bg-restro-green-button-hover active:scale-95 disabled:opacity-60"
        >
          {isNew ? <IconPlus size={20} stroke={iconStroke} /> : null}
          {isNew ? t("waitlist.add_to_list", "Add to waitlist") : t("waitlist.save", "Save")}
        </button>
      }
    >
      <form id="waitlist-entry-form" onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">{t("waitlist.guest_name", "Guest name")}</label>
          <input autoFocus value={guestName} onChange={(e) => setGuestName(e.target.value)} className={inputClass} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">{t("waitlist.phone", "Phone")}</label>
          <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="012 345 678" className={inputClass} />
          {isNew && smsEnabled && phone.trim() && (
            <label className="flex min-h-[42px] items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} className="h-5 w-5 accent-restro-green" />
              {t("waitlist.send_join_text", "Text a confirmation (if turned on in SMS settings)")}
            </label>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">{t("waitlist.party_size", "Party size")}</label>
          <div className="flex flex-wrap items-center gap-2">
            {PARTY_CHOICES.map((n) => (
              <button type="button" key={n} onClick={() => setPartySize(n)} className={chipClass(partySize === n)}>{n}</button>
            ))}
            <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-zinc-800">
              <button type="button" onClick={() => setPartySize((p) => Math.max(1, p - 1))} className="flex h-[42px] w-[42px] items-center justify-center rounded-lg active:scale-95 hover:bg-white dark:hover:bg-zinc-700"><IconMinus size={18} /></button>
              <span className="w-8 text-center text-base font-black">{partySize}</span>
              <button type="button" onClick={() => setPartySize((p) => Math.min(100, p + 1))} className="flex h-[42px] w-[42px] items-center justify-center rounded-lg active:scale-95 hover:bg-white dark:hover:bg-zinc-700"><IconPlus size={18} /></button>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            {t("waitlist.quoted_wait", "Quoted wait (min)")}
            {suggestedQuote != null && (
              <span className="ml-2 normal-case tracking-normal font-semibold text-gray-400">
                {t("waitlist.recent_avg", "recent avg {{n}} min", { n: suggestedQuote })}
              </span>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            {QUOTE_CHOICES.map((q) => (
              <button type="button" key={q} onClick={() => setQuote(q)} className={chipClass(quote === q)}>{q}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">{t("waitlist.notes", "Notes")}</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("waitlist.notes_placeholder", "High chair, outside, birthday…")} className={inputClass} maxLength={255} />
        </div>
      </form>
    </ModalShell>
  );
}

function SeatModal({ entry, onClose, onSeat, t }) {
  const { data, isLoading } = useStoreTablesLiveStatus();
  const tables = useMemo(() => {
    const list = Array.isArray(data?.tables) ? data.tables : [];
    const party = Number(entry.party_size || 1);
    const score = (tbl) => {
      const free = !tbl.active_order_id;
      const fits = Number(tbl.seating_capacity || 0) >= party;
      return (free ? 0 : 4) + (fits ? 0 : 2);
    };
    return [...list].sort((a, b) => score(a) - score(b) || Number(a.seating_capacity || 0) - Number(b.seating_capacity || 0) || String(a.table_title).localeCompare(String(b.table_title), undefined, { numeric: true }));
  }, [data, entry.party_size]);

  return (
    <ModalShell
      wide
      title={t("waitlist.seat_title", "Seat {{name}} ({{n}})", { name: entry.guest_name, n: entry.party_size })}
      onClose={onClose}
      footer={
        <button
          onClick={() => onSeat(null)}
          className="flex h-[48px] w-full items-center justify-center rounded-2xl border border-gray-200 text-sm font-bold text-gray-700 active:scale-95 hover:bg-gray-50 dark:border-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-800"
        >
          {t("waitlist.seat_no_table", "Seat without choosing a table")}
        </button>
      }
    >
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-gray-300 border-t-restro-green" />
        </div>
      ) : tables.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{t("waitlist.no_tables", "No tables set up yet.")}</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {tables.map((tbl) => {
            const busy = Boolean(tbl.active_order_id);
            const fits = Number(tbl.seating_capacity || 0) >= Number(entry.party_size || 1);
            return (
              <button
                key={tbl.id}
                onClick={() => onSeat(tbl.id)}
                className={clsx(
                  "flex min-h-[72px] flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center transition active:scale-95",
                  busy
                    ? "border-gray-200 bg-gray-50 text-gray-400 dark:border-zinc-800 dark:bg-zinc-800/50"
                    : fits
                      ? "border-restro-green/50 bg-restro-green/10 text-gray-900 hover:bg-restro-green/20 dark:text-white"
                      : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                )}
              >
                <span className="text-base font-black truncate max-w-full">{tbl.table_title}</span>
                <span className="text-xs font-semibold">
                  {busy ? t("waitlist.table_busy", "In use") : `${tbl.seating_capacity || "–"} ${t("waitlist.seats", "seats")}`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

function AddedQrModal({ data, onClose, t }) {
  return (
    <ModalShell title={t("waitlist.added_title", "{{name}} is #{{n}} in line", { name: data.name, n: data.position })} onClose={onClose}>
      <div className="flex flex-col items-center gap-3 pb-2 text-center">
        <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <IconQrcode size={18} stroke={iconStroke} />
          {t("waitlist.scan_hint", "Let the guest scan this to follow their place in line.")}
        </p>
        <img src={data.img} alt="" className="h-64 w-64 rounded-2xl border border-gray-200 bg-white p-2 dark:border-zinc-700" />
        <p className="break-all text-xs text-gray-400">{data.url}</p>
        <button
          onClick={onClose}
          className="mt-1 flex h-[48px] w-full items-center justify-center rounded-2xl bg-restro-green text-base font-bold text-white active:scale-95 hover:bg-restro-green-button-hover"
        >
          {t("waitlist.done", "Done")}
        </button>
      </div>
    </ModalShell>
  );
}
