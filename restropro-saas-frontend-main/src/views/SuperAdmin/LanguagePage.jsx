import React, { useEffect } from "react";
import Page from "../../components/Page";
import { useTranslation } from "react-i18next";
import { getLanguage, setLanguage } from "../../helpers/LocalizationHelper";
import { LANGUAGES } from "../../config/languages";
import { IconLanguage, IconCheck, IconInfoCircle, IconSparkles } from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import toast from "react-hot-toast";

export default function LanguagePage() {
  const { t, i18n } = useTranslation();

  const currentLang = i18n.language || getLanguage() || "en";

  useEffect(() => {
    document.documentElement.setAttribute("dir", i18n.dir(currentLang));
  }, [currentLang, i18n]);

  const handleSelectLanguage = (code) => {
    if (currentLang === code) return;

    i18n.changeLanguage(code);
    setLanguage(code);
    document.documentElement.setAttribute("dir", i18n.dir(code));

    const successMessage =
      code === "km"
        ? "បានផ្លាស់ប្តូរភាសាទៅជាភាសាខ្មែរដោយជោគជ័យ"
        : "Language successfully changed to English";

    toast.success(successMessage, {
      id: "superadmin-lang-toast",
      duration: 2500,
      icon: "🌐",
    });
  };

  const activeLangObj =
    LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];

  return (
    <Page className="px-4 py-6 max-w-4xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#2CA01C]/10 text-[#2CA01C] flex items-center justify-center shrink-0 shadow-sm">
            <IconLanguage stroke={iconStroke} size={28} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {t("appbar.change_language")}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {currentLang === "km"
                ? "ជ្រើសរើសភាសាសម្រាប់ប្រើប្រាស់លើផ្ទាំងគ្រប់គ្រង SuperAdmin"
                : "Choose your preferred display language for SuperAdmin management portal"}
            </p>
          </div>
        </div>

        {/* Current Active Language Pill */}
        <div className="flex items-center gap-2 self-start md:self-center px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 shadow-xs">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2CA01C]"></span>
          </span>
          <span className="text-xs font-medium text-slate-600">
            {currentLang === "km" ? "ភាសាបច្ចុប្បន្ន:" : "Active:"}
          </span>
          <span className="text-xs font-bold text-slate-900">
            {activeLangObj.nativeTitle || activeLangObj.title}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <IconSparkles size={16} className="text-[#2CA01C]" />
            {t("appbar.select_language")}
          </label>
          <span className="text-xs text-slate-400">
            {LANGUAGES.length} {currentLang === "km" ? "ភាសាដែលអាចប្រើបាន" : "languages available"}
          </span>
        </div>

        {/* Responsive Grid of Language Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LANGUAGES.map((item) => {
            const isSelected = currentLang === item.code;
            const FlagComponent = item.Flag;

            return (
              <button
                key={item.code}
                type="button"
                onClick={() => handleSelectLanguage(item.code)}
                className={`group relative text-left w-full p-5 rounded-2xl transition-all duration-200 cursor-pointer min-h-[92px] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2CA01C] ${
                  isSelected
                    ? "border-2 border-[#2CA01C] bg-emerald-50/70 shadow-sm ring-4 ring-[#2CA01C]/10"
                    : "border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-xs"
                }`}
              >
                {/* Top Row: Flag, Badges, and Selection State */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    {FlagComponent && (
                      <FlagComponent className="w-10 h-7.5 rounded-md shadow-xs object-cover border border-black/10" />
                    )}
                    <span className="text-xs font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                      {item.countryCode || item.code}
                    </span>
                  </div>

                  {/* Active Indicator or Empty Selector */}
                  {isSelected ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#2CA01C] text-white shadow-xs">
                      <IconCheck size={14} stroke={3} />
                      <span>{currentLang === "km" ? "សកម្ម" : "Active"}</span>
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full border-2 border-slate-300 group-hover:border-[#2CA01C] group-hover:scale-105 transition-all" />
                  )}
                </div>

                {/* Center Content: Titles */}
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    {item.title}
                  </h3>
                  {item.nativeTitle && item.nativeTitle !== item.title && (
                    <p className="text-sm font-semibold text-[#2CA01C] mt-0.5">
                      {item.nativeTitle}
                    </p>
                  )}
                </div>

                {/* Subtitle / Description */}
                {item.description && (
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Info Helper Callout Card */}
        <div className="mt-8 p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50 flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-slate-200/70 text-slate-600 shrink-0">
            <IconInfoCircle stroke={iconStroke} size={20} />
          </div>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-800 block mb-0.5">
              {currentLang === "km" ? "ព័ត៌មានអំពីភាសា" : "SuperAdmin Session Preference"}
            </span>
            {currentLang === "km"
              ? "ការកំណត់ភាសាត្រូវបានរក្សាទុកនៅលើ browser នេះដោយស្វ័យប្រវត្តិ។ ផ្ទាំងគ្រប់គ្រងប្រព័ន្ធ SuperAdmin នឹងប្តូរតាមភាសាភ្លាមៗ។"
              : "Your language choice is stored for this SuperAdmin session. Portal analytics, tenant management, and system configs adapt immediately without page reload."}
          </div>
        </div>
      </div>
    </Page>
  );
}
