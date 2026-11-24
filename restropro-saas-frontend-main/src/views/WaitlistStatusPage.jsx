import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconBellRinging, IconClock, IconUsers, IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { getPublicWaitlistStatus } from "../controllers/waitlist.controller";
import { getImageURL } from "../helpers/ImageHelper";

const POLL_MS = 15000;

/**
 * Guest-facing waitlist status (no login). Polls every 15 s and turns green,
 * vibrates and changes the tab title when the table is ready.
 */
export default function WaitlistStatusPage() {
  const { code } = useParams();
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, data: null, notFound: false });
  const wasReady = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const load = async () => {
      try {
        const data = await getPublicWaitlistStatus(code);
        if (cancelled) return;
        setState({ loading: false, data, notFound: false });
        const ready = data.status === "notified";
        if (ready && !wasReady.current) {
          try { navigator.vibrate?.([300, 150, 300]); } catch { /* not supported */ }
        }
        wasReady.current = ready;
        if (["seated", "cancelled", "no_show"].includes(data.status)) return; // final: stop polling
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 404) {
          setState({ loading: false, data: null, notFound: true });
          return;
        }
        setState((s) => ({ ...s, loading: false })); // network blip: keep last state, retry
      }
      timer = setTimeout(load, POLL_MS);
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code]);

  const { loading, data, notFound } = state;

  useEffect(() => {
    if (!data) return;
    document.title = data.status === "notified"
      ? `🔔 ${t("waitlist_public.ready_short", "Your table is ready!")}`
      : `${t("waitlist_public.title", "Waitlist")} · ${data.storeName || ""}`;
  }, [data, t]);

  if (loading) {
    return (
      <Shell>
        <div className="flex h-60 items-center justify-center">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
        </div>
      </Shell>
    );
  }

  if (notFound || !data) {
    return (
      <Shell>
        <div className="py-16 text-center">
          <IconCircleX size={48} stroke={1.5} className="mx-auto text-gray-400" />
          <p className="mt-3 text-lg font-bold text-gray-800">{t("waitlist_public.not_found", "We couldn't find this waitlist spot.")}</p>
          <p className="mt-1 text-sm text-gray-500">{t("waitlist_public.ask_host", "Please ask the host for help.")}</p>
        </div>
      </Shell>
    );
  }

  const ready = data.status === "notified";
  const seated = data.status === "seated";
  const closed = data.status === "cancelled" || data.status === "no_show";
  const remaining = data.quotedWaitMinutes != null ? Math.max(0, data.quotedWaitMinutes - data.waitedMinutes) : null;

  return (
    <Shell storeName={data.storeName} storeImage={data.storeImage}>
      <p className="text-center text-base text-gray-600">
        {t("waitlist_public.hello", "Hi {{name}}", { name: data.firstName })} ·{" "}
        <span className="inline-flex items-center gap-1"><IconUsers size={16} /> {data.partySize}</span>
      </p>

      {ready ? (
        <div className="mt-5 rounded-3xl bg-emerald-600 px-6 py-10 text-center text-white shadow-lg animate-pulse">
          <IconBellRinging size={56} stroke={1.6} className="mx-auto" />
          <p className="mt-3 text-3xl font-black">{t("waitlist_public.ready", "Your table is ready!")}</p>
          <p className="mt-2 text-base opacity-90">{t("waitlist_public.come_now", "Please come to the host stand now.")}</p>
        </div>
      ) : seated ? (
        <div className="mt-5 rounded-3xl bg-emerald-50 px-6 py-10 text-center text-emerald-800">
          <IconCircleCheck size={52} stroke={1.6} className="mx-auto" />
          <p className="mt-3 text-2xl font-black">{t("waitlist_public.seated", "You're seated. Enjoy your meal!")}</p>
        </div>
      ) : closed ? (
        <div className="mt-5 rounded-3xl bg-gray-100 px-6 py-10 text-center text-gray-700">
          <p className="text-xl font-bold">{t("waitlist_public.closed", "This waitlist spot is closed.")}</p>
          <p className="mt-1 text-sm">{t("waitlist_public.ask_host", "Please ask the host for help.")}</p>
        </div>
      ) : (
        <div className="mt-5 rounded-3xl border border-gray-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-gray-500">{t("waitlist_public.your_place", "Your place in line")}</p>
          <p className="mt-1 text-7xl font-black text-gray-900">{data.position}</p>
          {remaining != null && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700">
              <IconClock size={16} />
              {remaining > 0
                ? t("waitlist_public.about_min", "About {{n}} min", { n: remaining })
                : t("waitlist_public.any_minute", "Any minute now")}
            </p>
          )}
          <p className="mt-4 text-sm text-gray-500">{t("waitlist_public.keep_open", "Keep this page open. It updates by itself and turns green when your table is ready.")}</p>
        </div>
      )}
    </Shell>
  );
}

function Shell({ storeName, storeImage, children }) {
  return (
    <div className="min-h-dvh bg-gray-50 px-4 py-8 text-gray-900">
      <div className="mx-auto w-full max-w-md">
        {(storeName || storeImage) && (
          <div className="mb-4 flex flex-col items-center gap-2">
            {storeImage && <img src={getImageURL(storeImage)} alt="" className="h-16 w-16 rounded-2xl object-cover" />}
            {storeName && <h1 className="text-xl font-black">{storeName}</h1>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
