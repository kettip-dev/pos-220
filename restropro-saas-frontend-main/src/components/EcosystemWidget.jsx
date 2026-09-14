import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconBrandWhatsapp,
  IconMail,
  IconWorld,
  IconLayoutDashboard,
  IconDeviceMobile,
  IconChefHat,
  IconUserCheck,
  IconMessageCircle,
  IconCheck,
  IconRocket,
  IconAdjustmentsAlt,
  IconWand,
  IconSparkles,
  IconPhoto,
  IconArrowsMaximize,
} from "@tabler/icons-react";

/**
 * EcosystemWidget — a support-style chat widget that introduces the full
 * RestroPro SaaS suite. A launcher with rotating teaser bubbles opens a chat
 * panel; the "assistant" walks visitors through each product (with image
 * carousels + clean feature lists), services, and contact options.
 *
 * Drop screenshots into these folders (auto-detected, no code change):
 *   src/assets/RestroPROImages/  src/assets/CaptainAppImages/
 *   src/assets/KitchenAppImages/ src/assets/WaiterAppImages/
 */

const WHATSAPP = "9499888170";
const EMAIL = "hi@uiflow.in";
const WEBSITE = "uiflow.in";

const TEASERS = [
  "👋 Hi! Need help getting started?",
  "RestroPro isn't just one app — see the full suite",
  "Captain · Kitchen · Waiter apps too 👀",
  "Have a question? Chat with us 💬",
];
const TEASER_SHOW_MS = 4200;
const TEASER_GAP_MS = 2600;
const TEASER_FIRST_DELAY_MS = 1800;

// --- Auto-import images per folder ------------------------------------------
const SUITE_IMGS = import.meta.glob(
  "../assets/RestroPROImages/*.{png,jpg,jpeg,webp}",
  { eager: true, query: "?url", import: "default" }
);
const CAPTAIN_IMGS = import.meta.glob(
  "../assets/CaptainAppImages/*.{png,jpg,jpeg,webp}",
  { eager: true, query: "?url", import: "default" }
);
const KITCHEN_IMGS = import.meta.glob(
  "../assets/KitchenAppImages/*.{png,jpg,jpeg,webp}",
  { eager: true, query: "?url", import: "default" }
);
const WAITER_IMGS = import.meta.glob(
  "../assets/WaiterAppImages/*.{png,jpg,jpeg,webp}",
  { eager: true, query: "?url", import: "default" }
);

function toSortedSlides(globMap) {
  return Object.entries(globMap)
    .sort(([a], [b]) => {
      const na = parseInt(a.match(/(\d+)\.\w+$/)?.[1] ?? "0", 10);
      const nb = parseInt(b.match(/(\d+)\.\w+$/)?.[1] ?? "0", 10);
      return na - nb || a.localeCompare(b);
    })
    .map(([, url]) => url);
}

// --- Product catalog (chat content) -----------------------------------------
const PRODUCTS = {
  suite: {
    id: "suite",
    label: "RestroPro Web",
    chip: "Web App",
    Icon: IconLayoutDashboard,
    intro:
      "RestroPro is the all-in-one web platform — the brain of your restaurant. Here's what it does 👇",
    features: [
      "Cloud POS & fast billing",
      "Menu, inventory & live stock",
      "Reports, analytics & dashboards",
      "Multi-outlet, roles & permissions",
    ],
    slides: toSortedSlides(SUITE_IMGS),
  },
  captain: {
    id: "captain",
    label: "Captain App",
    chip: "Captain",
    Icon: IconDeviceMobile,
    intro:
      "The Captain App lets your team take orders right at the table — no more running back and forth.",
    features: [
      "Tableside order taking",
      "Instant KOT to the kitchen",
      "Live table & floor status",
      "Works smoothly even offline",
    ],
    slides: toSortedSlides(CAPTAIN_IMGS),
  },
  kitchen: {
    id: "kitchen",
    label: "Kitchen App",
    chip: "Kitchen",
    Icon: IconChefHat,
    intro:
      "The Kitchen App is a live display that keeps every order moving and nothing slipping through.",
    features: [
      "Live KOT display (KDS)",
      "Order timing & status",
      "Bump & ready alerts",
      "Station-wise ticket flow",
    ],
    slides: toSortedSlides(KITCHEN_IMGS),
  },
  waiter: {
    id: "waiter",
    label: "Waiter App",
    chip: "Waiter",
    Icon: IconUserCheck,
    intro:
      "The Waiter App puts the whole order flow in your staff's pocket so they serve faster.",
    features: [
      "Quick order & modifiers",
      "Send to kitchen in a tap",
      "Table assignment & status",
      "Bill request & smooth handoff",
    ],
    slides: toSortedSlides(WAITER_IMGS),
  },
};

