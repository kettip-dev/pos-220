import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../assets/logo.svg";
import ApiClient from "../helpers/ApiClient";
import { isRestroUserAuthenticated } from "../helpers/AuthStatus";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { signOut } from "../controllers/auth.controller";
import { IconAlertCircle, IconCircleCheck, IconExternalLink } from "@tabler/icons-react";

/**
 * Opened in the system browser by the Bong POS desktop app
 * ("Sign in with your browser", like VS Code):
 *   /desktop-login?state=…&challenge=…
 * Once signed in here, "Open Bong POS" creates a one-time code and hands it to
 * the app through bongpos://auth/callback. The app finishes the sign-in with
 * its secret PKCE verifier, so the link alone is useless to anyone else.
 */

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const STATE = /^[A-Za-z0-9_-]{16,64}$/;

export default function DesktopLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const state = params.get("state") || "";
  const challenge = params.get("challenge") || "";
  const validRequest = STATE.test(state) && TOKEN.test(challenge);

  const [status, setStatus] = useState("idle"); // idle | working | opened | error
  const [error, setError] = useState("");
  const user = getUserDetailsInLocalStorage();

  const loginPath = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;

  useEffect(() => {
    if (validRequest && !(isRestroUserAuthenticated() && user)) {
      navigate(loginPath, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openApp = async () => {
    setStatus("working");
    setError("");
    try {
      const { data } = await ApiClient.post("/auth/desktop/code", { code_challenge: challenge });
      const link = `bongpos://auth/callback?code=${encodeURIComponent(data.code)}&state=${encodeURIComponent(state)}`;
      window.location.href = link;
      setStatus("opened");
    } catch (err) {
      setStatus("error");
      setError(err?.response?.data?.message || t("desktop_login.error", "Could not sign in to the app. Try again."));
    }
  };

  const switchAccount = async () => {
    try {
      await signOut();
    } catch (_) {
      // signOut clears the local session even when the request fails
    }
    navigate(loginPath, { replace: true });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#0D1117] px-5 py-10">
      <div className="w-full max-w-[440px] rounded-3xl border border-slate-200 dark:border-[#30363D] bg-white dark:bg-[#161B22] p-8 shadow-sm text-center">
        <img src={Logo} alt="Bong POS" className="h-9 w-auto mx-auto mb-6 dark:invert" />

        {!validRequest ? (
          <>
            <IconAlertCircle size={40} className="mx-auto text-amber-500" />
            <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">
              {t("desktop_login.invalid_title", "Open this page from the Bong POS app")}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              {t("desktop_login.invalid_desc", "In the Bong POS desktop app, click \"Sign in with your browser\".")}
            </p>
          </>
        ) : status === "opened" ? (
          <>
            <IconCircleCheck size={44} className="mx-auto text-emerald-500" />
            <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">
              {t("desktop_login.opened_title", "You're signed in to the Bong POS app")}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
              {t("desktop_login.opened_desc", "If your browser asks, allow it to open Bong POS. You can close this tab.")}
            </p>
            <button
              type="button"
              onClick={openApp}
              className="mt-6 w-full min-h-[48px] rounded-xl font-semibold text-[15px] border border-slate-200 dark:border-[#30363D] text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 transition"
            >
              {t("desktop_login.open_again", "Bong POS didn't open? Try again")}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t("desktop_login.title", "Sign in to the Bong POS app")}
            </h1>
            {user && (
              <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                {t("desktop_login.signed_in_as", "Signed in as")}{" "}
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{user.name || user.username}</span>
                {user.name && user.username ? <span className="block text-xs mt-0.5">{user.username}</span> : null}
              </p>
            )}

            {error && (
              <div role="alert" className="mt-5 flex items-start gap-2 p-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700 text-left">
                <IconAlertCircle size={18} className="shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={openApp}
              disabled={status === "working"}
              className="mt-6 w-full min-h-[52px] rounded-xl font-bold text-[15px] bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition flex items-center justify-center gap-2.5 disabled:opacity-60"
            >
              <IconExternalLink size={20} />
              {status === "working"
                ? t("desktop_login.opening", "Opening Bong POS...")
                : t("desktop_login.open_app", "Open Bong POS")}
            </button>
            <button
              type="button"
              onClick={switchAccount}
              className="mt-3 w-full min-h-[44px] rounded-xl text-sm font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-95 transition"
            >
              {t("desktop_login.switch_account", "Use a different account")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
