import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown, FiTruck, FiPackage, FiMapPin } from "react-icons/fi";
import { FaFileExcel } from "react-icons/fa";
import Navbar from "../../../components/layout/Navbar";
import Footer from "../../../components/layout/Footer";

const gateInRecords = [
  {
    trailerNo: "MH43H5994",
    containerNo: "PCIU0169752",
    activityName: "OFFLOAD",
    size: "20",
    type: "General (Dry)",
    transactionType: "EXPORT",
    gateInDate: "11-12-2025 10:26:18",
    location: "BLOCK-O-25D:4",
  },
  {
    trailerNo: "MH43E1924",
    containerNo: "FFAU5176090",
    activityName: "OFFLOAD",
    size: "40HQ",
    type: "General (Dry)",
    transactionType: "EXPORT",
    gateInDate: "11-12-2025 10:23:37",
    location: "BLOCK-I-19C:2",
  },
  {
    trailerNo: "MH46H2450",
    containerNo: "PCIU1798338",
    activityName: "OFFLOAD",
    size: "20",
    type: "General (Dry)",
    transactionType: "EXPORT",
    gateInDate: "11-12-2025 10:17:21",
    location: "BLOCK-W-15A:4",
  },
  {
    trailerNo: "MH46H5395",
    containerNo: "CAIU8841145",
    activityName: "OFFLOAD",
    size: "40HQ",
    type: "General (Dry)",
    transactionType: "EXPORT",
    gateInDate: "11-12-2025 09:51:30",
    location: "BLOCK-B-05F:2",
  },
  {
    trailerNo: "MH46AR3065",
    containerNo: "CMAU9495986",
    activityName: "OFFLOAD",
    size: "40HQ",
    type: "General (Dry)",
    transactionType: "IMPORT",
    gateInDate: "11-12-2025 09:10:48",
    location: "BLOCK-O-25D:4",
  },
  {
    trailerNo: "MH43U9071",
    containerNo: "MSDU8847049",
    activityName: "OFFLOAD",
    size: "40HQ",
    type: "General (Dry)",
    transactionType: "EXPORT",
    gateInDate: "11-12-2025 08:21:46",
    location: "BLOCK-B-05B:1",
  },
  {
    trailerNo: "MH47AR8870",
    containerNo: "MSMU1593648",
    activityName: "OFFLOAD",
    size: "N/A",
    type: "N/A",
    transactionType: "IMPORT",
    gateInDate: "11-12-2025 08:05:33",
    location: "BLOCK-I-19C:2",
  },
  {
    trailerNo: "MH04DK1356",
    containerNo: "HLBU3008381",
    activityName: "OFFLOAD",
    size: "20",
    type: "N/A",
    transactionType: "EXPORT",
    gateInDate: "11-12-2025 08:01:23",
    location: "BLOCK-B-15D:4",
  },
  {
    trailerNo: "MH46BF1800",
    containerNo: "UETU5886470",
    activityName: "OFFLOAD",
    size: "40HQ",
    type: "General (Dry)",
    transactionType: "IMPORT",
    gateInDate: "11-12-2025 07:45:04",
    location: "BLOCK-A-27G:4",
  },
  {
    trailerNo: "MH06AQ7367",
    containerNo: "TIIU4044059",
    activityName: "OFFLOAD",
    size: "40HQ",
    type: "General (Dry)",
    transactionType: "EXPORT",
    gateInDate: "11-12-2025 07:25:15",
    location: "BLOCK-W-15A:4",
  },
];

const filterOptions = [
  { label: "All Entries", value: "all" },
  { label: "Export", value: "EXPORT" },
  { label: "Import", value: "IMPORT" },
];

const columns = [
  { key: "trailerNo", label: "Trailer No", sortable: true },
  { key: "containerNo", label: "Container No", sortable: true },
  { key: "activityName", label: "Activity", sortable: true },
  { key: "size", label: "Size", sortable: true },
  { key: "type", label: "Type", sortable: true },
  { key: "transactionType", label: "Txn Type", sortable: true },
  { key: "gateInDate", label: "Gate In Date", sortable: true },
  { key: "location", label: "Location", sortable: true },
];

