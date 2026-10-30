import React, { useRef , useEffect } from "react";
import { toast } from "react-hot-toast";
import { addCustomer } from "../controllers/customers.controller";
import { mutate } from "swr";
import { validateEmail } from "../utils/emailValidator";
import { validatePhone } from "../utils/phoneValidator";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";

export default function DialogAddCustomer({APIURL, defaultValue, onSuccess}) {
  const { t } = useTranslation();
  const phoneRef = useRef();
  const nameRef = useRef();
  const emailRef = useRef();
  const genderRef = useRef();
  const birthDateRef = useRef();
  const { theme } = useTheme();

  useEffect(()=>{
    if(/^\d+$/.test(defaultValue)) {
      // it's number
      phoneRef.current.value = defaultValue;
    } else {
      if(defaultValue) {
        nameRef.current.value = defaultValue;
      }
    }
  }, [defaultValue])

  async function btnAdd() {
    const phone = phoneRef.current.value;
    const name = nameRef.current.value;
    const email = emailRef.current.value || null;
    const gender = genderRef.current.value || null;
    const birthDate = birthDateRef.current.value || null;

    if(!phone) {
      toast.error(t("customers.please_provide_phone"));
      return;
    }

    if(!name) {
      toast.error(t("customers.please_provide_name"));
      return;
    }

    if(email) {
      if(!validateEmail(email)) {
        toast.error(t("customers.please_provide_valid_email"));
        return;
      }
    }
    if(!validatePhone(phone)) {
      toast.error(t("customers.please_provide_valid_phone"));
      return;
    }

    try {
      toast.loading(t("toast.please_wait"));
      const res = await addCustomer(phone, name, email, birthDate, gender);

      if(res.status == 200) {
        phoneRef.current.value = null;
        nameRef.current.value = null;
        emailRef.current.value = null;
        genderRef.current.value = null;
        birthDateRef.current.value = null;

        if(APIURL){
          await mutate(APIURL);
        }
        toast.dismiss();
        toast.success(res.data.message);
        document.getElementById("modal-add-customer").close();
        if(onSuccess) {
          onSuccess(phone, name);
        }
      }
    } catch (error) {
      const message = error?.response?.data?.message || t("toast.something_went_wrong");
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  }

  return (
    <dialog
      id="modal-add-customer"
      className="modal modal-bottom sm:modal-middle"
    >
      <div className="modal-box bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-6">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t("customers.new")}</h3>

        <div className="mt-4">
          <label htmlFor="phone" className="mb-1 block text-slate-500 dark:text-slate-400 text-xs font-medium">
            {t("customers.phone")} <span className="text-slate-400">- ({t("customers.required")})</span>
          </label>
          <input
            ref={phoneRef}
            type="tel"
            name="phone"
            className="text-xs sm:text-sm w-full rounded-lg px-3.5 py-2 border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            placeholder={t("customers.phone_placeholder")}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="name" className="mb-1 block text-slate-500 dark:text-slate-400 text-xs font-medium">
            {t("customers.name")} <span className="text-slate-400">- ({t("customers.required")})</span>
          </label>
          <input
            ref={nameRef}
            type="text"
            name="name"
            className="text-xs sm:text-sm w-full rounded-lg px-3.5 py-2 border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            placeholder={t("customers.name_placeholder")}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="email" className="mb-1 block text-slate-500 dark:text-slate-400 text-xs font-medium">
            {t("customers.email")}
          </label>
          <input
            ref={emailRef}
            type="email"
            name="email"
            className="text-xs sm:text-sm w-full rounded-lg px-3.5 py-2 border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            placeholder={t("customers.email_placeholder")}
          />
        </div>

        <div className="flex gap-4 w-full my-4">
          <div className="flex-1">
            <label htmlFor="birthdate"
              className="mb-1 block text-slate-500 dark:text-slate-400 text-xs font-medium"
              >
              {t("customers.birth_date")}
            </label>
            <input
              ref={birthDateRef}
              type="date"
              name="birthdate"
              max={new Date().toISOString().substring(0, 10)}
              className="text-xs sm:text-sm w-full rounded-lg px-3.5 py-2 border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              placeholder={t("customers.birthdate_placeholder")}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="type" className="mb-1 block text-slate-500 dark:text-slate-400 text-xs font-medium">
              {t("customers.gender")}
            </label>
            <select
              ref={genderRef}
              name="type"
              className="text-xs sm:text-sm w-full rounded-lg px-3.5 py-2 border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              placeholder={t("customers.gender")}
            >
              <option value="">
                {t("customers.gender")}
              </option>
              <option value="female">{t("customers.female")}</option>
              <option value="male">{t("customers.male")}</option>
              <option value="other">{t("customers.other")}</option>
            </select>
          </div>
        </div>

        <div className="modal-action mt-6 flex items-center justify-end gap-2">
          <form method="dialog" className="flex items-center gap-2">
            <button className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs sm:text-sm font-medium transition active:scale-95">
              {t("customers.close")}
            </button>
          </form>
          <button
            onClick={() => {
              btnAdd();
            }}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-[#107c41] hover:bg-[#0c6634] text-white text-xs sm:text-sm font-semibold transition active:scale-95 shadow-xs"
          >
            {t("customers.save")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
