import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import ApiClient from "../../helpers/ApiClient";
import { BREAKPOINTS, COLS } from "../types";

const LAYOUT_URL = "/dashboard/layout";

const fetcher = (url) => ApiClient.get(url).then((r) => r.data);

/**
 * useDashboardLayout
 * - Fetches the user's saved layout (or null on first load).
 * - Provides optimistic, debounced save.
 * - Provides reset.
 *
 * The seed/default layout is decided by the *frontend* (so first-time users
 * get a consistent default that matches the registered widget catalog).
 */
export function useDashboardLayout(getDefaultLayout) {
  const { data, error, isLoading, mutate } = useSWR(LAYOUT_URL, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const [localLayout, setLocalLayout] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (data === undefined) return;
    const fetched = data?.layout?.layout_json || null;
    if (fetched) {
      setLocalLayout(normalizeLayout(fetched));
    } else {
      const seed = typeof getDefaultLayout === "function"
        ? getDefaultLayout()
        : getDefaultLayout;
      setLocalLayout(normalizeLayout(seed));
    }
    setDirty(false);
  }, [data]);

  const persist = useCallback(async (layoutToSave, opts = {}) => {
    setSaving(true);
    try {
      const res = await ApiClient.put(LAYOUT_URL, {
        layout_json: layoutToSave,
        template_key: opts.templateKey ?? data?.layout?.template_key ?? null,
      });
      mutate(res.data, { revalidate: false });
      setDirty(false);
    } catch (e) {
      console.error("save layout failed", e);
    } finally {
      setSaving(false);
    }
  }, [data, mutate]);

  const updateLayout = useCallback((next, { immediate = false } = {}) => {
    setLocalLayout(next);
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (immediate) {
      persist(next);
    } else {
      saveTimer.current = setTimeout(() => persist(next), 700);
    }
  }, [persist]);

  const resetLayout = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    try {
      await ApiClient.post(`${LAYOUT_URL}/reset`);
      await mutate();
    } finally {
      setSaving(false);
    }
  }, [mutate]);

  return {
    layout: localLayout,
    isLoading,
    isError: !!error,
    dirty,
    saving,
    updateLayout,
    resetLayout,
    saveNow: () => localLayout && persist(localLayout),
  };
}

export function normalizeLayout(layout) {
  if (!layout) return null;
  return {
    version: layout.version || 1,
    breakpoints: layout.breakpoints || BREAKPOINTS,
    cols: layout.cols || COLS,
    items: Array.isArray(layout.items) ? layout.items : [],
  };
}