const TrailerGateIn = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "gateInDate", direction: "desc" });

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
    let result = [...gateInRecords];

    // Apply filter
    if (filter !== "all") {
      result = result.filter((record) => record.transactionType === filter);
    }

    // Apply search
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter((record) =>
        record.trailerNo.toLowerCase().includes(term) ||
        record.containerNo.toLowerCase().includes(term) ||
        record.activityName.toLowerCase().includes(term) ||
        record.location.toLowerCase().includes(term) ||
        record.type.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        // Handle date sorting
        if (sortConfig.key === "gateInDate") {
          const dateA = new Date(aValue.split(" ").reverse().join("-"));
          const dateB = new Date(bValue.split(" ").reverse().join("-"));
          return sortConfig.direction === "asc"
            ? dateA - dateB
            : dateB - dateA;
        }

        // Handle numeric sorting for size
        if (sortConfig.key === "size") {
          const numA = parseInt(aValue) || 0;
          const numB = parseInt(bValue) || 0;
          return sortConfig.direction === "asc"
            ? numA - numB
            : numB - numA;
        }

        // String sorting for other fields
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
  }, [search, filter, sortConfig]);

  const stats = useMemo(() => {
    const total = gateInRecords.length;
    const exportCount = gateInRecords.filter(
      (record) => record.transactionType === "EXPORT"
    ).length;
    const importCount = gateInRecords.filter(
      (record) => record.transactionType === "IMPORT"
    ).length;
    return { total, exportCount, importCount };
  }, []);

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(sortedAndFilteredRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TrailerGateIn");
    XLSX.writeFile(workbook, "trailer-gate-in.xlsx");
  };

  const handleRefresh = () => {
    setSearch("");
    setFilter("all");
    setSortConfig({ key: "gateInDate", direction: "desc" });
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
            <header className="pt-6 pb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500 font-semibold">
                  Gate Management
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#0e4a78] flex items-center gap-3">
                  <FiTruck className="text-3xl" />
                  24hr Trailer Gate In Detail
                </h1>
                <p className="text-slate-600 mt-1 text-sm sm:text-base">
                  Monitor live trailer gate-in activity with unified search and reporting.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 lg:mt-0 lg:gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 text-white transform hover:scale-105 transition-transform duration-200">
                  <p className="text-xs uppercase tracking-wider text-blue-100 font-semibold">Total Entries</p>
                  <p className="text-2xl md:text-3xl font-bold mt-2">{stats.total}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-4 text-white transform hover:scale-105 transition-transform duration-200">
                  <p className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">Export</p>
                  <p className="text-2xl md:text-3xl font-bold mt-2">{stats.exportCount}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-4 text-white transform hover:scale-105 transition-transform duration-200">
                  <p className="text-xs uppercase tracking-wider text-amber-100 font-semibold">Import</p>
                  <p className="text-2xl md:text-3xl font-bold mt-2">{stats.importCount}</p>
                </div>
              </div>
            </header>

            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-4 sm:px-6 py-4 sm:py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
                    <FiPackage className="text-2xl" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-wide">
                      Trailer Gate-In Register
                    </h2>
                    <p className="text-xs sm:text-sm text-white/80">
                      Click on column headers to sort | Excel ready report
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 min-w-[200px]">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search..."
                      className="w-full rounded-xl border border-white/20 bg-white/15 pl-12 pr-4 py-3 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/40 text-sm sm:text-base"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRefresh}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/20 hover:bg-white/30 transition text-white font-semibold border border-white/30"
                    >
                      <FiRefreshCw /> Clear
                    </button>
                    <button
                      onClick={handleExport}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 transition text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      <FaFileExcel /> Export
                    </button>
                  </div>
                </div>
              </header>

              <div className="px-4 sm:px-6 py-4 flex flex-wrap gap-3 border-b border-slate-200 bg-slate-50/80">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all ${filter === option.value
                      ? "bg-[#0e4a78] text-white border-[#0e4a78] shadow-md"
                      : "bg-white text-slate-700 border-slate-300 hover:border-[#0e4a78] hover:bg-blue-50"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Sorting Table */}
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
                                  className={`w-3 h-3 ${sortConfig.key === column.key && sortConfig.direction === 'asc' ? 'text-white' : 'text-white/40'}`}
                                />
                                <FiChevronDown
                                  className={`w-3 h-3 -mt-1 ${sortConfig.key === column.key && sortConfig.direction === 'desc' ? 'text-white' : 'text-white/40'}`}
                                />
                              </div>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {sortedAndFilteredRecords.map((record, index) => (
                      <tr
                        key={`${record.containerNo}-${index}`}
                        className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200"
                      >

                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          <span className="font-semibold text-slate-900">{record.trailerNo}</span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          <span className="font-mono tracking-wide">{record.containerNo}</span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          {record.activityName}
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
                              : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                          >
                            {record.transactionType}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          {record.gateInDate}
                        </td>
                        <td className="px-4 sm:px-5 py-3 border-r border-slate-200 last:border-r-0">
                          <div className="flex items-center gap-2">
                            <FiMapPin className="text-blue-500" />
                            <span className="font-medium text-slate-800">{record.location}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sortedAndFilteredRecords.length === 0 && (
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
                    Showing <strong className="text-[#0e4a78] font-bold">{sortedAndFilteredRecords.length}</strong> of{" "}
                    <strong className="text-[#0e4a78] font-bold">{gateInRecords.length}</strong> records
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

export default TrailerGateIn;