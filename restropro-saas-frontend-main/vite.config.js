import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Curated mapping from Tabler Icon names to Solar Duotone icon candidates (in priority order)
const SOLAR_ICON_CANDIDATES = {
  IconActivityHeartbeat: ["health-bold-duotone", "heart-pulse-bold-duotone", "pulse-2-bold-duotone"],
  IconAdjustments: ["tuning-2-bold-duotone", "Slider-vertical-bold-duotone", "settings-bold-duotone"],
  IconAdjustmentsAlt: ["tuning-bold-duotone", "tuning-2-bold-duotone"],
  IconAdjustmentsHorizontal: ["tuning-square-2-bold-duotone", "tuning-2-bold-duotone"],
  IconAlertCircle: ["danger-circle-bold-duotone", "info-circle-bold-duotone"],
  IconAlertTriangle: ["danger-triangle-bold-duotone", "danger-bold-duotone"],
  IconAlertTriangleFilled: ["danger-triangle-bold-duotone", "danger-bold-duotone"],
  IconArchive: ["archive-bold-duotone", "box-bold-duotone"],
  IconArmchair: ["armchair-2-bold-duotone", "armchair-bold-duotone", "sofa-bold-duotone"],
  IconArmchair2: ["armchair-bold-duotone", "armchair-2-bold-duotone", "sofa-2-bold-duotone"],
  IconArrowBarToLeft: ["sidebar-minimalistic-bold-duotone", "alt-arrow-left-bold-duotone", "double-alt-arrow-left-bold-duotone"],
  IconArrowBarToRight: ["sidebar-minimalistic-bold-duotone", "alt-arrow-right-bold-duotone", "double-alt-arrow-right-bold-duotone"],
  IconArrowDownLeft: ["arrow-left-down-bold-duotone", "round-arrow-left-down-bold-duotone"],
  IconArrowLeft: ["arrow-left-bold-duotone", "round-arrow-left-bold-duotone"],
  IconArrowRight: ["arrow-right-bold-duotone", "round-arrow-right-bold-duotone"],
  IconArrowUpRight: ["arrow-right-up-bold-duotone", "round-arrow-right-up-bold-duotone"],
  IconArrowsMaximize: ["maximize-square-bold-duotone", "full-screen-bold-duotone"],
  IconArrowsMinimize: ["minimize-square-bold-duotone", "quit-full-screen-bold-duotone"],
  IconArrowsRandom: ["shuffle-bold-duotone", "transfer-horizontal-bold-duotone"],
  IconBan: ["forbidden-circle-bold-duotone", "close-circle-bold-duotone"],
  IconBell: ["bell-bold-duotone", "bell-bing-bold-duotone"],
  IconBellRinging: ["bell-bing-bold-duotone", "bell-bold-duotone"],
  IconBolt: ["bolt-bold-duotone", "bolt-circle-bold-duotone", "flash-bold-duotone"],
  IconBook: ["book-2-bold-duotone", "book-bookmark-bold-duotone"],
  IconBookmark: ["bookmark-bold-duotone", "bookmark-square-bold-duotone"],
  IconBox: ["box-bold-duotone", "box-minimalistic-bold-duotone"],
  IconBoxSeam: ["box-bold-duotone", "delivery-bold-duotone"],
  IconBrandPaypal: ["card-send-bold-duotone", "wallet-money-bold-duotone", "card-bold-duotone"],
  IconBrandWhatsapp: ["chat-round-dots-bold-duotone", "phone-calling-rounded-bold-duotone"],
  IconBuilding: ["buildings-2-bold-duotone", "buildings-bold-duotone"],
  IconBuildingBank: ["bank-bold-duotone", "buildings-3-bold-duotone", "safe-square-bold-duotone"],
  IconBuildingStore: ["shop-2-bold-duotone", "shop-bold-duotone"],
  IconBuildingWarehouse: ["buildings-3-bold-duotone", "box-bold-duotone", "garage-bold-duotone"],
  IconCake: ["cake-bold-duotone", "cup-hot-bold-duotone"],
  IconCalendar: ["calendar-bold-duotone", "calendar-date-bold-duotone"],
  IconCalendarEvent: ["calendar-mark-bold-duotone", "calendar-date-bold-duotone", "calendar-bold-duotone"],
  IconCalendarPlus: ["calendar-add-bold-duotone", "calendar-bold-duotone"],
  IconCalendarStats: ["calendar-search-bold-duotone", "calendar-mark-bold-duotone"],
  IconCalendarTime: ["calendar-date-bold-duotone", "clock-circle-bold-duotone"],
  IconCalendarX: ["calendar-minimalistic-bold-duotone", "close-square-bold-duotone"],
  IconCarrot: ["leaf-bold-duotone", "cup-hot-bold-duotone", "chef-hat-bold-duotone"],
  IconCash: ["wad-of-money-bold-duotone", "banknote-2-bold-duotone", "wallet-money-bold-duotone"],
  IconCashRegister: ["calculator-bold-duotone", "wad-of-money-bold-duotone", "card-2-bold-duotone"],
  IconCategory: ["widget-2-bold-duotone", "widget-bold-duotone"],
  IconCategory2: ["widget-4-bold-duotone", "widget-2-bold-duotone"],
  IconChartArea: ["graph-new-up-bold-duotone", "chart-2-bold-duotone", "graph-up-bold-duotone"],
  IconChartBar: ["chart-bold-duotone", "chart-square-bold-duotone"],
  IconChartDots: ["graph-bold-duotone", "chart-2-bold-duotone"],
  IconChartLine: ["graph-up-bold-duotone", "presentation-graph-bold-duotone", "chart-2-bold-duotone"],
  IconChartPie: ["pie-chart-2-bold-duotone", "pie-chart-bold-duotone"],
  IconCheck: ["check-read-bold-duotone", "check-circle-bold-duotone", "unread-bold-duotone"],
  IconChecks: ["check-read-bold-duotone", "check-square-bold-duotone"],
  IconChefHat: ["chef-hat-bold-duotone", "chef-hat-heart-bold-duotone"],
  IconChevronDown: ["alt-arrow-down-bold-duotone", "round-alt-arrow-down-bold-duotone"],
  IconChevronLeft: ["alt-arrow-left-bold-duotone", "round-alt-arrow-left-bold-duotone"],
  IconChevronRight: ["alt-arrow-right-bold-duotone", "round-alt-arrow-right-bold-duotone"],
  IconChevronUp: ["alt-arrow-up-bold-duotone", "round-alt-arrow-up-bold-duotone"],
  IconChevronsLeft: ["double-alt-arrow-left-bold-duotone", "alt-arrow-left-bold-duotone"],
  IconChevronsRight: ["double-alt-arrow-right-bold-duotone", "alt-arrow-right-bold-duotone"],
  IconCircleArrowDownLeft: ["round-arrow-left-down-bold-duotone", "arrow-left-down-bold-duotone"],
  IconCircleArrowUpRight: ["round-arrow-right-up-bold-duotone", "arrow-right-up-bold-duotone"],
  IconCircleCheck: ["check-circle-bold-duotone"],
  IconCircleCheckFilled: ["check-circle-bold-duotone"],
  IconCircleMinus: ["minus-circle-bold-duotone"],
  IconCircleXFilled: ["close-circle-bold-duotone"],
  IconClearAll: ["broom-bold-duotone", "eraser-bold-duotone", "trash-bin-minimalistic-bold-duotone"],
  IconClipboardList: ["clipboard-list-bold-duotone", "clipboard-text-bold-duotone"],
  IconClock: ["clock-circle-bold-duotone", "watch-round-bold-duotone"],
  IconClockHour4: ["clock-circle-bold-duotone", "history-bold-duotone"],
  IconCloudDown: ["cloud-download-bold-duotone"],
  IconCloudUpload: ["cloud-upload-bold-duotone"],
  IconCommand: ["command-bold-duotone", "keyboard-bold-duotone"],
  IconCopy: ["copy-bold-duotone", "layers-minimalistic-bold-duotone"],
  IconCopyMinus: ["minus-square-bold-duotone", "copy-bold-duotone"],
  IconCreditCard: ["card-bold-duotone", "card-2-bold-duotone"],
  IconCsv: ["file-text-bold-duotone", "document-text-bold-duotone"],
  IconCurrencyDollar: ["dollar-minimalistic-bold-duotone", "dollar-bold-duotone"],
  IconDashboard: ["widget-5-bold-duotone", "home-smile-bold-duotone", "widget-bold-duotone"],
  IconDatabaseDollar: ["safe-square-bold-duotone", "dollar-minimalistic-bold-duotone"],
  IconDeviceFloppy: ["diskette-bold-duotone", "bookmark-square-bold-duotone"],
  IconDeviceIpad: ["tablet-bold-duotone", "smartphone-2-bold-duotone"],
  IconDeviceIpadHorizontal: ["tablet-bold-duotone", "monitor-smartphone-bold-duotone", "laptop-minimalistic-bold-duotone"],
  IconDeviceMobile: ["smartphone-bold-duotone", "smartphone-2-bold-duotone"],
  IconDeviceTablet: ["tablet-bold-duotone"],
  IconDeviceTv: ["tv-bold-duotone", "monitor-bold-duotone"],
  IconDevices: ["monitor-smartphone-bold-duotone", "devices-bold-duotone", "laptop-bold-duotone"],
  IconDiscount: ["sale-bold-duotone", "tag-price-bold-duotone"],
  IconDiscount2: ["sale-square-bold-duotone", "sale-bold-duotone"],
  IconDoor: ["door-open-bold-duotone", "exit-bold-duotone"],
  IconDotsVertical: ["menu-dots-bold-duotone", "menu-dots-square-bold-duotone"],
  IconDownload: ["download-minimalistic-bold-duotone", "download-square-bold-duotone"],
  IconEdit: ["pen-new-square-bold-duotone", "pen-bold-duotone"],
  IconExternalLink: ["square-top-down-bold-duotone", "link-round-bold-duotone"],
  IconEye: ["eye-bold-duotone"],
  IconEyeOff: ["eye-closed-bold-duotone"],
  IconFileInvoice: ["bill-list-bold-duotone", "bill-check-bold-duotone", "bill-bold-duotone"],
  IconFileSpreadsheet: ["document-text-bold-duotone", "file-text-bold-duotone"],
  IconFileTypeCsv: ["file-download-bold-duotone", "file-text-bold-duotone"],
  IconFilter: ["filter-bold-duotone", "sort-bold-duotone"],
  IconFilterFilled: ["filter-bold-duotone"],
  IconFlame: ["fire-bold-duotone", "flame-bold-duotone"],
  IconFriends: ["users-group-rounded-bold-duotone", "users-group-two-rounded-bold-duotone"],
  IconGenderAgender: ["user-circle-bold-duotone", "user-bold-duotone"],
  IconGlassFull: ["wineglass-bold-duotone", "cup-hot-bold-duotone", "tea-cup-bold-duotone"],
  IconGridDots: ["widget-3-bold-duotone", "widget-bold-duotone", "menu-dots-circle-bold-duotone"],
  IconHash: ["hashtag-bold-duotone", "hashtag-square-bold-duotone"],
  IconHeartHandshake: ["heart-shine-bold-duotone", "hand-heart-bold-duotone", "heart-bold-duotone"],
  IconHelp: ["question-circle-bold-duotone", "help-bold-duotone"],
  IconHelpCircle: ["question-circle-bold-duotone"],
  IconHistory: ["history-bold-duotone", "clock-circle-bold-duotone"],
  IconHome: ["home-smile-bold-duotone", "home-2-bold-duotone", "home-bold-duotone"],
  IconId: ["user-id-bold-duotone", "card-bold-duotone"],
  IconInfoCircle: ["info-circle-bold-duotone"],
  IconInfoCircleFilled: ["info-circle-bold-duotone"],
  IconInfoSquareRounded: ["info-square-bold-duotone", "info-circle-bold-duotone"],
  IconInfoSquareRoundedFilled: ["info-square-bold-duotone", "info-circle-bold-duotone"],
  IconKey: ["key-bold-duotone", "key-minimalistic-square-bold-duotone"],
  IconLanguage: ["global-bold-duotone", "Translation-bold-duotone", "earth-bold-duotone"],
  IconLayersIntersect: ["layers-bold-duotone", "layers-minimalistic-bold-duotone"],
  IconLayout2: ["widget-2-bold-duotone", "widget-bold-duotone"],
  IconLayout2Filled: ["widget-2-bold-duotone"],
  IconLayoutColumns: ["sidebar-code-bold-duotone", "widget-4-bold-duotone"],
  IconLayoutDashboard: ["widget-5-bold-duotone", "widget-2-bold-duotone", "home-2-bold-duotone"],
  IconLayoutGrid: ["widget-bold-duotone", "widget-2-bold-duotone"],
  IconLayoutGridFilled: ["widget-bold-duotone"],
  IconLayoutList: ["list-bold-duotone", "checklist-minimalistic-bold-duotone"],
  IconLayoutRows: ["slider-vertical-bold-duotone", "list-bold-duotone"],
  IconLibraryMinus: ["minus-square-bold-duotone", "folder-error-bold-duotone"],
  IconLifebuoy: ["lifebuoy-bold-duotone", "question-circle-bold-duotone", "headphones-round-bold-duotone"],
  IconListCheck: ["checklist-minimalistic-bold-duotone", "clipboard-check-bold-duotone"],
  IconListDetails: ["clipboard-list-bold-duotone", "list-bold-duotone"],
  IconListTree: ["list-bold-duotone", "structure-bold-duotone"],
  IconLoader2: ["refresh-circle-bold-duotone", "restart-bold-duotone"],
  IconLock: ["lock-keyhole-bold-duotone", "lock-bold-duotone"],
  IconLockOpen: ["lock-keyhole-unlocked-bold-duotone", "lock-unlocked-bold-duotone"],
  IconLogin2: ["login-2-bold-duotone", "login-3-bold-duotone"],
  IconLogout: ["logout-2-bold-duotone", "logout-3-bold-duotone"],
  IconLogs: ["clipboard-list-bold-duotone", "document-text-bold-duotone"],
  IconMail: ["letter-bold-duotone", "mailbox-bold-duotone"],
  IconMan: ["user-rounded-bold-duotone", "user-bold-duotone"],
  IconMapPin: ["map-point-bold-duotone", "map-point-wave-bold-duotone"],
  IconMenu: ["hamburger-menu-bold-duotone"],
  IconMenu2: ["hamburger-menu-bold-duotone"],
  IconMenu4: ["hamburger-menu-bold-duotone"],
  IconMessageCircle: ["chat-round-dots-bold-duotone", "chat-round-line-bold-duotone"],
  IconMinus: ["minus-circle-bold-duotone", "minus-square-bold-duotone"],
  IconMoodEmptyFilled: ["sad-circle-bold-duotone", "emoji-funny-circle-bold-duotone"],
  IconMoon: ["moon-bold-duotone", "moon-stars-bold-duotone"],
  IconNote: ["notes-bold-duotone", "document-add-bold-duotone"],
  IconNotes: ["notes-bold-duotone", "clipboard-text-bold-duotone"],
  IconPackages: ["box-bold-duotone", "delivery-bold-duotone"],
  IconPencil: ["pen-bold-duotone", "pen-new-square-bold-duotone"],
  IconPhone: ["phone-calling-rounded-bold-duotone", "phone-bold-duotone"],
  IconPhoto: ["gallery-bold-duotone", "gallery-wide-bold-duotone"],
  IconPlus: ["add-circle-bold-duotone", "add-square-bold-duotone"],
  IconPremiumRights: ["crown-bold-duotone", "medal-star-bold-duotone"],
  IconPrinter: ["printer-bold-duotone", "printer-minimalistic-bold-duotone"],
  IconQrcode: ["qr-code-bold-duotone", "scanner-bold-duotone"],
  IconQuestionMark: ["question-circle-bold-duotone"],
  IconReceipt: ["bill-list-bold-duotone", "bill-bold-duotone"],
  IconReceipt2: ["bill-check-bold-duotone", "bill-list-bold-duotone"],
  IconReceiptTax: ["bill-list-bold-duotone", "tag-price-bold-duotone", "sale-bold-duotone"],
  IconRefresh: ["refresh-bold-duotone", "restart-bold-duotone"],
  IconReportAnalytics: ["presentation-graph-bold-duotone", "chart-2-bold-duotone", "graph-up-bold-duotone"],
  IconReportMoney: ["wad-of-money-bold-duotone", "dollar-minimalistic-bold-duotone", "chart-square-bold-duotone"],
  IconRocket: ["rocket-2-bold-duotone", "rocket-bold-duotone"],
  IconRotate: ["restart-bold-duotone", "refresh-bold-duotone"],
  IconRotateClockwise2: ["restart-bold-duotone", "refresh-circle-bold-duotone"],
  IconScreenShare: ["screencast-2-bold-duotone", "monitor-smartphone-bold-duotone"],
  IconSearch: ["magnifer-bold-duotone", "minimalistic-magnifer-bold-duotone"],
  IconSend: ["plain-bold-duotone", "Send-square-bold-duotone", "arrow-right-up-bold-duotone"],
  IconSettings: ["settings-bold-duotone", "settings-minimalistic-bold-duotone"],
  IconSettings2: ["settings-bold-duotone", "tuning-2-bold-duotone"],
  IconShare: ["share-bold-duotone", "share-circle-bold-duotone"],
  IconShieldCheck: ["shield-check-bold-duotone", "shield-user-bold-duotone"],
  IconShoppingBag: ["bag-4-bold-duotone", "bag-smile-bold-duotone", "bag-bold-duotone"],
  IconShoppingCart: ["cart-large-2-bold-duotone", "cart-smile-bold-duotone", "cart-3-bold-duotone"],
  IconShoppingCartX: ["cart-cross-bold-duotone", "cart-large-2-bold-duotone"],
  IconShovelPitchforks: ["chef-hat-bold-duotone", "cup-hot-bold-duotone"],
  IconSparkles: ["stars-bold-duotone", "magic-stick-3-bold-duotone"],
  IconStar: ["star-bold-duotone", "star-shine-bold-duotone"],
  IconStarFilled: ["star-bold-duotone", "star-shine-bold-duotone"],
  IconStarHalfFilled: ["star-bold-duotone"],
  IconStars: ["stars-bold-duotone", "medal-star-bold-duotone"],
  IconSun: ["sun-2-bold-duotone", "sun-bold-duotone"],
  IconTable: ["widget-4-bold-duotone", "armchair-2-bold-duotone"],
  IconTableDown: ["download-square-bold-duotone", "file-download-bold-duotone"],
  IconTableImport: ["import-bold-duotone", "upload-square-bold-duotone"],
  IconTags: ["tag-bold-duotone", "tag-price-bold-duotone"],
  IconTarget: ["target-bold-duotone", "gps-bold-duotone"],
  IconTicket: ["ticket-bold-duotone", "ticket-sale-bold-duotone"],
  IconToolsKitchen2: ["chef-hat-heart-bold-duotone", "chef-hat-bold-duotone", "cup-hot-bold-duotone"],
  IconToolsKitchen3: ["donut-bitten-bold-duotone", "cup-hot-bold-duotone", "chef-hat-bold-duotone"],
  IconTrash: ["trash-bin-trash-bold-duotone", "trash-bin-minimalistic-bold-duotone"],
  IconTrendingDown: ["graph-down-new-bold-duotone", "graph-down-bold-duotone", "course-down-bold-duotone"],
  IconTrendingUp: ["graph-new-up-bold-duotone", "graph-up-bold-duotone", "course-up-bold-duotone"],
  IconTruck: ["delivery-bold-duotone", "bus-bold-duotone"],
  IconTruckDelivery: ["delivery-bold-duotone", "scooter-bold-duotone", "box-bold-duotone"],
  IconUpload: ["upload-minimalistic-bold-duotone", "upload-square-bold-duotone"],
  IconUser: ["user-rounded-bold-duotone", "user-circle-bold-duotone", "user-bold-duotone"],
  IconUserCheck: ["user-check-rounded-bold-duotone", "user-check-bold-duotone"],
  IconUserEdit: ["user-pen-bold-duotone", "user-rounded-bold-duotone"],
  IconUserPlus: ["user-plus-rounded-bold-duotone", "user-plus-bold-duotone"],
  IconUsers: ["users-group-rounded-bold-duotone", "users-group-two-rounded-bold-duotone"],
  IconUsersGroup: ["users-group-two-rounded-bold-duotone", "users-group-rounded-bold-duotone"],
  IconVolume: ["volume-loud-bold-duotone", "volume-small-bold-duotone"],
  IconVolumeOff: ["volume-cross-bold-duotone", "muted-bold-duotone"],
  IconWallet: ["wallet-money-bold-duotone", "wallet-bold-duotone"],
  IconWand: ["magic-stick-3-bold-duotone", "stars-bold-duotone"],
  IconWoman: ["user-rounded-bold-duotone", "user-bold-duotone"],
  IconWorld: ["global-bold-duotone", "earth-bold-duotone"],
  IconX: ["close-circle-bold-duotone", "close-square-bold-duotone"],
};

