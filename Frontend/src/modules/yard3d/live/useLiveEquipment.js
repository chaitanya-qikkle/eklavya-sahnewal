import { useMemo } from "react";
import {
  useGetEquipmentQuery,
  useGetDeviceDataLiveLocationsQuery,
} from "../../../store/api/ymsApi";

// How long after an unlock (PacketID=8) the "just dropped" ring keeps pulsing.
const UNLOCK_RECENT_MS = 15 * 60 * 1000; // 15 minutes

const normalizeKey = (value) => (value == null ? "" : String(value).trim().toUpperCase());

const pick = (row, keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const toNumber = (value) => {
  if (typeof value === "number") return value;
  const num = Number(String(value ?? "").trim());
  return Number.isFinite(num) ? num : null;
};

const toBool = (value) => {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["yes", "y", "true", "on", "active"].includes(v)) return true;
    if (["no", "n", "false", "off", "inactive"].includes(v)) return false;
  }
  return null;
};

const normalizeEquipmentRow = (row, index) => {
  const id =
    row?.Eqp_ID ??
    row?.eqp_id ??
    row?.EQUIPMENT_ID ??
    row?.equipment_id ??
    row?.ID ??
    row?.id ??
    index + 1;

  const name =
    row?.Equipment_Name ??
    row?.equipment_name ??
    row?.EQUIPMENT_NAME ??
    row?.eqp ??
    row?.EQP ??
    row?.Equipment_Code ??
    row?.equipment_code ??
    row?.EQUIPMENT_CODE ??
    `EQP-${index + 1}`;

  const type =
    row?.Equipment_Type ??
    row?.equipment_type ??
    row?.EQUIPMENT_TYPE ??
    row?.eqp_type ??
    row?.EQP_TYPE ??
    row?.Type ??
    row?.type ??
    "Unknown";

  const deviceId =
    row?.Device_ID ??
    row?.device_id ??
    row?.DEVICE_ID ??
    row?.DeviceId ??
    row?.deviceId ??
    row?.DEVICE_IMEI ??
    row?.device_imei ??
    null;

  return {
    id,
    name,
    type,
    deviceId: deviceId ? normalizeKey(deviceId) : null,
    raw: row,
  };
};

const normalizeLiveLocationRow = (row) => {
  const deviceId = pick(row, [
    "DEVICE_IMEI",
    "device_imei",
    "DEVICE_ID",
    "device_id",
    "DeviceId",
    "deviceId",
  ]);
  const lat = toNumber(
    pick(row, ["LAT", "lat", "LATITUDE", "latitude", "GPS_LATITUDE", "gps_latitude"])
  );
  const lon = toNumber(
    pick(row, ["LNG", "lng", "LON", "lon", "LONGITUDE", "longitude", "GPS_LONGITUDE", "gps_longitude"])
  );
  const heading = toNumber(
    pick(row, ["HEADING", "heading", "COURSE", "course", "DIRECTION", "direction"])
  ) || 0;
  const speed = toNumber(
    pick(row, ["SPEED", "speed", "SPD", "spd", "VELOCITY", "velocity"])
  ) || 0;

  const ignition = toBool(
    pick(row, ["IGNITION", "ignition", "IGNITION_STATUS", "ignition_status", "IGN", "ign"])
  );

  const status =
    pick(row, ["STATUS", "status", "ACTIVITY_STATUS", "activity_status", "STATE", "state"]) || "";

  const emergency = toBool(
    pick(row, ["EMERGENCY", "emergency", "SOS", "sos", "PANIC", "panic"])
  );

  const updatedAt =
    pick(row, ["LAST_AT", "last_at", "DATE_TIME", "date_time", "UPDATED_AT", "updated_at", "LAST_TRANSACTION_DATE", "last_transaction_date"]) ||
    null;

  // Lock/unlock state — the live-locations endpoint derives PACKET_STATE per
  // device by comparing the latest lock (PacketID=7) and unlock (PacketID=8):
  //   7 = currently carrying (locked), 8 = just unlocked, 1 = plain movement.
  // PACKET_ID stays 1 (the GPS row), so we key off PACKET_STATE.
  const packetId = toNumber(pick(row, ["PACKET_ID", "packet_id"]));
  const packetState = toNumber(pick(row, ["PACKET_STATE", "packet_state"])) ?? packetId;
  const lastLkAt = pick(row, ["LAST_LK_AT", "last_lk_at"]) || null;
  const lastUkAt = pick(row, ["LAST_UK_AT", "last_uk_at"]) || null;
  const lkContainer = pick(row, ["LK_CONTAINER", "lk_container"]) || null;
  const ukContainer = pick(row, ["UK_CONTAINER", "uk_container"]) || null;
  const gpsContainer = pick(row, ["RFIDDATA", "rfiddata", "OCR_CONTAINER_NO", "ocr_container_no", "CONTAINER_TAG_ID", "container_tag_id"]) || null;

  // isCarrying: last lock/unlock event was a lock -> machine has a box on its spreader.
  // Stays true until the machine reports an unlock (it is genuinely still holding).
  const isCarrying = packetState === 7;
  // isUnlockPacket: last event was an unlock. Gate on recency so the unlock ring
  // is a transient "just dropped" pulse, not a permanent badge on every idle machine.
  const unlockAgeMs = lastUkAt ? Date.now() - new Date(lastUkAt).getTime() : Infinity;
  const isUnlockPacket = packetState === 8 && Number.isFinite(unlockAgeMs) && unlockAgeMs <= UNLOCK_RECENT_MS;

  // Pick the most relevant container number for the current state.
  const activeContainer = isCarrying
    ? (lkContainer || gpsContainer)
    : isUnlockPacket
      ? (ukContainer || gpsContainer)
      : gpsContainer;
  const normalizedContainerTag = activeContainer ? String(activeContainer).trim() : null;

  return {
    deviceId: deviceId ? normalizeKey(deviceId) : null,
    lat,
    lon,
    heading,
    speed,
    ignition,
    status,
    emergency,
    updatedAt,
    packetId,
    packetState,
    containerTag: normalizedContainerTag,
    lastLkAt,
    lastUkAt,
    isUnlockPacket,
    isCarrying,
    raw: row,
  };
};

