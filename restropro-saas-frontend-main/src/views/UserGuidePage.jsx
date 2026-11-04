import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconBook, IconRocket, IconSearch, IconX, IconListDetails } from "@tabler/icons-react";
import Page from "../components/Page";
import { Blocks, parseBlocks, splitSections } from "../helpers/MarkdownLite";
import gettingStartedMd from "../docs/user-guide/GETTING_STARTED.md?raw";
import posGuideMd from "../docs/user-guide/POS_USER_GUIDE.md?raw";
import gettingStartedKmMd from "../docs/user-guide/GETTING_STARTED.km.md?raw";
import posGuideKmMd from "../docs/user-guide/POS_USER_GUIDE.km.md?raw";

// Each guide has an English and a Khmer (.km.md) version; links between guides use the English file name.
const DOCS = [
  { id: "getting-started", file: "GETTING_STARTED.md", source: { en: gettingStartedMd, km: gettingStartedKmMd }, Icon: IconRocket, labelKey: "user_guide.getting_started", fallback: "Getting Started" },
  { id: "pos", file: "POS_USER_GUIDE.md", source: { en: posGuideMd, km: posGuideKmMd }, Icon: IconBook, labelKey: "user_guide.pos_guide", fallback: "POS Guide" },
];

export default function UserGuidePage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [activeSlug, setActiveSlug] = useState(null);
  const scrollRef = useRef(null);
  const pendingAnchor = useRef(null);

  const doc = DOCS.find((d) => d.id === searchParams.get("doc")) || DOCS[0];
  const lang = (i18n.language || "").startsWith("km") ? "km" : "en";
  const source = doc.source[lang] || doc.source.en;

  const sections = useMemo(
    () => splitSections(source).map((s) => ({ ...s, blocks: parseBlocks(s.raw.split("\n")) })),
    [source]
  );

  const q = query.trim().toLowerCase();
  const visible = q ? sections.filter((s) => s.raw.toLowerCase().includes(q)) : sections;
  const toc = visible.filter((s) => s.title);

  const scrollTo = (id) => {
    const el = scrollRef.current?.querySelector(`[id="${CSS.escape(id)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSlug(id);
    }
  };

  const switchDoc = (id, anchor = null) => {
    setQuery("");
    pendingAnchor.current = anchor;
    setSearchParams(id === DOCS[0].id ? {} : { doc: id }, { replace: true });
  };

  // After switching documents, jump to the requested anchor or back to the top.
  useEffect(() => {
    const anchor = pendingAnchor.current;
    pendingAnchor.current = null;
    if (anchor) requestAnimationFrame(() => scrollTo(anchor));
    else window.scrollTo({ top: 0 });
    setActiveSlug(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  // Highlight the section currently in view in the contents list.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;
    const onScroll = () => {
      const heads = root.querySelectorAll("h2[id]");
      const top = 120;
      let current = null;
      heads.forEach((h) => { if (h.getBoundingClientRect().top <= top) current = h.id; });
      setActiveSlug(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [doc.id, q]);

  const onLink = (href) => {
    const [file, anchor] = href.split("#");
    if (!file) return scrollTo(anchor);
    const target = DOCS.find((d) => d.file === file.split("/").pop().replace(/\.km\.md$/, ".md"));
    if (target) {
      if (target.id === doc.id) { if (anchor) scrollTo(anchor); }
      else switchDoc(target.id, anchor || null);
    }
  };

  const ctx = { onLink };

  return (
    <Page className="flex flex-col gap-3 text-foreground">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-black leading-snug tracking-tight text-gray-900 dark:text-white">
            {t("user_guide.title", "User Guide")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            {t("user_guide.subtitle", "Step-by-step help for setting up and running your POS.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-2xl border border-gray-200 bg-gray-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            {DOCS.map(({ id, Icon, labelKey, fallback }) => {
              const active = id === doc.id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchDoc(id)}
                  className={`flex min-h-[42px] items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold leading-snug transition active:scale-95 ${
                    active
                      ? "bg-white text-gray-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                      : "text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <Icon size={18} stroke={1.8} className={active ? "text-restro-green" : ""} />
                  {t(labelKey, fallback)}
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
            <IconSearch size={18} stroke={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("user_guide.search", "Search the guide...")}
              className="h-[42px] w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-900 outline-none transition focus:border-restro-border-green focus:ring-2 focus:ring-restro-green/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("user_guide.clear_search", "Clear search")}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 active:scale-95"
              >
                <IconX size={16} stroke={2} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex items-start gap-4">
        {/* Contents */}
        <aside className="hidden lg:flex sticky top-[72px] max-h-[calc(100vh-96px)] w-64 shrink-0 flex-col overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="flex items-center gap-2 px-2.5 pb-2 pt-1.5 text-xs font-bold uppercase text-gray-400 dark:text-zinc-500">
            <IconListDetails size={16} stroke={1.8} />
            {t("user_guide.contents", "Contents")}
          </p>
          {toc.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => scrollTo(s.slug)}
              className={`min-h-[42px] rounded-xl px-2.5 py-2 text-left text-sm leading-snug transition active:scale-95 ${
                activeSlug === s.slug
                  ? "bg-emerald-500/10 font-bold text-restro-green"
                  : "text-gray-600 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {s.title}
            </button>
          ))}
        </aside>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 min-w-0 rounded-2xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <article className="mx-auto max-w-3xl px-4 py-5 md:px-8 md:py-7 text-[15px] text-gray-700 dark:text-zinc-300">
            {visible.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                <IconSearch size={36} stroke={1.5} className="text-gray-300 dark:text-zinc-600" />
                <p className="text-sm text-gray-500 dark:text-zinc-400">{t("user_guide.no_results", "No sections match your search.")}</p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="flex h-[42px] items-center rounded-xl bg-restro-green px-4 text-sm font-bold text-white transition active:scale-95 hover:bg-restro-green-button-hover"
                >
                  {t("user_guide.clear_search", "Clear search")}
                </button>
              </div>
            ) : (
              visible.map((s, i) => (
                <section key={s.slug || `intro-${i}`} className={i > 0 ? "mt-8 border-t border-gray-100 pt-6 dark:border-zinc-800" : ""}>
                  <Blocks blocks={s.blocks.filter((b) => b.type !== "hr")} ctx={ctx} k={`s${i}`} />
                </section>
              ))
            )}
          </article>
        </div>
      </div>
    </Page>
  );
}