function scanAllIconNames(srcDir) {
  const found = new Set(Object.keys(SOLAR_ICON_CANDIDATES));
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
        const content = fs.readFileSync(full, "utf8");
        const matches = content.match(/\bIcon[A-Z][A-Za-z0-9]*\b/g);
        if (matches) {
          matches.forEach((m) => found.add(m));
        }
      }
    }
  }
  walk(srcDir);
  return Array.from(found);
}

function resolveSolarIconBody(iconName, solarIcons) {
  const candidates = SOLAR_ICON_CANDIDATES[iconName] || [];
  for (const cand of candidates) {
    const lower = cand.toLowerCase();
    if (solarIcons[lower]) return solarIcons[lower].body;
  }

  // Fallback automatic kebab-case lookup in solarIcons
  const baseKebab = iconName
    .replace(/^Icon/, "")
    .replace(/Filled$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();

  const autoCandidates = [
    `${baseKebab}-bold-duotone`,
    `${baseKebab}-line-duotone`,
    `${baseKebab}-2-bold-duotone`,
    `${baseKebab}-rounded-bold-duotone`,
    `${baseKebab}-circle-bold-duotone`,
    `${baseKebab}-square-bold-duotone`,
    `${baseKebab}-minimalistic-bold-duotone`,
  ];

  for (const cand of autoCandidates) {
    if (solarIcons[cand]) return solarIcons[cand].body;
  }

  // Keyword match against solar bold-duotone keys
  const firstWord = baseKebab.split("-")[0];
  const allKeys = Object.keys(solarIcons);
  const keywordMatch = allKeys.find(
    (k) => k.endsWith("-bold-duotone") && k.startsWith(firstWord)
  );
  if (keywordMatch) {
    return solarIcons[keywordMatch].body;
  }

  return (
    solarIcons["widget-bold-duotone"]?.body ||
    solarIcons["star-bold-duotone"]?.body ||
    '<circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.5"/><circle cx="12" cy="12" r="4" fill="currentColor"/>'
  );
}

function solarDuotoneTablerPlugin() {
  const virtualModuleId = "\0virtual:solar-duotone-icons";

  return {
    name: "vite-plugin-solar-duotone-icons",
    enforce: "pre",
    resolveId(source) {
      if (source === "@tabler/icons-react") {
        return virtualModuleId;
      }
      return null;
    },
    load(id) {
      if (id !== virtualModuleId) return null;

      const solarJson = require("@iconify-json/solar/icons.json");
      const solarIcons = solarJson.icons || {};
      const srcDir = path.resolve(process.cwd(), "src");
      const allIconNames = scanAllIconNames(srcDir);

      const iconDictionary = {};
      for (const name of allIconNames) {
        iconDictionary[name] = resolveSolarIconBody(name, solarIcons);
      }

      const exportsCode = allIconNames
        .map(
          (name) =>
            `export const ${name} = createSolarIcon(${JSON.stringify(
              iconDictionary[name]
            )}, ${JSON.stringify(name)});`
        )
        .join("\n");

      return `
import React from "react";

function scaleSolarDimension(val) {
  if (val === undefined || val === null) return 28;
  const num = Number(val);
  if (isNaN(num) || num <= 0) return val;
  if (num <= 14) return 18;
  if (num <= 16) return 20;
  if (num <= 18) return 22;
  if (num <= 20) return 24;
  if (num <= 24) return 28;
  return Math.round(num * 1.2);
}

function createSolarIcon(svgBody, displayName) {
  const IconComponent = React.forwardRef(function SolarIcon(
    { size = 24, width, height, className = "", style, color, stroke, strokeWidth, ...rest },
    ref
  ) {
    const baseDim = width || height || size;
    const finalW = width ? scaleSolarDimension(width) : scaleSolarDimension(baseDim);
    const finalH = height ? scaleSolarDimension(height) : scaleSolarDimension(baseDim);
    return React.createElement("svg", {
      ref,
      xmlns: "http://www.w3.org/2000/svg",
      width: finalW,
      height: finalH,
      viewBox: "0 0 24 24",
      fill: "none",
      color: color,
      className: ("solar-duotone-icon shrink-0 " + className).trim(),
      style,
      ...rest,
      dangerouslySetInnerHTML: { __html: svgBody },
    });
  });
  IconComponent.displayName = displayName;
  return IconComponent;
}

${exportsCode}
`;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
      },
      "/public": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    solarDuotoneTablerPlugin(),
    react(),
    VitePWA({
      registerType: "autoUpdate",

      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
      },

      manifest: {
        name: "RestroPro",
        short_name: "RestroPro",
        description: "Manage Your Restaurant, Cafe, Hotel, Bar, Food Truck, Stall, any food store.",
        theme_color: "#ECF1EB",
        icons: [
          {
            src: "/logo_192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/logo.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});
