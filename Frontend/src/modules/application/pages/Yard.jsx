import React, { useState, useEffect, useCallback } from "react"
import axios from "axios"
import Navbar from "../../../components/layout/Navbar"
import { API_ENDPOINTS } from "../../../config/api"
import { FiEdit2, FiEye, FiGrid, FiList, FiMap, FiCheckCircle, FiXCircle, FiTrash2, FiSquare, FiRotateCcw, FiMousePointer } from "react-icons/fi"
import { GoogleMap, useJsApiLoader, Polygon, InfoWindow, Marker, Polyline } from "@react-google-maps/api"

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" }
const DEFAULT_CENTER = { lat: 18.897905866934074, lng: 73.00137179085313 }
const MIN_POLYGON_POINTS = 3
const CLOSE_POLYGON_DISTANCE_METERS = 8

const Badge = ({ label, value, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-800",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
  };
  const cls = colorClasses[color] || colorClasses.blue;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}: {value}
    </span>
  );
};

const Yard = () => {
  // ================= TABS =================
  const [activeTab, setActiveTab] = useState("grid")

  // ================= MASTER DATA STATES =================
  const [yards, setYards] = useState([])
  const [plants, setPlants] = useState([])
  const [blocks, setBlocks] = useState([])

  // ================= SELECTED VALUES (form state) =================
  const [selectedYard, setSelectedYard] = useState("")
  const [blockName, setBlockName] = useState("")
  const [blockCode, setBlockCode] = useState("")
  const [rowStart, setRowStart] = useState("")
  const [rowEnd, setRowEnd] = useState("")
  const [totalColumns, setTotalColumns] = useState("")
  const [saving, setSaving] = useState(false)
  const [savingMap, setSavingMap] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState(null)

  // ================= SUBMITTED STATE =================
  const [submittedData, setSubmittedData] = useState(null)
  const [highlightedRows, setHighlightedRows] = useState([])

  // ================= MAP STATE =================
  const [map, setMap] = useState(null)
  const [polygons, setPolygons] = useState([])
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState(null)
  const [activeDrawingPolygon, setActiveDrawingPolygon] = useState(null)
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const [drawingType, setDrawingType] = useState("polygon") // 'polygon' | 'rectangle'
  const [currentDrawingPath, setCurrentDrawingPath] = useState([])
  const [cursorPos, setCursorPos] = useState(null)
  const [selectedLayoutBlockId, setSelectedLayoutBlockId] = useState(null)

  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || ""
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: mapsApiKey,
  })

  // ================= DYNAMIC GRID =================
  const computeGridRows = () => {
    if (!rowStart || !rowEnd) return ["A", "B", "C"]
    const s = rowStart.toUpperCase().charCodeAt(0)
    const e = rowEnd.toUpperCase().charCodeAt(0)
    const rows = []
    for (let i = s; i <= e; i++) rows.push(String.fromCharCode(i))
    return rows.length > 0 ? rows : ["A", "B", "C"]
  }
  const gridRows = computeGridRows()
  const gridCols = Array.from({ length: Number(totalColumns) || 7 }, (_, i) => i + 1)

  // helper for auth headers
  const getAuthHeaders = () => {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken')
    return { Authorization: `Bearer ${token}` }
  }

  const getBlockId = (block) => Number(block?.BlockID ?? block?.blockId ?? block?.id)

  const parseBlockPolygon = (polygon) => {
    if (!polygon) return []
    if (Array.isArray(polygon)) return polygon
    try {
      const parsed = JSON.parse(polygon)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const toPointPath = (path) =>
    (Array.isArray(path) ? path : [])
      .map((point) => ({
        lat: Number(point?.lat ?? point?.LAT ?? point?.latitude),
        lng: Number(point?.lng ?? point?.LNG ?? point?.longitude),
      }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))

  const findBlockById = (blockId) => blocks.find((block) => getBlockId(block) === Number(blockId))

  const buildBlockPayload = (block, polygonPath = null) => ({
    BlockID: getBlockId(block),
    YardID: block?.YardID ? Number(block.YardID) : null,
    BlockName: block?.BlockName || "",
    BlockCode: block?.BlockCode || null,
    RowStart: block?.RowStart || null,
    RowEnd: block?.RowEnd || null,
    TotalColumns: block?.TotalColumns ? Number(block.TotalColumns) : null,
    Polygon: polygonPath ? toPointPath(polygonPath) : parseBlockPolygon(block?.Polygon),
    IsActive: block?.IsActive ?? true,
  })

  // ================= FETCH MASTER DATA =================
  const fetchMasterData = async () => {
    try {
      const res = await axios.get(API_ENDPOINTS.MASTER.GET_YARD, { headers: getAuthHeaders() })
      if (res.data.status === "success" || res.data.status === "partial") {
        const data = res.data.data
        setYards(data.yards || [])
        setPlants(data.plants || [])
        setBlocks(data.blocks || [])
      }
    } catch (error) {
      console.error("Error fetching master lists:", error)
    }
  }
  useEffect(() => { fetchMasterData() }, [])

  useEffect(() => {
    const savedPolygons = blocks
      .map((block) => {
        const path = toPointPath(parseBlockPolygon(block?.Polygon))
        if (path.length < MIN_POLYGON_POINTS) return null
        const blockId = getBlockId(block)
        return {
          id: `block-${blockId}`,
          blockId,
          name: block?.BlockName || `BLOCK-${blockId}`,
          path,
          color: "#4472c4",
          blockName: block?.BlockName || "",
        }
      })
      .filter(Boolean)

    setPolygons((prev) => {
      const draftPolygons = prev.filter((poly) => !poly.blockId)
      return [...savedPolygons, ...draftPolygons]
    })
  }, [blocks])

  // ================= COMPUTE ROW RANGE =================
  const computeHighlightedRows = (start, end) => {
    if (!start && !end) return []
    const startChar = (start || end).toUpperCase()
    const endChar = (end || start).toUpperCase()
    const rows = []
    for (let i = startChar.charCodeAt(0); i <= endChar.charCodeAt(0); i++) {
      rows.push(String.fromCharCode(i))
    }
    return rows
  }

  // ================= REAL-TIME HIGHLIGHTED ROWS =================
  const liveHighlightedRows = computeHighlightedRows(rowStart, rowEnd)
  const hasActiveFilters = selectedYard || blockName || blockCode || rowStart || rowEnd || totalColumns

  // ================= SAVE BLOCK TO DATABASE =================
  const handleSubmit = async () => {
    if (!blockName) return alert("Block Name is required")
    setSaving(true)
    try {
      const blockPayload = {
        YardID: selectedYard ? Number(selectedYard) : null,
        BlockName: blockName,
        BlockCode: blockCode || null,
        RowStart: rowStart.toUpperCase() || null,
        RowEnd: rowEnd.toUpperCase() || null,
        TotalColumns: totalColumns ? Number(totalColumns) : null,
        Polygon: null,
        IsActive: true
      }

      if (editingBlockId) {
        const existingBlock = findBlockById(editingBlockId)
        await axios.post(
          API_ENDPOINTS.MASTER.UPDATE_BLOCK,
          {
            ...blockPayload,
            BlockID: editingBlockId,
            Polygon: parseBlockPolygon(existingBlock?.Polygon),
          },
          { headers: getAuthHeaders() }
        )
      } else {
        await axios.post(API_ENDPOINTS.MASTER.ADD_BLOCK, blockPayload, { headers: getAuthHeaders() })
      }

      await fetchMasterData()
      handleClear()
    } catch (err) {
      console.error("Save failed:", err)
      alert("Failed to save block")
    } finally {
      setSaving(false)
    }
  }

  const handleClear = () => {
    setSelectedYard("")
    setBlockName("")
    setBlockCode("")
    setRowStart("")
    setRowEnd("")
    setTotalColumns("")
    setEditingBlockId(null)
    setSubmittedData(null)
    setHighlightedRows([])
  }

  const handleEditBlock = (block) => {
    setSelectedYard(block?.YardID ? String(block.YardID) : "")
    setBlockName(block?.BlockName || "")
    setBlockCode(block?.BlockCode || "")
    setRowStart(block?.RowStart || "")
    setRowEnd(block?.RowEnd || "")
    setTotalColumns(block?.TotalColumns ? String(block.TotalColumns) : "")
    setEditingBlockId(getBlockId(block) || null)
    setActiveTab("grid")
  }

  const handleDeleteBlock = async (block) => {
    const blockId = getBlockId(block)
    if (!blockId) return
    if (!window.confirm(`Delete block "${block?.BlockName || blockId}"?`)) return

    try {
      await axios.post(API_ENDPOINTS.MASTER.DELETE_BLOCK, { BlockID: blockId }, { headers: getAuthHeaders() })
      setPolygons((prev) => prev.filter((poly) => poly.blockId !== blockId))
      if (selectedLayoutBlockId === blockId) setSelectedLayoutBlockId(null)
      await fetchMasterData()
    } catch (err) {
      console.error("Delete block failed:", err)
      alert("Failed to delete block")
    }
  }

  const showBlockLayout = (block) => {
    const blockId = getBlockId(block)
    const path = toPointPath(parseBlockPolygon(block?.Polygon))
    setSelectedLayoutBlockId(blockId || null)
    setActiveTab("map")
    if (path.length >= MIN_POLYGON_POINTS) {
      setActiveDrawingPolygon(`block-${blockId}`)
    }
  }

  const saveMapLayout = async () => {
    if (!polygons.length) return

    const missingAssignments = polygons.filter((poly) => !poly.blockId && !poly.blockName)
    if (missingAssignments.length) {
      alert("Please assign every drawn polygon to a block before saving the map layout.")
      return
    }

    setSavingMap(true)
    try {
      const saveRequests = polygons.map((poly) => {
        const block = poly.blockId
          ? findBlockById(poly.blockId)
          : blocks.find((item) => item.BlockName === poly.blockName)
        if (!block) {
          throw new Error(`Block not found for ${poly.blockName || poly.name}`)
        }

        return axios.post(
          API_ENDPOINTS.MASTER.UPDATE_BLOCK,
          buildBlockPayload(block, poly.path),
          { headers: getAuthHeaders() }
        )
      })

      await Promise.all(saveRequests)
      await fetchMasterData()
      alert("Map layout saved successfully")
    } catch (err) {
      console.error("Save map layout failed:", err)
      alert("Failed to save map layout")
    } finally {
      setSavingMap(false)
    }
  }

  // Map drawing handlers
  const onMapLoad = useCallback((map) => {
    setMap(map)
  }, [])

  const onMapUnmount = useCallback((map) => {
    setMap(null)
  }, [])

  const getPointFromMapEvent = (e) => {
    if (!e?.latLng) return null
    return { lat: e.latLng.lat(), lng: e.latLng.lng() }
  }

  const startDrawing = (type) => {
    setCurrentDrawingPath([])
    setCursorPos(null)
    setSelectedPolygonIndex(null)
    setActiveDrawingPolygon(null)
    setDrawingType(type)
    setIsDrawingMode(true)
  }

  const getDistanceMeters = (pointA, pointB) => {
    const toRadians = (value) => (value * Math.PI) / 180
    const earthRadiusMeters = 6371000
    const deltaLat = toRadians(pointB.lat - pointA.lat)
    const deltaLng = toRadians(pointB.lng - pointA.lng)
    const latA = toRadians(pointA.lat)
    const latB = toRadians(pointB.lat)
    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const shouldClosePolygon = (point) => {
    if (drawingType !== "polygon" || currentDrawingPath.length < MIN_POLYGON_POINTS) return false
    return getDistanceMeters(point, currentDrawingPath[0]) <= CLOSE_POLYGON_DISTANCE_METERS
  }

  const onMapClick = (e) => {
    if (!isDrawingMode) return

    const point = getPointFromMapEvent(e)
    if (!point) return

    if (drawingType === "rectangle") {
      if (currentDrawingPath.length === 0) {
        setCurrentDrawingPath([point])
      } else if (currentDrawingPath.length === 1) {
        const p1 = currentDrawingPath[0]
        const p2 = point
        const rectPath = [
          p1,
          { lat: p1.lat, lng: p2.lng },
          p2,
          { lat: p2.lat, lng: p1.lng }
        ]
        finishDrawingPath(rectPath)
      }
    } else {
      if (shouldClosePolygon(point)) {
        finishDrawing()
        return
      }
      setCurrentDrawingPath(prev => [...prev, point])
    }
  }

  const onMapDoubleClick = (e) => {
    if (isDrawingMode && drawingType === "polygon" && currentDrawingPath.length >= MIN_POLYGON_POINTS) {
      if (e?.domEvent) {
        e.domEvent.preventDefault()
        e.domEvent.stopPropagation()
      }
      finishDrawing()
    }
  }

  const stopDrawingToolbarEvent = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.nativeEvent?.stopImmediatePropagation) {
      e.nativeEvent.stopImmediatePropagation()
    }
  }

  const handleToolbarClick = (handler) => (e) => {
    stopDrawingToolbarEvent(e)
    handler()
  }

  const handlePolygonClick = (poly) => {
    if (isDrawingMode) return
    setSelectedPolygonIndex(poly)
  }

  const closePolygonFromFirstPoint = (e) => {
    if (e?.domEvent) {
      e.domEvent.preventDefault()
      e.domEvent.stopPropagation()
    }
    if (currentDrawingPath.length >= MIN_POLYGON_POINTS) {
      finishDrawing()
    }
  }

  const onMapMouseMove = (e) => {
    const point = getPointFromMapEvent(e)
    if (isDrawingMode && currentDrawingPath.length > 0 && point) {
      setCursorPos(point)
    } else {
      setCursorPos(null)
    }
  }

  const finishDrawingPath = (path) => {
    if (path.length < MIN_POLYGON_POINTS) return

    const polygonId = Date.now()
    setPolygons(prev => {
      const newPoly = {
        id: polygonId,
        name: `BLOCK-${prev.length + 1}`,
        path,
        color: "#4472c4", // Match image blue style
        blockName: ""
      }
      return [...prev, newPoly]
    })
    setActiveDrawingPolygon(polygonId)
    setCurrentDrawingPath([])
    setCursorPos(null)
    setIsDrawingMode(false)
  }

  const finishDrawing = () => {
    if (currentDrawingPath.length >= MIN_POLYGON_POINTS) {
      finishDrawingPath(currentDrawingPath)
    }
  }

  const undoLastPoint = () => {
    setCurrentDrawingPath(prev => {
      const nextPath = prev.slice(0, -1)
      if (nextPath.length === 0) {
        setCursorPos(null)
      }
      return nextPath
    })
  }

  const cancelDrawing = () => {
    setCurrentDrawingPath([])
    setCursorPos(null)
    setIsDrawingMode(false)
  }

  const deletePolygon = (id) => {
    setPolygons(prev => prev.filter(p => p.id !== id))
    if (selectedPolygonIndex?.id === id) {
      setSelectedPolygonIndex(null)
    }
    if (activeDrawingPolygon === id) {
      setActiveDrawingPolygon(null)
    }
  }

  const getBlockRows = (block) => {
    const start = String(block?.RowStart || "").trim().toUpperCase()
    const end = String(block?.RowEnd || start).trim().toUpperCase()
    if (!start) return []

    const startCode = start.charCodeAt(0)
    const endCode = end.charCodeAt(0)
    if (!Number.isFinite(startCode) || !Number.isFinite(endCode)) return []

    const direction = startCode <= endCode ? 1 : -1
    const rows = []
    for (let code = startCode; direction > 0 ? code <= endCode : code >= endCode; code += direction) {
      rows.push(String.fromCharCode(code))
    }
    return rows
  }

  const getBlockColumnCount = (block) => Math.max(0, Number(block?.TotalColumns) || 0)

  const getPolygonBlock = (poly) =>
    poly?.blockId ? findBlockById(poly.blockId) : blocks.find((block) => block.BlockName === poly?.blockName)

  const getPathBounds = (path) => {
    const points = toPointPath(path)
    if (!points.length) return null
    return points.reduce(
      (bounds, point) => ({
        minLat: Math.min(bounds.minLat, point.lat),
        maxLat: Math.max(bounds.maxLat, point.lat),
        minLng: Math.min(bounds.minLng, point.lng),
        maxLng: Math.max(bounds.maxLng, point.lng),
      }),
      { minLat: points[0].lat, maxLat: points[0].lat, minLng: points[0].lng, maxLng: points[0].lng }
    )
  }

  const getHorizontalSegments = (path, lat) => {
    const intersections = []
    path.forEach((point, index) => {
      const next = path[(index + 1) % path.length]
      if ((point.lat <= lat && next.lat > lat) || (next.lat <= lat && point.lat > lat)) {
        const ratio = (lat - point.lat) / (next.lat - point.lat)
        intersections.push(point.lng + ratio * (next.lng - point.lng))
      }
    })
    intersections.sort((a, b) => a - b)
    const segments = []
    for (let i = 0; i < intersections.length - 1; i += 2) {
      segments.push([{ lat, lng: intersections[i] }, { lat, lng: intersections[i + 1] }])
    }
    return segments
  }

  const getVerticalSegments = (path, lng) => {
    const intersections = []
    path.forEach((point, index) => {
      const next = path[(index + 1) % path.length]
      if ((point.lng <= lng && next.lng > lng) || (next.lng <= lng && point.lng > lng)) {
        const ratio = (lng - point.lng) / (next.lng - point.lng)
        intersections.push(point.lat + ratio * (next.lat - point.lat))
      }
    })
    intersections.sort((a, b) => a - b)
    const segments = []
    for (let i = 0; i < intersections.length - 1; i += 2) {
      segments.push([{ lat: intersections[i], lng }, { lat: intersections[i + 1], lng }])
    }
    return segments
  }

  const getBlockGridOverlay = (poly) => {
    const block = getPolygonBlock(poly)
    const path = toPointPath(poly?.path)
    const bounds = getPathBounds(path)
    if (!block || path.length < MIN_POLYGON_POINTS || !bounds) return { lines: [], labels: [] }

    const rows = getBlockRows(block)
    const columnCount = getBlockColumnCount(block)
    const lines = []
    const labels = []

    if (rows.length > 1) {
      const rowStep = (bounds.maxLat - bounds.minLat) / rows.length
      for (let i = 1; i < rows.length; i += 1) {
        getHorizontalSegments(path, bounds.minLat + rowStep * i).forEach((segment) => {
          lines.push({ key: `${poly.id}-row-${i}-${segment[0].lng}`, path: segment })
        })
      }

      if (poly.blockId === selectedLayoutBlockId) {
        rows.forEach((row, index) => {
          const lat = bounds.minLat + rowStep * (index + 0.5)
          const segment = getHorizontalSegments(path, lat)[0]
          if (segment) labels.push({ key: `${poly.id}-row-label-${row}`, text: row, position: { lat, lng: segment[0].lng } })
        })
      }
    }

    if (columnCount > 1) {
      const columnStep = (bounds.maxLng - bounds.minLng) / columnCount
      for (let i = 1; i < columnCount; i += 1) {
        getVerticalSegments(path, bounds.minLng + columnStep * i).forEach((segment) => {
          lines.push({ key: `${poly.id}-col-${i}-${segment[0].lat}`, path: segment })
        })
      }

      if (poly.blockId === selectedLayoutBlockId) {
        for (let i = 0; i < columnCount; i += 1) {
          const lng = bounds.minLng + columnStep * (i + 0.5)
          const segment = getVerticalSegments(path, lng)[0]
          if (segment) labels.push({ key: `${poly.id}-col-label-${i + 1}`, text: String(i + 1), position: { lat: segment[1].lat, lng } })
        }
      }
    }

    return { lines, labels }
  }

  useEffect(() => {
    if (!map || activeTab !== "map" || isDrawingMode || currentDrawingPath.length) return

    const visiblePolygons = selectedLayoutBlockId
      ? polygons.filter((poly) => poly.blockId === selectedLayoutBlockId)
      : polygons
    const allPoints = visiblePolygons.flatMap((poly) => toPointPath(poly.path))
    if (!allPoints.length || !window.google?.maps) return

    const bounds = new window.google.maps.LatLngBounds()
    allPoints.forEach((point) => bounds.extend(point))
    map.fitBounds(bounds)
  }, [activeTab, currentDrawingPath.length, isDrawingMode, map, polygons, selectedLayoutBlockId])

  const activeHighlightedRows = liveHighlightedRows

  return (
    <div className="min-h-screen bg-[#0c111f]">
      <div className="min-h-screen bg-cover bg-center" style={{ backgroundImage: "url('/Images/bgimageold.png')" }}>
        <div className="min-h-screen bg-white/80 backdrop-blur-sm">
          <Navbar />

          <main className="max-w-[1920px] mx-auto px-6 py-8">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col min-h-[700px]">

              {/* Gradient Header with Tabs */}
              <header className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white">
                <div className="px-6 py-4 border-b border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-wide">Yard Management</h1>
                    <p className="text-sm text-white/80 mt-1">Configure yard grids, assign blocks, and draw zones</p>
                  </div>

                  {/* Tab Switcher */}
                  <div className="flex bg-black/20 rounded-lg p-1">
                    <button
                      onClick={() => setActiveTab('grid')}
                      className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'grid' ? 'bg-white text-[#0e4a78] shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                    >
                      <FiGrid /> Add Block
                    </button>
                    <button
                      onClick={() => setActiveTab('map')}
                      className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'map' ? 'bg-white text-[#0e4a78] shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                    >
                      <FiMap /> Draw Block
                    </button>
                    <button
                      onClick={() => setActiveTab('blocks')}
                      className={`px-4 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'blocks' ? 'bg-white text-[#0e4a78] shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                    >
                      <FiList /> View Block
                    </button>
                  </div>
                </div>
              </header>

              {/* VIEW: GRID CONFIGURATION */}
              {activeTab === 'grid' && (
                <div className="flex-1 p-6 bg-slate-50 overflow-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">

                    {/* Filters Column */}
                    <div className="lg:col-span-1 space-y-4">
                      {/* Block Selection */}
                      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                          <h3 className="font-bold text-slate-700">Block Selection</h3>
                        </div>
                        <div className="p-4 space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Yard</label>
                            <select
                              value={selectedYard}
                              onChange={(e) => setSelectedYard(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/20 focus:border-[#0e4a78]"
                            >
                              <option value="">Select Yard</option>
                              {yards.map((yard) => (
                                <option key={yard.YardID} value={yard.YardID}>{yard.YardName}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Block Name</label>
                            <input
                              type="text"
                              placeholder="e.g. Block A"
                              value={blockName}
                              onChange={(e) => setBlockName(e.target.value)}
                              className="w-full rounded-lg text-black border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/20 focus:border-[#0e4a78]"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Block Code</label>
                            <input
                              type="text"
                              placeholder="e.g. BLK-A"
                              value={blockCode}
                              onChange={(e) => setBlockCode(e.target.value)}
                              className="w-full rounded-lg text-black border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/20 focus:border-[#0e4a78]"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Row Range</label>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                              <input
                                type="text"
                                placeholder="A"
                                value={rowStart}
                                onChange={(e) => setRowStart(e.target.value)}
                                maxLength={2}
                                className="w-full rounded-lg text-black border border-slate-300 bg-white px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/20 focus:border-[#0e4a78] uppercase"
                              />
                              <span className="text-slate-500 font-bold text-center">to</span>
                              <input
                                type="text"
                                placeholder="G"
                                value={rowEnd}
                                onChange={(e) => setRowEnd(e.target.value)}
                                maxLength={2}
                                className="w-full rounded-lg text-black border border-slate-300 bg-white px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/20 focus:border-[#0e4a78] uppercase"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Total Columns</label>
                            <input
                              type="number"
                              placeholder="e.g. 10"
                              value={totalColumns}
                              onChange={(e) => setTotalColumns(e.target.value)}
                              min={1}
                              className="w-full rounded-lg text-black border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0e4a78]/20 focus:border-[#0e4a78]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        <button
                          onClick={handleClear}
                          className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-lg transition-colors shadow-sm"
                        >
                          Clear
                        </button>
                        <button
                          onClick={handleSubmit}
                          disabled={saving}
                          className="flex-1 py-2.5 bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] hover:from-[#0a3b61] hover:to-[#083153] text-white text-sm font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        >
                          {saving ? "Saving..." : editingBlockId ? "Update Block" : "Save Block"}
                        </button>
                      </div>
                    </div>

                    {/* Grid Column */}
                    <div className="lg:col-span-3">
                      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                          <h3 className="font-bold text-slate-700">Grid Representation</h3>
                          {activeHighlightedRows.length > 0 && (
                            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded font-bold border border-amber-200">
                              Selected: Row {activeHighlightedRows.join(", ")}
                            </span>
                          )}
                        </div>

                        <div className="p-6 flex-1 overflow-auto">
                          {hasActiveFilters && (
                            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 mb-6">
                              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Live Configuration</h4>
                              <div className="flex flex-wrap gap-2">
                                {selectedYard && <Badge label="Yard" value={yards.find(y=>y.YardID===Number(selectedYard))?.YardName || selectedYard} />}
                                {blockName && <Badge label="Block" value={blockName} />}
                                {blockCode && <Badge label="Code" value={blockCode} />}
                                {rowStart && <Badge label="Row Start" value={rowStart.toUpperCase()} color="emerald" />}
                                {rowEnd && <Badge label="Row End" value={rowEnd.toUpperCase()} color="emerald" />}
                                {totalColumns && <Badge label="Columns" value={totalColumns} color="emerald" />}
                              </div>
                            </div>
                          )}

                          <div className="overflow-x-auto border border-slate-200 rounded-lg bg-slate-50 p-4">
                            <div className="inline-block min-w-full">
                              <div className="flex">
                                <div className="flex flex-col">
                                  <div className="w-12 h-10 bg-transparent" />
                                  {gridRows.map((rowLabel) => {
                                    const isHighlighted = activeHighlightedRows.includes(rowLabel)
                                    return (
                                      <div
                                        key={rowLabel}
                                        className={`w-12 h-16 flex items-center justify-center font-bold text-lg border-b border-white transition-all
                                          ${isHighlighted ? "bg-[#ffc000] text-slate-800 shadow-inner" : "bg-[#0e4a78] text-white"}`}
                                      >
                                        {rowLabel}
                                      </div>
                                    )
                                  })}
                                </div>

                                <div className="flex-1">
                                  <div className="flex">
                                    {gridCols.map((col) => (
                                      <div
                                        key={col}
                                        className="flex-1 min-w-[120px] h-10 bg-[#0e4a78] text-white flex items-center justify-center font-bold text-sm border-l border-white/20"
                                      >
                                        Col {col}
                                      </div>
                                    ))}
                                  </div>

                                  {gridRows.map((rowLabel) => {
                                    const isHighlighted = activeHighlightedRows.includes(rowLabel)
                                    return (
                                      <div key={rowLabel} className="flex">
                                        {gridCols.map((col) => (
                                          <div
                                            key={`${rowLabel}-${col}`}
                                            className={`flex-1 min-w-[120px] h-16 border-l border-b border-white flex items-center justify-center transition-all
                                              ${isHighlighted
                                                ? "bg-amber-50 hover:bg-amber-100"
                                                : "bg-slate-100 hover:bg-blue-50"
                                              }`}
                                          >
                                            <div className="text-center">
                                              <div className={`text-xs font-bold ${isHighlighted ? "text-amber-900" : "text-slate-600"}`}>
                                                {rowLabel}{col}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex items-center gap-6 text-xs text-slate-500 font-medium px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200" />
                              <span>Empty Slot</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded bg-amber-50 border border-amber-200" />
                              <span>Selected Row Range</span>
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* VIEW: BLOCK MANAGEMENT */}
              {activeTab === 'blocks' && (
                <div className="flex-1 bg-slate-50 p-6 overflow-auto">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-800">All Blocks ({blocks.length})</h3>
                        <p className="text-xs text-slate-500 mt-1">View saved blocks, edit grid details, delete blocks, or open the saved map layout.</p>
                      </div>
                      <button
                        onClick={fetchMasterData}
                        className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm text-left">
                        <thead className="bg-[#0e4a78] text-white">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Block</th>
                            <th className="px-4 py-3 font-semibold">Code</th>
                            <th className="px-4 py-3 font-semibold">Rows</th>
                            <th className="px-4 py-3 font-semibold">Columns</th>
                            <th className="px-4 py-3 font-semibold">Layout</th>
                            <th className="px-4 py-3 font-semibold text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {blocks.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                                No blocks found
                              </td>
                            </tr>
                          ) : (
                            blocks.map((block) => {
                              const blockId = getBlockId(block)
                              const polygonPath = toPointPath(parseBlockPolygon(block?.Polygon))
                              const hasLayout = polygonPath.length >= MIN_POLYGON_POINTS
                              return (
                                <tr key={blockId || block.BlockName} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-semibold text-slate-800">{block.BlockName || "-"}</td>
                                  <td className="px-4 py-3 text-slate-600">{block.BlockCode || "-"}</td>
                                  <td className="px-4 py-3 text-slate-600">
                                    {block.RowStart || "-"} {block.RowEnd ? `to ${block.RowEnd}` : ""}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">{block.TotalColumns || "-"}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${hasLayout ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                      {hasLayout ? "Saved" : "Not mapped"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => showBlockLayout(block)}
                                        disabled={!hasLayout}
                                        className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
                                        title="Show block layout"
                                      >
                                        <FiEye size={15} />
                                      </button>
                                      <button
                                        onClick={() => handleEditBlock(block)}
                                        className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
                                        title="Edit block"
                                      >
                                        <FiEdit2 size={15} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteBlock(block)}
                                        className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
                                        title="Delete block"
                                      >
                                        <FiTrash2 size={15} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: MAP DRAWING */}
              {activeTab === 'map' && (
                <div className="flex-1 flex flex-col lg:flex-row bg-slate-50 h-[600px]">
                  
                  {/* Map Panel */}
                  <div className="flex-1 relative">
                    {!isLoaded ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                        <div className="w-10 h-10 border-4 border-[#0e4a78] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : loadError ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-600 font-bold">
                        Failed to load Google Maps. Check API Key.
                      </div>
                    ) : (
                      <GoogleMap
                        mapContainerStyle={MAP_CONTAINER_STYLE}
                        center={DEFAULT_CENTER}
                        zoom={17}
                        onLoad={onMapLoad}
                        onUnmount={onMapUnmount}
                        onClick={onMapClick}
                        onDblClick={onMapDoubleClick}
                        onMouseMove={onMapMouseMove}
                        options={{
                          mapTypeId: "satellite",
                          streetViewControl: false,
                          fullscreenControl: true,
                          zoomControl: true,
                          disableDoubleClickZoom: isDrawingMode,
                          draggableCursor: isDrawingMode ? "crosshair" : "grab"
                        }}
                      >
                        {/* Awesome Custom Drawing Toolbar Overlay */}
                        <div
                          className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
                          onClick={stopDrawingToolbarEvent}
                          onMouseDown={stopDrawingToolbarEvent}
                          onDoubleClick={stopDrawingToolbarEvent}
                        >
                          <div className="flex bg-white/90 backdrop-blur-md rounded-full shadow-xl overflow-hidden border border-white/40 p-1">
                            {!isDrawingMode ? (
                              <>
                                <button 
                                  className="px-5 py-2.5 text-sm font-bold flex items-center gap-2 hover:bg-slate-100/80 text-slate-700 rounded-full transition-all"
                                  onClick={handleToolbarClick(() => startDrawing('polygon'))}
                                >
                                  <FiMousePointer /> Draw Polygon
                                </button>
                                <button 
                                  className="px-5 py-2.5 text-sm font-bold flex items-center gap-2 hover:bg-slate-100/80 text-slate-700 rounded-full transition-all"
                                  onClick={handleToolbarClick(() => startDrawing('rectangle'))}
                                >
                                  <FiSquare /> Draw Rectangle
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center">
                                <div className="px-5 py-2.5 text-sm font-bold bg-[#0e4a78] text-white flex items-center gap-2 rounded-full shadow-inner">
                                  {drawingType === 'polygon' ? <><span className="text-lg leading-none">⬠</span> Polygon Mode</> : <><FiSquare /> Rectangle Mode</>}
                                </div>
                                
                                {drawingType === 'polygon' && currentDrawingPath.length > 0 && (
                                  <button 
                                    className="px-4 py-2 mx-1 text-sm font-bold hover:bg-slate-200 text-slate-700 flex items-center gap-2 rounded-full transition-colors"
                                    onClick={handleToolbarClick(undoLastPoint)}
                                  >
                                    <FiRotateCcw /> Undo
                                  </button>
                                )}

                                {drawingType === 'polygon' && currentDrawingPath.length > 2 && (
                                  <button 
                                    className="px-5 py-2.5 ml-1 text-sm font-bold bg-green-500 hover:bg-green-600 text-white flex items-center gap-2 rounded-full transition-colors shadow-md"
                                    onClick={handleToolbarClick(finishDrawing)}
                                  >
                                    <FiCheckCircle /> Finish
                                  </button>
                                )}
                                
                                <button 
                                  className="px-5 py-2.5 ml-1 text-sm font-bold bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 rounded-full transition-colors shadow-md"
                                  onClick={handleToolbarClick(cancelDrawing)}
                                >
                                  <FiXCircle /> Cancel
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {/* Live Instructional Badge */}
                          {isDrawingMode && (
                            <div className="bg-black/70 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-lg animate-fade-in">
                              {drawingType === 'polygon' && currentDrawingPath.length === 0 && "Click anywhere on the map to start drawing a polygon."}
                              {drawingType === 'polygon' && currentDrawingPath.length > 0 && currentDrawingPath.length < 3 && "Click to add more points."}
                              {drawingType === 'polygon' && currentDrawingPath.length >= 3 && "Click to add points, or click Finish to complete."}
                              {drawingType === 'rectangle' && currentDrawingPath.length === 0 && "Click to set the first corner of the rectangle."}
                              {drawingType === 'rectangle' && currentDrawingPath.length === 1 && "Click the opposite corner to complete the rectangle."}
                            </div>
                          )}
                        </div>

                        {/* Live Drawing Path Preview */}
                        {isDrawingMode && currentDrawingPath.length > 0 && (
                          <>
                            {drawingType === 'polygon' && (
                              <>
                                <Polyline
                                  path={cursorPos ? [...currentDrawingPath, cursorPos] : currentDrawingPath}
                                  options={{ strokeColor: "#4472c4", strokeWeight: 3, zIndex: 2, strokeOpacity: cursorPos ? 0.8 : 1, clickable: false }}
                                />
                                {currentDrawingPath.length > 2 && (
                                  <Polygon
                                    paths={currentDrawingPath}
                                    options={{ fillColor: "#4472c4", fillOpacity: 0.3, strokeOpacity: 0, zIndex: 1, clickable: false }}
                                  />
                                )}
                              </>
                            )}

                            {drawingType === 'rectangle' && currentDrawingPath.length === 1 && cursorPos && (
                              <Polygon
                                paths={[
                                  currentDrawingPath[0],
                                  { lat: currentDrawingPath[0].lat, lng: cursorPos.lng },
                                  cursorPos,
                                  { lat: cursorPos.lat, lng: currentDrawingPath[0].lng }
                                ]}
                                options={{ fillColor: "#4472c4", fillOpacity: 0.4, strokeColor: "#4472c4", strokeWeight: 3, zIndex: 2, clickable: false }}
                              />
                            )}

                            {/* Node Markers */}
                            {currentDrawingPath.map((p, idx) => (
                              <Marker 
                                key={`temp-${idx}`} 
                                position={p} 
                                icon={{
                                  path: window.google.maps.SymbolPath.CIRCLE,
                                  scale: idx === 0 && drawingType === 'polygon' && currentDrawingPath.length >= MIN_POLYGON_POINTS ? 7 : 4,
                                  fillColor: idx === 0 && drawingType === 'polygon' && currentDrawingPath.length >= MIN_POLYGON_POINTS ? "#22c55e" : "white",
                                  fillOpacity: 1,
                                  strokeWeight: 2,
                                  strokeColor: "#4472c4"
                                }} 
                                clickable={idx === 0 && drawingType === 'polygon' && currentDrawingPath.length >= MIN_POLYGON_POINTS}
                                onClick={idx === 0 && drawingType === 'polygon' && currentDrawingPath.length >= MIN_POLYGON_POINTS ? closePolygonFromFirstPoint : undefined}
                                title={idx === 0 && drawingType === 'polygon' && currentDrawingPath.length >= MIN_POLYGON_POINTS ? "Click to close polygon" : undefined}
                              />
                            ))}
                          </>
                        )}

                        {/* Render Saved Polygons */}
                        {polygons.map((poly) => (
                          <Polygon
                            key={poly.id}
                            paths={poly.path}
                            options={{
                              fillColor: poly.blockId === selectedLayoutBlockId ? "#22c55e" : poly.color,
                              fillOpacity: poly.blockId === selectedLayoutBlockId ? 0.45 : 0.3,
                              strokeColor: poly.blockId === selectedLayoutBlockId ? "#16a34a" : poly.color,
                              strokeWeight: poly.blockId === selectedLayoutBlockId ? 4 : 2,
                              clickable: !isDrawingMode,
                            }}
                            onClick={() => handlePolygonClick(poly)}
                          />
                        ))}

                        {/* Render row / column grid inside each mapped block */}
                        {polygons.flatMap((poly) =>
                          getBlockGridOverlay(poly).lines.map((line) => (
                            <Polyline
                              key={line.key}
                              path={line.path}
                              options={{
                                strokeColor: poly.blockId === selectedLayoutBlockId ? "#ffffff" : "#dbeafe",
                                strokeOpacity: poly.blockId === selectedLayoutBlockId ? 0.95 : 0.65,
                                strokeWeight: poly.blockId === selectedLayoutBlockId ? 2 : 1,
                                clickable: false,
                                zIndex: poly.blockId === selectedLayoutBlockId ? 6 : 4,
                              }}
                            />
                          ))
                        )}

                        {polygons.flatMap((poly) =>
                          getBlockGridOverlay(poly).labels.map((label) => (
                            <Marker
                              key={label.key}
                              position={label.position}
                              icon={{
                                path: window.google.maps.SymbolPath.CIRCLE,
                                scale: 0,
                              }}
                              label={{
                                text: label.text,
                                color: "#ffffff",
                                fontWeight: "bold",
                                fontSize: "12px",
                                className: "drop-shadow-md",
                              }}
                              clickable={false}
                            />
                          ))
                        )}
                        
                        {/* Map Labels for Blocks */}
                        {polygons.map((poly) => {
                           // Compute center for label
                           const bounds = new window.google.maps.LatLngBounds();
                           poly.path.forEach(p => bounds.extend(p));
                           const center = bounds.getCenter();
                           return (
                             <Marker
                               key={`label-${poly.id}`}
                               position={center}
                               icon={{
                                 path: window.google.maps.SymbolPath.CIRCLE,
                                 scale: 0, // Invisible marker, we only want the label
                               }}
                               label={{
                                 text: poly.name,
                                 color: '#ff0000',
                                 fontWeight: 'bold',
                                 fontSize: '16px',
                                 className: 'drop-shadow-md',
                               }}
                               clickable={false}
                             />
                           )
                        })}

                        {/* Yard Mapping InfoWindow */}
                        {activeDrawingPolygon && polygons.find(p => p.id === activeDrawingPolygon) && (() => {
                          const poly = polygons.find(p => p.id === activeDrawingPolygon);
                          const bounds = new window.google.maps.LatLngBounds();
                          poly.path.forEach(p => bounds.extend(p));
                          const center = bounds.getCenter();
                          const displayCoords = poly.path.length > 0 ? `${poly.path[0].lat.toFixed(6)}, ${poly.path[0].lng.toFixed(6)}` : "";

                          return (
                            <InfoWindow
                              position={center}
                              onCloseClick={() => setActiveDrawingPolygon(null)}
                            >
                              <div className="w-[300px] font-sans text-slate-800 -m-1">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-[#0e4a78] to-[#0a3b61] text-white px-4 py-3 rounded-t-lg shadow-sm flex items-center justify-between border-b border-[#082a45]">
                                  <span className="font-bold text-[15px] tracking-wide flex items-center gap-2">
                                    <FiMap className="opacity-80" /> Map to Block
                                  </span>
                                </div>
                                {/* Body */}
                                <div className="p-5 space-y-4 bg-white rounded-b-lg shadow-inner">
                                  
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assign Block</label>
                                    <select 
                                      className="w-full border border-slate-300 rounded-md px-3 py-2.5 text-sm text-slate-700 font-semibold focus:outline-none focus:border-[#0e4a78] focus:ring-1 focus:ring-[#0e4a78] bg-slate-50 hover:bg-white transition-colors cursor-pointer shadow-sm"
                                      value={poly.blockId || ""}
                                      onChange={(e) => {
                                        const blockId = Number(e.target.value)
                                        const block = findBlockById(blockId)
                                        setPolygons(prev => prev.map(p => p.id === poly.id ? {
                                          ...p,
                                          blockId,
                                          blockName: block?.BlockName || "",
                                          name: block?.BlockName || p.name
                                        } : p))
                                      }}
                                    >
                                      <option value="">-- Select Block --</option>
                                      {blocks.filter(b => b.BlockName).map(b => (
                                        <option key={getBlockId(b) || b.BlockName} value={getBlockId(b)}>
                                          {b.BlockName} {b.BlockCode ? `(${b.BlockCode})` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Coordinates</label>
                                    <input 
                                      readOnly 
                                      value={displayCoords}
                                      className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-500 bg-slate-100/80 font-mono shadow-inner outline-none cursor-not-allowed"
                                    />
                                  </div>

                                  <div className="flex justify-end pt-3 mt-2 border-t border-slate-100">
                                    <button 
                                      className="bg-[#0e4a78] hover:bg-[#0a3b61] text-white px-6 py-2 rounded-md font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                                      onClick={() => setActiveDrawingPolygon(null)}
                                    >
                                      <FiCheckCircle /> Confirm
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </InfoWindow>
                          )
                        })()}

                      </GoogleMap>
                    )}
                  </div>

                  {/* Sidebar for Drawn Blocks */}
                  <div className="w-full lg:w-80 bg-white border-l border-slate-200 flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)]">
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                      <h3 className="font-bold text-slate-800">Drawn Blocks ({polygons.length})</h3>
                      <p className="text-xs text-slate-500 mt-1">Use map tools to draw polygons and define yard blocks visually.</p>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-3">
                      {polygons.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <FiMap className="mx-auto text-3xl mb-2 opacity-50" />
                          <p className="text-sm">No blocks drawn yet</p>
                        </div>
                      ) : (
                        polygons.map((poly) => (
                          <div key={poly.id} className={`bg-white border rounded-lg p-3 shadow-sm transition-colors ${poly.blockId === selectedLayoutBlockId ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200 hover:border-blue-300"}`}>
                            <div className="flex items-center justify-between mb-2">
                              <input 
                                type="text"
                                value={poly.name}
                                onChange={(e) => {
                                  setPolygons(prev => prev.map(p => p.id === poly.id ? {...p, name: e.target.value} : p))
                                }}
                                className="font-bold text-sm text-slate-700 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-500 w-2/3"
                              />
                              <button onClick={() => deletePolygon(poly.id)} className="text-red-400 hover:text-red-600 p-1">
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                            <div className="text-xs text-slate-500 space-y-1">
                              <p>Points: {poly.path.length}</p>
                              <p>Block: {poly.blockName || "Not assigned"}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`w-3 h-3 rounded-full ${poly.blockId ? "bg-emerald-500" : "bg-red-500"}`}></span>
                                <span>{poly.blockId ? "Ready to save" : "Assign block before saving"}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {polygons.length > 0 && (
                      <div className="p-4 border-t border-slate-200 bg-slate-50">
                        <button
                          onClick={saveMapLayout}
                          disabled={savingMap}
                          className="w-full py-2 bg-[#0e4a78] text-white rounded-lg text-sm font-bold shadow-md hover:bg-[#0a3b61] transition-colors disabled:opacity-50"
                        >
                          {savingMap ? "Saving Map..." : "Save Map Layout"}
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Yard
