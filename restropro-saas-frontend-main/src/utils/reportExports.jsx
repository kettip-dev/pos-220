import LogoUrl from "../assets/logo.svg";

const RESTRO_GREEN = "70B56A";
const RESTRO_GREEN_DARK = "243922";
const RESTRO_BORDER = "DCE7DB";
const RESTRO_MUTED = "6B7280";

const formatDecimal = (value, maxFractionDigits = 2) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(number);
};

const formatReportDate = (value) => {
  if (!value) return "";
  const rawValue = String(value);
  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString();
  }

  return new Date(value).toLocaleDateString();
};

const formatValue = (value, type, currency = "") => {
  if (type === "money") return `${currency}${Number(value || 0).toFixed(2)}`;
  if (type === "quantity") return formatDecimal(value, 4);
  if (type === "number") return formatDecimal(value, 2);
  if (type === "date" || type === "datetime") return formatReportDate(value);
  return value ?? "";
};

const safeSheetName = (name) => name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Sheet";

const buildSummaryRows = (report, currency) => (report?.summary || []).map((item) => ({
  Metric: item.label,
  Value: formatValue(item.value, item.type, currency),
}));

const buildTableRows = (table, currency) => (table.rows || []).map((row) => {
  return (table.columns || []).reduce((result, column) => {
    result[column.label] = formatValue(row[column.key], column.type, currency);
    return result;
  }, {});
});

export async function exportReportToExcel(report, currency) {
  const XLSX = await import("xlsx");
  const { utils, writeFile } = XLSX;
  const workbook = utils.book_new();
  const store = report?.store || {};
  const generatedAt = new Date().toLocaleDateString();

  const titleStyle = {
    font: { bold: true, sz: 18, color: { rgb: RESTRO_GREEN_DARK } },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const subTitleStyle = {
    font: { bold: true, sz: 11, color: { rgb: RESTRO_MUTED } },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: RESTRO_GREEN } },
    border: {
      top: { style: "thin", color: { rgb: RESTRO_GREEN } },
      bottom: { style: "thin", color: { rgb: RESTRO_GREEN } },
      left: { style: "thin", color: { rgb: RESTRO_GREEN } },
      right: { style: "thin", color: { rgb: RESTRO_GREEN } },
    },
  };
  const cellStyle = {
    border: {
      top: { style: "thin", color: { rgb: RESTRO_BORDER } },
      bottom: { style: "thin", color: { rgb: RESTRO_BORDER } },
      left: { style: "thin", color: { rgb: RESTRO_BORDER } },
      right: { style: "thin", color: { rgb: RESTRO_BORDER } },
    },
    alignment: { vertical: "top" },
  };

  const brandRows = [
    ["RestroPro Reports"],
    [store.name || "Store"],
    [report.title],
    [`Generated ${generatedAt}`],
    [store.address || store.phone || store.email ? [store.address, store.phone, store.email].filter(Boolean).join(" | ") : ""],
    [],
  ];

  const styleWorksheet = (worksheet, columnCount, dataStartRow = 7) => {
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(columnCount - 1, 1) } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(columnCount - 1, 1) } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: Math.max(columnCount - 1, 1) } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: Math.max(columnCount - 1, 1) } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: Math.max(columnCount - 1, 1) } },
    ];
    worksheet["!cols"] = Array.from({ length: columnCount }, () => ({ wch: 22 }));

    ["A1", "A2", "A3"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = titleStyle;
    });
    ["A4", "A5"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = subTitleStyle;
    });

    const range = utils.decode_range(worksheet["!ref"]);
    for (let row = dataStartRow - 1; row <= range.e.r; row += 1) {
      for (let col = 0; col <= range.e.c; col += 1) {
        const address = utils.encode_cell({ r: row, c: col });
        if (!worksheet[address]) continue;
        worksheet[address].s = row === dataStartRow - 1 ? headerStyle : cellStyle;
      }
    }
  };

  const summaryRows = buildSummaryRows(report, currency);
  const summarySheet = utils.aoa_to_sheet([...brandRows, ["Metric", "Value"], ...summaryRows.map((row) => [row.Metric, row.Value]), [], ["Powered by RestroPro"]]);
  styleWorksheet(summarySheet, 2);
  utils.book_append_sheet(workbook, summarySheet, "Summary");

  (report.tables || []).forEach((table) => {
    const rows = buildTableRows(table, currency);
    const headers = (table.columns || []).map((column) => column.label);
    const body = rows.length ? rows.map((row) => headers.map((header) => row[header])) : [["No data"]];
    const sheet = utils.aoa_to_sheet([...brandRows, headers.length ? headers : ["No data"], ...body, [], ["Powered by RestroPro"]]);
    styleWorksheet(sheet, Math.max(headers.length, 1));
    utils.book_append_sheet(workbook, sheet, safeSheetName(table.title));
  });

  writeFile(workbook, `${report.title} - ${new Date().toISOString().substring(0, 10)}.xlsx`);
}

