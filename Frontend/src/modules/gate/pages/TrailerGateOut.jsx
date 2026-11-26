import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { writeXlsx } from "../../../utils/excelDates";
import { FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown, FiTruck, FiPackage, FiMapPin, FiX, FiUpload, FiDownload } from "react-icons/fi";
import Navbar from "../../../components/layout/Navbar";
import Footer from "../../../components/layout/Footer";
import { notify } from "../../../utils/notify";
import { useGetTrailerGateOutListQuery, useGateOutTrailerMutation } from "../../../store/api/ymsApi";
import { StatGrid, FilterCard } from "../../../components/ui/StatCard";
import { FilterBar, FilterExportBtn } from "../../../components/ui/FilterBar";

const mapRecord = (row) => ({
  trailerNo: row.TrailerNo || "",
  activityName: row.ActivityName || "",
  inContainerNo: row.InContainerNo || "",
  outContainerNo: row.OutContainerNo || "",
  size: row.ContainerSize || "N/A",
  type: row.ContainerType || "N/A",
  transactionType: (row.Process || "").toUpperCase() || "N/A",
  lineName: row.ShippingLine || "",
  gateInDate: row.GateInDate || "",
  gateOutDate: row.GateOutDate || "",
  // location: row.ContainerLocation || "",
});

function formatDate(raw) {
  if (!raw) return "—";
  const d = new Date(String(raw).replace(" ", "T"));
  if (isNaN(d.getTime())) return String(raw);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const columns = [
  { key: "trailerNo", label: "Trailer No", sortable: true },
  { key: "activityName", label: "Activity Name", sortable: true },
  { key: "inContainerNo", label: "In Container No.", sortable: true },
  { key: "size", label: "Size", sortable: true },
  { key: "type", label: "Type", sortable: true },
  { key: "transactionType", label: "Transaction Type", sortable: true },
  { key: "lineName", label: "Line Name", sortable: true },
  { key: "gateInDate", label: "Gate In Date", sortable: true },
  { key: "gateOutDate", label: "Gate Out Date", sortable: true },
  // { key: "location", label: "Location", sortable: true },
];

const parseDateTime = (value) => {
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getRecordId = (record) =>
  `${record.trailerNo}-${record.gateOutDate}-${record.lineName}`;

// '20' / '40' / '' — "20GP", "40HQ" jaise sizes bhi 20 / 40 maane jaate hain
const sizeKey = (record) => {
  const s = String(record.size || "").trim();
  if (s.startsWith("20")) return "20";
  if (s.startsWith("40")) return "40";
  return "";
};

// Count + 20ft + 40ft + TEU (20ft = 1 TEU, 40ft = 2 TEU) for a list of records
const breakdown = (list) => {
  const c20 = list.filter((r) => sizeKey(r) === "20").length;
  const c40 = list.filter((r) => sizeKey(r) === "40").length;
  return { count: list.length, c20, c40, teu: c20 + c40 * 2 };
};

/* ─── Stat card with 20 ft / 40 ft / TEU breakdown ───────────────────────── */
const CARD_TONES = {
  emerald: { card: "bg-emerald-100 border-emerald-300", iconBox: "text-emerald-600", bar: "bg-emerald-500", ring: "ring-emerald-600", pct: "text-emerald-700" },
  amber:   { card: "bg-amber-100 border-amber-300",     iconBox: "text-amber-600",   bar: "bg-amber-500",   ring: "ring-amber-600",   pct: "text-amber-700" },
  violet:  { card: "bg-violet-100 border-violet-300",   iconBox: "text-violet-600",  bar: "bg-violet-500",  ring: "ring-violet-600",  pct: "text-violet-700" },
  rose:    { card: "bg-rose-100 border-rose-300",       iconBox: "text-rose-600",    bar: "bg-rose-500",    ring: "ring-rose-600",    pct: "text-rose-700" },
  // Total card ke liye alag colour (blue) — text poora black
  sky:     { card: "bg-sky-100 border-sky-300",         iconBox: "text-sky-700",     bar: "bg-sky-600",     ring: "ring-sky-700",     pct: "text-sky-800",
             label: "text-black", value: "text-black", subLabel: "text-black", subValue: "text-black", teu: "text-black" },
};

function SizeStatCard({ label, icon: Icon, tone = "emerald", stat, total, isActive, onClick }) {
  const t = CARD_TONES[tone] || CARD_TONES.emerald;
  const pct = total ? Math.round((stat.count / total) * 100) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-left rounded-xl border px-3 pt-3 pb-3 overflow-hidden transition-all hover:shadow-md ${t.card} ${isActive ? `ring-2 ${t.ring} shadow-md` : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0 ${t.iconBox}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.12em] leading-tight truncate ${t.label || "text-slate-500"}`}>{label}</p>
          <p className={`text-2xl font-black leading-tight ${t.value || "text-slate-800"}`}>{stat.count.toLocaleString()}</p>
        </div>
        {pct !== null && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white ${t.pct}`}>{pct}%</span>
        )}
      </div>

      {/* 20 ft / 40 ft / TEU */}
      <div className="mt-2.5 grid grid-cols-3">
        <div className="px-1.5 text-center">
          <p className={`text-[9px] font-bold uppercase tracking-wider leading-tight ${t.subLabel || "text-slate-500"}`}>20 ft</p>
          <p className={`text-sm font-black leading-tight ${t.subValue || "text-slate-700"}`}>{stat.c20.toLocaleString()}</p>
        </div>
        <div className="px-1.5 text-center border-l border-slate-400/40">
          <p className={`text-[9px] font-bold uppercase tracking-wider leading-tight ${t.subLabel || "text-slate-500"}`}>40 ft</p>
          <p className={`text-sm font-black leading-tight ${t.subValue || "text-slate-700"}`}>{stat.c40.toLocaleString()}</p>
        </div>
        <div className="px-1.5 text-center border-l border-slate-400/40">
          <p className={`text-[9px] font-bold uppercase tracking-wider leading-tight ${t.subLabel || "text-slate-500"}`}>TEU</p>
          <p className={`text-sm font-black leading-tight ${t.teu || "text-[#0e4a78]"}`}>{stat.teu.toLocaleString()}</p>
        </div>
      </div>

      <span className={`absolute left-0 bottom-0 h-[3px] ${t.bar}`} style={{ width: `${pct ?? 100}%` }} />
    </button>
  );
}

