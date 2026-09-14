import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  IconUpload,
  IconDownload,
  IconCheck,
  IconX,
  IconArrowLeft,
  IconArrowRight,
  IconFileSpreadsheet,
  IconAlertCircle,
  IconCircleCheck,
  IconCloudUpload,
  IconChevronDown,
} from "@tabler/icons-react";
import { iconStroke } from "../config/config";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { downloadImportTemplate, bulkImportMenuItems } from "../controllers/menu_item.controller";
import toast from "react-hot-toast";

const STEPS = [
  { key: "upload", label: "Upload File" },
  { key: "map", label: "Map Fields" },
  { key: "preview", label: "Preview Data" },
  { key: "import", label: "Import" },
];

// Expected fields for menu item import
const EXPECTED_FIELDS = [
  { key: "title", label: "Title", description: "Name of the menu item", required: true },
  { key: "description", label: "Description", description: "Short description (max 500 chars)", required: false },
  { key: "price", label: "Price", description: "Selling price per unit", required: true },
  { key: "netPrice", label: "Net Price", description: "Cost / purchase price", required: false },
  { key: "category", label: "Category", description: "Category name — will match existing or create new", required: false },
  { key: "tax", label: "Tax", description: "Tax name — will match existing or skip if not found", required: false },
  { key: "status", label: "Status", description: "enabled or disabled (default: enabled)", required: false },
];