export async function exportReportToPdf(report, currency, filterLabel) {
  const {
    Document,
    Page,
    Text,
    View,
    Image,
    StyleSheet,
    pdf,
  } = await import("@react-pdf/renderer");
  const { saveAs } = await import("file-saver");
  const store = report?.store || {};

  const styles = StyleSheet.create({
    page: { padding: 28, fontSize: 9, color: "#1f2937", fontFamily: "Helvetica" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: "#18181b", paddingBottom: 12, marginBottom: 14 },
    logo: { width: 74, height: 28, objectFit: "contain" },
    storeName: { fontSize: 15, color: "#18181b", marginBottom: 3 },
    storeMeta: { fontSize: 8, color: "#6b7280", marginTop: 2 },
    title: { fontSize: 18, marginBottom: 4, color: "#111827" },
    subtitle: { fontSize: 9, marginBottom: 14, color: "#6b7280" },
    badge: { alignSelf: "flex-start", backgroundColor: "#f4f4f5", color: "#18181b", paddingHorizontal: 8, paddingVertical: 4, marginTop: 4, fontSize: 8 },
    section: { marginTop: 12 },
    sectionTitle: { fontSize: 12, marginBottom: 7, color: "#111827" },
    table: { borderWidth: 1, borderColor: "#d1d5db" },
    row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
    rowLast: { flexDirection: "row" },
    cell: { flex: 1, padding: 6 },
    headerCell: { flex: 1, padding: 6, backgroundColor: "#18181b", fontSize: 8, color: "#ffffff" },
    footer: { position: "absolute", bottom: 18, left: 28, right: 28, borderTopWidth: 1, borderTopColor: "#e4e4e7", paddingTop: 8, flexDirection: "row", justifyContent: "space-between", color: "#6b7280", fontSize: 8 },
  });

  const PdfTable = ({ title, rows, columns }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.row}>
          {columns.map((column) => (
            <Text key={column.key} style={styles.headerCell}>{column.label}</Text>
          ))}
        </View>
        {(rows.length ? rows : [{}]).slice(0, 80).map((row, rowIndex, tableRows) => (
          <View key={rowIndex} style={rowIndex === tableRows.length - 1 ? styles.rowLast : styles.row}>
            {columns.map((column) => (
              <Text key={column.key} style={styles.cell}>
                {row[column.key] == null && !rows.length ? "No data" : String(formatValue(row[column.key], column.type, currency))}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );

  const ReportDocument = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.storeName}>{store.name || "Store"}</Text>
            {store.address ? <Text style={styles.storeMeta}>{store.address}</Text> : null}
            {[store.phone, store.email].filter(Boolean).length ? <Text style={styles.storeMeta}>{[store.phone, store.email].filter(Boolean).join(" | ")}</Text> : null}
            <Text style={styles.badge}>RestroPro Report</Text>
          </View>
          <Image src={LogoUrl} style={styles.logo} />
        </View>
        <Text style={styles.title}>{report.title}</Text>
        <Text style={styles.subtitle}>Showing data for {filterLabel} • Exported {new Date().toLocaleDateString()}</Text>
        <PdfTable
          title="Summary"
          columns={[
            { key: "Metric", label: "Metric" },
            { key: "Value", label: "Value" },
          ]}
          rows={buildSummaryRows(report, currency)}
        />
        {(report.tables || []).map((table) => (
          <PdfTable key={table.title} title={table.title} rows={table.rows || []} columns={table.columns || []} />
        ))}
        <View style={styles.footer} fixed>
          <Text>Powered by RestroPro</Text>
          <Text>Generated from RestroPro SaaS</Text>
        </View>
      </Page>
    </Document>
  );

  const blob = await pdf(<ReportDocument />).toBlob();
  saveAs(blob, `${report.title} - ${new Date().toISOString().substring(0, 10)}.pdf`);
}

export function formatReportValue(value, type, currency = "") {
  return formatValue(value, type, currency);
}