const TrailerGateOut = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({
    key: "gateOutDate",
    direction: "desc",
  });
  const [trailerNo, setTrailerNo] = useState("");

  const { data, isLoading, isError, refetch } = useGetTrailerGateOutListQuery(undefined, {
    pollingInterval: 60000,
  });
  const [gateOutTrailer, { isLoading: isSubmitting }] = useGateOutTrailerMutation();

  const gateOutRecords = useMemo(() => {
    const rows = data?.data || [];
    return rows.map(mapRecord);
  }, [data]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    } else if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = null;
      setSortConfig({ key: null, direction: null });
      return;
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredRecords = useMemo(() => {
    let result = [...gateOutRecords];

    if (filter !== "all") {
      result = result.filter((record) => record.transactionType === filter);
    }

    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter((record) =>
        [
          record.trailerNo,
          record.inContainerNo,
          record.outContainerNo,
          record.activityName,
          record.lineName,
          // record.location,
          record.type,
          record.transactionType,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term))
      );
    }

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (sortConfig.key === "gateInDate" || sortConfig.key === "gateOutDate") {
          const dateA = parseDateTime(aValue);
          const dateB = parseDateTime(bValue);
          return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
        }

        if (sortConfig.key === "size") {
          const numA = parseInt(aValue) || 0;
          const numB = parseInt(bValue) || 0;
          return sortConfig.direction === "asc" ? numA - numB : numB - numA;
        }

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [search, filter, sortConfig, gateOutRecords]);

  // Har card ke liye: count + 20 ft + 40 ft + TEU
  const stats = useMemo(() => ({
    total:    breakdown(gateOutRecords),
    EXPORT:   breakdown(gateOutRecords.filter((r) => r.transactionType === "EXPORT")),
    IMPORT:   breakdown(gateOutRecords.filter((r) => r.transactionType === "IMPORT")),
    EMPTY:    breakdown(gateOutRecords.filter((r) => r.transactionType === "EMPTY")),
    DOMESTIC: breakdown(gateOutRecords.filter((r) => r.transactionType === "DOMESTIC")),
  }), [gateOutRecords]);

  const handleExport = () => {
    const exportRows = sortedAndFilteredRecords.map((r) => ({
      ...r,
      gateInDate: formatDate(r.gateInDate),
      gateOutDate: formatDate(r.gateOutDate),
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TrailerGateOut");
    writeXlsx(workbook, "trailer-gate-out.xlsx");
  };

  const handleRefresh = () => {
    setSearch("");
    setFilter("all");
    setSortConfig({ key: "gateOutDate", direction: "desc" });
    refetch();
  };

  const handleTrailerSubmit = async () => {
    const trimmed = trailerNo.trim();
    if (!trimmed) {
      return;
    }
    try {
      await gateOutTrailer(trimmed).unwrap();
      notify.success("Gated Out", `Trailer ${trimmed} gated out successfully.`);
      setTrailerNo("");
    } catch (err) {
      notify.error("Gate-Out Failed", err?.data?.detail || "Could not gate out trailer.");
    }
  };

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1 px-4 sm:px-6 pb-10">
          <div className="w-full">

            {/* Trailer Gate Out Form + Stats */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden mt-6 mb-6">
              <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4 flex items-center gap-3">
                <FiTruck className="text-2xl" />
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-wide">Trailer Gate Out</h2>
                  <p className="text-xs sm:text-sm text-white/80">Enter trailer number and trigger gate-out workflow</p>
                </div>
              </header>
              <div className="p-6">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
                  <FiTruck className="text-[#0e4a78]" />
                  Trailer No
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex w-full sm:w-64 rounded-xl border-2 border-slate-300 overflow-hidden bg-white focus-within:border-[#0e4a78] focus-within:ring-2 focus-within:ring-[#0e4a78]/20 transition-all">
                    <input
                      value={trailerNo}
                      onChange={(event) => setTrailerNo(event.target.value.toUpperCase())}
                      placeholder="Enter trailer number"
                      className="flex-1 min-w-0 px-3 py-2.5 text-sm text-slate-800 focus:outline-none"
                    />
                    {trailerNo && (
                      <button
                        type="button"
                        onClick={() => setTrailerNo("")}
                        className="px-3 border-l border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                      >
                        <FiX size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleTrailerSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrailerNo("")}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleTrailerSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isSubmitting ? "Processing..." : "Trailer Out"}
                  </button>
                </div>
              </div>
            </section>

            {/* Header */}
            <header className="px-1 mb-4">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-wide text-[#0e4a78] flex items-center gap-2">
                <FiPackage /> Trailer Gate-Out Register
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Click on column headers to sort | Excel ready report
              </p>
            </header>

            {/* Stats + Filter — merged into one card */}
            <FilterCard>
            <StatGrid cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" bare>
              <SizeStatCard
                label="Total Entries"
                icon={FiPackage}
                tone="sky"
                stat={stats.total}
                isActive={filter === "all"}
                onClick={() => setFilter("all")}
              />
              <SizeStatCard
                label="Export"
                icon={FiUpload}
                tone="amber"
                stat={stats.EXPORT}
                total={stats.total.count}
                isActive={filter === "EXPORT"}
                onClick={() => setFilter("EXPORT")}
              />
              <SizeStatCard
                label="Import"
                icon={FiDownload}
                tone="emerald"
                stat={stats.IMPORT}
                total={stats.total.count}
                isActive={filter === "IMPORT"}
                onClick={() => setFilter("IMPORT")}
              />
              <SizeStatCard
                label="Empty"
                icon={FiPackage}
                tone="violet"
                stat={stats.EMPTY}
                total={stats.total.count}
                isActive={filter === "EMPTY"}
                onClick={() => setFilter("EMPTY")}
              />
              <SizeStatCard
                label="Domestic"
                icon={FiTruck}
                tone="rose"
                stat={stats.DOMESTIC}
                total={stats.total.count}
                isActive={filter === "DOMESTIC"}
                onClick={() => setFilter("DOMESTIC")}
              />
            </StatGrid>

            {/* Filter Bar */}
            <FilterBar bare>
              <div className="relative flex-1 min-w-[200px]">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search trailer, container, line..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-12 pr-4 py-3 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-all"
                >
                  <FiRefreshCw size={13} /> Clear
                </button>
                <FilterExportBtn onClick={handleExport} />
              </div>
            </FilterBar>
            </FilterCard>

            {/* Gate Out Register Table */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <div className="overflow-auto max-h-[500px] custom-scrollbar">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                      {columns.map((column) => (
                        <th
                          key={column.key}
                          className={`px-4 sm:px-5 py-3 text-left font-semibold border-r border-white/30 last:border-r-0 ${column.sortable ? "cursor-pointer hover:bg-white/10" : ""
                            }`}
                          onClick={() => column.sortable && handleSort(column.key)}
                        >
                          <div className="flex items-center gap-1.5">
                            {column.label}
                            {column.sortable && (
                              <div className="flex flex-col">
                                <FiChevronUp
                                  className={`w-3 h-3 ${sortConfig.key === column.key && sortConfig.direction === "asc"
                                    ? "text-white"
                                    : "text-white/40"
                                    }`}
                                />
                                <FiChevronDown
                                  className={`w-3 h-3 -mt-1 ${sortConfig.key === column.key && sortConfig.direction === "desc"
                                    ? "text-white"
                                    : "text-white/40"
                                    }`}
                                />
                              </div>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {sortedAndFilteredRecords.map((record) => (
                      <tr
                        key={getRecordId(record)}
                        className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200"
                      >
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          <span className="font-semibold text-slate-900">{record.trailerNo}</span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          {record.activityName}
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          <span className="font-mono tracking-wide">{record.inContainerNo}</span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          {record.size}
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          {record.type}
                        </td>
                        <td className="px-4 sm:px-5 py-3 border-r border-slate-200">
                          <span
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${record.transactionType === "EXPORT"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : record.transactionType === "IMPORT"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : record.transactionType === "EMPTY"
                              ? "bg-violet-50 text-violet-700 border-violet-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                              }`}
                          >
                            {record.transactionType}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          <span className="font-semibold text-slate-900">{record.lineName}</span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          {formatDate(record.gateInDate)}
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          {formatDate(record.gateOutDate)}
                        </td>
                        {/* <td className="px-4 sm:px-5 py-3 border-r border-slate-200 last:border-r-0">
                          <div className="flex items-center gap-2">
                            <FiMapPin className="text-blue-500" />
                            <span className="font-medium text-slate-800">{record.location}</span>
                          </div>
                        </td> */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isLoading && (
                <div className="py-12 text-center">
                  <p className="text-slate-500 text-lg font-medium">Loading trailer gate-out data...</p>
                </div>
              )}

              {isError && !isLoading && (
                <div className="py-12 text-center">
                  <p className="text-red-500 text-lg font-medium">Failed to load data from server</p>
                  <p className="text-slate-400 mt-1">Please check the backend connection and try again</p>
                </div>
              )}

              {!isLoading && !isError && sortedAndFilteredRecords.length === 0 && (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <FiSearch className="text-2xl text-slate-400" />
                  </div>
                  <p className="text-slate-500 text-lg font-medium">No records found</p>
                  <p className="text-slate-400 mt-1">Try adjusting your search or filter</p>
                </div>
              )}

              <footer className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <span>
                    Showing <strong className="text-[#0e4a78] font-bold">{sortedAndFilteredRecords.length}</strong> of {" "}
                    <strong className="text-[#0e4a78] font-bold">{gateOutRecords.length}</strong> records
                    {sortConfig.key && sortConfig.direction && (
                      <span className="ml-3">
                        | Sorted by: <strong className="text-[#0e4a78]">{sortConfig.key}</strong> ({sortConfig.direction})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600"></span>
                    <span className="text-slate-700">Export</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-600"></span>
                    <span className="text-slate-700">Import</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-violet-500 border border-violet-600"></span>
                    <span className="text-slate-700">Empty</span>
                  </div>
                </div>
              </footer>
            </section>
          </div>
        </main>

        <Footer />
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #0e4a78;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #0a3b61;
        }
      `}</style>
    </div>
  );
};

export default TrailerGateOut;