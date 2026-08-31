import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiRefreshCw, FiChevronUp, FiChevronDown, FiMapPin, FiAlertCircle, FiPackage, FiDownload, FiUpload, FiBox, FiX, FiLayers, FiTruck } from "react-icons/fi";
import { FaFileExcel } from "react-icons/fa";
import Navbar from "../../../components/layout/Navbar";
import Footer from "../../../components/layout/Footer";
import { notify } from "../../../utils/notify";
import ContainerMap from "../../container/pages/ContainerMap";
import { useLazyGetContainerLiveStatusQuery, useLazySearchContainerQuery } from "../../../store/api/ymsApi";

const columns = [
  { key: "CONTAINER_NO", label: "Container No", sortable: true },
  { key: "CONTAINER_SIZE", label: "Size", sortable: true },
  { key: "CONTAINER_TYPE", label: "Type", sortable: true },
  { key: "CONTAINER_PROCESS", label: "Transaction", sortable: true },
  { key: "INVENTORY_STATUS", label: "Status", sortable: true },
  { key: "location", label: "Location", sortable: true },
  { key: "yardName", label: "Yard", sortable: true },
  { key: "GATE_IN_DATE", label: "Gate In", sortable: true },
  { key: "TOSS_IN_DATE", label: "Transaction Date", sortable: true },
  { key: "TIME_IN_YARD", label: "TAT", sortable: true },
  { key: "OFFLOAD_EQP", label: "Equipment", sortable: true },
];

const parseDateTime = (value) => {
  if (!value) return 0;
  if (String(value).includes("T")) return new Date(value).getTime();
  const [datePart, timePart] = String(value).split(" ");
  if (!datePart || !timePart) return 0;
  const [day, month, year] = datePart.split("-");
  if (!day || !month || !year) return 0;
  return new Date(`${year}-${month}-${day}T${timePart}`).getTime();
};

const getRecordId = (record) => `${record.CONTAINER_NO}-${record.INVENTORY_ID || Math.random()}`;

