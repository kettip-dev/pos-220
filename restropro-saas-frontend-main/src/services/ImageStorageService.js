import { setImageStorageConfig } from "../helpers/ImageHelper";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";

/**
 * Initialize image storage configuration globally.
 * This should be called once when the app loads to ensure cloud image URLs work everywhere.
 * 
 * The config is automatically set when:
 * 1. User fetches store settings (via useStoreSettings hook)
 * 2. QR menu is loaded
 * 3. POS is initialized
 * 4. Menu item details are loaded
 * 
 * This function provides a fallback initialization for pages that don't explicitly fetch these.
 */
export async function initializeImageStorage() {
    try {
        const user = getUserDetailsInLocalStorage();
        
        // Only initialize for authenticated users (tenant admins)
        // QR menu pages initialize their own config from the public endpoint
        if (!user || !user.tenant_id) {
            return;
        }

        // The config will be set automatically when any of the above endpoints are called
        // This is just a placeholder for future enhancement if needed
        // For now, we rely on individual page initializations
        
        console.log("[ImageStorage] Initialization ready. Config will be set by data-fetching hooks.");
    } catch (error) {
        console.error("[ImageStorage] Failed to initialize:", error);
    }
}

/**
 * For future enhancement: Add a dedicated lightweight endpoint
 * GET /api/v1/settings/image-storage-config
 * Returns: { publicUrl: string | null }
 * 
 * Then uncomment this implementation:
 * 
 * import ApiClient from "../helpers/ApiClient";
 * 
 * export async function initializeImageStorage() {
 *     try {
 *         const user = getUserDetailsInLocalStorage();
 *         if (!user || !user.tenant_id) return;
 *         
 *         const res = await ApiClient.get("/settings/image-storage-config");
 *         if (res.data?.publicUrl) {
 *             setImageStorageConfig(res.data);
 *         }
 *     } catch (error) {
 *         console.error("[ImageStorage] Failed to initialize:", error);
 *     }
 * }
 */
