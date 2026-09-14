import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { refreshSession } from "./ApiClient";

export default function useAuth() {
  const location = useLocation();
  const navigate = useNavigate();

  // `ready` gates the first render of the authenticated area. We do NOT let the
  // page's data requests fire until the session has been refreshed once, so the
  // very first request after the app loads always carries a fresh access token.
  // This kills the "open after a day -> 401 -> error, but works after a manual
  // refresh" race. Subsequent navigations are NOT gated (ready stays true).
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  const markReady = () => {
    if (!readyRef.current) {
      readyRef.current = true;
      setReady(true);
    }
  };

  // Proactively refresh the session. The single-flight `refreshSession`
  // dedupes concurrent calls (mount + focus + path change firing together)
  // so we never stampede the refresh endpoint or rotate tokens twice.
  const safeRefresh = async () => {
    try {
      await refreshSession();
      markReady();
    } catch (error) {
      // Only bounce the user out when the session is genuinely invalid (401 =
      // refresh token expired/revoked). Transient/network errors must NOT log
      // them out — the response interceptor recovers on the next real request,
      // so we still mark ready and let the app run.
      if (error?.response?.status === 401) {
        navigate("/refresh", { replace: true });
        return;
      }
      console.error("Token refresh failed:", error);
      markReady();
    }
  };

  // p1 + p2: initial token + refresh every 13 minutes
  useEffect(() => {
    safeRefresh();

    const id = setInterval(() => {
      safeRefresh();
    }, 13 * 60 * 1000); // 13 minutes

    return () => clearInterval(id);
  }, []);

  // p3: get token when window activity changes
  useEffect(() => {
    const handleActivity = () => {
      if (document.visibilityState === "hidden") return; // only refresh when visible
      safeRefresh();
    };

    window.addEventListener("focus", handleActivity);
    document.addEventListener("visibilitychange", handleActivity);

    return () => {
      window.removeEventListener("focus", handleActivity);
      document.removeEventListener("visibilitychange", handleActivity);
    };
  }, []);

  // p4: get token when path changes, (optional) -- require for upgrade/downgrade
  useEffect(() => {
    safeRefresh();
  }, [location.pathname]);

  return { ready };
}