const SERVICES = [
  {
    Icon: IconRocket,
    title: "Installation Service",
    desc: "We set up the web & apps and publish to the Play Store + App Store for you.",
  },
  {
    Icon: IconAdjustmentsAlt,
    title: "Customization",
    desc: "Any tweak — shaped to exactly how your restaurant runs.",
  },
  {
    Icon: IconWand,
    title: "Custom Solutions",
    desc: "Got an idea? We design & build bespoke software end-to-end.",
  },
];

// quick-reply chips shown under the chat
const CHIPS = [
  { key: "suite", label: "🖥️ Web App" },
  { key: "captain", label: "🧑‍✈️ Captain App" },
  { key: "kitchen", label: "👨‍🍳 Kitchen App" },
  { key: "waiter", label: "🤝 Waiter App" },
  { key: "services", label: "🛠️ Services" },
  { key: "contact", label: "💬 Contact us" },
];

// --- Inline image carousel (inside a chat card) -----------------------------
function ChatCarousel({ slides, label, Icon }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false); // fullscreen lightbox open?
  const count = slides.length;
  useEffect(() => setIdx(0), [slides]);
  useEffect(() => {
    if (count <= 1 || zoom) return; // pause autoplay while zoomed
    const t = setInterval(() => setIdx((i) => (i + 1) % count), 3500);
    return () => clearInterval(t);
  }, [count, zoom]);

  if (count === 0) {
    return (
      <div className="relative w-full aspect-[16/10] rounded-xl bg-restro-gray border border-restro-border-green-light dark:border-restro-border-dark-mode grid place-items-center text-restro-text/40">
        <div className="flex flex-col items-center gap-1.5">
          <Icon size={30} stroke={1.4} />
          <span className="text-[11px] font-medium flex items-center gap-1">
            <IconPhoto size={12} /> {label} preview soon
          </span>
        </div>
      </div>
    );
  }

  const go = (d) => setIdx((i) => (i + d + count) % count);

  return (
    <div className="group relative w-full rounded-xl overflow-hidden bg-restro-gray border border-restro-border-green-light dark:border-restro-border-dark-mode">
      <button
        type="button"
        onClick={() => setZoom(true)}
        aria-label="View fullscreen"
        className="block w-full cursor-zoom-in"
      >
        <img
          key={idx}
          src={slides[idx]}
          alt={`${label} ${idx + 1}`}
          className="w-full aspect-[16/10] object-cover eco-fade"
        />
      </button>

      {/* expand hint */}
      <span
        onClick={() => setZoom(true)}
        className="absolute top-2 right-2 grid place-items-center h-7 w-7 rounded-full bg-black/45 text-white backdrop-blur-sm cursor-zoom-in opacity-0 group-hover:opacity-100 transition hover:scale-110"
        title="View fullscreen"
      >
        <IconArrowsMaximize size={15} />
      </span>

      {zoom && (
        <Lightbox
          slides={slides}
          start={idx}
          label={label}
          onIndex={setIdx}
          onClose={() => setZoom(false)}
        />
      )}

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-full bg-white/85 dark:bg-black/60 text-restro-text shadow opacity-0 group-hover:opacity-100 transition hover:scale-110 active:scale-90"
          >
            <IconChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-full bg-white/85 dark:bg-black/60 text-restro-text shadow opacity-0 group-hover:opacity-100 transition hover:scale-110 active:scale-90"
          >
            <IconChevronRight size={16} />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-4 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Fullscreen image lightbox (portal) -------------------------------------
function Lightbox({ slides, start, label, onIndex, onClose }) {
  const [i, setI] = useState(start);
  const count = slides.length;
  const go = (d) => setI((p) => (p + d + count) % count);

  // sync back to the carousel + lock body scroll + key nav
  useEffect(() => {
    onIndex?.(i);
  }, [i]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [count]);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-black/90 backdrop-blur-sm eco-fade"
      onClick={onClose}
    >
      {/* top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 text-white/90">
        <span className="text-[13px] font-semibold">
          {label} · {i + 1} / {count}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-10 w-10 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 transition"
        >
          <IconX size={22} />
        </button>
      </div>

      {/* image */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center px-4 sm:px-16 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          key={i}
          src={slides[i]}
          alt={`${label} ${i + 1}`}
          className="max-w-full max-h-full object-contain rounded-xl shadow-2xl eco-fade select-none"
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous"
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 h-12 w-12 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition hover:scale-105 active:scale-95"
            >
              <IconChevronLeft size={26} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next"
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 h-12 w-12 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition hover:scale-105 active:scale-95"
            >
              <IconChevronRight size={26} />
            </button>
          </>
        )}
      </div>

      {/* thumbnails */}
      {count > 1 && (
        <div
          className="flex gap-2 justify-center px-4 pb-5 overflow-x-auto no-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          {slides.map((s, k) => (
            <button
              key={k}
              type="button"
              onClick={() => setI(k)}
              className={`shrink-0 h-12 sm:h-14 aspect-[16/9] rounded-lg overflow-hidden border-2 transition ${
                k === i ? "border-restro-green opacity-100" : "border-transparent opacity-50 hover:opacity-90"
              }`}
            >
              <img src={s} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

// --- A single bot message bubble --------------------------------------------
function Bubble({ children, className = "" }) {
  return (
    <div
      className={`eco-slide-up max-w-[88%] rounded-2xl rounded-tl-md bg-white dark:bg-[#1f1f1f] ring-1 ring-black/[0.05] dark:ring-white/[0.07] shadow-sm px-3.5 py-3 ${className}`}
    >
      {children}
    </div>
  );
}

function FeatureList({ items }) {
  return (
    <ul className="mt-2.5 space-y-1.5">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2 text-[13px] text-restro-text">
          <span className="mt-0.5 shrink-0 grid place-items-center h-4 w-4 rounded-full bg-restro-green-10 text-restro-green">
            <IconCheck size={10} stroke={3.5} />
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
}

// --- Main widget ------------------------------------------------------------
export default function EcosystemWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {type, ...}
  const [typing, setTyping] = useState(false);
  const [teaserIdx, setTeaserIdx] = useState(0);
  const [teaserOn, setTeaserOn] = useState(false);
  const [teaserDismissed, setTeaserDismissed] = useState(false);

  const scrollRef = useRef(null);
  const chipsRef = useRef(null);
  const timers = useRef([]);

  // chip strip edge-fade affordance (show arrows/fades when more chips exist)
  const [chipEdges, setChipEdges] = useState({ left: false, right: false });
  const updateChipEdges = () => {
    const el = chipsRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setChipEdges((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right }
    );
  };
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(updateChipEdges, 60);
    window.addEventListener("resize", updateChipEdges);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", updateChipEdges);
    };
  }, [open]);
  const nudgeChips = (dir) => {
    const el = chipsRef.current;
    if (el) el.scrollBy({ left: dir * 160, behavior: "smooth" });
  };

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // push a bot message after a short "typing" delay
  const botSay = (msg, delay = 650) => {
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, msg]);
    }, delay);
    timers.current.push(t);
  };

  // auto-scroll to bottom on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  // greeting when chat first opens
  useEffect(() => {
    if (!open || messages.length > 0) return;
    botSay({ type: "text", text: "Hey there 👋 Welcome to RestroPro!" }, 500);
    botSay(
      {
        type: "text",
        text:
          "We're not just one app — we're a full restaurant suite: a web platform plus Captain, Kitchen & Waiter apps that work together.",
      },
      1500
    );
    botSay(
      { type: "text", text: "What would you like to see first?" },
      2700
    );
    return clearTimers;
  }, [open]);

  // teaser cycling
  useEffect(() => {
    if (open || teaserDismissed) {
      setTeaserOn(false);
      return;
    }
    let hideT;
    const showT = setTimeout(
      () => {
        setTeaserOn(true);
        hideT = setTimeout(() => {
          setTeaserOn(false);
          setTeaserIdx((i) => (i + 1) % TEASERS.length);
        }, TEASER_SHOW_MS);
      },
      teaserIdx === 0 ? TEASER_FIRST_DELAY_MS : TEASER_GAP_MS
    );
    return () => {
      clearTimeout(showT);
      clearTimeout(hideT);
    };
  }, [open, teaserDismissed, teaserIdx]);

  // lock scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const openWidget = () => {
    setOpen(true);
    setTeaserOn(false);
    setTeaserDismissed(true);
  };

  const waMsg = encodeURIComponent(
    "Hi UIFlow! I'm interested in the RestroPro SaaS ecosystem. Please share details."
  );

  // handle a quick-reply chip — echo a user bubble, then bot responds
  const handleChip = (key) => {
    const chip = CHIPS.find((c) => c.key === key);
    setMessages((m) => [...m, { type: "user", text: chip.label }]);

    if (key === "services") {
      botSay({ type: "text", text: "Beyond the apps, we also handle the heavy lifting 👇" });
      botSay({ type: "services" }, 1200);
      botSay({ type: "text", text: "Want any of these? Just reach out below 👇" }, 1900);
      botSay({ type: "contact" }, 2500);
      return;
    }
    if (key === "contact") {
      botSay({ type: "text", text: "Let's talk! Pick whatever's easiest — our team replies fast 🙌" });
      botSay({ type: "contact" }, 1100);
      return;
    }
    // a product
    const p = PRODUCTS[key];
    botSay({ type: "text", text: p.intro });
    botSay({ type: "product", productKey: key }, 1300);
  };

  return (
    <>
      {/* Launcher + teaser */}
      <div
        className={`fixed z-[60] bottom-6 right-6 flex items-end gap-3 transition-all duration-300 ${
          open ? "opacity-0 pointer-events-none scale-90" : "opacity-100"
        }`}
      >
        {teaserOn && !open && (
          <button
            type="button"
            onClick={openWidget}
            className="eco-bubble-in mb-1 max-w-[230px] text-left relative rounded-2xl rounded-br-md
                       bg-white dark:bg-[#1f1f1f] text-restro-text px-4 py-2.5
                       shadow-[0_8px_30px_-8px_rgba(16,24,40,0.25)]
                       ring-1 ring-black/[0.05] dark:ring-white/[0.08] hover:-translate-y-0.5 transition-transform"
          >
            <span className="block text-[13.5px] font-medium leading-snug">
              {TEASERS[teaserIdx]}
            </span>
            <span className="absolute -bottom-1 right-3 h-3 w-3 rotate-45 rounded-[3px] bg-white dark:bg-[#1f1f1f] ring-1 ring-black/[0.05] dark:ring-white/[0.08]" />
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                setTeaserOn(false);
                setTeaserDismissed(true);
              }}
              className="absolute -top-2 -left-2 grid place-items-center h-5 w-5 rounded-full bg-restro-text/70 text-white shadow hover:bg-restro-text transition"
              aria-label="Dismiss"
            >
              <IconX size={11} stroke={2.5} />
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={openWidget}
          aria-label="Chat about the RestroPro suite"
          className="group relative grid place-items-center h-14 w-14 rounded-full
                     bg-restro-green text-white shadow-[0_10px_30px_-6px_rgba(0,0,0,0.35)]
                     eco-launch-in eco-bob transition-all duration-300 ease-out hover:scale-105 active:scale-95"
        >
          <span className="pointer-events-none absolute inset-0 rounded-full bg-restro-green/40 eco-pulse-ring" />
          {/* unread count badge */}
          <span className="absolute -top-1 -right-1 grid place-items-center min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold leading-none ring-2 ring-white dark:ring-[#161616]">
            1
          </span>
          <IconMessageCircle
            size={26}
            stroke={2}
            className="relative transition-transform duration-300 ease-out group-hover:scale-110"
          />
        </button>
      </div>

      {/* Chat panel */}
      {open && (
        <>
          {/* mobile backdrop */}
          <div
            className="fixed inset-0 z-[65] bg-black/30 sm:bg-transparent sm:pointer-events-none eco-fade"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[70] inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-6 sm:right-6
                       w-full sm:w-[420px] h-[88vh] sm:h-[640px] sm:max-h-[85vh]
                       flex flex-col bg-restro-green-light dark:bg-[#121212]
                       sm:rounded-3xl rounded-t-3xl overflow-hidden eco-float-in
                       shadow-[0_24px_70px_-15px_rgba(0,0,0,0.5)] ring-1 ring-black/10 dark:ring-white/10"
          >
            {/* Header — calm light green */}
            <div className="relative px-4 py-3.5 bg-[#EAF3E7] dark:bg-[#1a221a] border-b border-restro-green/15">
              <div className="flex items-center gap-3">
                <span className="relative grid place-items-center h-10 w-10 rounded-full bg-white dark:bg-[#243024] ring-1 ring-restro-green/20 text-restro-green shadow-sm">
                  <IconSparkles size={20} />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[#EAF3E7] dark:ring-[#1a221a]" />
                </span>
                <div className="leading-tight">
                  <div className="text-[15px] font-bold tracking-tight text-restro-green-dark dark:text-restro-text">
                    RestroPro Assistant
                  </div>
                  <div className="text-[11px] text-restro-text/60 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Online · replies in minutes
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                  className="ml-auto h-8 w-8 grid place-items-center rounded-full text-restro-text/70 hover:bg-black/5 dark:hover:bg-white/10 transition"
                >
                  <IconX size={18} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3.5 py-4 space-y-3"
            >
              {messages.map((m, i) =>
                m.type === "user" ? (
                  <div key={i} className="flex justify-end eco-slide-up">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-restro-green text-white px-3.5 py-2 text-[13px] font-medium shadow-sm">
                      {m.text}
                    </div>
                  </div>
                ) : m.type === "text" ? (
                  <div key={i} className="flex items-end gap-2">
                    <BotAvatar />
                    <Bubble>
                      <p className="text-[13.5px] leading-relaxed text-restro-text">
                        {m.text}
                      </p>
                    </Bubble>
                  </div>
                ) : m.type === "product" ? (
                  <div key={i} className="flex items-end gap-2">
                    <BotAvatar />
                    <Bubble className="w-[88%]">
                      <ProductCard p={PRODUCTS[m.productKey]} />
                    </Bubble>
                  </div>
                ) : m.type === "services" ? (
                  <div key={i} className="flex items-end gap-2">
                    <BotAvatar />
                    <Bubble className="w-[88%]">
                      <div className="space-y-2">
                        {SERVICES.map((s) => (
                          <div key={s.title} className="flex items-start gap-2.5">
                            <span className="shrink-0 grid place-items-center h-8 w-8 rounded-xl bg-restro-green-10 text-restro-green">
                              <s.Icon size={17} stroke={1.8} />
                            </span>
                            <div>
                              <div className="text-[13px] font-semibold text-restro-text">
                                {s.title}
                              </div>
                              <p className="text-[12px] leading-snug text-restro-text/60">
                                {s.desc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Bubble>
                  </div>
                ) : m.type === "contact" ? (
                  <div key={i} className="flex items-end gap-2">
                    <BotAvatar />
                    <Bubble className="w-[88%]">
                      <ContactRow waMsg={waMsg} />
                      <p className="mt-2.5 text-[11px] text-restro-text/50">
                        +91 {WHATSAPP} · {EMAIL} · {WEBSITE}
                      </p>
                    </Bubble>
                  </div>
                ) : null
              )}

              {typing && (
                <div className="flex items-end gap-2">
                  <BotAvatar />
                  <div className="rounded-2xl rounded-tl-md bg-white dark:bg-[#1f1f1f] ring-1 ring-black/[0.05] dark:ring-white/[0.07] shadow-sm px-3.5 py-3">
                    <div className="flex gap-1">
                      <span className="eco-typing h-1.5 w-1.5 rounded-full bg-restro-text/50" style={{ animationDelay: "0ms" }} />
                      <span className="eco-typing h-1.5 w-1.5 rounded-full bg-restro-text/50" style={{ animationDelay: "150ms" }} />
                      <span className="eco-typing h-1.5 w-1.5 rounded-full bg-restro-text/50" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick replies */}
            <div className="px-3 pt-2.5 pb-3 border-t border-black/5 dark:border-white/10 bg-[#EAF3E7]/70 dark:bg-[#121212]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-restro-text/40 px-1 mb-1.5">
                Explore
              </div>
              <div className="relative">
                {/* left fade + arrow */}
                <div
                  className={`pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r from-[#EAF3E7] dark:from-[#121212] to-transparent transition-opacity ${
                    chipEdges.left ? "opacity-100" : "opacity-0"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => nudgeChips(-1)}
                  aria-label="Scroll left"
                  className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 grid place-items-center h-7 w-7 rounded-full bg-white dark:bg-[#1f1f1f] text-restro-text ring-1 ring-black/5 dark:ring-white/10 shadow-sm transition ${
                    chipEdges.left ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                >
                  <IconChevronLeft size={15} />
                </button>

                <div
                  ref={chipsRef}
                  onScroll={updateChipEdges}
                  className="flex gap-2 overflow-x-auto no-scrollbar scroll-px-2 px-1 py-1"
                >
                  {CHIPS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => handleChip(c.key)}
                      disabled={typing}
                      className="shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold
                                 bg-white dark:bg-[#1f1f1f] text-restro-text
                                 ring-1 ring-restro-green/30 hover:bg-restro-green hover:text-white
                                 disabled:opacity-50 transition"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* right fade + arrow */}
                <div
                  className={`pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-[#EAF3E7] dark:from-[#121212] to-transparent transition-opacity ${
                    chipEdges.right ? "opacity-100" : "opacity-0"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => nudgeChips(1)}
                  aria-label="Scroll right"
                  className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 grid place-items-center h-7 w-7 rounded-full bg-white dark:bg-[#1f1f1f] text-restro-text ring-1 ring-black/5 dark:ring-white/10 shadow-sm transition ${
                    chipEdges.right ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                >
                  <IconChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function BotAvatar() {
  return (
    <span className="shrink-0 grid place-items-center h-7 w-7 rounded-full bg-restro-green text-white mb-0.5">
      <IconSparkles size={14} />
    </span>
  );
}

function ProductCard({ p }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="grid place-items-center h-8 w-8 rounded-xl bg-restro-green text-white">
          <p.Icon size={17} stroke={1.8} />
        </span>
        <div className="text-[14px] font-bold tracking-tight text-restro-text">
          {p.label}
        </div>
      </div>
      <ChatCarousel slides={p.slides} label={p.label} Icon={p.Icon} />
      <FeatureList items={p.features} />
    </div>
  );
}

function ContactRow({ waMsg }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <a
        href={`https://wa.me/91${WHATSAPP}?text=${waMsg}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-1 rounded-xl py-2.5 text-white bg-restro-green hover:bg-restro-green-button-hover transition hover:scale-[1.03] active:scale-95"
      >
        <IconBrandWhatsapp size={18} />
        <span className="text-[10px] font-bold">WhatsApp</span>
      </a>
      <a
        href={`mailto:${EMAIL}`}
        className="flex flex-col items-center gap-1 rounded-xl py-2.5 text-restro-text bg-restro-gray hover:bg-restro-button-hover transition hover:scale-[1.03] active:scale-95"
      >
        <IconMail size={18} />
        <span className="text-[10px] font-bold">Email</span>
      </a>
      <a
        href={`https://${WEBSITE}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-1 rounded-xl py-2.5 text-restro-text bg-restro-gray hover:bg-restro-button-hover transition hover:scale-[1.03] active:scale-95"
      >
        <IconWorld size={18} />
        <span className="text-[10px] font-bold">Website</span>
      </a>
    </div>
  );
}
