import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { toast } from "react-hot-toast";
import { API } from "../config/config";
import { saveUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { parseUser, getHomePathForUser, getDesktopBridge } from "../helpers/SignInHelper";
import { IconAlertCircle, IconLoader2 } from "@tabler/icons-react";

/**
 * Inside the desktop app only: the app opens this page after the browser sent
 * it a one-time code (bongpos://auth/callback). The code and the app's PKCE
 * verifier come from the app itself (never from the URL), are exchanged for a
 * normal session cookie, and the user lands on their home page.
 */
export default function DesktopLoginCompletePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const desktop = getDesktopBridge();
      const pending = desktop?.takeBrowserSignIn ? await desktop.takeBrowserSignIn() : null;
      if (!pending?.code || !pending?.verifier) {
        navigate("/login", { replace: true });
        return;
      }
      try {
        const res = await axios.post(
          `${API}/auth/desktop/exchange`,
          { code: pending.code, code_verifier: pending.verifier },
          { withCredentials: true }
        );
        saveUserDetailsInLocalStorage(parseUser(res.data.user));
        toast.success(t("login.success_message"));
        navigate(getHomePathForUser(res.data.user), { replace: true });
      } catch (err) {
        console.error("Desktop sign-in failed", err?.message || err);
        setError(err?.response?.data?.message || t("desktop_login.error", "Could not sign in to the app. Try again."));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#0D1117] px-5">
      <div className="w-full max-w-[400px] text-center">
        {error ? (
          <>
            <IconAlertCircle size={40} className="mx-auto text-rose-500" />
            <p className="mt-4 text-[15px] font-semibold text-slate-800 dark:text-zinc-200">{error}</p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="mt-6 w-full min-h-[52px] rounded-xl font-bold text-[15px] bg-slate-900 text-white active:scale-95 transition"
            >
              {t("desktop_login.back_to_login", "Back to sign in")}
            </button>
          </>
        ) : (
          <>
            <IconLoader2 size={36} className="mx-auto text-emerald-600 animate-spin" />
            <p className="mt-4 text-[15px] font-semibold text-slate-700 dark:text-zinc-300">
              {t("desktop_login.finishing", "Signing you in...")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
