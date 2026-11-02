import React from "react";

export const FlagUS = ({ className = "w-9 h-6.5" }) => (
  <svg
    className={`rounded shadow-sm shrink-0 object-cover ${className}`}
    viewBox="0 0 640 480"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="640" height="480" fill="#bd3d44" />
    <path
      stroke="#ffffff"
      strokeWidth="37"
      d="M0 55.4h640M0 129.2h640M0 203h640M0 277h640M0 350.8h640M0 424.6h640"
    />
    <rect width="256" height="258.5" fill="#192f5d" />
    <g fill="#ffffff">
      <circle cx="35" cy="30" r="7" />
      <circle cx="75" cy="30" r="7" />
      <circle cx="115" cy="30" r="7" />
      <circle cx="155" cy="30" r="7" />
      <circle cx="195" cy="30" r="7" />
      <circle cx="55" cy="62" r="7" />
      <circle cx="95" cy="62" r="7" />
      <circle cx="135" cy="62" r="7" />
      <circle cx="175" cy="62" r="7" />
      <circle cx="215" cy="62" r="7" />
      <circle cx="35" cy="94" r="7" />
      <circle cx="75" cy="94" r="7" />
      <circle cx="115" cy="94" r="7" />
      <circle cx="155" cy="94" r="7" />
      <circle cx="195" cy="94" r="7" />
      <circle cx="55" cy="126" r="7" />
      <circle cx="95" cy="126" r="7" />
      <circle cx="135" cy="126" r="7" />
      <circle cx="175" cy="126" r="7" />
      <circle cx="215" cy="126" r="7" />
      <circle cx="35" cy="158" r="7" />
      <circle cx="75" cy="158" r="7" />
      <circle cx="115" cy="158" r="7" />
      <circle cx="155" cy="158" r="7" />
      <circle cx="195" cy="158" r="7" />
      <circle cx="55" cy="190" r="7" />
      <circle cx="95" cy="190" r="7" />
      <circle cx="135" cy="190" r="7" />
      <circle cx="175" cy="190" r="7" />
      <circle cx="215" cy="190" r="7" />
      <circle cx="35" cy="222" r="7" />
      <circle cx="75" cy="222" r="7" />
      <circle cx="115" cy="222" r="7" />
      <circle cx="155" cy="222" r="7" />
      <circle cx="195" cy="222" r="7" />
    </g>
  </svg>
);

export const FlagKH = ({ className = "w-9 h-6.5" }) => (
  <svg
    className={`rounded shadow-sm shrink-0 object-cover ${className}`}
    viewBox="0 0 640 480"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="640" height="480" fill="#032ea1" />
    <rect y="120" width="640" height="240" fill="#e00025" />
    <g fill="#ffffff">
      {/* Angkor Wat Base */}
      <rect x="180" y="300" width="280" height="18" rx="2" />
      <rect x="200" y="278" width="240" height="22" rx="2" />
      <rect x="220" y="258" width="200" height="20" rx="2" />
      {/* Central Tower */}
      <path d="M320 160 L305 210 L308 258 L332 258 L335 210 Z" />
      <path d="M320 148 L315 162 L325 162 Z" />
      {/* Left Tower */}
      <path d="M260 190 L248 230 L250 258 L270 258 L272 230 Z" />
      <path d="M260 180 L255 192 L265 192 Z" />
      {/* Right Tower */}
      <path d="M380 190 L368 230 L370 258 L390 258 L392 230 Z" />
      <path d="M380 180 L375 192 L385 192 Z" />
      {/* Outer Turrets */}
      <rect x="225" y="240" width="12" height="18" rx="1" />
      <path d="M231 232 L227 240 L235 240 Z" />
      <rect x="403" y="240" width="12" height="18" rx="1" />
      <path d="M409 232 L405 240 L413 240 Z" />
    </g>
  </svg>
);

export const LANGUAGES = [
  {
    code: "en",
    title: "English",
    nativeTitle: "English (US)",
    countryCode: "US",
    description: "Standard English for POS and back-office operations",
    Flag: FlagUS,
  },
  {
    code: "km",
    title: "Khmer (ភាសាខ្មែរ)",
    nativeTitle: "ភាសាខ្មែរ",
    countryCode: "KH",
    description: "ភាសាខ្មែរពេញលេញសម្រាប់ប្រព័ន្ធលក់ និងការគ្រប់គ្រងទូទៅ",
    Flag: FlagKH,
  },
];
