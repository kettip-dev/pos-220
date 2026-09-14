const { load } = require("cheerio");
const dns = require("dns").promises;

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ensureInternet = async () => {
    await dns.lookup("www.bing.com");
};

const normalizeUrl = (srcRaw) => {
    if (!srcRaw) return null;
    let src = srcRaw.trim();
    if (!src) return null;
    if (src.startsWith("//")) {
        src = `https:${src}`;
    }
    return src;
};

const fetchText = async (url, { timeoutMs = 15000, maxBytes = 5 * 1024 * 1024, headers = {} } = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { headers, signal: controller.signal });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const reader = response.body?.getReader ? response.body.getReader() : null;

        if (!reader) {
            const text = await response.text();
            if (Buffer.byteLength(text) > maxBytes) {
                throw new Error("Response too large");
            }
            return text;
        }

        const chunks = [];
        let received = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            received += value.length;
            if (received > maxBytes) {
                controller.abort();
                throw new Error("Response too large");
            }

            chunks.push(value);
        }

        return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
    } finally {
        clearTimeout(timeout);
    }
};

/**
 * Scrapes Bing Image Search results (no API key required) for product photo suggestions.
 * @param {string} query Search term (e.g. menu item title)
 * @param {number} count Number of image URLs to return
 * @returns {Promise<{ok: boolean, imageUrls?: string[], error?: string}>}
 */
exports.bingSearchImages = async (query, count = 4) => {
    const q = String(query || "").trim();
    if (!q) return { ok: true, imageUrls: [] };

    try {
        await ensureInternet();
    } catch {
        return { ok: false, error: "No internet connection." };
    }

    const searchQuery = `${q} food photo`;
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(searchQuery)}&form=HDRSC2`;

    let html;
    try {
        html = await fetchText(url, {
            timeoutMs: 15000,
            maxBytes: 5 * 1024 * 1024,
            headers: {
                "User-Agent": USER_AGENT,
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9"
            }
        });
    } catch {
        return { ok: false, error: "Failed to fetch images from Bing." };
    }

    const $ = load(html);
    const imageUrls = [];

    // 1) Prefer main image result thumbnails.
    $("img.mimg").each((_, el) => {
        if (imageUrls.length >= count) return false;

        const srcRaw = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-src2") || "";
        let src = normalizeUrl(srcRaw);

        // Basic quality filters.
        if (!src) return;
        if (src.startsWith("data:")) return;
        if (!src.startsWith("http")) return;
        if (src.includes("bing.net/th?id=OIP.")) return;

        imageUrls.push(src);
    });

    // 2) Fallback: some layouts use different img tags.
    if (imageUrls.length < count) {
        $("img").each((_, el) => {
            if (imageUrls.length >= count) return false;
            const srcRaw = $(el).attr("src") || $(el).attr("data-src") || "";
            const src = normalizeUrl(srcRaw);
            if (!src) return;
            if (src.startsWith("data:")) return;
            if (!src.startsWith("http")) return;
            if (imageUrls.includes(src)) return;
            imageUrls.push(src);
        });
    }

    return { ok: true, imageUrls: imageUrls.slice(0, count) };
};