const fmtDate = (val) => {
  if (!val) return "-";
  const d = new Date(String(val).replace(" ", "T"));
  if (isNaN(d)) return String(val);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const LiveStatus = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [backendPagination, setBackendPagination] = useState({
    totalRecords: 0,
    totalPages: 1,
    currentPage: 1,
    pageSize: 25,
    recordsOnPage: 0,
  });
  const [totalStats, setTotalStats] = useState({
    total: 0,
    importCount: 0,
    exportCount: 0,
    emptyCount: 0,
    uccCount: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [containerNo, setContainerNo] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // Map states
  const [showMap, setShowMap] = useState(false);
  const [mapContainer, setMapContainer] = useState(null);
  const [mapAutoFocus, setMapAutoFocus] = useState(null);

  // Autocomplete states
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestionRef = useRef(null);
  const inputRef = useRef(null);

  // ✅ Live-status SP feed (GET_CONTAINERLIVESTATUS).
  // The SP returns the FULL snapshot in one call — pagination/process-filter
  // are computed client-side here for instant interaction.
  const [triggerFetch] = useLazyGetContainerLiveStatusQuery();
  const [triggerSuggestions] = useLazySearchContainerQuery();

  const allRowsRef = useRef([]);          // full snapshot from the SP
  const activeFilterRef = useRef("all");  // current process filter
  const containerFilterRef = useRef(null); // Set<containerNo> for comma-separated multi-container search, or null

  const isUCC = (r) => String(r.BLOCK_NAME || "").toUpperCase().includes("UCC");

  const computeStats = (rows) => {
    const total = rows.length;
    let importCount = 0, exportCount = 0, emptyCount = 0, uccCount = 0;
    for (const r of rows) {
      const p = String(r.CONTAINER_PROCESS || "").toLowerCase();
      if (isUCC(r)) uccCount++;
      else if (p === "import") importCount++;
      else if (p === "export") exportCount++;
      else if (p === "empty") emptyCount++;
    }
    return { total, importCount, exportCount, emptyCount, uccCount };
  };

  const applyClientSlice = (page, size, processType, containerFilterSet = null) => {
    const all = allRowsRef.current;
    let filtered = processType === "all"
      ? all
      : processType === "Domestic"
        ? all.filter((r) => isUCC(r))
        : all.filter((r) => String(r.CONTAINER_PROCESS || "").toLowerCase() === String(processType).toLowerCase());

    if (containerFilterSet && containerFilterSet.size > 0) {
      filtered = filtered.filter((r) => containerFilterSet.has(String(r.CONTAINER_NO || "").toUpperCase()));
    }

    const totalRecords = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / size));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * size;
    const slice = filtered.slice(start, start + size).map((item) => ({
      ...item,
      location: item.MASTERTABLE || item.LOCATION_NAME || item.YARD_LOC || "",
      yardName: item.MASTERTABLE || item.YARD_NAME || "",
      transactionDate: item.TOSS_IN_DATE || item.LAST_MOVED_DATE || "",
      CONTAINER_PROCESS: item.CONTAINER_PROCESS || "",
    }));

    setRecords(slice);
    setBackendPagination({
      totalRecords,
      totalPages,
      currentPage: safePage,
      pageSize: size,
      recordsOnPage: slice.length,
    });
  };

  // Shared helper: stores the full snapshot, refreshes stats, slices for view.
  const processApiResponse = useCallback((apiData, page, size, updateStats = true) => {
    const all = Array.isArray(apiData?.data) ? apiData.data : [];
    allRowsRef.current = all;
    if (updateStats) setTotalStats(computeStats(all));
    applyClientSlice(page, size, activeFilterRef.current, containerFilterRef.current);
  }, []);


  // Pull the full live snapshot from GET_CONTAINERLIVESTATUS.
  // `searchTerm` is forwarded to the SP for server-side filtering.
  const fetchData = useCallback(
    async (page = null, size = null, searchTerm = null) => {
      setLoading(true);
      setError(null);
      try {
        const term = searchTerm !== null ? searchTerm : search;
        const result = await triggerFetch(term || "").unwrap();

        if (result?.status === "success") {
          activeFilterRef.current = "all";
          containerFilterRef.current = null;
          processApiResponse(
            result,
            page || backendPagination.currentPage,
            size || backendPagination.pageSize,
            true
          );
          setError(null);
        } else {
          setRecords([]);
          allRowsRef.current = [];
        }
      } catch (err) {
        const errorMsg = err?.data?.detail || err?.message || "Network error occurred";
        setError(errorMsg);
        notify.error("Error", `Failed to fetch data: ${errorMsg}`);
        setRecords([]);
        allRowsRef.current = [];
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backendPagination.currentPage, backendPagination.pageSize, search, triggerFetch, processApiResponse]
  );

  // Process-type filter — pure client-side over the cached snapshot
  const fetchDataByProcess = useCallback(
    (processType, page = 1, size = null) => {
      activeFilterRef.current = processType;
      applyClientSlice(page, size || backendPagination.pageSize, processType, containerFilterRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backendPagination.pageSize]
  );

  // Autocomplete: GET_ALL_YARDINVENTORY_LIST (same SP used by Inventory
  // Mapping's suggestion box), not the full live-status feed — lighter and
  // purpose-built for container-number lookup.
  const fetchSuggestions = useCallback(
    async (searchTerm) => {
      if (!searchTerm || searchTerm.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      setLoadingSuggestions(true);
      try {
        const result = await triggerSuggestions(searchTerm.trim()).unwrap();
        if (result?.status === "success") {
          const unique = [...new Set((result.data || []).map((item) => item.Cont_No))]
            .filter(Boolean)
            .slice(0, 10);
          setSuggestions(unique);
          setShowSuggestions(unique.length > 0);
        }
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoadingSuggestions(false);
      }
    },
    [triggerSuggestions]
  );

  // Initial load
  useEffect(() => {
    fetchData(1, backendPagination.pageSize, "");
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== undefined) {
        fetchData(1, backendPagination.pageSize, search);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [search]);

  // Debounced suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerNo) {
        fetchSuggestions(containerNo);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [containerNo, fetchSuggestions]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionRef.current && !suggestionRef.current.contains(event.target) &&
        inputRef.current && !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    } else if (sortConfig.key === key && sortConfig.direction === "desc") {
      setSortConfig({ key: null, direction: null });
      return;
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredRecords = useMemo(() => {
    let result = [...records];
    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (String(sortConfig.key).includes("DATE")) {
          return sortConfig.direction === "asc"
            ? parseDateTime(aValue) - parseDateTime(bValue)
            : parseDateTime(bValue) - parseDateTime(aValue);
        }
        if (["CONTAINER_SIZE", "TIME_IN_YARD"].includes(sortConfig.key)) {
          const numA = parseFloat(aValue) || 0;
          const numB = parseFloat(bValue) || 0;
          return sortConfig.direction === "asc" ? numA - numB : numB - numA;
        }
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [records, sortConfig]);

  const handleKeyDown = (e) => {
    if (!showSuggestions) {
      if (e.key === "Enter") handleContainerSubmit();
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
          handleSuggestionClick(suggestions[selectedSuggestionIndex]);
        } else {
          handleContainerSubmit();
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleSuggestionClick = (selectedContainer) => {
    setContainerNo(selectedContainer);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    containerFilterRef.current = null;
    setSearch(selectedContainer);
    notify.success("Selected", `Searching for container ${selectedContainer}`);
  };

  const handleRefresh = async () => {
    setContainerNo("");
    containerFilterRef.current = null;
    setSearch("");
    setFilter("all");
    setSortConfig({ key: null, direction: null });
    await fetchData(1, backendPagination.pageSize, "");
    if (!error) notify.success("Refreshed", "Data refreshed successfully!");
  };

  const handleExport = () => {
    const all = allRowsRef.current;
    const source = filter === "all"
      ? all
      : all.filter((r) => String(r.CONTAINER_PROCESS || "").toLowerCase() === filter.toLowerCase());
    if (source.length === 0) {
      notify.warning("No Data", "No records to export");
      return;
    }
    const exportData = source.map((record) => ({
      "Container No":     record.CONTAINER_NO,
      "Container Size":   record.CONTAINER_SIZE,
      "Container Type":   record.CONTAINER_TYPE,
      "Transaction Type": record.CONTAINER_PROCESS,
      "Container Status": record.INVENTORY_STATUS,
      "Location":         record.MASTERTABLE || record.LOCATION_NAME || "",
      "Yard Name":        record.MASTERTABLE || record.YARD_NAME || "",
      "Gate In Date":     fmtDate(record.GATE_IN_DATE),
      "Transaction Date": fmtDate(record.TOSS_IN_DATE || record.LAST_MOVED_DATE || ""),
      "Gate In TAT":      record.TIME_IN_YARD,
      "Equipment Name":   record.OFFLOAD_EQP,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Container Inventory");
    const timestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `container-inventory-${filter}-${timestamp}.xlsx`);
    notify.success("Exported", `${source.length} records exported`);
  };

  const handleContainerSubmit = async () => {
    if (!containerNo.trim()) {
      notify.warning("Required", "Please enter a container number");
      return;
    }
    setShowSuggestions(false);

    const terms = containerNo
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    if (terms.length > 1) {
      // Multi-container search: filter client-side over the full in-yard
      // snapshot (the SP's @SearchFor is a single-term filter, not comma-aware).
      containerFilterRef.current = new Set(terms);
      activeFilterRef.current = "all";
      setFilter("all");
      setSearch("");
      if (allRowsRef.current.length === 0) {
        await fetchData(1, backendPagination.pageSize, "");
      }
      applyClientSlice(1, backendPagination.pageSize, "all", containerFilterRef.current);
      notify.success("Searching", `Searching for ${terms.length} containers...`);
    } else {
      containerFilterRef.current = null;
      setSearch(containerNo.trim());
      notify.success("Searching", `Searching for container ${containerNo}...`);
    }
  };

  const handleShowMap = () => {
    if (!containerNo.trim()) {
      notify.warning("Container Required", "Enter container number(s) to view on map.");
      return;
    }
    const containerNumbers = containerNo
      .split(",")
      .map((num) => num.trim().toUpperCase())
      .filter((num) => num.length > 0);

    const foundContainers = containerNumbers
      .map((num) => records.find((record) => record.CONTAINER_NO === num))
      .filter(Boolean);

    if (foundContainers.length === 0) {
      notify.warning("Not Found", `No containers found matching: ${containerNumbers.join(", ")}`);
      return;
    }
    if (foundContainers.length !== containerNumbers.length) {
      const notFound = containerNumbers.filter((num) => !foundContainers.find((c) => c.CONTAINER_NO === num));
      notify.warning("Partial Match", `Found ${foundContainers.length}/${containerNumbers.length}. Not found: ${notFound.join(", ")}`);
    } else {
      notify.success("Found", `Showing ${foundContainers.length} container(s) on map`);
    }
    setMapContainer(foundContainers);
    setShowMap(true);
  };

  const handleStatCardClick = (value) => {
    setFilter(value);
    if (value === "all") {
      fetchData(1, backendPagination.pageSize, search);
    } else {
      fetchDataByProcess(value, 1, backendPagination.pageSize);
    }
  };

  const handleShowMapForRecord = (record) => {
    setMapContainer([record]);
    setMapAutoFocus(record.CONTAINER_NO);
    setShowMap(true);
    notify.success("Map", `Locating ${record.CONTAINER_NO} on map`);
  };

  const handleCloseMap = () => {
    setShowMap(false);
    setMapContainer(null);
    setMapAutoFocus(null);
  };

  // Page / size changes are pure client slicing — no server hit.
  const handlePageChange = (newPage) => {
    applyClientSlice(newPage, backendPagination.pageSize, activeFilterRef.current, containerFilterRef.current);
  };

  const handlePageSizeChange = (newSize) => {
    applyClientSlice(1, newSize, activeFilterRef.current, containerFilterRef.current);
  };

  return (
    <div
      className="w-full h-screen flex flex-col relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        <Navbar />

        <main className="flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-4 lg:px-8 pb-10">
          {showMap && (
            <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full h-full max-w-[1500px] max-h-[92vh] ring-1 ring-slate-200">
                <ContainerMap containerNo={mapContainer} onClose={handleCloseMap} autoFocusContainer={mapAutoFocus} />
              </div>
            </div>
          )}

          <div className="w-full">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6 mt-8 shadow-md">
                <div className="flex items-start gap-3">
                  <FiAlertCircle className="text-red-600 text-xl flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-800 font-semibold">Error Loading Data</p>
                    <p className="text-red-600 text-sm mt-1">{error}</p>
                  </div>
                  <button
                    onClick={() => fetchData()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Header bar */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible mb-5 mt-8">
              <div className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-6 py-4 rounded-t-2xl">
                <h2 className="text-lg sm:text-xl font-semibold tracking-wide">Container Live Status</h2>
                <p className="text-[11px] sm:text-xs text-white/70 mt-0.5">
                  Search a container to trigger live telemetry and zoom the map to its slot
                </p>
              </div>

              {/* Search row */}
              <div className="px-6 py-5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Container No
                </label>
                <div className="mt-2 flex flex-col lg:flex-row gap-3">
                  <div className="relative flex-1">
                    <div className="flex items-center rounded-xl border border-slate-300 bg-white focus-within:border-[#0e4a78] focus-within:ring-2 focus-within:ring-[#0e4a78]/15 transition">
                      <FiSearch className="ml-3 text-slate-400 text-base" />
                      <input
                        ref={inputRef}
                        value={containerNo}
                        onChange={(e) => setContainerNo(e.target.value.toUpperCase())}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                          if (suggestions.length > 0) setShowSuggestions(true);
                        }}
                        placeholder="Enter container number(s) — comma separated"
                        className="flex-1 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 bg-transparent focus:outline-none"
                        autoComplete="off"
                      />
                      {containerNo && (
                        <button
                          type="button"
                          onClick={() => {
                            setContainerNo("");
                            setSuggestions([]);
                            setShowSuggestions(false);
                            containerFilterRef.current = null;
                            setSearch("");
                            setFilter("all");
                            fetchData(1, backendPagination.pageSize, "");
                          }}
                          className="px-2.5 text-slate-400 hover:text-[#0e4a78] transition"
                          title="Clear"
                        >
                          <FiX />
                        </button>
                      )}
                    </div>

                    {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
                      <div
                        ref={suggestionRef}
                        className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-[200] max-h-72 overflow-y-auto ring-1 ring-slate-100"
                      >
                        {loadingSuggestions ? (
                          <div className="px-4 py-3 text-center text-slate-500 text-sm">
                            <FiRefreshCw className="animate-spin inline mr-2" />
                            Loading suggestions…
                          </div>
                        ) : (
                          <>
                            <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
                              {suggestions.length} match{suggestions.length === 1 ? "" : "es"}
                            </p>
                            {suggestions.map((containerNumber, index) => (
                              <div
                                key={`${containerNumber}-${index}`}
                                onClick={() => handleSuggestionClick(containerNumber)}
                                className={`px-4 py-2.5 cursor-pointer transition border-b border-slate-100 last:border-b-0 ${
                                  index === selectedSuggestionIndex ? "bg-[#0e4a78] text-white" : "hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <FiMapPin
                                    className={`text-sm flex-shrink-0 ${
                                      index === selectedSuggestionIndex ? "text-white" : "text-slate-400"
                                    }`}
                                  />
                                  <span
                                    className={`font-mono text-sm font-semibold ${
                                      index === selectedSuggestionIndex ? "text-white" : "text-slate-900"
                                    }`}
                                  >
                                    {containerNumber}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleContainerSubmit}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0e4a78] text-white font-semibold text-sm shadow-sm hover:bg-[#0a3b61] transition"
                    >
                      <FiSearch /> Submit
                    </button>
                    <button
                      type="button"
                      onClick={handleShowMap}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-[#0e4a78] font-semibold text-sm hover:bg-blue-50 hover:border-[#0e4a78]/40 transition"
                    >
                      <FiMapPin /> Show on Map
                    </button>
                  </div>
                </div>
              </div>

              {/* Stat strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 border-t border-slate-200 rounded-b-2xl overflow-hidden">
                <StatTile
                  label="Total Inventory"
                  value={totalStats.total}
                  icon={FiPackage}
                  tone="slate"
                  isActive={filter === "all"}
                  onClick={() => handleStatCardClick("all")}
                  total={totalStats.total}
                />
                <StatTile
                  label="Import"
                  value={totalStats.importCount}
                  icon={FiDownload}
                  tone="emerald"
                  isActive={filter === "Import"}
                  onClick={() => handleStatCardClick("Import")}
                  total={totalStats.total}
                />
                <StatTile
                  label="Export"
                  value={totalStats.exportCount}
                  icon={FiUpload}
                  tone="amber"
                  isActive={filter === "Export"}
                  onClick={() => handleStatCardClick("Export")}
                  total={totalStats.total}
                />
                <StatTile
                  label="Empty"
                  value={totalStats.emptyCount}
                  icon={FiBox}
                  tone="slate"
                  isActive={filter === "Empty"}
                  onClick={() => handleStatCardClick("Empty")}
                  total={totalStats.total}
                />
                <StatTile
                  label="UCC"
                  value={totalStats.uccCount}
                  icon={FiTruck}
                  tone="violet"
                  isActive={filter === "Domestic"}
                  onClick={() => handleStatCardClick("Domestic")}
                  total={totalStats.total}
                />
              </div>
            </section>

            {/* Table Card */}
            <section className="bg-white/95 rounded-2xl shadow-xl border border-slate-300 overflow-hidden">
              <header className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] text-white px-4 sm:px-6 py-4 sm:py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/15 flex items-center justify-center">
                    <FaFileExcel className="text-xl sm:text-2xl" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-wide">
                      {filter === "Domestic" ? "UCC Containers" : filter !== "all" ? `${filter} Containers` : "All Containers"} (
                      <span className="text-emerald-200">{backendPagination.totalRecords}</span>)
                    </h2>
                    <p className="text-xs sm:text-sm text-white/80">
                      Showing page {backendPagination.currentPage} of {backendPagination.totalPages}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 transition text-white font-semibold border border-white/30 text-sm disabled:opacity-50"
                  >
                    <FiRefreshCw className={loading ? "animate-spin" : ""} /> Clear
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={loading || sortedAndFilteredRecords.length === 0}
                    className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 transition text-white font-semibold shadow-md text-sm disabled:opacity-50"
                  >
                    <FaFileExcel /> Export
                  </button>
                </div>
              </header>

              <div className="overflow-auto">
                <table className="min-w-full text-xs md:text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                      {columns.map((column) => (
                        <th
                          key={column.key}
                          className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] border-r border-slate-200 last:border-r-0 ${column.sortable ? "cursor-pointer hover:bg-slate-200/70" : ""}`}
                          onClick={() => column.sortable && handleSort(column.key)}
                        >
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            {column.label}
                            {column.sortable && (
                              <div className="flex flex-col">
                                <FiChevronUp className={`w-3 h-3 ${sortConfig.key === column.key && sortConfig.direction === "asc" ? "text-[#0e4a78]" : "text-slate-400"}`} />
                                <FiChevronDown className={`w-3 h-3 -mt-1 ${sortConfig.key === column.key && sortConfig.direction === "desc" ? "text-[#0e4a78]" : "text-slate-400"}`} />
                              </div>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-3">
                            <FiRefreshCw className="animate-spin text-3xl text-[#0e4a78]" />
                            <span className="text-lg font-medium">Loading containers...</span>
                          </div>
                        </td>
                      </tr>
                    ) : sortedAndFilteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} className="px-4 py-12 text-center">
                          <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <FiSearch className="text-3xl text-slate-400" />
                          </div>
                          <p className="text-slate-500 text-lg font-medium">
                            {search ? `No containers found matching "${search}"` : filter !== "all" ? `No ${filter} containers found` : "No containers found"}
                          </p>
                          <p className="text-slate-400 mt-2">
                            {search ? "Try a different search term" : "Adjust your filters or refresh the data"}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      sortedAndFilteredRecords.map((record, idx) => {
                        const process = String(record.CONTAINER_PROCESS || "").toLowerCase();
                        const processBadge =
                          process === "import" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : process === "export" ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                          : process === "empty"  ? "bg-slate-100 text-slate-700 ring-slate-500/20"
                          : "bg-slate-50 text-slate-600 ring-slate-300";
                        const statusBadge =
                          record.INVENTORY_STATUS === "Active"
                            ? "bg-emerald-100 text-emerald-800 ring-emerald-600/20"
                            : record.INVENTORY_STATUS === "Hold"
                            ? "bg-rose-100 text-rose-800 ring-rose-600/20"
                            : "bg-slate-100 text-slate-800 ring-slate-500/20";
                        return (
                          <tr
                            key={getRecordId(record)}
                            className={`transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-blue-50`}
                          >
                            <td className="px-4 py-2.5 text-slate-700 border-r border-slate-200">
                              <span className="font-mono font-semibold text-slate-900 tracking-tight">{record.CONTAINER_NO}</span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-700 border-r border-slate-200">{record.CONTAINER_SIZE} ft</td>
                            <td className="px-4 py-2.5 text-slate-700 border-r border-slate-200">{record.CONTAINER_TYPE || "-"}</td>
                            <td className="px-4 py-2.5 border-r border-slate-200">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${processBadge}`}>
                                {record.CONTAINER_PROCESS || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 border-r border-slate-200">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${statusBadge}`}>
                                {record.INVENTORY_STATUS || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 border-r border-slate-200 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#0e4a78]" />
                                <span className="font-medium text-slate-800">{record.location || "-"}</span>
                                {record.CONTAINER_NO && (
                                  <button
                                    onClick={() => handleShowMapForRecord(record)}
                                    title="Show on Map"
                                    className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20"
                                  >
                                    <FiMapPin className="w-3 h-3" />Map
                                  </button>
                                )}
                                {record.location && record.location !== "-" && record.CONTAINER_NO && (
                                  <button
                                    onClick={() => navigate(`/dashboard/3d-visualization?highlight=${encodeURIComponent(record.CONTAINER_NO)}`)}
                                    title="View in 3D Yard"
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0e4a78]/10 text-[#0e4a78] hover:bg-[#0e4a78] hover:text-white transition-all border border-[#0e4a78]/20"
                                  >
                                    <FiLayers className="w-3 h-3" />3D
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-slate-700 border-r border-slate-200">{record.yardName || "-"}</td>
                            <td className="px-4 py-2.5 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                              {fmtDate(record.GATE_IN_DATE)}
                            </td>
                            <td className="px-4 py-2.5 text-slate-700 border-r border-slate-200 whitespace-nowrap">{fmtDate(record.transactionDate)}</td>
                            <td className="px-4 py-2.5 text-slate-700 border-r border-slate-200 whitespace-nowrap">{record.TIME_IN_YARD || "-"}</td>
                            <td className="px-4 py-2.5 text-slate-700">{record.OFFLOAD_EQP || "-"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer / Pagination */}
              <footer className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-slate-200 text-xs sm:text-sm text-slate-600">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      Showing <strong className="text-[#0e4a78]">{sortedAndFilteredRecords.length}</strong> of{" "}
                      <strong className="text-[#0e4a78]">{backendPagination.totalRecords}</strong>{" "}
                      {filter !== "all" ? filter : "total"} records (Page{" "}
                      <strong>{backendPagination.currentPage}</strong> of{" "}
                      <strong>{backendPagination.totalPages}</strong>)
                      {sortConfig.key && sortConfig.direction && (
                        <span className="ml-3">
                          | Sorted by: <strong className="text-[#0e4a78]">{sortConfig.key}</strong> ({sortConfig.direction})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6">
                      <LegendDot color="bg-emerald-500" label="Import" />
                      <LegendDot color="bg-amber-500" label="Export" />
                      <LegendDot color="bg-slate-500" label="Empty" />
                      <LegendDot color="bg-violet-500" label="UCC" />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600">Show:</span>
                      <select
                        value={backendPagination.pageSize}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        disabled={loading}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0e4a78] disabled:opacity-50"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                      </select>
                      <span className="text-slate-600">per page</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePageChange(backendPagination.currentPage - 1)}
                        disabled={backendPagination.currentPage === 1 || loading}
                        className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                          backendPagination.currentPage === 1 || loading
                            ? "text-slate-400 cursor-not-allowed bg-slate-100"
                            : "text-[#0e4a78] hover:bg-blue-50"
                        }`}
                      >
                        Previous
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">Page</span>
                        <input
                          type="number"
                          min={1}
                          max={backendPagination.totalPages}
                          value={backendPagination.currentPage}
                          onChange={(e) => {
                            const page = Math.max(1, Math.min(backendPagination.totalPages, Number(e.target.value) || 1));
                            handlePageChange(page);
                          }}
                          disabled={loading}
                          className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-[#0e4a78] disabled:opacity-50"
                        />
                        <span className="text-slate-600">of {backendPagination.totalPages}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePageChange(backendPagination.currentPage + 1)}
                        disabled={backendPagination.currentPage === backendPagination.totalPages || loading}
                        className={`px-4 py-2 rounded-lg border border-slate-300 font-semibold transition ${
                          backendPagination.currentPage === backendPagination.totalPages || loading
                            ? "text-slate-400 cursor-not-allowed bg-slate-100"
                            : "text-[#0e4a78] hover:bg-blue-50"
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </footer>
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
};

const TONE_MAP = {
  slate:   { accent: "#0e4a78", iconColor: "text-[#0e4a78]",   iconBg: "bg-[#0e4a78]/10", valueColor: "text-[#0e4a78]",   badgeBg: "bg-[#0e4a78]/8",  activeBg: "bg-[#0e4a78]"   },
  emerald: { accent: "#059669", iconColor: "text-emerald-600", iconBg: "bg-emerald-50",    valueColor: "text-emerald-700", badgeBg: "bg-emerald-50",   activeBg: "bg-emerald-600" },
  amber:   { accent: "#d97706", iconColor: "text-amber-600",   iconBg: "bg-amber-50",      valueColor: "text-amber-700",   badgeBg: "bg-amber-50",     activeBg: "bg-amber-500"   },
  violet:  { accent: "#7c3aed", iconColor: "text-violet-600",  iconBg: "bg-violet-50",     valueColor: "text-violet-700",  badgeBg: "bg-violet-50",    activeBg: "bg-violet-600"  },
};

const StatTile = ({ label, value, icon: Icon, tone = "slate", isActive, onClick, total }) => {
  const t = TONE_MAP[tone] || TONE_MAP.slate;
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left transition-all duration-150 overflow-hidden border-r border-slate-200 last:border-r-0
        ${isActive ? "bg-slate-50" : "bg-white hover:bg-slate-50/70"}`}
    >
      {/* Active left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-150"
        style={{ background: isActive ? t.accent : "transparent" }}
      />

      <div className="pl-4 pr-4 py-3.5 flex items-center gap-3.5">
        {/* Icon badge */}
        <span
          className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${
            isActive ? `${t.activeBg} text-white` : `${t.iconBg} ${t.iconColor}`
          } transition-all duration-150`}
        >
          {Icon && <Icon className="text-[15px]" />}
        </span>

        {/* Text block */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400 leading-none mb-1.5 truncate">
            {label}
          </p>
          <p
            className={`text-2xl font-black leading-none tracking-tight transition-colors ${
              isActive ? t.valueColor : "text-slate-700"
            }`}
          >
            {value}
          </p>
        </div>

        {/* Percentage pill — only for non-total tiles */}
        {total > 0 && tone !== "slate" && (
          <span
            className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.badgeBg} transition-colors`}
            style={{ color: t.accent }}
          >
            {pct}%
          </span>
        )}
      </div>

      {/* Bottom progress line — always rendered so tile heights stay aligned */}
      <div className="h-[2px] bg-slate-100">
        {total > 0 && tone !== "slate" && (
          <div
            className="h-full transition-all duration-700 rounded-full"
            style={{ width: `${pct}%`, background: t.accent }}
          />
        )}
      </div>
    </button>
  );
};

const LegendDot = ({ color, label }) => (
  <div className="flex items-center gap-2 text-slate-700">
    <span className={`w-3 h-3 rounded-full ${color} border border-white shadow`} />
    {label}
  </div>
);

export default LiveStatus;