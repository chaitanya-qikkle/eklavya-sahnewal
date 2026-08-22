import React, { useEffect, useState } from "react";
import { GoogleMap, MarkerF, InfoWindowF, useJsApiLoader } from "@react-google-maps/api";
import {
  FiEye,
  FiSearch,
  FiFilter,
  FiChevronUp,
  FiChevronDown,
  FiActivity,
  FiMapPin,
  FiFileText
} from "react-icons/fi";
import { MdDevices, MdLocationOn } from "react-icons/md";
import { TbRefresh } from "react-icons/tb";
import Navbar from "../../../components/layout/Navbar";
import { useGetEquipmentQuery, useGetDeviceDataLatestQuery, useGetCurrentEquipmentStatusQuery, useLazyGetDeviceDetailsQuery } from "../../../store/api/ymsApi";

import Swal from "sweetalert2";

const mapModes = {
  satellite: { label: "Satellite", type: "k" },
  labels: { label: "Labels", type: "h" },
  terrain: { label: "Terrain", type: "p" }
};

const DEFAULT_EQUIPMENT_MAP_CENTER = { lat: 28.42684598807148, lng: 76.91546293301492 };
const normalizeDeviceKey = (value) => (value == null ? '' : String(value).trim().toUpperCase());
const MARKER_IMAGE = '/Images/reach_stacker.png';
const INACTIVE_MARKER_IMAGE = '/Images/reach_stacker_inactive.png';

