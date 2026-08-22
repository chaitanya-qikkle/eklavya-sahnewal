import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown, FiTruck, FiPackage, FiMapPin, FiX } from "react-icons/fi";
import { FaFileExcel } from "react-icons/fa";
import Navbar from "../../../components/layout/Navbar";
import Footer from "../../../components/layout/Footer";
import { notify } from "../../../utils/notify";

const gateOutRecords = [
  {
    trailerNo: "CG04MF2250",
    activityName: "PICKUP",
    inContainerNo: "TTNU4107607",
    outContainerNo: "TTNU4107607",
    size: "40",
    type: "General (Dry)",
    transactionType: "IMPORT",
    lineName: "LINE-A",
    gateInDate: "28-11-2025 10:05:12",
    gateOutDate: "28-11-2025 10:07:37",
    location: "BLOCK-W-12A:2",
  },
  {
    trailerNo: "MP09HH6439",
    activityName: "PICKUP",
    inContainerNo: "HZKU2801610",
    outContainerNo: "HZKU2801610",
    size: "20",
    type: "General (Dry)",
    transactionType: "IMPORT",
    lineName: "LINE-B",
    gateInDate: "19-11-2025 16:02:05",
    gateOutDate: "19-11-2025 16:05:52",
    location: "BLOCK-A-10C:3",
  },
  {
    trailerNo: "GJ05JD9759",
    activityName: "PICKUP",
    inContainerNo: "TLNU9101464",
    outContainerNo: "TLNU9101464",
    size: "20",
    type: "General (Dry)",
    transactionType: "IMPORT",
    lineName: "LINE-C",
    gateInDate: "19-11-2025 15:28:54",
    gateOutDate: "19-11-2025 15:31:45",
    location: "BLOCK-A-09A:3",
  },
  {
    trailerNo: "22BH6517A",
    activityName: "PICKUP",
    inContainerNo: "HZKU7082761",
    outContainerNo: "HZKU7082761",
    size: "45",
    type: "General (Dry)",
    transactionType: "IMPORT",
    lineName: "LINE-D",
    gateInDate: "19-11-2025 13:03:04",
    gateOutDate: "19-11-2025 13:03:59",
    location: "BLOCK-O-25D:4",
  },
  {
    trailerNo: "22BH6517A",
    activityName: "OFFLOAD",
    inContainerNo: "GLDU0479276",
    outContainerNo: "GLDU0479276",
    size: "40",
    type: "General (Dry)",
    transactionType: "EXPORT",
    lineName: "LINE-D",
    gateInDate: "19-11-2025 10:00:27",
    gateOutDate: "19-11-2025 10:02:23",
    location: "BLOCK-B-05B:1",
  },
  {
    trailerNo: "KL43E2225",
    activityName: "OFFLOAD",
    inContainerNo: "ONEU1639707",
    outContainerNo: "ONEU1639707",
    size: "40HQ",
    type: "General (Dry)",
    transactionType: "IMPORT",
    lineName: "LINE-E",
    gateInDate: "18-11-2025 11:15:26",
    gateOutDate: "18-11-2025 11:32:39",
    location: "BLOCK-W-31A:4",
  },
  {
    trailerNo: "KL43E3402",
    activityName: "OFFLOAD",
    inContainerNo: "ONEU1639707",
    outContainerNo: "ONEU1639707",
    size: "40HQ",
    type: "General (Dry)",
    transactionType: "IMPORT",
    lineName: "LINE-F",
    gateInDate: "06-10-2025 16:43:41",
    gateOutDate: "07-10-2025 11:16:20",
    location: "BLOCK-A-27G:4",
  },
  {
    trailerNo: "KL43E2225",
    activityName: "OFFLOAD",
    inContainerNo: "ONEU1639707",
    outContainerNo: "ONEU1639707",
    size: "40HQ",
    type: "General (Dry)",
    transactionType: "IMPORT",
    lineName: "LINE-E",
    gateInDate: "06-10-2025 16:32:41",
    gateOutDate: "18-11-2025 11:32:03",
    location: "BLOCK-B-05E:4",
  },
  {
    trailerNo: "KL43E3402",
    activityName: "OFFLOAD",
    inContainerNo: "ONEU1639707",
    outContainerNo: "ONEU1639707",
    size: "40HQ",
    type: "General (Dry)",
    transactionType: "IMPORT",
    lineName: "LINE-F",
    gateInDate: "06-10-2025 15:35:36",
    gateOutDate: "07-10-2025 11:15:53",
    location: "BLOCK-B-09G:4",
  },
];

const filterOptions = [
  { label: "All Entries", value: "all" },
  { label: "Export", value: "EXPORT" },
  { label: "Import", value: "IMPORT" },
];

