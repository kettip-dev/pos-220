import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Page from "../components/Page";
import DeleteModal from "../components/DeleteModal";
import {
  IconCake,
  IconCalendarPlus,
  IconCalendarTime,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCloudDown,
  IconDownload,
  IconEdit,
  IconChartBar,
  IconGenderAgender,
  IconMail,
  IconMan,
  IconMenu4,
  IconPencil,
  IconPhone,
  IconPlus,
  IconTableDown,
  IconTableImport,
  IconTrash,
  IconUser,
  IconWoman,
  IconX,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import DialogAddCustomer from "../components/DialogAddCustomer";
import { deleteCustomer, getAllCustomers, updateCustomer, useCustomers } from "../controllers/customers.controller";
import {clsx} from "clsx";
import { toast } from "react-hot-toast";
import { mutate } from "swr";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { isAllBusinessesScope } from "../helpers/BusinessScope";
import { SCOPES, hasFullBusinessAccess } from "../config/scopes";
import { validateEmail } from "../utils/emailValidator";
import { validatePhone } from "../utils/phoneValidator";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";

export default function CustomersPage() {
  const { t } = useTranslation();
  const { role, scope } = getUserDetailsInLocalStorage();
  // Enterprise "All Businesses" view. The backend collapses a person who
  // visited several businesses onto one row and labels it, so the extra column
  // only exists here.
  const isConsolidated = isAllBusinessesScope(role);
  const userScopes = scope?.split(",");
  const {theme} = useTheme();

  let isManageAllowed = false;
  if(hasFullBusinessAccess(role)) {
    isManageAllowed = true;
  } else {
    if(userScopes.includes(SCOPES.CUSTOMERS) || userScopes.includes(SCOPES.MANAGE_CUSTOMERS)) {
      isManageAllowed = true;
    }
  }

  const navigate = useNavigate();

  const phoneRef = useRef();
  const nameRef = useRef();
  const updateNameRef = useRef();
  const updatePhoneRef = useRef();
  const [deleteCustomerPhone, setDeleteCustomerPhone] = useState(null);
  const emailRef = useRef();
  const genderRef = useRef();
  const birthDateRef = useRef();

  const searchRef = useRef();
  const [state, setState] = useState({
    spage: 1,
    search: ""
  });
  const { APIURL, data, error, isLoading } = useCustomers({
    page: state.spage,
    perPage: 10,
    filter: state.search
  });

  if (isLoading) {
    return <Page>{t('customers.please_wait')}</Page>;
  }

  if (error) {
    console.error(error);
    return <Page>{t('customers.error_loading_details')}</Page>;
  }

  const { customers, currentPage, totalPages, totalCustomers } = data;

  // pagination
  const btnPaginationFirstPage = () => {
    setState({
      ...state,
      spage: 1,
    })
  };
  const btnPaginationLastPage = () => {
    setState({
      ...state,
      spage: totalPages,
    })
  };
  const btnPaginationNextPage = () => {
    if(currentPage == totalPages) {
      return;
    }
    setState({
      ...state,
      spage: state.spage + 1,
    })
  };
  const btnPaginationPreviousPage = () => {
    if(currentPage == 1) {
      return;
    }
    setState({
      ...state,
      spage: state.spage - 1,
    })
  };
  // pagination


  const btnDelete = async (id) => {
    try {
      toast.loading(t('customers.please_wait'));
      const res = await deleteCustomer(id);

      if(res.status == 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('customers.something_went_wrong');
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  };

  const btnSearch = () => {
    const searchQuery = searchRef.current.value;
    if(!new String(searchQuery).trim()) {
      return;
    }

    setState({
      ...state,
      search: searchQuery,
      spage: 1
    });
  };
  const btnClearSearch = () => {
    searchRef.current.value = null;

    setState({
      ...state,
      search: "",
      spage: 1
    });
  };


  const btnShowUpdate = (phone, name, email, birthDate, gender) => {
    phoneRef.current.value = phone;
    nameRef.current.value = name;
    emailRef.current.value = email;

    const bDate = new Date(birthDate);

    birthDateRef.current.value = birthDate ? `${bDate.getFullYear()}-${(bDate.getMonth()+1).toString().padStart("2", '0')}-${bDate.getDate().toString().padStart("2", '0')}` : null;
    genderRef.current.value = gender;

    document.getElementById("modal-update-customer").showModal()
  };

  async function btnUpdate() {
    const phone = phoneRef.current.value;
    const name = nameRef.current.value;
    const email = emailRef.current.value || null;
    const gender = genderRef.current.value || null;
    const birthDate = birthDateRef.current.value || null;

    if(!phone) {
      toast.error(t('customers.please_provide_phone'));
      return;
    }

    if(!name) {
      toast.error(t('customers.please_provide_name'));
      return;
    }

    if(email) {
      if(!validateEmail(email)) {
        toast.error(t('customers.please_provide_valid_email'));
        return;
      }
    }
    if(!validatePhone(phone)) {
      toast.error(t('customers.please_provide_valid_phone'));
      return;
    }

    try {
      toast.loading(t('customers.please_wait'));
      const res = await updateCustomer(phone, name, email, birthDate, gender);

      if(res.status == 200) {
        phoneRef.current.value = null;
        nameRef.current.value = null;
        emailRef.current.value = null;
        genderRef.current.value = null;
        birthDateRef.current.value = null;

        await mutate(APIURL);

        toast.dismiss();
        toast.success(res.data.message);
        document.getElementById('modal-update-customer').close();
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('customers.something_went_wrong');
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  }

  const btnDownloadCustomerDataVisible = async () => {
    try {
      toast.loading(t('customers.please_wait'));;
      if(customers.length == 0) {
        toast.dismiss();
        toast.error("No data found!");
        return;
      }

      const { Parser } = await import("@json2csv/plainjs")
      const { saveAs } = await import("file-saver")
      const opts = {};
      const parser = new Parser(opts);
      const csv = parser.parse(customers);

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

      toast.dismiss();

      saveAs(blob, "Customers.csv");
    } catch (error) {
      console.log(error);
      toast.dismiss();
    }
  }

  const btnDownloadCustomerAllData = async () => {
    try {
      toast.loading("Please wait...");
      const res = await getAllCustomers();

      if(res.status == 200) {
        toast.dismiss();
        if(res.data?.length == 0) {
          toast.dismiss();
          toast.error("No data found!");
          return;
        }
        const customers = res.data;
        const { Parser } = await import("@json2csv/plainjs")
        const { saveAs } = await import("file-saver")
        const opts = {};
        const parser = new Parser(opts);
        const csv = parser.parse(customers);

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

        toast.dismiss();

        saveAs(blob, "Customers.csv");
      }
    } catch (error) {
      const message = error?.response?.data?.message || t('customers.something_went_wrong');
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  }

  return (
    <Page>
      <div className="flex flex-wrap gap-4 flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex gap-6">
          <h3 className="text-2xl">{t('customers.title')}</h3>
          {isManageAllowed && <button
            onClick={() =>
              document.getElementById("modal-add-customer").showModal()
            }
           className ='text-sm rounded-lg border transition active:scale-95 hover:shadow-lg px-2 py-1 flex items-center gap-1 text-restro-text bg-restro-gray border-restro-border-green hover:bg-restro-button-hover'
          >
            <IconPlus size={22} stroke={iconStroke} /> {t('customers.new')}
          </button>}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className='px-2 py-1 rounded-lg flex items-center text-restro-text bg-restro-bg-gray'>
            <input
              ref={searchRef}
              defaultValue={state.search}
              type="text"
              placeholder={t('customers.search_placeholder')}
              className="bg-transparent placeholder:text-gray-400 outline-none block"
            />
            {state.search && <button onClick={btnClearSearch} className="text-gray-400">
              <IconX stroke={iconStroke} size={18} />
            </button>}
          </div>
          <button onClick={btnSearch}  className='rounded-lg transition active:scale-95 hover:shadow-lg px-2 text-white border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'>
            {t('customers.search')}
          </button>

          <div className={`dropdown dropdown-end dark:rounded-lg`}>
            <div tabIndex={0} role="button" className='btn btn-sm transition active:scale-95 px-2 py-2 rounded-lg text-restro-text bg-restro-gray hover:bg-restro-button-hover dark:rounded-lg'><IconMenu4 stroke={iconStroke} size={18} /> {t('customers.actions')}</div>
            <ul tabIndex={0} className='dropdown-content menu bg-base-100 dark:rounded-xl rounded-box z-[1] w-52 p-2 shadow-lg border mt-2 border-restro-border-green'>
              <li ><button className="dark:rounded-lg" onClick={btnDownloadCustomerDataVisible}><IconDownload stroke={iconStroke} /> {t('customers.download_visible')}</button></li>
              <li ><button className="dark:rounded-lg" onClick={btnDownloadCustomerAllData}><IconCloudDown stroke={iconStroke} /> {t('customers.download_all')}</button></li>
              <li ><button className="dark:rounded-lg" onClick={()=>{
                navigate("import")
              }}><IconTableImport stroke={iconStroke} /> {t('customers.import')}</button></li>
            </ul>
          </div>
        </div>

      </div>

      {customers?.length == 0 && (
        <div className="w-full h-[calc(100vh-15vh)] flex gap-4 flex-col items-center justify-center">
          <img
            src="/assets/illustrations/customers-not-found.webp"
            alt="no customers"
            className="w-1/2 md:w-60"
          />
          <p className="text-gray-400">{t('customers.no_customers_found')}</p>
        </div>
      )}

          <div className="overflow-x-auto mt-6 border rounded-2xl border-restro-border-green bg-white dark:bg-restro-bg-card-dark-mode">
            <table className="table w-full">
              <thead>
                <tr className="border-b border-restro-border-green bg-restro-green-light dark:bg-[#1a1a1a] text-restro-green-dark dark:text-gray-300 uppercase tracking-wider text-xs">
                  <th className="px-4 py-3 font-bold text-center w-12">#</th>
                  <th className="px-4 py-3 font-bold">{t('customers.name') || 'Customer'}</th>
                  {isConsolidated && (
                    <th className="px-4 py-3 font-bold">
                      {t('business_switcher.business', 'Business')}
                    </th>
                  )}
                  <th className="px-4 py-3 font-bold">{t('customers.phone') || 'Phone'}</th>
                  <th className="px-4 py-3 font-bold">Created</th>
                  <th className="px-4 py-3 font-bold text-right">{t('customers.actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer, index) => {
                  const { phone, name, email, created_at, updated_at, businesses } = customer;
                  const srNo = (state.spage - 1) * 10 + index + 1;

                  return (
                    <tr 
                      key={phone} 
                      className="border-b last:border-0 border-restro-border-green hover:bg-restro-green-10 dark:hover:bg-[#222222] transition text-restro-text"
                    >
                      <td className="px-4 py-3 font-medium text-gray-400 text-center">
                        {srNo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex w-8 h-8 shrink-0 rounded-full items-center justify-center text-restro-green dark:text-white bg-restro-green-light dark:bg-[#333333] shadow-sm">
                            <IconUser size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{name}</p>
                          </div>
                        </div>
                      </td>
                      {isConsolidated && (
                        <td className="px-4 py-3">
                          {/* A person who visited several businesses is one row
                              (grouped by phone/email in SQL), so this can list
                              more than one. */}
                          <div className="flex flex-wrap gap-1">
                            {(businesses || []).map((business) => (
                              <span
                                key={business}
                                className="rounded-[42px] bg-restro-gray px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap"
                              >
                                {business}
                              </span>
                            ))}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1 font-medium text-sm text-gray-700 dark:text-gray-300">
                          <IconPhone stroke={iconStroke} size={14} className="text-restro-green shrink-0" />
                          {phone}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 text-xs text-gray-500">
                          <p className="flex items-center gap-1 whitespace-nowrap">
                            <IconCalendarPlus stroke={iconStroke} size={14} className="text-gray-400 shrink-0" />
                            {new Date(created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {/* Insights, edit and delete are all keyed by a phone
                            number, which identifies a customer only WITHIN one
                            business — so the backend requires a single business
                            for each. Hidden rather than left to fail on click. */}
                        {isConsolidated ? (
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {t('business_switcher.select_business_to_manage', 'Select a business to manage')}
                          </span>
                        ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { navigate(`${phone}/insights`) }}
                            className="p-1.5 rounded-full text-restro-green hover:bg-restro-green hover:text-white transition bg-restro-green-light dark:bg-[#333333] dark:text-gray-200 dark:hover:bg-restro-green shadow-sm"
                            title="Insights"
                          >
                            <IconChartBar stroke={iconStroke} size={16} />
                          </button>
                          <button 
                            onClick={() => { btnShowUpdate(phone, name, email, customer.birth_date, customer.gender); }}
                            className="p-1.5 rounded-full text-restro-green hover:bg-restro-green hover:text-white transition bg-restro-green-light dark:bg-[#333333] dark:text-gray-200 dark:hover:bg-restro-green shadow-sm"
                            title="Edit"
                          >
                            <IconPencil stroke={iconStroke} size={16} />
                          </button>
                          <button 
                            onClick={() => { setDeleteCustomerPhone(phone); }}
                            className="p-1.5 rounded-full text-restro-red hover:bg-restro-red hover:text-white transition bg-red-50 dark:bg-red-950 dark:text-red-400 dark:hover:bg-restro-red dark:hover:text-white shadow-sm"
                            title="Delete"
                          >
                            <IconTrash stroke={iconStroke} size={16} />
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

      {/* pagination */}
      <div className="flex justify-end mt-8">
        <div className="join">
          <button
            onClick={btnPaginationFirstPage}
            className={clsx(
                            "join-item btn btn-sm",
                          {
                            // Normal state (not disabled)
                            "bg-restro-bg-card-dark-mode text-gray-200": theme === "black" && state.page !== state.totalPages,
                            "bg-white text-gray-800": theme !== "black" && state.page !== state.totalPages,
            
                            // Disabled state
                            "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed": theme === "black" && state.page === state.totalPages,
                            "bg-gray-100 text-gray-400 cursor-not-allowed": theme !== "black" && state.page === state.totalPages,
                          }
                          )}
            >
              <IconChevronsLeft stroke={iconStroke} />
            </button>
            <button
              onClick={btnPaginationPreviousPage}
              className={clsx(
                      "join-item btn btn-sm",
                    {
                      // Normal state (not disabled)
                      "bg-restro-bg-card-dark-mode text-gray-200": theme === "black" && state.page !== state.totalPages,
                      "bg-white text-gray-800": theme !== "black" && state.page !== state.totalPages,
      
                      // Disabled state
                      "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed": theme === "black" && state.page === state.totalPages,
                      "bg-gray-100 text-gray-400 cursor-not-allowed": theme !== "black" && state.page === state.totalPages,
                    }
                    )}
            >
              <IconChevronLeft stroke={iconStroke} />
            </button>
            <button
              className={clsx(
                "join-item btn btn-sm",
                  {
                    // Normal state (not disabled)
                    "bg-restro-bg-card-dark-mode text-gray-200": theme === "black" && state.page !== state.totalPages,
                    "bg-white text-gray-800": theme !== "black" && state.page !== state.totalPages,

                    // Disabled state
                    "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed": theme === "black" && state.page === state.totalPages,
                    "bg-white text-gray-400 cursor-not-allowed": theme !== "black" && state.page === state.totalPages,
                  }
                )}
              >
                Page {currentPage}
              </button>
              <button
                onClick={btnPaginationNextPage}
                className={clsx(
                                "join-item btn btn-sm",
                              {
                                // Normal state (not disabled)
                                "bg-restro-bg-card-dark-mode text-gray-200": theme === "black" && state.page !== state.totalPages,
                                "bg-white text-gray-800": theme !== "black" && state.page !== state.totalPages,
                
                                // Disabled state
                                "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed": theme === "black" && state.page === state.totalPages,
                                "bg-gray-100 text-gray-400 cursor-not-allowed": theme !== "black" && state.page === state.totalPages,
                              }
                              )}
              >
                <IconChevronRight stroke={iconStroke} />
              </button>
              <button
                onClick={btnPaginationLastPage}
                className={clsx(
                                "join-item btn btn-sm",
                              {
                                // Normal state (not disabled)
                                "bg-restro-bg-card-dark-mode text-gray-200": theme === "black" && state.page !== state.totalPages,
                                "bg-white text-gray-800": theme !== "black" && state.page !== state.totalPages,
                
                                // Disabled state
                                "bg-restro-bg-card-dark-mode text-gray-400 cursor-not-allowed": theme === "black" && state.page === state.totalPages,
                                "bg-gray-100 text-gray-400 cursor-not-allowed": theme !== "black" && state.page === state.totalPages,
                              }
                              )}
              >
                <IconChevronsRight stroke={iconStroke} />
              </button>
  </div>
      </div>
      {/* pagination */}

      {/* add dialog */}
      <DialogAddCustomer APIURL={APIURL} />
      {/* add dialog */}

      {/* update dialog */}
      <dialog id="modal-update-customer" className="modal modal-bottom sm:modal-middle" >
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg">{t('customers.update_customer')}</h3>

          <div className="mt-4">
            <label htmlFor="phone" className="mb-1 block text-gray-500 text-sm">
              {t('customers.phone')} <span className="text-xs text-gray-400">- ({t('customers.required')})</span>
            </label>
            <input
              ref={phoneRef}
              type="tel"
              name="phone"
              disabled
              className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green bg-gray-50 dark:bg-black focus:outline-restro-border-green'
              placeholder={t('customers.phone')}
            />
          </div>

          <div className="mt-4">
            <label htmlFor="name" className="mb-1 block text-gray-500 text-sm">
              {t('customers.name')} <span className="text-xs text-gray-400">- ({t('customers.required')})</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              name="name"
              className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green bg-gray-50 dark:bg-black focus:outline-restro-border-green'
              placeholder={t('customers.name')}
            />
          </div>

        <div className="mt-4">
          <label htmlFor="email" className="mb-1 block text-gray-500 text-sm">
            {t('customers.email')}
          </label>
          <input
            ref={emailRef}
            type="email"
            name="email"
            className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green bg-gray-50 dark:bg-black focus:outline-restro-border-green'
            placeholder={t('customers.email')}
          />
        </div>

        <div className="flex gap-4 w-full my-4">
          <div className="flex-1">
            <label htmlFor="birthdate" className="mb-1 block text-gray-500 text-sm">
              {t('customers.birth_date')}
            </label>
            <input
              ref={birthDateRef}
              type="date"
              name="birthdate"
              max={new Date().toISOString().substring(0, 10)}
              className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green bg-gray-50 dark:bg-black focus:outline-restro-border-green'
              placeholder={t('customers.birth_date')}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="type" className="mb-1 block text-gray-500 text-sm">
              {t('customers.gender')}
            </label>
            <select
              ref={genderRef}
              name="type"
              className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green bg-gray-50 dark:bg-black focus:outline-restro-border-green'
              placeholder={t('customers.gender')}
            >
              <option value="">
                {t('customers.gender')}
              </option>
              <option value="female">{t('customers.female')}</option>
              <option value="male">{t('customers.male')}</option>
              <option value="other">{t('customers.other')}</option>
            </select>
          </div>
        </div>

        <div className="modal-action">
          <form method="dialog">
            {/* if there is a button in form, it will close the modal */}
            <button className='btn transition active:scale-95 hover:shadow-lg px-4 py-3 flex-1 items-center justify-center align-center rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text'>
              {t('customers.close')}
            </button>
            <button
              onClick={() => {
                btnUpdate();
              }}
            className='rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover'
            >
              {t('customers.save')}
            </button>
          </form>
        </div>
      </div>
    </dialog>
      {/* update dialog */}

      <DeleteModal
        isOpen={Boolean(deleteCustomerPhone)}
        onClose={() => setDeleteCustomerPhone(null)}
        onConfirm={async () => {
          const id = deleteCustomerPhone;
          setDeleteCustomerPhone(null);
          await btnDelete(id);
        }}
        title={t("customers.delete_customer", "Delete Customer")}
        description={t("customers.are_you_sure")}
      />
    </Page>
  );
}
