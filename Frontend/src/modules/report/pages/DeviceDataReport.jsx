import React, { useMemo, useState, useEffect, useRef } from "react";
import { FiSearch, FiCalendar, FiFilter, FiX, FiChevronUp, FiChevronDown, FiZoomIn, FiTag, FiMapPin, FiTruck, FiCheck } from "react-icons/fi";
// import { SiMicrosoftexcel } from 'react-icons/si';
import Navbar from "../../../components/layout/Navbar";
import {
  useGetEquipmentQuery,
  useLazyGetDeviceLockReportQuery,
  useLazySearchContainerQuery,
  useUpdateDeviceDataContainerMutation,
} from "../../../store/api/ymsApi";
import Swal from "sweetalert2";

const DeviceDataReport = () => {
  const [zoomedImage, setZoomedImage] = useState(null);
  // Stores selected DEVICE_ID values (so we can query the transaction table directly)
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [searchMachine, setSearchMachine] = useState("");
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);
  const eqpDropdownRef = useRef(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [sortConfig, setSortConfig] = useState({ key: "TRANSACTION DATETIME", direction: "desc" });

  const handleSort = (label) => {
    if (label === "SR NO." || label === "Action") return;
    let direction = "asc";
    if (sortConfig.key === label && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key: label, direction });
  };
  const [searchTable, setSearchTable] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [deviceRows, setDeviceRows] = useState([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [selectedImageRow, setSelectedImageRow] = useState(null);
  const [updateContainerNo, setUpdateContainerNo] = useState("");
  const [containerSuggestions, setContainerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [searchContainer] = useLazySearchContainerQuery();
  const [updateDeviceContainer] = useUpdateDeviceDataContainerMutation();

  const AWS_IMAGE_PATH =
    "https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr";
  // Backend returns bare filenames (e.g. <DeviceID>_<ddMMyyyyHHmmss>_camN_1.jpg) — build the full URL
  const imgUrl = (name) => (name ? `${AWS_IMAGE_PATH}/${name}` : "");
  // The actually-captured frame varies (_1/_2/_3), so build all three candidates to fall back through
  const camSrcs = (name, camN) => {
    const clean = name?.trim();
    if (!clean) return [];
    const re = new RegExp(`_cam${camN}_1\\.jpg$`, "i");
    return [1, 2, 3].map((f) => imgUrl(clean.replace(re, `_cam${camN}_${f}.jpg`)));
  };

  const { data: equipmentApi } = useGetEquipmentQuery(undefined, {
    pollingInterval: 15000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const [
    fetchDeviceData,
    {
      data: reportApiData,
      isLoading: reportApiLoading,
      isError: reportApiIsError,
      error: reportApiError,
    },
  ] = useLazyGetDeviceLockReportQuery();

  useEffect(() => {
    const rows = Array.isArray(reportApiData?.data) ? reportApiData.data : [];
    setDeviceRows(rows);
    setDeviceLoading(!!reportApiLoading);

    if (reportApiIsError) {
      const message =
        reportApiError?.data?.message ||
        reportApiError?.data?.detail ||
        reportApiError?.error ||
        "Error fetching report data";
      setDeviceError(String(message));
    } else {
      setDeviceError("");
    }
  }, [reportApiData, reportApiLoading, reportApiIsError, reportApiError]);

  // Close equipment dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (eqpDropdownRef.current && !eqpDropdownRef.current.contains(e.target)) {
        setShowMachineDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const allMachines = useMemo(() => {
    const rows = Array.isArray(equipmentApi?.data) ? equipmentApi.data : [];
    return rows
      .map((item, index) => {
        const name =
          item?.Equipment_Code ??
          item?.equipment_code ??
          item?.EQUIPMENT_CODE ??
          item?.Equipment_Name ??
          item?.equipment_name ??
          item?.EQUIPMENT_NAME ??
          item?.eqp ??
          item?.EQP ??
          `EQP-${index + 1}`;

        const cleanName = String(name ?? "").trim();
        if (!cleanName) return null;

        const id =
          item?.Eqp_ID ?? item?.eqp_id ?? item?.ID ?? item?.id ?? index + 1;

        const deviceId =
          item?.Device_ID ?? item?.device_id ?? item?.DEVICE_ID ?? null;
        const cleanDeviceId = String(deviceId ?? "").trim();
        if (!cleanDeviceId) return null;

        return { id, name: cleanName, deviceId: cleanDeviceId };
      })
      .filter(Boolean);
  }, [equipmentApi]);

  const filteredMachines = allMachines.filter((m) =>
    m.name.toLowerCase().includes(searchMachine.toLowerCase()),
  );

  const toggleMachine = (deviceId) => {
    setSelectedMachines((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId],
    );
  };

  const selectAllMachines = () => {
    if (selectedMachines.length === allMachines.length) {
      setSelectedMachines([]);
    } else {
      setSelectedMachines(allMachines.map((m) => m.deviceId));
    }
  };

  const handleFilter = () => {
    const equipment_names = selectedMachines.join(",");
    fetchDeviceData({
      equipment_names: equipment_names || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      report_type: selectedType || "All",
      location: selectedLocation === "All" ? "" : selectedLocation,
    });
    setShowResults(true);
  };

  // Auto-show results when data arrives even without explicit Apply Filter
  useEffect(() => {
    if (Array.isArray(reportApiData?.data) && reportApiData.data.length >= 0) {
      setShowResults(true);
    }
  }, [reportApiData]);

  const handleViewImage = (row) => {
    setSelectedImageRow(row);
    const containerNo =
      getField(
        row,
        "ContNo", "ContainerNo", "contno", "containerno",
        "RFIDDATA", "rfiddata",
      ) ?? "";
    const cleanNo = containerNo.split(" ")[0]; // SP returns ContNo like 'ABCD1234567 (EQ)'
    setUpdateContainerNo(
      cleanNo === "00000000000" || cleanNo.startsWith("0000000") ? "" : cleanNo,
    );
    setContainerSuggestions([]);
    setShowSuggestions(false);
  };

  const handleContainerChange = (e) => {
    const input = e.target;
    const cursorPos = input.selectionStart;
    const val = input.value.toUpperCase();
    if (val.length > 11) return;
    setUpdateContainerNo(val);
    // Restore cursor after state update
    requestAnimationFrame(() => {
      input.setSelectionRange(cursorPos, cursorPos);
    });
    if (val.length >= 1) {
      searchContainer(val)
        .unwrap()
        .then((res) => {
          setContainerSuggestions(res?.data || res || []);
          setShowSuggestions(true);
        })
        .catch(() => setContainerSuggestions([]));
    } else {
      setContainerSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (container) => {
    // Assuming container is a string or object with CONTAINER_NO
    const no =
      typeof container === "string"
        ? container
        : container?.Cont_No || container?.cont_no || container?.CONTAINER_NO || container?.container_no || "";
    setUpdateContainerNo(no);
    setShowSuggestions(false);
  };

  const handleUpdateContainer = async () => {
    if (!updateContainerNo || updateContainerNo.trim() === '') {
      Swal.fire(
        "Warning",
        "Please enter a container number.",
        "warning",
      );
      return;
    }

    if (updateContainerNo.length !== 11) {
      Swal.fire(
        "Warning",
        "Container number must be exactly 11 characters long.",
        "warning",
      );
      return;
    }

    try {
      const transactionId = getField(selectedImageRow, "DeviceTransID", "EqpTransID", "devicetransid", "eqptransid");
      if (!transactionId) {
        Swal.fire("Error", "Transaction ID not found for this row.", "error");
        return;
      }

      const res = await updateDeviceContainer({
        eqp_trans_id: parseInt(transactionId),
        cont_no: updateContainerNo,
      }).unwrap();

      Swal.fire(
        "Success",
        res.message || "Container updated successfully",
        "success",
      );
      setSelectedImageRow(null);
      // Refresh report data
      handleFilter();
    } catch (err) {
      console.error("Error updating container:", err);
      Swal.fire(
        "Error",
        err?.data?.message || err?.data?.detail || "Failed to update container",
        "error",
      );
    }
  };

  const formatDateTime = (dtStr) => {
    if (!dtStr || dtStr === "-") return "-";
    const d = new Date(String(dtStr).replace(" ", "T"));
    if (isNaN(d.getTime())) return dtStr;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    setSelectedType("All");
    setSelectedLocation("All");
    setSelectedMachines([]);
    setSearchMachine("");
    setSearchTable("");
    setShowResults(false);
  };

  const getField = (row, ...keys) => {
    for (const key of keys) {
      if (
        row &&
        Object.prototype.hasOwnProperty.call(row, key) &&
        row[key] != null
      )
        return row[key];
    }
    return null;
  };

  const filteredRows = useMemo(() => {
    const rows = Array.isArray(deviceRows) ? deviceRows : [];

    const missingFiltered = (() => {
      const type = String(selectedType || "All").trim();
      if (type === "All") return rows;
      return rows.filter((row) => {
        const raw = getField(
          row,
          "ContNo", "ContainerNo", "contno",
          "RFIDDATA", "rfiddata",
          "OCR_CONTAINER_NO", "ocr_container_no",
        );
        const cleanNo = String(raw ?? "").trim().split(" ")[0];
        const isMissing = cleanNo.replace(/0/g, "") === "" || cleanNo === "-";
        return type === "Missing" ? isMissing : !isMissing;
      });
    })();

    const term = String(searchTable ?? "").trim().toLowerCase();

    let finalRows = [...(term ? missingFiltered.filter((row) =>
      Object.values(row || {}).some((value) =>
        String(value ?? "").toLowerCase().includes(term),
      )
    ) : missingFiltered)];

    if (sortConfig.key) {
      finalRows.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === "TRANSACTION ID") {
          valA = Number(getField(a, "EqpTransID", "eqptransid", "Sr_No", "SR_NO", "sr_no", "TRANSACTION_ID", "transaction_id")) || 0;
          valB = Number(getField(b, "EqpTransID", "eqptransid", "Sr_No", "SR_NO", "sr_no", "TRANSACTION_ID", "transaction_id")) || 0;
        } else if (sortConfig.key === "MACHINE") {
          valA = String(getField(a, "EqpName", "eqpname", "DeviceID", "deviceid", "DEVICE_IMEI", "device_imei") || "").toLowerCase();
          valB = String(getField(b, "EqpName", "eqpname", "DeviceID", "deviceid", "DEVICE_IMEI", "device_imei") || "").toLowerCase();
        } else if (sortConfig.key === "CONTAINER NO") {
          valA = String(getField(a, "ContNo", "ContainerNo", "contno", "RFIDDATA", "rfiddata") || "").toLowerCase();
          valB = String(getField(b, "ContNo", "ContainerNo", "contno", "RFIDDATA", "rfiddata") || "").toLowerCase();
        } else if (sortConfig.key === "LOCATION") {
          valA = String(getField(a, "Location", "location", "LOCATION", "BLOCK_NAME", "block_name") || "").toLowerCase();
          valB = String(getField(b, "Location", "location", "LOCATION", "BLOCK_NAME", "block_name") || "").toLowerCase();
        } else if (sortConfig.key === "TRANSACTION DATETIME") {
          valA = getField(a, "TransDate", "transdate", "DATE_TIME", "date_time");
          valB = getField(b, "TransDate", "transdate", "DATE_TIME", "date_time");
          valA = valA ? new Date(valA).getTime() : 0;
          valB = valB ? new Date(valB).getTime() : 0;
        }

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return finalRows;
  }, [deviceRows, searchTable, selectedType, sortConfig]);

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div
        className="absolute inset-0 bg-white/65 backdrop-blur-[1px]"
        aria-hidden="true"
      ></div>

      <div className="relative z-10">
        <Navbar />

        {/* Page Header */}
        <div className="px-4 md:px-6 pt-4 md:pt-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#0e4a78]">
                Device Data Report
              </h1>
              <p className="text-gray-500 mt-1 text-sm md:text-base">
                Unlock container transactions (Import/Export filter)
              </p>
            </div>
          </div>

          {/* Filters Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 relative overflow-visible">
            {/* Accent Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#0e4a78] to-[#2fb0d2] rounded-t-xl"></div>
            
            <div className="p-5 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 items-start">
                
                {/* Type Filter */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    <FiTag className="text-[#0e4a78]" />
                    Type
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm text-slate-700 font-medium transition-all"
                  >
                    <option value="All">All Types</option>
                    <option value="Missing">Missing</option>
                    <option value="Non Missing">Non Missing</option>
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    <FiMapPin className="text-[#0e4a78]" />
                    Location
                  </label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm text-slate-700 font-medium transition-all"
                  >
                    <option value="All">All Locations</option>
                    <option value="Import">Import</option>
                    <option value="Export">Export</option>
                  </select>
                </div>

                {/* Equipment Name */}
                <div ref={eqpDropdownRef} className="relative z-20">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    <FiTruck className="text-[#0e4a78]" />
                    Equipment Name
                  </label>
                  <div
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 cursor-pointer flex items-center justify-between hover:bg-white hover:border-[#0e4a78] transition-all"
                    onClick={() => setShowMachineDropdown((v) => !v)}
                  >
                    <span className="text-sm font-medium text-slate-700 truncate mr-2">
                      {selectedMachines.length === 0
                        ? "Select Equipments"
                        : `${selectedMachines.length} Selected`}
                    </span>
                    <FiFilter className="text-slate-400 shrink-0" />
                  </div>

                  {/* Dropdown */}
                  {showMachineDropdown && (
                    <div className="absolute top-[calc(100%+0.5rem)] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col z-50 max-h-80">
                      <div className="p-2 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search..."
                            value={searchMachine}
                            onChange={(e) => setSearchMachine(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-[#0e4a78] focus:ring-1 focus:ring-[#0e4a78]/50"
                          />
                        </div>
                      </div>
                      <div className="p-2 border-b border-slate-100 bg-blue-50/30">
                        <div
                          className="flex items-center gap-2 cursor-pointer hover:bg-blue-50/50 p-1.5 rounded transition-colors select-none"
                          onClick={(e) => { e.stopPropagation(); selectAllMachines(); }}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selectedMachines.length === allMachines.length && allMachines.length > 0 ? "bg-[#0e4a78] border-[#0e4a78]" : "border-slate-300 bg-white"}`}>
                            {selectedMachines.length === allMachines.length && allMachines.length > 0 && <FiCheck className="w-2.5 h-2.5 text-white" />}
                            {selectedMachines.length > 0 && selectedMachines.length < allMachines.length && <div className="w-2 h-0.5 bg-[#0e4a78]" />}
                          </div>
                          <span className="text-sm font-semibold text-slate-700">Select All</span>
                        </div>
                      </div>
                      <div className="overflow-y-auto p-1 flex-1">
                        {filteredMachines.length > 0 ? (
                          filteredMachines.map((machine) => (
                            <div
                              key={machine.id}
                              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 rounded-md transition-colors select-none"
                              onClick={(e) => { e.stopPropagation(); toggleMachine(machine.deviceId); }}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selectedMachines.includes(machine.deviceId) ? "bg-[#0e4a78] border-[#0e4a78]" : "border-slate-300 bg-white"}`}>
                                {selectedMachines.includes(machine.deviceId) && <FiCheck className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <span className="text-sm text-slate-600 font-medium truncate">{machine.name}</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-sm text-slate-500">No equipments found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* FROM DATE */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    <FiCalendar className="text-[#0e4a78]" />
                    From Date
                  </label>
                  <input
                    type="datetime-local"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm text-slate-700 font-medium transition-all"
                  />
                </div>

                {/* TO DATE */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    <FiCalendar className="text-[#0e4a78]" />
                    To Date
                  </label>
                  <input
                    type="datetime-local"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/30 focus:border-[#0e4a78] text-sm text-slate-700 font-medium transition-all"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 mt-6 pt-5 border-t border-slate-100">
                <button
                  onClick={handleClear}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  Clear Fields
                </button>
                <button
                  onClick={handleFilter}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[#0e4a78] text-white text-sm font-semibold hover:bg-[#0b3b60] transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/50"
                >
                  <FiSearch className="w-4 h-4" />
                  Apply Filter
                </button>
              </div>
            </div>
          </div>

          {/* Results Section */}
          {showResults && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden animate-in fade-in zoom-in duration-300">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#0e4a78] via-[#0b3e66] to-[#072c4a] px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                  DEVICE DATA REPORT
                  <span className="text-xs md:text-sm font-normal text-white/80">
                    ( {filteredRows.length} )
                  </span>
                </h2>
              </div>

              {/* Search */}
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 bg-slate-50">
                <div className="relative w-full md:max-w-md">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTable}
                    onChange={(e) => setSearchTable(e.target.value)}
                    className="device-input w-full pl-10 pr-4 py-2.5 border-2 border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#0e4a78] focus:ring-2 focus:ring-[#0e4a78]/20 transition-all"
                  />
                </div>
              </div>

              {/* Table */}
              {deviceLoading ? (
                <div className="px-6 py-8 text-sm text-slate-600">
                  Loading report...
                </div>
              ) : deviceError ? (
                <div className="px-6 py-8 text-sm text-red-600">
                  {deviceError}
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm mx-3 mb-3 md:m-6 md:mt-0">
                  <table className="min-w-full divide-y divide-slate-200 text-sm device-table">
                    <thead className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] sticky top-0">
                      <tr>
                        {[
                          { label: "SR NO.", mobileHide: true },
                          { label: "TRANSACTION ID", mobileHide: true },
                          { label: "MACHINE", mobileHide: true },
                          { label: "CONTAINER NO", mobileHide: false },
                          { label: "LOCATION", mobileHide: true },
                          { label: "TRANSACTION DATETIME", mobileHide: true },
                          { label: "Action", mobileHide: false },
                        ].map(({ label, mobileHide }) => (
                          <th
                            key={label}
                            onClick={() => handleSort(label)}
                            className={`group px-4 py-3 md:px-5 md:py-4 text-left font-bold text-white uppercase tracking-wider border-r border-white/10 last:border-r-0 whitespace-nowrap ${mobileHide ? "hidden md:table-cell" : ""} ${label !== "SR NO." && label !== "Action" ? "cursor-pointer hover:bg-white/10 select-none" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{label}</span>
                              {sortConfig.key === label && label !== "SR NO." && label !== "Action" && (
                                <span className="flex flex-col text-white/80">
                                  {sortConfig.direction === "asc" ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                                </span>
                              )}
                              {sortConfig.key !== label && label !== "SR NO." && label !== "Action" && (
                                <span className="flex flex-col text-white/30 opacity-0 group-hover:opacity-100">
                                  <FiChevronUp className="w-4 h-4" />
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredRows.length > 0 ? (
                        filteredRows.map((row, index) => {
                          const srNo = index + 1;
                          const transactionId =
                            getField(row, "DeviceTransID", "EqpTransID", "devicetransid", "eqptransid") ?? "-";
                          const deviceId =
                            getField(row, "EqpName", "KalmarNo", "DeviceIMEI", "eqpname", "kalmarno", "deviceimei") ?? "-";
                          const containerNo =
                            getField(row, "ContNo", "ContainerNo", "RFIDDATA", "contno", "containerno", "rfiddata") ?? "-";
                          const location =
                            getField(row, "Location", "location") ?? "-";
                          const rawDateTime =
                            getField(row, "Date_Time", "TransDate", "date_time", "transdate") ?? "-";
                          const dateTime = formatDateTime(rawDateTime);
                          return (
                            <tr
                              key={String(index)}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="hidden md:table-cell px-5 py-4 text-slate-700 whitespace-nowrap border-r border-slate-100">
                                {srNo}
                              </td>
                              <td className="hidden md:table-cell px-5 py-4 text-slate-700 whitespace-nowrap border-r border-slate-100">
                                {transactionId}
                              </td>
                              <td className="hidden md:table-cell px-5 py-4 text-slate-700 whitespace-nowrap border-r border-slate-100">
                                {deviceId}
                              </td>
                              <td className="px-4 py-3 md:px-5 md:py-4 text-slate-700 whitespace-nowrap border-r border-slate-100 font-semibold text-sm">
                                {containerNo}
                              </td>
                              <td className="hidden md:table-cell px-5 py-4 text-slate-700 whitespace-nowrap border-r border-slate-100">
                                {location}
                              </td>
                              <td className="hidden md:table-cell px-5 py-4 text-slate-700 whitespace-nowrap border-r border-slate-100">
                                {dateTime}
                              </td>
                              <td className="px-3 py-3 md:px-5 md:py-4 text-center whitespace-nowrap">
                                <button
                                  onClick={() => handleViewImage(row)}
                                  className="px-3 py-2 bg-[#0e4a78] text-white text-xs font-semibold rounded-lg shadow hover:bg-[#0b3e66] transition-colors flex items-center gap-1.5 mx-auto"
                                >
                                  <FiZoomIn className="w-3.5 h-3.5" />
                                  <span>View</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-6 py-10 text-center text-slate-500"
                          >
                            No data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      {selectedImageRow && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedImageRow(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h3 className="text-base md:text-lg font-bold text-slate-800">
                Container Details
              </h3>
              <button
                onClick={() => setSelectedImageRow(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 items-start">
              {/* Images Section */}
              <div className="w-full md:w-1/2 flex flex-col gap-4">
                {/* Image 1 */}
                <div className="group w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 aspect-video flex items-center justify-center relative">
                  {(() => {
                    const srcs = camSrcs(selectedImageRow.CameraImage1 || selectedImageRow.cameraimage1, 1);
                    return (
                      <img
                        src={srcs[0] || "/Images/placeholder-image.png"}
                        alt="Container View 1"
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={(e) => setZoomedImage(e.target.src)}
                        onError={(e) => {
                          const next = Number(e.target.dataset.i || 0) + 1;
                          if (next < srcs.length) {
                            e.target.dataset.i = String(next);
                            e.target.src = srcs[next];
                          } else {
                            e.target.onerror = null;
                            e.target.src = "/Images/placeholder-image.png";
                          }
                        }}
                      />
                    );
                  })()}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full text-white">
                      <FiZoomIn size={24} />
                    </div>
                  </div>
                </div>
                {/* Image 2 */}
                <div className="group w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 aspect-video flex items-center justify-center relative">
                  {(() => {
                    const srcs = camSrcs(selectedImageRow.CameraImage2 || selectedImageRow.cameraimage2, 2);
                    return (
                      <img
                        src={srcs[0] || "/Images/placeholder-image.png"}
                        alt="Container View 2"
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={(e) => setZoomedImage(e.target.src)}
                        onError={(e) => {
                          const next = Number(e.target.dataset.i || 0) + 1;
                          if (next < srcs.length) {
                            e.target.dataset.i = String(next);
                            e.target.src = srcs[next];
                          } else {
                            e.target.onerror = null;
                            e.target.src = "/Images/placeholder-image.png";
                          }
                        }}
                      />
                    );
                  })()}
                </div>
              </div>

              {/* Update Section */}
              <div className="w-full md:w-1/2 flex flex-col gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-500 uppercase mb-3">
                    Current Data
                  </h4>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-slate-500">Transaction ID:</span>
                    <span className="font-medium text-slate-800">
                      {getField(selectedImageRow, "DeviceTransID", "EqpTransID", "devicetransid") ?? "-"}
                    </span>
                    <span className="text-slate-500">Machine:</span>
                    <span className="font-medium text-slate-800">
                      {getField(selectedImageRow, "EqpName", "KalmarNo", "DeviceIMEI", "eqpname", "kalmarno") ?? "-"}
                    </span>
                    <span className="text-slate-500">Date Time:</span>
                    <span className="font-medium text-slate-800">
                      {formatDateTime(getField(selectedImageRow, "Date_Time", "TransDate", "date_time")) ?? "-"}
                    </span>
                  </div>
                </div>

                <div className="mt-2 relative">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Update Container No
                    </label>
                    <span className={`text-xs font-medium ${updateContainerNo.length === 11 ? 'text-green-600' : 'text-slate-400'}`}>
                      {updateContainerNo.length}/11
                    </span>
                  </div>
                  <input
                    type="text"
                    value={updateContainerNo}
                    onChange={handleContainerChange}
                    maxLength={11}
                    className={`w-full px-4 py-2.5 rounded-lg border-2 focus:outline-none focus:ring-2 text-sm transition-all text-black font-semibold ${updateContainerNo.length > 0 && updateContainerNo.length < 11 ? "border-amber-400 focus:border-amber-500 focus:ring-amber-200" : "border-slate-300 focus:border-[#0e4a78] focus:ring-[#0e4a78]/50"}`}
                    placeholder="Enter 11-digit Container No"
                  />
                  {updateContainerNo.length > 0 &&
                    updateContainerNo.length < 11 && (
                      <span className="text-xs text-amber-600 mt-1 block">
                        Container number must be 11 characters.
                      </span>
                    )}

                  {/* Suggestions Dropdown */}
                  {showSuggestions && containerSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-slate-200 mt-1 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {containerSuggestions.map((c, i) => {
                        const val =
                          typeof c === "string"
                            ? c
                            : c?.Cont_No || c?.cont_no || c?.CONTAINER_NO || c?.container_no || "";
                        const loc =
                          typeof c === "object"
                            ? c?.Last_Loc || c?.last_loc || c?.LAST_LOCATION_NAME || ""
                            : "";
                        return (
                          <li
                            key={i}
                            onClick={() => selectSuggestion(c)}
                            className="px-4 py-2.5 hover:bg-[#0e4a78]/5 cursor-pointer border-b border-slate-100 last:border-0 flex items-center justify-between gap-3"
                          >
                            <span className="text-sm font-bold text-slate-800 font-mono">{val}</span>
                            {loc && <span className="text-xs text-slate-400 shrink-0">{loc}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <button
                  onClick={handleUpdateContainer}
                  className="w-full mt-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white font-semibold hover:from-[#0b3e66] hover:to-[#072c4a] transition-all shadow-md transform hover:-translate-y-0.5"
                >
                  Update Container
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Styles for this page */}
      <style>{`
        .device-input {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          background-color: #ffffff !important;
          font-weight: 500 !important;
        }
        
        .device-input::placeholder {
          color: #94a3b8 !important;
          -webkit-text-fill-color: #94a3b8 !important;
          opacity: 1 !important;
        }

        .device-table th {
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        /* Custom Scrollbar Global */
        ::-webkit-scrollbar {
          width: 8px; /* Slightly wider for visibility */
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

      `}</style>
      
      {/* Zoom Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <img 
            src={zoomedImage} 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
            alt="Zoomed" 
            onClick={(e) => e.stopPropagation()}
          />
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
            onClick={() => setZoomedImage(null)}
          >
            <FiX size={24} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DeviceDataReport;