const columns = [
  { key: "trailerNo", label: "Trailer No", sortable: true },
  { key: "activityName", label: "Activity Name", sortable: true },
  { key: "inContainerNo", label: "In Container No.", sortable: true },
  { key: "outContainerNo", label: "Out Container No.", sortable: true },
  { key: "size", label: "Size", sortable: true },
  { key: "type", label: "Type", sortable: true },
  { key: "transactionType", label: "Transaction Type", sortable: true },
  { key: "lineName", label: "Line Name", sortable: true },
  { key: "gateInDate", label: "Gate In Date", sortable: true },
  { key: "gateOutDate", label: "Gate Out Date", sortable: true },
  { key: "location", label: "Location", sortable: true },
];

const parseDateTime = (value) => {
  if (!value) {
    return 0;
  }
  const [datePart, timePart] = value.split(" ");
  if (!datePart || !timePart) {
    return 0;
  }
  const [day, month, year] = datePart.split("-");
  if (!day || !month || !year) {
    return 0;
  }
  return new Date(`${year}-${month}-${day}T${timePart}`).getTime();
};

const getRecordId = (record) =>
  `${record.trailerNo}-${record.gateOutDate}-${record.lineName}`;

const TrailerGateOut = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({
    key: "gateOutDate",
    direction: "desc",
  });
  const [trailerNo, setTrailerNo] = useState("");

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
          record.location,
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
  }, [search, filter, sortConfig]);

  const stats = useMemo(() => {
    const total = gateOutRecords.length;
    const exportCount = gateOutRecords.filter(
      (record) => record.transactionType === "EXPORT"
    ).length;
    const importCount = gateOutRecords.filter(
      (record) => record.transactionType === "IMPORT"
    ).length;
    return { total, exportCount, importCount };
  }, []);

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(sortedAndFilteredRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TrailerGateOut");
    XLSX.writeFile(workbook, "trailer-gate-out.xlsx");
  };

  const handleRefresh = () => {
    setSearch("");
    setFilter("all");
    setSortConfig({ key: "gateOutDate", direction: "desc" });
  };

  const handleTrailerSubmit = () => {
    if (!trailerNo.trim()) {
      return;
    }
    notify.success("Submitted", `Trailer ${trailerNo} submitted for gate-out workflow.`);
    setTrailerNo("");
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

            {/* Statistics Cards */}
            <header className="pt-6 pb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-5 text-white transform hover:scale-105 transition-transform duration-200">
                <p className="text-xs uppercase tracking-wider text-blue-100 font-semibold">Total Entries</p>
                <p className="text-3xl font-bold mt-2">{stats.total}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-5 text-white transform hover:scale-105 transition-transform duration-200">
                <p className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">Export</p>
                <p className="text-3xl font-bold mt-2">{stats.exportCount}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-5 text-white transform hover:scale-105 transition-transform duration-200">
                <p className="text-xs uppercase tracking-wider text-amber-100 font-semibold">Import</p>
                <p className="text-3xl font-bold mt-2">{stats.importCount}</p>
              </div>
            </header>

            {/* Trailer Gate Out Form */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden mb-6">
              <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4 flex items-center gap-3">
                <FiTruck className="text-2xl" />
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-wide">Trailer Gate Out</h2>
                  <p className="text-xs sm:text-sm text-white/80">Enter trailer number and trigger gate-out workflow</p>
                </div>
              </header>
              <div className="p-6 space-y-4">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FiTruck className="text-[#0e4a78]" />
                  Trailer No
                </label>
                <div className="flex flex-col lg:flex-row items-stretch gap-3">
                  <div className="flex flex-1 rounded-xl border-2 border-slate-300 overflow-hidden bg-white focus-within:border-[#0e4a78] focus-within:ring-2 focus-within:ring-[#0e4a78]/20 transition-all">
                    <input
                      value={trailerNo}
                      onChange={(event) => setTrailerNo(event.target.value.toUpperCase())}
                      placeholder="Enter trailer number"
                      className="flex-1 px-4 py-3 text-base text-slate-800 focus:outline-none"
                    />
                    {trailerNo && (
                      <button
                        type="button"
                        onClick={() => setTrailerNo("")}
                        className="px-4 border-l border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                      >
                        <FiX />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleTrailerSubmit}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Submit
                  </button>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setTrailerNo("")}
                    className="px-6 py-2.5 rounded-xl border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleTrailerSubmit}
                    className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                  >
                    Trailer Out
                  </button>
                </div>
              </div>
            </section>

            {/* Gate Out Register Table */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-4 sm:px-6 py-4 sm:py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
                    <FiPackage className="text-2xl" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-wide">
                      Trailer Gate-Out Register
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
                      placeholder="Search trailer, container, line..."
                      className="w-full rounded-xl border border-white/20 bg-white/15 pl-12 pr-4 py-3 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/40"
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
                          <span className="font-mono tracking-wide">{record.outContainerNo}</span>
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
                          <span className="font-semibold text-slate-900">{record.lineName}</span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          {record.gateInDate}
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-slate-700 border-r border-slate-200">
                          {record.gateOutDate}
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