function CustomSelect({ value, options, onChange, placeholder = "— Skip —" }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = value || placeholder;

  return (
    <div ref={dropdownRef} className="relative w-36 sm:w-48 shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-xl border transition-all text-start ${
          value
            ? "border-restro-border-green bg-restro-green-light dark:bg-[#2a3a29] text-restro-green-dark dark:text-emerald-300 font-semibold"
            : "border-restro-border-green bg-white dark:bg-[#222] text-gray-500 dark:text-gray-400 hover:border-restro-green"
        } ${isOpen ? "ring-2 ring-restro-green/30 border-restro-green shadow-sm" : ""}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <IconChevronDown
          size={16}
          className={`shrink-0 transition-transform duration-200 text-gray-400 ${isOpen ? "rotate-180 text-restro-green" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-52 py-1.5 bg-white dark:bg-[#1f1f1f] border border-restro-border-green rounded-xl shadow-xl z-[10000] max-h-56 overflow-y-auto">
          <div
            onClick={() => {
              onChange("");
              setIsOpen(false);
            }}
            className={`px-3.5 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors ${
              !value
                ? "bg-restro-green-light dark:bg-[#2d3e2c] text-restro-green-dark dark:text-emerald-300 font-semibold"
                : "text-gray-500 dark:text-gray-400 hover:bg-restro-gray dark:hover:bg-[#2a2a2a]"
            }`}
          >
            <span>{placeholder}</span>
            {!value && <IconCheck size={14} className="text-restro-green shrink-0" />}
          </div>
          {options.map((header) => {
            const isSelected = value === header;
            return (
              <div
                key={header}
                onClick={() => {
                  onChange(header);
                  setIsOpen(false);
                }}
                className={`px-3.5 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                  isSelected
                    ? "bg-restro-green text-white font-semibold"
                    : "text-slate-700 dark:text-gray-200 hover:bg-restro-green-light dark:hover:bg-[#2a3a29] hover:text-restro-green-dark dark:hover:text-emerald-300"
                }`}
              >
                <span className="truncate">{header}</span>
                {isSelected && <IconCheck size={14} className="text-white shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ImportMenuItemsModal({ isOpen, onClose, onImportSuccess }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileHeaders, setFileHeaders] = useState([]);
  const [fileData, setFileData] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [importResult, setImportResult] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef();

  const resetState = useCallback(() => {
    setCurrentStep(0);
    setUploadedFile(null);
    setFileHeaders([]);
    setFileData([]);
    setFieldMapping({});
    setImportResult(null);
    setIsImporting(false);
    setIsDragging(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ── File Parsing ──

  const parseFile = (file) => {
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          setFileHeaders(headers);
          setFileData(results.data);
          setUploadedFile(file);
          autoMapFields(headers);
          setCurrentStep(1);
        },
        error: (err) => {
          toast.error("Failed to parse CSV file: " + err.message);
        },
      });
    } else if (["xlsx", "xls"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
          setFileHeaders(headers);
          setFileData(jsonData);
          setUploadedFile(file);
          autoMapFields(headers);
          setCurrentStep(1);
        } catch (err) {
          toast.error("Failed to parse XLSX file: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Unsupported file format. Please upload CSV, XLSX, or XLS.");
    }
  };

  const autoMapFields = (headers) => {
    const mapping = {};
    for (const field of EXPECTED_FIELDS) {
      const match = headers.find(
        (h) => h.toLowerCase().replace(/[_\s-]/g, "") === field.label.toLowerCase().replace(/[_\s-]/g, "")
      );
      if (match) {
        mapping[field.key] = match;
      }
    }
    setFieldMapping(mapping);
  };

  // ── Drag & Drop ──

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      parseFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      parseFile(files[0]);
    }
  };

  // ── Template Download ──

  const handleDownloadTemplate = async () => {
    try {
      const response = await downloadImportTemplate();
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "menu_items_template.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Failed to download template.");
    }
  };

  // ── Field Mapping ──

  const handleMappingChange = (fieldKey, headerValue) => {
    setFieldMapping((prev) => ({
      ...prev,
      [fieldKey]: headerValue || undefined,
    }));
  };

  const mappedFieldCount = EXPECTED_FIELDS.filter((f) => fieldMapping[f.key]).length;
  const requiredFieldsMapped = EXPECTED_FIELDS.filter((f) => f.required).every((f) => fieldMapping[f.key]);

  // ── Preview Data ──

  const getMappedRows = () => {
    return fileData.map((row) => {
      const mapped = {};
      for (const field of EXPECTED_FIELDS) {
        const csvHeader = fieldMapping[field.key];
        mapped[field.key] = csvHeader ? (row[csvHeader] ?? "") : "";
      }
      return mapped;
    });
  };

  const mappedRows = currentStep >= 2 ? getMappedRows() : [];

  const getRowErrors = (row) => {
    const errors = [];
    if (!row.title || !row.title.toString().trim()) errors.push("title");
    const price = parseFloat(row.price);
    if (isNaN(price) || price < 0) errors.push("price");
    return errors;
  };

  const validRowCount = mappedRows.filter((r) => getRowErrors(r).length === 0).length;

  // ── Import ──

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const rows = getMappedRows().filter((r) => getRowErrors(r).length === 0);
      const response = await bulkImportMenuItems(rows);
      setImportResult(response.data);
      setIsImporting(false);
    } catch (err) {
      const msg = err?.response?.data?.message || "Import failed.";
      toast.error(msg);
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  // ── Render ──

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col border border-restro-border-green overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-restro-border-green">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Import Menu Items</h2>
          <div className="flex items-center gap-6">
            {/* Stepper */}
            <div className="hidden sm:flex items-center gap-1">
              {STEPS.map((step, idx) => {
                const isCompleted = idx < currentStep;
                const isActive = idx === currentStep;
                return (
                  <div key={step.key} className="flex items-center gap-1">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                          isCompleted
                            ? "bg-restro-green text-white"
                            : isActive
                            ? "border-2 border-restro-green text-restro-green bg-white dark:bg-[#1a1a1a]"
                            : "border border-gray-300 dark:border-gray-600 text-gray-400"
                        }`}
                      >
                        {isCompleted ? <IconCheck size={12} stroke={3} /> : idx + 1}
                      </div>
                      <span
                        className={`text-xs font-medium whitespace-nowrap ${
                          isCompleted || isActive ? "text-slate-700 dark:text-white" : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`w-4 h-px mx-0.5 ${idx < currentStep ? "bg-restro-green" : "bg-gray-300 dark:bg-gray-600"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
              <IconX size={20} stroke={iconStroke} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {currentStep === 0 && renderUploadStep()}
          {currentStep === 1 && renderMapStep()}
          {currentStep === 2 && renderPreviewStep()}
          {currentStep === 3 && renderImportStep()}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-restro-border-green bg-gray-50 dark:bg-[#222]">
          <span className="text-xs text-gray-500">
            Step {currentStep + 1} of {STEPS.length} — {STEPS[currentStep].label}
          </span>
          <div className="flex items-center gap-2">
            {currentStep > 0 && currentStep < 3 && (
              <button
                onClick={() => setCurrentStep((s) => s - 1)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-restro-border-green text-restro-text hover:bg-restro-button-hover transition active:scale-95"
              >
                <IconArrowLeft size={16} stroke={iconStroke} /> Back
              </button>
            )}
            {currentStep === 1 && (
              <button
                onClick={() => setCurrentStep(2)}
                disabled={!requiredFieldsMapped}
                className="flex items-center gap-1 px-4 py-1.5 text-sm rounded-lg text-white bg-restro-green hover:bg-restro-green-button-hover transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Preview <IconArrowRight size={16} stroke={iconStroke} />
              </button>
            )}
            {currentStep === 2 && (
              <button
                onClick={() => setCurrentStep(3)}
                disabled={validRowCount === 0}
                className="flex items-center gap-1 px-4 py-1.5 text-sm rounded-lg text-white bg-restro-green hover:bg-restro-green-button-hover transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <IconArrowRight size={16} stroke={iconStroke} />
              </button>
            )}
            {currentStep === 3 && importResult && (
              <button
                onClick={handleClose}
                className="flex items-center gap-1 px-4 py-1.5 text-sm rounded-lg text-white bg-restro-green hover:bg-restro-green-button-hover transition active:scale-95"
              >
                Done <IconCheck size={16} stroke={iconStroke} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Step 1: Upload ──

  function renderUploadStep() {
    return (
      <div>
        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
            isDragging
              ? "border-restro-green bg-restro-green/5"
              : "border-gray-300 dark:border-gray-600 hover:border-restro-green hover:bg-gray-50 dark:hover:bg-[#252525]"
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#333] flex items-center justify-center mb-3">
            <IconUpload size={24} className="text-gray-400" stroke={iconStroke} />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-white">Drop your file here or browse</p>
          <p className="text-xs text-gray-400 mt-1">Supports CSV, XLSX, and XLS files</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Template Download */}
        <div className="mt-5 flex items-center justify-between p-4 rounded-xl border border-restro-border-green bg-gray-50 dark:bg-[#222]">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-white">Need a template?</p>
            <p className="text-xs text-gray-400 mt-0.5">Download a sample file with the correct format</p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-restro-border-green text-restro-text hover:bg-restro-button-hover transition active:scale-95"
          >
            <IconDownload size={16} stroke={iconStroke} /> Download Template
          </button>
        </div>

        {/* Expected Fields */}
        <div className="mt-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Expected Fields</p>
          <div className="flex flex-wrap gap-2">
            {EXPECTED_FIELDS.map((field) => (
              <span
                key={field.key}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  field.required
                    ? "bg-restro-green text-white"
                    : "bg-white dark:bg-[#333] border border-restro-border-green text-slate-600 dark:text-gray-300"
                }`}
              >
                {field.label}
                {field.required && <span className="text-white/80">*</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Map Fields ──

  function renderMapStep() {
    return (
      <div>
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Map your columns</h3>
            {uploadedFile && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#333] border border-restro-border-green text-xs font-medium text-slate-600 dark:text-gray-300 shrink-0 w-fit">
                <IconFileSpreadsheet size={14} stroke={iconStroke} />
                <span className="truncate max-w-[200px] sm:max-w-none">{uploadedFile.name}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Match your file columns to the correct fields. Required fields are marked with <span className="text-red-500">*</span>
          </p>
        </div>

        <div className="border border-restro-border-green rounded-xl overflow-hidden divide-y divide-restro-border-green">
          {EXPECTED_FIELDS.map((field) => {
            const isMapped = !!fieldMapping[field.key];
            return (
              <div key={field.key} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3">
                {/* Status Icon */}
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shrink-0 ${isMapped ? "text-restro-green" : "text-gray-300"}`}>
                  {isMapped ? <IconCheck size={14} stroke={3} /> : <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-300 dark:border-gray-600" />}
                </div>

                {/* Field Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white truncate">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate hidden sm:block">{field.description}</p>
                </div>

                {/* Arrow */}
                <span className="text-gray-300 dark:text-gray-600 shrink-0 text-xs sm:text-sm">←</span>

                {/* Custom Restropro Styled Dropdown */}
                <CustomSelect
                  value={fieldMapping[field.key] || ""}
                  options={fileHeaders}
                  onChange={(val) => handleMappingChange(field.key, val)}
                />
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          {mappedFieldCount} of {EXPECTED_FIELDS.length} fields mapped
          {!requiredFieldsMapped && (
            <span className="text-red-500 ml-2">
              <IconAlertCircle size={12} className="inline mr-0.5" />
              Required fields must be mapped
            </span>
          )}
        </p>
      </div>
    );
  }

  // ── Step 3: Preview ──

  function renderPreviewStep() {
    const previewRows = mappedRows.slice(0, 50);

    return (
      <div>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Preview mapped data</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Showing {previewRows.length} of {mappedRows.length} rows. Review before importing.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#333] border border-restro-border-green text-xs font-medium text-slate-600 dark:text-gray-300">
            {validRowCount} rows ready
          </span>
        </div>

        <div className="overflow-x-auto border border-restro-border-green rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-start bg-restro-card-bg text-xs font-semibold text-gray-500 whitespace-nowrap">#</th>
                {EXPECTED_FIELDS.map((f) => (
                  <th key={f.key} className="px-3 py-2.5 text-start bg-restro-card-bg text-xs font-semibold text-gray-500 whitespace-nowrap">
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, idx) => {
                const errors = getRowErrors(row);
                const hasError = errors.length > 0;
                return (
                  <tr
                    key={idx}
                    className={`border-t border-restro-border-green ${hasError ? "bg-red-50 dark:bg-red-900/10" : ""}`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-gray-400">{idx + 1}</td>
                    {EXPECTED_FIELDS.map((f) => {
                      const value = row[f.key];
                      const isError = errors.includes(f.key);
                      return (
                        <td
                          key={f.key}
                          className={`px-3 py-2 whitespace-nowrap ${isError ? "text-red-500 font-medium" : value ? "" : "text-gray-300"}`}
                        >
                          {value || "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {mappedRows.length - validRowCount > 0 && (
          <p className="text-xs text-red-500 mt-3 flex items-center gap-1">
            <IconAlertCircle size={14} />
            {mappedRows.length - validRowCount} row(s) will be skipped due to missing required fields (Title, Price).
          </p>
        )}
      </div>
    );
  }

  // ── Step 4: Import ──

  function renderImportStep() {
    if (importResult) {
      const hasErrors = importResult.errors && importResult.errors.length > 0;
      const categoriesCreated = importResult.categoriesCreated || [];

      return (
        <div className="flex flex-col items-center justify-center py-10 px-4 w-full text-center">
          {/* Green Check Icon Circle */}
          <div className="w-11 h-11 rounded-full border-2 border-restro-green text-restro-green flex items-center justify-center mb-4">
            <IconCheck size={22} stroke={3} />
          </div>

          <h3 className="text-xl font-bold text-slate-800 dark:text-white">Import Complete</h3>
          <p className="text-sm text-gray-500 mt-1">
            {importResult.imported} of {importResult.totalRows} items imported successfully.
          </p>

          {/* New Categories Created Section */}
          {categoriesCreated.length > 0 && (
            <div className="mt-6 w-full max-w-lg flex flex-col items-center">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
                NEW CATEGORIES CREATED
              </p>
              <div className="max-h-36 overflow-y-auto flex flex-wrap items-center justify-center gap-2 px-2 py-1 w-full">
                {categoriesCreated.map((c, i) => (
                  <span
                    key={i}
                    className="px-3.5 py-1 rounded-full text-xs font-medium text-restro-green bg-white dark:bg-[#252525] border border-restro-border-green shadow-2xs"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Errors Section */}
          {hasErrors && (
            <div className="mt-6 w-full max-w-md">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">
                ERRORS ({importResult.errors.length})
              </p>
              <div className="max-h-28 overflow-y-auto text-xs text-red-600 dark:text-red-400 space-y-1 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-900/50 text-start">
                {importResult.errors.map((err, i) => (
                  <p key={i}>Row {err.row}: {err.message}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-[#333] flex items-center justify-center mb-4">
          <IconCloudUpload size={32} className="text-gray-400" stroke={iconStroke} />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Ready to import</h3>
        <p className="text-sm text-gray-500 mt-1">
          {validRowCount} items will be imported. This may take a moment.
        </p>
        <button
          onClick={async () => {
            await handleImport();
            if (onImportSuccess) onImportSuccess();
          }}
          disabled={isImporting}
          className="mt-6 flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white bg-restro-green hover:bg-restro-green-button-hover transition active:scale-95 disabled:opacity-50"
        >
          {isImporting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Importing...
            </>
          ) : (
            <>
              <IconUpload size={18} stroke={iconStroke} /> Start Import
            </>
          )}
        </button>
      </div>
    );
  }
}