const ACTIVE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes — mirrors EquipmentStatus.jsx

const deriveStatus = (row, hasFix, now) => {
  if (!hasFix) return "offline";
  if (row.emergency) return "emergency";

  // If the device sent a GPS packet within the last 10 minutes, treat it as moving/active.
  // SP_DEVICE_DATA_LIVE_LOCATIONS does not return SPEED/IGNITION/STATUS fields,
  // so timestamp proximity is the only reliable signal.
  if (row.updatedAt) {
    const age = now - new Date(row.updatedAt).getTime();
    if (Number.isFinite(age) && age <= ACTIVE_THRESHOLD_MS) return "moving";
    return "idle";
  }

  // No timestamp — fall back to speed if present, else idle.
  if ((Number(row.speed) || 0) > 0.2) return "moving";
  return "idle";
};

export function useLiveEquipment({ pollingInterval = 15000, staleMs = 6 * 60 * 1000 } = {}) {
  const { data: equipmentApi } = useGetEquipmentQuery(undefined, {
    pollingInterval,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const { data: liveLocApi } = useGetDeviceDataLiveLocationsQuery(undefined, {
    pollingInterval,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const equipmentList = useMemo(() => {
    const rows = Array.isArray(equipmentApi?.data) ? equipmentApi.data : [];
    return rows.map(normalizeEquipmentRow);
  }, [equipmentApi]);

  const liveLocationList = useMemo(() => {
    const rows = Array.isArray(liveLocApi?.data) ? liveLocApi.data : [];
    return rows.map(normalizeLiveLocationRow).filter((row) => row.deviceId);
  }, [liveLocApi]);

  const equipment = useMemo(() => {
    const now = Date.now(); // snapshot for consistent comparisons within this memo
    const equipmentByDevice = new Map(
      equipmentList
        .map((row) => (row.deviceId ? [row.deviceId, row] : null))
        .filter(Boolean)
    );

    const usedDevices = new Set();
    const combined = [];

    liveLocationList.forEach((loc) => {
      const eqp = equipmentByDevice.get(loc.deviceId) || {};
      const hasFix = Number.isFinite(loc.lat) && Number.isFinite(loc.lon);
      const updatedAtMs = loc.updatedAt ? new Date(loc.updatedAt).getTime() : null;
      const isFresh = updatedAtMs ? now - updatedAtMs <= staleMs : true;
      combined.push({
        id: eqp.id ?? loc.deviceId,
        deviceId: loc.deviceId,
        name: eqp.name || loc.deviceId,
        type: eqp.type || "Unknown",
        lat: loc.lat,
        lon: loc.lon,
        heading: loc.heading,
        speed: loc.speed,
        ignition: loc.ignition,
        updatedAt: loc.updatedAt,
        updatedAtMs,
        hasFix,
        isFresh,
        statusText: loc.status,
        emergency: loc.emergency,
        status: deriveStatus(loc, hasFix, now),
        // lock/unlock
        packetId: loc.packetId,
        packetState: loc.packetState,
        containerTag: loc.containerTag,
        lastLkAt: loc.lastLkAt,
        lastUkAt: loc.lastUkAt,
        isUnlockPacket: loc.isUnlockPacket,
        isCarrying: loc.isCarrying,
        raw: { equipment: eqp.raw, live: loc.raw },
      });
      usedDevices.add(loc.deviceId);
    });

    equipmentList.forEach((eqp) => {
      if (!eqp.deviceId || usedDevices.has(eqp.deviceId)) return;
      combined.push({
        id: eqp.id,
        deviceId: eqp.deviceId,
        name: eqp.name,
        type: eqp.type,
        lat: null,
        lon: null,
        heading: 0,
        speed: 0,
        ignition: null,
        updatedAt: null,
        updatedAtMs: null,
        hasFix: false,
        isFresh: false,
        statusText: "",
        emergency: false,
        status: "offline",
        raw: { equipment: eqp.raw, live: null },
      });
    });

    return combined;
  }, [equipmentList, liveLocationList]);

  const stats = useMemo(() => {
    const out = {
      total: equipment.length,
      moving: 0,
      idle: 0,
      offline: 0,
      ignition_off: 0,
      emergency: 0,
      lastUpdatedAt: null,
    };

    for (const eq of equipment) {
      out[eq.status] = (out[eq.status] || 0) + 1;
      if (eq.updatedAt) {
        const ts = new Date(eq.updatedAt).getTime();
        if (!Number.isNaN(ts)) {
          out.lastUpdatedAt = out.lastUpdatedAt ? Math.max(out.lastUpdatedAt, ts) : ts;
        }
      }
    }
    return out;
  }, [equipment]);

  return { equipment, stats };
}
