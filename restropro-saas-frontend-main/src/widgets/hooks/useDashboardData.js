import useSWR from "swr";
import ApiClient from "../../helpers/ApiClient";

/**
 * Single shared dashboard data fetch. All widgets that pull from the
 * monolithic /dashboard payload read from the same SWR key, so 12 widgets
 * on screen still trigger only one network call.
 *
 * Phase 3 will introduce per-widget endpoints; this hook stays as the
 * fallback "shared bundle" source.
 */
const fetcher = (url) => ApiClient.get(url).then((r) => r.data);

export function useDashboardData() {
  const { data, error, isLoading, mutate } = useSWR("/dashboard", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30 * 1000,
    // Keep "Today at a glance" live on a tablet left open at the counter.
    refreshInterval: 60 * 1000,
  });
  return { data, error, isLoading, refresh: mutate };
}