export default function EquipmentStatus() {

  const EXIM_STORAGE_KEY = 'equipmentStatus.eximByKey';

  const getEximKey = React.useCallback((row) => {
    const deviceId = row?.deviceId ? String(row.deviceId).trim() : '';
    if (deviceId) return `device:${deviceId}`;
    const eqp = row?.eqp ? String(row.eqp).trim() : '';
    if (eqp) return `eqp:${eqp}`;
    const id = row?.id != null ? String(row.id) : '';
    return id ? `id:${id}` : '';
  }, []);

  const readEximByKey = React.useCallback(() => {
    try {
      const raw = window?.localStorage?.getItem(EXIM_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }, []);

  const writeEximByKey = React.useCallback((nextMap) => {
    try {
      window?.localStorage?.setItem(EXIM_STORAGE_KEY, JSON.stringify(nextMap ?? {}));
    } catch {
      // ignore
    }
  }, []);


  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: mapsApiKey || "",
  });

  const [equipment, setEquipment] = useState([]);

  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  // Poll the backend every 15 seconds.
  const {
    data: equipmentApi,
    isLoading: equipmentLoading,
    isFetching: equipmentFetching,
    refetch: refetchEquipment,
  } = useGetEquipmentQuery(undefined, {
    pollingInterval: 15000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const {
    data: latestTxApi,
  } = useGetDeviceDataLatestQuery(undefined, {
    pollingInterval: 15000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  // Live status (location, date/time, TAT, lat/long) from GET_CURRENTEQUIPMENT_STATUS.
  const {
    data: currentStatusApi,
  } = useGetCurrentEquipmentStatusQuery(undefined, {
    pollingInterval: 15000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const [selectedRow, setSelectedRow] = useState(null);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("eqp");
  const [sortDir, setSortDir] = useState("asc");
  const [activeFilter, setActiveFilter] = useState("all");
  const [deviceDetail, setDeviceDetail] = useState({ eqp: null, deviceId: null, records: [], loading: false, error: null });
  const [mapMode, setMapMode] = useState("satellite");
  const [enabledMapModes, setEnabledMapModes] = useState(new Set()); // Track which modes are enabled
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState('list');
  const [activeMapMarker, setActiveMapMarker] = useState(null);

  const [fetchDeviceData] = useLazyGetDeviceDetailsQuery();

  const latestTxMap = React.useMemo(() => {
    const rows = Array.isArray(latestTxApi?.data) ? latestTxApi.data : [];
    const map = new Map();
    for (const row of rows) {
      const deviceId = row?.DEVICE_IMEI ?? row?.device_imei ?? row?.DEVICE_ID ?? row?.device_id;
      const lastAt = row?.LAST_TRANSACTION_DATE ?? row?.last_transaction_date;
      const deviceKey = normalizeDeviceKey(deviceId);
      if (deviceKey) {
        map.set(deviceKey, lastAt);
      }
    }
    return map;
  }, [latestTxApi]);

  // Live status per device (Location/Date_Time/TAT/Lat/Long/Status) from GET_CURRENTEQUIPMENT_STATUS.
  const currentStatusMap = React.useMemo(() => {
    const rows = Array.isArray(currentStatusApi?.data) ? currentStatusApi.data : [];
    const map = new Map();
    for (const row of rows) {
      const deviceKey = normalizeDeviceKey(row?.KalmarNo);
      if (!deviceKey) continue;
      const lat = row?.Latitude;
      const lng = row?.Longitude;
      const latNum = typeof lat === 'number' ? lat : Number(String(lat ?? '').trim());
      const lngNum = typeof lng === 'number' ? lng : Number(String(lng ?? '').trim());
      map.set(deviceKey, {
        location: row?.RFIDDATA ?? '',
        dateTime: row?.Date_Time ?? null,
        statusText: row?.STATUS ?? '',
        tat: row?.TAT ?? null,
        lastHandleAt: row?.LastHandleDate ?? null,
        lat: Number.isFinite(latNum) ? latNum : null,
        lng: Number.isFinite(lngNum) ? lngNum : null,
      });
    }
    return map;
  }, [currentStatusApi]);

  const equipmentMarkers = React.useMemo(() => {
    return (equipment || [])
      .filter((eqp) => Number.isFinite(eqp?.lat) && Number.isFinite(eqp?.lng))
      .map((eqp) => ({
        id: eqp.id,
        eqp: eqp.eqp,
        status: eqp.status,
        statusLabel: eqp.statusLabel,
        deviceId: eqp.deviceId,
        position: { lat: eqp.lat, lng: eqp.lng },
        location: eqp.location,
        tat: eqp.tat,
      }));
  }, [equipment]);

  const selectedMarker = React.useMemo(() => {
    if (!activeMapMarker) return null;
    return equipmentMarkers.find((m) => String(m.deviceId) === String(activeMapMarker)) || null;
  }, [equipmentMarkers, activeMapMarker]);

  const mapCenter = React.useMemo(() => {
    if (selectedMarker?.position) return selectedMarker.position;
    if (equipmentMarkers.length > 0) return equipmentMarkers[0].position;
    return DEFAULT_EQUIPMENT_MAP_CENTER;
  }, [selectedMarker, equipmentMarkers]);

  const mapTypeId = mapMode === 'satellite'
    ? 'satellite'
    : mapMode === 'terrain'
      ? 'terrain'
      : mapMode === 'labels'
        ? 'hybrid'
        : 'roadmap';

  const mapRef = React.useRef(null);

  const handleMapLoad = React.useCallback((map) => {
    mapRef.current = map;
  }, []);

  const handleMapUnmount = React.useCallback(() => {
    mapRef.current = null;
  }, []);

  const activeIcon = React.useMemo(() => {
    if (!isLoaded || !window.google?.maps) return window.location.origin + MARKER_IMAGE;
    return {
      url: window.location.origin + MARKER_IMAGE,
      scaledSize: new window.google.maps.Size(50, 50),
      anchor: new window.google.maps.Point(18, 32),
      labelOrigin: new window.google.maps.Point(18, -6),
    };
  }, [isLoaded]);

  const inactiveIcon = React.useMemo(() => {
    if (!isLoaded || !window.google?.maps) return window.location.origin + INACTIVE_MARKER_IMAGE;
    return {
      url: window.location.origin + INACTIVE_MARKER_IMAGE,
      scaledSize: new window.google.maps.Size(36, 36),
      anchor: new window.google.maps.Point(18, 32),
      labelOrigin: new window.google.maps.Point(18, -6),
    };
  }, [isLoaded]);

  const getMarkerIcon = React.useCallback((status) => {
    return status === 'active' ? activeIcon : inactiveIcon;
  }, [activeIcon, inactiveIcon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded || !window.google?.maps) return;

    if (selectedMarker?.position) {
      map.panTo(selectedMarker.position);
      map.setZoom(18);
    }
  }, [selectedMarker, isLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded || !window.google?.maps || selectedMarker || equipmentMarkers.length === 0) return;

    if (equipmentMarkers.length === 1) {
      map.panTo(equipmentMarkers[0].position);
      map.setZoom(17);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    equipmentMarkers.forEach((marker) => bounds.extend(marker.position));
    map.fitBounds(bounds, 60);
  }, [equipmentMarkers, isLoaded, selectedMarker]);

  const setMachineMode = async (event, item, nextIsExim) => {
    event?.stopPropagation?.();

    const key = getEximKey(item);
    if (key) {
      const existing = readEximByKey();
      existing[key] = !!nextIsExim;
      writeEximByKey(existing);
    }

    setEquipment((prev) => prev.map((row) => (row.id === item.id ? { ...row, exim: nextIsExim } : row)));

    await Swal.fire({
      icon: 'success',
      title: nextIsExim ? 'Machine Acivated for Exim!!!' : 'Machine Acivated for Domestic!!!',
      text: 'Click Ok',
      confirmButtonText: 'OK',
    });
  };

  const toggleMachineMode = (event, item) => setMachineMode(event, item, !item.exim);

  useEffect(() => {
    const rows = Array.isArray(equipmentApi?.data) ? equipmentApi.data : null;
    if (!rows || rows.length === 0) return;

    const persistedExim = readEximByKey();

    const mapped = rows.map((item, index) => {
      const name = item?.Equipment_Name ?? item?.equipment_name ?? item?.EQUIPMENT_NAME ?? item?.eqp ?? item?.EQP;
      const code = item?.Equipment_Code ?? item?.equipment_code ?? item?.EQUIPMENT_CODE;
      const deviceId = item?.Device_ID ?? item?.device_id ?? item?.DEVICE_ID;
      const ownerName = item?.Owner_Name ?? item?.owner_name ?? item?.OWNER_NAME;

      const created = item?.CreatedDate ?? item?.created_date ?? item?.CREATED_DATE;
      const modified = item?.ModifiedDate ?? item?.modified_date ?? item?.MODIFIED_DATE;
      const installed = item?.Installation_Date ?? item?.installation_date ?? item?.INSTALLATION_DATE;

      const time = modified || created || installed || '';
      const hasDevice = !!(deviceId && String(deviceId).trim());
      const normalizedDeviceId = hasDevice ? normalizeDeviceKey(deviceId) : null;

      const cur = normalizedDeviceId ? currentStatusMap.get(normalizedDeviceId) : null;
      const statusText = cur?.statusText || 'In Active';
      const isActive = statusText === 'Working' || statusText === 'Idle';
      const status = isActive ? 'active' : 'inactive';
      const blockLocation = cur?.location ? extractBlock(cur.location) : '';
      const packetTime = cur?.dateTime || null; // DATE TIME = latest GPS packet, via SP
      const lastUnlockAt = cur?.lastHandleAt || (normalizedDeviceId ? (latestTxMap.get(normalizedDeviceId) || null) : null); // LAST HANDLE

      return {
        id: item?.Eqp_ID ?? item?.eqp_id ?? item?.ID ?? item?.id ?? index + 1,
        eqp: code || name || `EQP-${index + 1}`,
        equipmentName: name || code || `EQP-${index + 1}`,
        location: blockLocation || '—',
        time: packetTime || time,
        status,
        statusLabel: statusText,
        lastTransactionAt: lastUnlockAt, // LAST HANDLE
        tat: cur?.tat || null,           // IDLE HRS, computed server-side (ConvertDDHHMMSS)
        deviceData: status === 'active' && hasDevice ? 'Available' : 'Offline',
        deviceId: normalizedDeviceId,
        lat: cur?.lat ?? null,
        lng: cur?.lng ?? null,
      };
    });

    setEquipment((prev) => {
      const prevByKey = new Map(
        (prev || [])
          .map((row) => {
            const k = getEximKey(row);
            return k ? [k, row] : null;
          })
          .filter(Boolean)
      );

      return mapped.map((row) => {
        const k = getEximKey(row);
        const fromPersisted = k && Object.prototype.hasOwnProperty.call(persistedExim, k)
          ? !!persistedExim[k]
          : undefined;
        const existing = k ? prevByKey.get(k) : null;

        return {
          ...row,
          exim: fromPersisted ?? existing?.exim ?? true,
        };
      });
    });
    setLastRefreshedAt(new Date());
  }, [equipmentApi, latestTxMap, currentStatusMap, getEximKey, readEximByKey]);

  const handleManualRefresh = async () => {
    try {
      await refetchEquipment();
      setLastRefreshedAt(new Date());
    } catch {
      // Ignore; UI already shows previous data.
    }
  };

  // Track viewport width to switch layouts on mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileView('list');
  }, [isMobile]);

  // Filter equipment based on active filter
  const getFilteredEquipment = () => {
    if (activeFilter === "all") return equipment;
    if (activeFilter === "active") return equipment.filter(item => item.status === "active");
    if (activeFilter === "inactive") return equipment.filter(item => item.status === "inactive");
    return equipment;
  };

  const sortEquipmentData = (data, col, direction) => {
    const isAsc = direction === "asc";

    return [...data].sort((a, b) => {
      if (["eqp", "location", "deviceData", "status", "container"].includes(col)) {
        const valA = a[col] || "";
        const valB = b[col] || "";
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (col === "time") {
        return isAsc
          ? new Date(a.time) - new Date(b.time)
          : new Date(b.time) - new Date(a.time);
      }

      if (col === "lastUk") {
        const toMinutes = (str) => {
          const [h, m] = str.split(":").map(Number);
          return h * 60 + m;
        };

        return isAsc
          ? toMinutes(a.lastUk) - toMinutes(b.lastUk)
          : toMinutes(b.lastUk) - toMinutes(a.lastUk);
      }

      return 0;
    });
  };
  // Sorting Utility
  const handleSort = (col) => {
    if (!col) return;

    const nextDirection = sortCol === col
      ? (sortDir === "asc" ? "desc" : "asc")
      : "asc";

    setSortCol(col);
    setSortDir(nextDirection);
    setEquipment(prev => sortEquipmentData(prev, col, nextDirection));
  };

  const showDeviceData = async (item) => {
    setSelectedRow(item.id);

    const deviceKey = normalizeDeviceKey(item?.deviceId);
    if (!deviceKey) {
      await Swal.fire({
        icon: 'warning',
        title: 'Device not mapped',
        text: 'This machine does not have a DEVICE_ID, so transactions cannot be fetched.',
        confirmButtonText: 'OK',
      });
      return;
    }

    setDeviceDetail({ eqp: item.eqp, deviceId: deviceKey, records: [], loading: true, error: null });

    try {
      const response = await fetchDeviceData(deviceKey).unwrap();
      const rows = Array.isArray(response?.data) ? response.data : [];
      const mapped = rows.map((row) => {
        return {
          datetime: row?.TransDate ?? '-',
          container: row?.ContNo ?? '-',
          location: row?.Location ?? '-',
        };
      });

      setDeviceDetail({
        eqp: item.eqp,
        deviceId: deviceKey,
        records: mapped,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err?.data?.message || err?.error || 'Failed to fetch device transactions.';
      setDeviceDetail({ eqp: item.eqp, deviceId: deviceKey, records: [], loading: false, error: message });
    }
  };

  const handleShowDeviceData = (event, item) => {
    event.stopPropagation();
    showDeviceData(item);
  };

  const clearDeviceDetail = () => setDeviceDetail({ eqp: null, deviceId: null, records: [], loading: false, error: null });

  // Auto-refresh the modal if a newer status ping comes in
  useEffect(() => {
    if (!deviceDetail.deviceId || deviceDetail.loading) return;
    const cur = currentStatusMap.get(deviceDetail.deviceId);
    if (!cur?.dateTime) return;
    const lastRecord = deviceDetail.records[0];
    const lastRecordTime = lastRecord ? new Date(lastRecord.datetime).getTime() : 0;
    const curTime = new Date(cur.dateTime).getTime();
    if (curTime > lastRecordTime) {
      const item = equipment.find(e => e.deviceId === deviceDetail.deviceId);
      if (item) {
        showDeviceData(item);
      }
    }
  }, [currentStatusMap, deviceDetail.deviceId]); // intentionally omitting deviceDetail to avoid infinite loops, we rely on curTime

  // Column sort icon
  const SortIcon = ({ col }) => {
    if (sortCol !== col) {
      return (
        <div className="flex flex-col leading-3 ml-1 opacity-50">
          <FiChevronUp className="text-[10px]" />
          <FiChevronDown className="text-[10px] -mt-1" />
        </div>
      );
    }
    return sortDir === "asc"
      ? <FiChevronUp className="ml-1 text-blue-400" />
      : <FiChevronDown className="ml-1 text-blue-400" />;
  };

  const filtered = getFilteredEquipment().filter((item) =>
    item.eqp.toLowerCase().includes(search.toLowerCase()) ||
    item.location.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const stats = {
    total: equipment.length,
    active: equipment.filter(e => e.status === "active").length,
    inactive: equipment.filter(e => e.status === "inactive").length
  };
  const mapContainerStyle = { width: '100%', height: '100%' };

  return (
    <div
      className="w-full min-h-screen relative bg-cover bg-center"
      style={{ backgroundImage: "url('/Images/bgimageold.png')" }}
    >
      <div className="absolute inset-0 bg-white/65 backdrop-blur-[1px]" aria-hidden="true"></div>

      <div className="relative z-10">

        {/* NAVBAR */}
        <Navbar />

        {/* PAGE HEADER + SEARCH + FILTER */}
        <div className="px-4 md:px-6 py-3 border-b border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm">
          {/* Top row — title + refresh */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0e4a78] to-[#0a3b61] flex items-center justify-center shadow">
                <MdDevices className="text-white text-lg" />
              </div>
              <div>
                <h1 className="text-sm font-black text-[#0e4a78] leading-tight tracking-tight">Equipment Monitoring</h1>
                <p className="text-slate-400 text-[10px] leading-none mt-0.5 font-medium">Live operational monitoring</p>
              </div>
            </div>
            <button
              onClick={handleManualRefresh}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white hover:from-[#0b3e66] hover:to-[#072c4a] transition-all flex items-center gap-2 text-xs font-bold shadow-md"
            >
              <TbRefresh className={`text-sm ${equipmentFetching ? "animate-spin" : ""}`} />
              {equipmentFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {/* Bottom row — search + filter pills */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search equipment or block..."
                className="pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700
                         focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/20 focus:border-[#0e4a78] w-full text-sm"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <FilterBtn label="All"      count={stats.total}    active={activeFilter === "all"}      onClick={() => setActiveFilter("all")} />
              <FilterBtn label="Active"   count={stats.active}   active={activeFilter === "active"}   color="green" onClick={() => setActiveFilter("active")} />
              <FilterBtn label="Inactive" count={stats.inactive} active={activeFilter === "inactive"} color="red"   onClick={() => setActiveFilter("inactive")} />
            </div>
          </div>

          {/* Mobile list/map toggle */}
          {isMobile && (
            <div className="flex gap-2 mt-2 md:hidden">
              <button type="button" onClick={() => setMobileView('list')}
                className={`flex-1 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${mobileView === 'list' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600'}`}>
                List
              </button>
              <button type="button" onClick={() => setMobileView('map')}
                className={`flex-1 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${mobileView === 'map' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600'}`}>
                Map
              </button>
            </div>
          )}
        </div>

        {/* MAIN GRID */}
        <main className={`p-4 md:p-4 grid ${isMobile ? "grid-cols-1 gap-4" : "grid-cols-1 xl:grid-cols-12 gap-4"}`}>

          {/* PRIMARY CONTENT */}
          <div className={isMobile ? "space-y-4" : "xl:col-span-7"}>
            {isMobile ? (
              mobileView === 'map' ? (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden flex flex-col h-[75vh] min-h-[560px]">
                  <div className="px-6 py-4 border-b bg-blue-950 flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <FiMapPin className="text-white" /> Map
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {Object.entries(mapModes).map(([key, mode]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setMapMode(key)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${mapMode === key
                            ? 'bg-white text-slate-900 border-white'
                            : 'bg-transparent text-white border-white/40 hover:border-white'
                            }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1">
                    {!mapsApiKey ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <h4 className="text-lg font-semibold text-slate-700 mb-2">Google Maps Key Missing</h4>
                        <p className="text-slate-500 text-sm max-w-sm">
                          Provide a valid <code>VITE_GOOGLE_MAPS_KEY</code> in your frontend environment file to enable the live equipment map.
                        </p>
                      </div>
                    ) : loadError ? (
                      <div className="h-full flex items-center justify-center p-6 text-center">
                        <p className="text-sm font-semibold text-red-600">
                          Unable to load Google Maps. Please verify the API key and network connectivity.
                        </p>
                      </div>
                    ) : !isLoaded ? (
                      <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
                        <div className="w-10 h-10 border-2 border-slate-300 border-t-[#0e4a78] rounded-full animate-spin" />
                        <p className="text-sm font-medium">Loading Google Map…</p>
                      </div>
                    ) : equipmentMarkers.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <h4 className="text-lg font-semibold text-slate-700 mb-2">No Live GPS Data</h4>
                        <p className="text-slate-500 text-sm max-w-sm">
                          No equipment has valid GPS lat/long in the latest device transactions.
                        </p>
                      </div>
                    ) : (
                      <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={mapCenter}
                        zoom={16}
                        onLoad={handleMapLoad}
                        onUnmount={handleMapUnmount}
                        options={{
                          mapTypeId,
                          streetViewControl: false,
                          fullscreenControl: true,
                          mapTypeControl: false,
                        }}
                      >
                        {equipmentMarkers.map((m) => (
                          <MarkerF
                            key={m.deviceId || m.id}
                            position={m.position}
                            icon={getMarkerIcon(m.status)}
                            label={{
                              text: m.eqp,
                              color: '#FFFFFF',
                              fontWeight: '800',
                              fontSize: '14px',
                              className: 'map-marker-label'
                            }}
                            onClick={() => setActiveMapMarker(m.deviceId)}
                          >
                            {activeMapMarker === m.deviceId && (
                              <InfoWindowF onCloseClick={() => setActiveMapMarker(null)}>
                                <div className="p-1">
                                  <div className="text-sm font-semibold text-slate-800">{m.eqp}</div>
                                  <div className="text-xs text-slate-600 mt-1">Status: <span className="font-semibold">{String(m.statusLabel || m.status || '').toUpperCase()}</span></div>
                                  <div className="text-xs text-slate-600 mt-1">TAT: {m.tat || '—'}</div>
                                  {m.location ? (
                                    <div className="text-xs text-slate-600 mt-1">Location: <span className="font-semibold">{m.location}</span></div>
                                  ) : null}
                                </div>
                              </InfoWindowF>
                            )}
                          </MarkerF>
                        ))}
                      </GoogleMap>
                    )}
                  </div>
                </div>
              ) : (
                filtered.length ? (
                  filtered.map((item) => (
                    <MobileEquipmentCard
                      key={item.id}
                      item={item}
                      onShowData={() => showDeviceData(item)}
                      onToggleMode={(event) => toggleMachineMode(event, item)}
                    />
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-blue-300 bg-white/70 px-6 py-10 text-center text-blue-900">
                    No equipment matches your filters.
                  </div>
                )
              )
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden flex flex-col h-[540px]">

                <div className="px-6 py-3 border-b bg-blue-950 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <MdDevices className="text-white text-lg" />
                    Equipment Monitoring
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <FiFilter className="text-[10px]" />
                    Sorted by: {sortCol || "eqp"}
                  </div>
                </div>

                <div className="overflow-auto flex-1">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr className="border-b border-gray-200">
                        <th className="w-[72px] px-3 py-2.5 text-left font-semibold text-xs text-gray-500 uppercase tracking-wide">
                          EXIM
                        </th>
                        <Th label="Machine" col="eqp" onSort={handleSort} icon={<SortIcon col="eqp" />} />
                        <Th label="Location" col="location" onSort={handleSort} icon={<SortIcon col="location" />} />
                        <Th label="Date Time" col="time" onSort={handleSort} icon={<SortIcon col="time" />} />
                        <Th label="Status" col="status" onSort={handleSort} icon={<SortIcon col="status" />} />
                        <Th label="Last Handle" col="lastUk" onSort={handleSort} icon={<SortIcon col="lastUk" />} />
                        <Th label="Idle Hrs" />
                        <Th label="Actions" />
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200">
                      {filtered.map((item) => (
                        <tr
                          key={item.id}
                          className={`transition-all ${selectedRow === item.id
                            ? "bg-blue-50"
                            : "hover:bg-gray-100"
                            }`}
                          onClick={() => setSelectedRow(item.id)}
                        >

                          {/* EXIM */}
                          <td className="px-3 py-2">
                            <ModeToggle isExim={item.exim} onToggle={(event) => toggleMachineMode(event, item)} />
                          </td>

                          {/* MACHINE */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-3">
                              <img
                                src={item.status === "active" ? MARKER_IMAGE : INACTIVE_MARKER_IMAGE}
                                alt="Vehicle"
                                className="w-10 h-10 object-contain"
                              />
                              <span className="font-semibold text-gray-800">{item.eqp}</span>
                            </div>
                          </td>

                          {/* BLOCK */}
                          <td className="px-3 py-2">
                            {item.location && item.location !== '—' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e4a78]/10 border border-[#0e4a78]/20 text-[#0e4a78] text-xs font-bold tracking-wide">
                                <MdLocationOn className="text-[#0e4a78] flex-shrink-0 text-sm" />
                                {String(item.location).replace(/\s*-\s*Block$/i, '')}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>

                         

                          {/* TIME */}
                          <td className="px-3 py-2 text-gray-700">
                            {(() => {
                              const formatted = formatIndianDateTime(item.time);
                              const [d, t] = formatted ? formatted.split(' ') : ['', ''];
                              return (
                                <>
                                  <div className="font-medium text-sm">{t || ''}</div>
                                  <div className="text-xs text-gray-500">{d || ''}</div>
                                </>
                              );
                            })()}
                          </td>

                          {/* STATUS */}
                          <td className="px-3 py-2">
                            <span className={`px-3 py-1.5 rounded-full text-xs font-medium inline-block border ${statusBadgeClasses(item.statusLabel)}`}>
                              {(item.statusLabel || 'In Active').toUpperCase()}
                            </span>
                          </td>

                          {/* LAST HANDLE */}
                          <td className="px-3 py-2">
                            {item.lastTransactionAt || item.time ? (() => {
                              const formatted = formatIndianDateTime(item.lastTransactionAt || item.time);
                              const [d, t] = formatted ? formatted.split(' ') : ['', ''];
                              return (
                                <>
                                  <div className="font-medium text-sm text-gray-800">{t || ''}</div>
                                  <div className="text-xs text-gray-500">{d || ''}</div>
                                </>
                              );
                            })() : <span className="text-gray-400 text-xs">—</span>}
                          </td>

                          {/* IDLE HRS (TAT) */}
                          <td className="px-3 py-2">
                            <span className={`font-semibold ${item.status === "active" ? "text-green-600" : "text-gray-500"}`}>
                              {item.tat || '—'}
                            </span>
                          </td>

                          {/* ACTION */}
                          <td className="px-3 py-2">
                            <button
                              onClick={(event) => handleShowDeviceData(event, item)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center justify-center"
                            >
                              <FiEye className="text-base" />
                            </button>
                          </td>

                        </tr>
                      ))}
                    </tbody>

                  </table>
                </div>

                <div className="px-4 py-2 border-t bg-gray-50 text-gray-500 text-xs flex-shrink-0">
                  Showing <b className="text-[#0e4a78]">{filtered.length}</b> of <b className="text-[#0e4a78]">{equipment.length}</b> machines
                </div>

              </div>
            )}
          </div>

          {/* RIGHT PANEL (MAP / DEVICE DATA) */}
          {!isMobile && (
            <div className="xl:col-span-5">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-md flex flex-col">

                {deviceDetail.eqp ? (
                  <>
                    <div className="px-6 py-4 border-b bg-blue-950 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FiActivity className="text-white-500" /> Device Data – {deviceDetail.eqp}
                      </h3>

                      <button
                        onClick={clearDeviceDetail}
                        className="px-3 py-1.5 text-xs rounded-full bg-white text-black hover:bg-white"
                      >
                        Show Map
                      </button>
                    </div>

                    <div>
                      {deviceDetail.loading ? (
                        <div className="px-6 py-8 text-sm text-gray-600">Loading device data...</div>
                      ) : deviceDetail.error ? (
                        <div className="px-6 py-8 text-sm text-red-600">{deviceDetail.error}</div>
                      ) : deviceDetail.records.length === 0 ? (
                        <div className="px-6 py-8 text-sm text-gray-600">No device data found for DEVICE_ID: {deviceDetail.deviceId}</div>
                      ) : (
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Time</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Container</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deviceDetail.records.map((entry, i) => (
                              <tr key={i} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                <td className="px-3 py-2 text-sm text-gray-700">{formatIndianDateTime(entry.datetime)}</td>
                                <td className="px-3 py-2 text-sm font-bold text-gray-800">{entry.container}</td>
                                <td className="px-3 py-2 text-sm text-gray-600">{entry.location}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="px-6 py-4 border-b bg-blue-950 flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FiMapPin className="text-white" /> Map
                      </h3>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {Object.entries(mapModes).map(([key, mode]) => {
                          const isEnabled = enabledMapModes.has(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                const newEnabled = new Set(enabledMapModes);
                                if (isEnabled) {
                                  newEnabled.delete(key);
                                } else {
                                  newEnabled.add(key);
                                  setMapMode(key); // Set as active when enabled
                                }
                                setEnabledMapModes(newEnabled);
                              }}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${isEnabled
                                  ? 'bg-white text-slate-900 border-white'
                                  : 'bg-transparent text-white/50 border-white/30 hover:border-white/50'
                                }`}
                            >
                              {mode.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-[540px]">
                      {!mapsApiKey ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6">
                          <h4 className="text-lg font-semibold text-slate-700 mb-2">Google Maps Key Missing</h4>
                          <p className="text-slate-500 text-sm max-w-sm">
                            Provide a valid <code>VITE_GOOGLE_MAPS_KEY</code> in your frontend environment file to enable the live equipment map.
                          </p>
                        </div>
                      ) : loadError ? (
                        <div className="h-full flex items-center justify-center p-6 text-center">
                          <p className="text-sm font-semibold text-red-600">
                            Unable to load Google Maps. Please verify the API key and network connectivity.
                          </p>
                        </div>
                      ) : !isLoaded ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
                          <div className="w-10 h-10 border-2 border-slate-300 border-t-[#0e4a78] rounded-full animate-spin" />
                          <p className="text-sm font-medium">Loading Google Map…</p>
                        </div>
                      ) : equipmentMarkers.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6">
                          <h4 className="text-lg font-semibold text-slate-700 mb-2">No Live GPS Data</h4>
                          <p className="text-slate-500 text-sm max-w-sm">
                            No equipment has valid GPS lat/long in the latest device transactions.
                          </p>
                        </div>
                      ) : (
                        <GoogleMap
                          mapContainerStyle={mapContainerStyle}
                          center={mapCenter}
                          zoom={16}
                          onLoad={handleMapLoad}
                          onUnmount={handleMapUnmount}
                          options={{
                            mapTypeId,
                            streetViewControl: false,
                            fullscreenControl: true,
                            mapTypeControl: false,
                          }}
                        >
                          {equipmentMarkers.map((m) => (
                            <MarkerF
                              key={m.deviceId || m.id}
                              position={m.position}
                              icon={getMarkerIcon(m.status)}
                              label={{
                                text: m.eqp,
                                color: '#FFFFFF',
                                fontWeight: '800',
                                fontSize: '14px',
                                className: 'map-marker-label'
                              }}
                              onClick={() => setActiveMapMarker(m.deviceId)}
                            >
                              {activeMapMarker === m.deviceId && (
                                <InfoWindowF onCloseClick={() => setActiveMapMarker(null)}>
                                  <div className="p-1">
                                    <div className="text-sm font-semibold text-slate-800">{m.eqp}</div>
                                    <div className="text-xs text-slate-600 mt-1">Status: <span className="font-semibold">{String(m.statusLabel || m.status || '').toUpperCase()}</span></div>
                                    <div className="text-xs text-slate-600 mt-1">TAT: {m.tat || '—'}</div>
                                    {m.location ? (
                                      <div className="text-xs text-slate-600 mt-1">Location: <span className="font-semibold">{m.location}</span></div>
                                    ) : null}
                                  </div>
                                </InfoWindowF>
                              )}
                            </MarkerF>
                          ))}
                        </GoogleMap>
                      )}
                    </div>
                  </>
                )}

              </div>
            </div>
          )}

        </main>

        {/* MOBILE CONTAINER DATA DRAWER */}
        {isMobile && deviceDetail.eqp && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/40 backdrop-blur-sm">
            <div className="mb-auto bg-white rounded-b-3xl shadow-2xl max-h-[80vh] overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-[0.3em]">Unlock Packets</p>
                  <h3 className="text-lg font-semibold text-slate-900">{deviceDetail.eqp}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={clearDeviceDetail}
                    className="text-sm font-semibold text-slate-700"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      clearDeviceDetail();
                      setMobileView('map');
                    }}
                    className="text-sm font-semibold text-blue-600"
                  >
                    Show Map
                  </button>
                </div>
              </div>
              <div className="overflow-auto">
                {deviceDetail.loading ? (
                  <div className="px-6 py-8 text-sm text-slate-600">Loading unlock packets...</div>
                ) : deviceDetail.error ? (
                  <div className="px-6 py-8 text-sm text-red-600">{deviceDetail.error}</div>
                ) : deviceDetail.records.length === 0 ? (
                  <div className="px-6 py-8 text-sm text-slate-600">No unlock packets found for DEVICE_ID: {deviceDetail.deviceId}</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-slate-500">Date Time</th>
                        <th className="px-3 py-2 text-left text-slate-500">Container</th>
                        <th className="px-3 py-2 text-left text-slate-500">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deviceDetail.records.map((entry, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-3 py-2 text-slate-800">{formatIndianDateTime(entry.datetime)}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{entry.container}</td>
                          <td className="px-3 py-2 text-slate-700">{entry.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* SMALL COMPONENTS */

const MobileEquipmentCard = ({ item, onShowData, onToggleMode }) => {
  const statusClasses = statusBadgeClasses(item.statusLabel);

  const formattedTs = formatIndianDateTime(item.time);
  const [tsDate, tsTime] = formattedTs ? formattedTs.split(' ') : ['', ''];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header Section */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={item.status === "active" ? MARKER_IMAGE : INACTIVE_MARKER_IMAGE}
              alt="Vehicle"
              className="w-12 h-12 object-contain"
            />
            <div>
              <h3 className="text-base font-bold text-slate-900">{item.eqp}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <MdLocationOn className="text-gray-500 text-xs" />
                <p className="text-xs text-slate-600">{item.location}</p>
              </div>
            </div>
          </div>
          <ModeToggle isExim={item.exim} onToggle={onToggleMode} />
        </div>
      </div>

      {/* Content Section */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-0.5">Status</p>
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusClasses}`}>
              {(item.statusLabel || 'In Active').toUpperCase()}
            </span>
          </div>
          <div className="bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-0.5">TAT</p>
            <p className={`text-sm font-bold ${item.status === "active" ? "text-green-600" : "text-gray-500"}`}>
              {item.tat || '—'}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-0.5">Timestamp</p>
          <div className="text-xs font-semibold text-slate-800">
            <div>{tsTime || ''}</div>
            <div className="text-[11px] text-slate-500 font-medium">{tsDate || ''}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onShowData}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-sm"
        >
          <FiEye className="text-base" />
          View Unlock Data
        </button>
      </div>
    </div>
  );
};

const FilterBtn = ({ label, count, active, onClick, color = "blue" }) => {
  const activeColor = color === "green"
    ? "bg-green-100 border-green-500 text-green-700 font-bold"
    : color === "red"
      ? "bg-red-100 border-red-400 text-red-700 font-bold"
      : "bg-[#0e4a78]/10 border-[#0e4a78] text-[#0e4a78] font-bold";

  const dot = color === "green"
    ? "bg-green-500"
    : color === "red"
      ? "bg-red-500"
      : "bg-[#0e4a78]";

  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-xl border text-xs transition-all flex items-center gap-2 shadow-sm ${active
        ? activeColor
        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
        }`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? dot : "bg-slate-300"}`} />
      <span className="font-semibold">{label}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${active ? "bg-white/70" : "bg-slate-100 text-slate-500"}`}>{count}</span>
    </button>
  );
};

const Th = ({ label, col, onSort, icon }) => (
  <th
    className="px-3 py-2.5 text-left font-semibold text-xs text-gray-500 uppercase tracking-wide cursor-pointer hover:text-[#0e4a78] whitespace-nowrap"
    onClick={() => onSort && onSort(col)}
  >
    <div className="flex items-center gap-1.5">
      {label}
      {icon}
    </div>
  </th>
);

const ModeToggle = ({ isExim, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={isExim}
    onClick={(e) => {
      e.stopPropagation();
      onToggle(e);
    }}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${isExim
        ? 'bg-indigo-600'
        : 'bg-amber-500'
      }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${isExim ? 'translate-x-6' : 'translate-x-1'
        }`}
    />
  </button>
);

function extractBlock(location) {
  if (!location) return '';
  const s = String(location).trim();
  // Format: "B2:B:8:1" → "B2 - B" (yard: first segment, block: second segment)
  const colonParts = s.split(':');
  if (colonParts.length >= 2) return `${colonParts[0].trim()} - Block`;
  // Fallback: return as-is
  return s;
}

function formatIndianDateTime(value) {
  if (!value) return '';

  // If backend sends a SQL datetime string like "2026-01-11 13:44:00"
  // prefer string formatting to avoid timezone shifts.
  const raw = String(value).trim();
  const sqlLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)(?:.*)?$/);
  if (sqlLike) {
    const [, yyyy, mm, dd, hh = '00', min = '00'] = sqlLike;
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  const date = value instanceof Date ? value : new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  const pad2 = (n) => String(n).padStart(2, '0');
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function statusBadgeClasses(statusLabel) {
  switch (statusLabel) {
    case 'Working':
      return 'bg-green-100 text-green-700 border-green-300';
    case 'Idle':
      return 'bg-amber-100 text-amber-700 border-amber-300';
    case 'Breakdown':
      return 'bg-red-100 text-red-700 border-red-300';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-300';
  }
}
