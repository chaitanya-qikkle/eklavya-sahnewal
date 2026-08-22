import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getStoredUser, logout } from "../../services/authService";
import { confirmAction, notify } from "../../utils/notify";
import { clearAuth, selectAuthUser } from "../../store/slices/authSlice";
import {
  FaTachometerAlt,
  FaDoorOpen,
  FaBox,
  FaTruck,
  FaChartBar,
  FaCogs,
  FaMobileAlt,
  FaUserCog,
  FaSignOutAlt,
  FaChevronDown,
  FaBars,
  FaTimes,
  FaWarehouse,
  FaServer,
  FaMicrochip,
  FaMapMarkerAlt,
  FaWrench,
  FaExclamationTriangle,
  FaClipboardList,
  FaHistory,
  FaRecycle,
  FaUpload,
  FaPallet,
  FaTrafficLight,
  FaCircle,
  FaClipboardCheck,
  FaDatabase,
  FaUsers,
  FaUserShield,
  FaSitemap,
  FaCog,
  FaMapPin,
  FaSlidersH,
  FaDesktop,
  FaTruckLoading,
  FaChartLine,
  FaFileAlt,
} from "react-icons/fa";
import { RiDashboardFill } from "react-icons/ri";
import { useGetMenusQuery, useGetRoleMenusQuery } from "../../store/api/ymsApi";

const Navbar = ({ brand = "Qikkle" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const authUser = useSelector(selectAuthUser);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [activeMainMenu, setActiveMainMenu] = useState("DASHBOARD");
  const [expandedMenus, setExpandedMenus] = useState({});
  const [, setExpandedNestedMenus] = useState({});
  const [hoveredMenu, setHoveredMenu] = useState(null);
  const hoverTimeoutRef = useRef(null);

  const [currentUser, setCurrentUser] = useState({
    name: "Guest",
    role: "User",
    roleId: null,
  });

  useEffect(() => {
    // Prefer Redux user (immediately available after login), fall back to sessionStorage.
    // This prevents a common case where the navbar mounts before sessionStorage is read.
    const user = authUser || getStoredUser();
    if (user) {
      // Prioritize full name from backend response structure if available
      let name = user.username || user.name || "User";

      if (user.first_name) {
        name = user.first_name;
      }

      const role = user.role || user.ROLE || user.role_name || "User";
      const roleId = user.role_id ?? user.ROLE_ID ?? user.roleId ?? null;
      setCurrentUser({ name, role, roleId });
    }
  }, [authUser]);

  const { data: roleMenusResponse, isLoading: roleMenusLoading } =
    useGetRoleMenusQuery(currentUser?.roleId, {
      skip: !currentUser?.roleId,
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    });

  const { data: menusResponse } = useGetMenusQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const iconByLabel = useMemo(
    () => ({
      DASHBOARD: <RiDashboardFill />,
      GATE: <FaDoorOpen />,
      CONTAINER: <FaBox />,
      TRAILER: <FaTruck />,
      REPORT: <FaChartBar />,
      MACHINE: <FaCogs />,
      APPLICATION: <FaMobileAlt />,
      USER_SETTINGS: <FaUserCog />,
    }),
    []
  );

  const handleSignOut = async () => {
    const confirmed = await confirmAction({
      title: "Sign Out?",
      text: "Are you sure you want to sign out?",
      confirmButtonText: "Sign Out",
    });

    if (!confirmed) return;

    dispatch(clearAuth());
    logout();
    notify.success("Signed out", "You have been successfully signed out");
    navigate("/");
  };

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleHoverStart = (label) => {
    clearHoverTimeout();
    setHoveredMenu(label);
  };

  const handleHoverEnd = () => {
    clearHoverTimeout();
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredMenu(null);
    }, 200);
  };

  const DB_URL_TO_REACT = {
    "AdminDashboard/Dashboard/Index":            "/dashboard/admin",
    "AdminDashboard/Dashboard/ServiceDashboard":   "/dashboard/service",
    "AdminDashboard/Dashboard/3DVisualization":    "/dashboard/3d-visualization",
    "Gate/Trailer/Index":                        "/gate/trailer-in",
    "Gate/TrailerOut/Index":                     "/gate/trailer-out",
    "Gate/Rail/RailPlanUpload":                  "/container/rail-plan-upload",
    "Essential/Container/ContainerLiveStatus":   "/container/live-status",
    "Report/Report/ContainerHistoryReport":      "/container/history-status",
    "Essential/Container/ContainerLifeCycle":    "/container/lifecycle",
    "Essential/Container/ContainerTracking":     "/container/container-tracking",
    "Essential/Container/RailInventoryStatus":   "/container/container-history-status",
    "Essential/Container/OnRackContainers":      "/container/onrack",
    "Report/Report/Esurvey":                     "/container/esurvey",
    "Report/Report/EsurveyHistory":              "/container/esurvey-history",
    "Report/Report/RailMovementTat":             "/container/rail-movement-tat",
    "Report/Report/AssignInventoryBlock":        "/container/assign-inventory-block",
    "Report/Report/TrailerLiveStatus":           "/trailer/status",
    "Report/Report/TrailerReport":               "/trailer/report",
    "Report/Report/GateInReport":                "/reports/gate-in-out-report",
    "Report/Report/GateOutReport":               "/reports/gate-in-out-report",
    "Report/Report/DeviceDataReport":            "/reports/device-data-report",
    "Report/Report/EquipmentUtilization":        "/reports/equipment-utilization",
    "Report/Report/DailyEquipmentUtilization":   "/reports/daily-equipment-utilization",
    "Report/Report/BreakDownReport":             "/reports/equipment-breakdown-report",
    "Report/Report/CountWithMoves":              "/reports/count-with-moves",
    "Report/Report/RailInReport":                "/reports/rail-in-report",
    "Report/Report/TaskAllocationSummury":       "/reports/task-allocation-summary",
    "Report/Report/NavisionStatus":              "/reports/navision-status",
    "Report/Report/DeviceDataReportSummary":     "/reports/device-transaction-summary",
    "Report/Report/LoginHistory":                "/reports/login-history",
    "Report/Report/MissMatch":                   "/reports/inventory-mismatch",
    "Report/Report/RailJourney":                 "/reports/rail-journey",
    "Report/Report/PhysicalInventoryLog":        "/reports/physical-inventory-log",
    "Report/Report/ContainerUpdateHistory":      "/reports/container-update-history",
    "Report/Report/RailPlanReport":              "/reports/rail-plan-report",
    "Report/Report/EquipmentAccuracy":           "/reports/equipment-accuracy",
    "Report/Report/DeviceRawDataReport":         "/reports/device-raw-data",
    "Report/Report/MonthWiseInventory":          "/reports/month-wise-inventory",
    "Report/Report/ExceptionReport":             "/reports/gate-in-out-report",
    "Report/Report/YardTransaction":             "/reports/gate-in-out-report",
    "Report/Report/GateEntry":                   "/gate/pre-gate-in-out",
    "Equipment/EquipmentStatus/Index":           "/machine/equipment-status",
    "Master/Equipment/Index":                    "/machine/equipment",
    "Equipment/Equipment/Breakdown":             "/machine/breakdown",
    "Master/Client/Index":                       "/application/client",
    "Master/Plant/Index":                        "/application/plant",
    "Master/Line/Index":                         "/application/line",
    "Master/YardType/Index":                     "/application/yard-type",
    "Master/Yard/Index":                         "/application/yard",
    "Master/Gate/Index":                         "/application/gate",
    "Master/Devicetype/Index":                   "/application/device-type",
    "Master/DeviceGate/Index":                   "/application/device-gate-mapping",
    "Master/DeviceEquip/Index":                  "/application/device-equipment-mapping",
    "Master/SlotMapping/Index":                  "/application/slot-mapping",
    "Master/slot/Index":                         "/application/slot",
    "YardPlan/YardPlanning/Index":               "/application/planning-module",
    "Identity/Menu":                             "/user-settings/menu",
    "Identity/RoleMenuMapping/Index":            "/user-settings/role-menu-mapping",
    "Identity/Role/Index":                       "/user-settings/role",
    "Identity/User/Index":                       "/user-settings/users",
  };

  const normalizeMenuPath = (path) => {
    const rawPath = String(path || "").trim();
    if (!rawPath) return "";
    if (/^(https?:)?\/\//i.test(rawPath)) return rawPath;

    if (DB_URL_TO_REACT[rawPath]) return DB_URL_TO_REACT[rawPath];

    const [pathOnly, suffix = ""] = rawPath.replace(/\\/g, "/").split(/([?#].*)/, 2);
    const normalizedPath = `/${pathOnly}`
      .replace(/\/+/g, "/")
      .replace(/\/$/, "")
      .toLowerCase();

    return `${normalizedPath || "/"}${suffix}`;
  };

  const allNavItems = useMemo(() => {
    const rows = Array.isArray(menusResponse?.data) ? menusResponse.data : [];

    const toFiniteNumber = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    const menus = rows
      .map((r) => ({
        id: Number(r?.MENU_ID ?? r?.menu_id),
        label: String(r?.MENU_NAME ?? r?.menu_name ?? "").trim(),
        parentId: r?.PARENT_MENU_ID ?? r?.parent_menu_id,
        path: normalizeMenuPath(r?.MENU_URL ?? r?.menu_url),
        // Ordering rules:
        // - Prefer SORT_ORDER when provided and non-zero
        // - Otherwise fall back to numeric AREA (many menus use AREA as the sequence)
        sort: (() => {
          const sortOrder = toFiniteNumber(r?.SORT_ORDER ?? r?.sort_order);
          const areaOrder = toFiniteNumber(r?.AREA ?? r?.area);
          if (sortOrder != null && sortOrder !== 0) return sortOrder;
          if (areaOrder != null && areaOrder !== 0) return areaOrder;
          return 0;
        })(),
        area: toFiniteNumber(r?.AREA ?? r?.area) || 0,
        isDeleted: r?.IS_DELETED ?? r?.is_deleted,
        isActive: r?.IS_ACTIVE ?? r?.is_active,
      }))
      .filter(
        (m) =>
          Number.isFinite(m.id) &&
          m.id > 0 &&
          m.label &&
          !(m.isDeleted === true || m.isDeleted === 1)
      )
      .map((m) => ({
        ...m,
        // DB stores root menus with ParentID=0, treat 0 same as null
        parentId: (m.parentId == null || m.parentId === 0) ? null : Number(m.parentId),
      }));

    const MENU_ORDER = ["DASHBOARD","GATE","CONTAINER","TRAILER","REPORT","MACHINE","APPLICATION","USER_SETTINGS"];

    const byParent = new Map();
    menus.forEach((m) => {
      const key = m.parentId || null;
      const next = byParent.get(key) || [];
      next.push(m);
      byParent.set(key, next);
    });

    // Sort by fixed order, then Area, then label
    const sorter = (a, b) => (a.sort - b.sort) || a.label.localeCompare(b.label);
    const parents = (byParent.get(null) || []).sort((a, b) => {
      const ai = MENU_ORDER.indexOf(a.label.toUpperCase());
      const bi = MENU_ORDER.indexOf(b.label.toUpperCase());
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return sorter(a, b);
    });

    return parents.map((p) => {
      const children = (byParent.get(p.id) || [])
        .filter((c) => !!c.path)
        .sort(sorter)
        .map((c) => ({
          id: c.id,
          label: c.label,
          path: c.path,
        }));

      return {
        id: p.id,
        label: p.label,
        path: p.path,
        icon: iconByLabel[String(p.label || "").toUpperCase()] || <FaCircle />,
        submenus: children,
      };
    });
  }, [menusResponse, iconByLabel]);

  const visibleNavItems = useMemo(() => {
    // Strict RBAC:
    // - If user has a role_id, show only menus explicitly mapped to that role.
    // - No "show all" fallback.
    // - Parent permission does NOT automatically grant all children.
    if (!currentUser?.roleId) return [];
    if (roleMenusLoading) return [];

    const allowedIds = Array.isArray(roleMenusResponse?.data)
      ? roleMenusResponse.data
          .map((m) => Number(m?.MENU_ID ?? m?.menu_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      : [];

    if (!allowedIds.length) return [];

    const allowed = new Set(allowedIds);

    return allNavItems
      .map((item) => {
        const parentAllowed = allowed.has(Number(item.id));
        const submenus = (item.submenus || []).filter((submenu) =>
          allowed.has(Number(submenu.id))
        );

        // Show parent if:
        // - parent itself is mapped (even if it has no mapped children), OR
        // - at least one child submenu is mapped.
        if (!parentAllowed && !submenus.length) return null;
        return { ...item, submenus };
      })
      .filter(Boolean);
  }, [allNavItems, currentUser?.roleId, roleMenusResponse, roleMenusLoading]);

  const toggleMenu = (menuLabel) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuLabel]: !prev[menuLabel],
    }));
  };

  const handleNavigate = (path, label) => {
    const targetPath = normalizeMenuPath(path);
    if (!targetPath) return;
    if (/^(https?:)?\/\//i.test(targetPath)) {
      window.location.href = targetPath;
      return;
    }
    navigate(targetPath);
    setActiveMainMenu(label || activeMainMenu);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const currentMenu = visibleNavItems.find(
      (item) =>
        (item.path && location.pathname.startsWith(item.path)) ||
        item.submenus.some((submenu) =>
          location.pathname.startsWith(submenu.path)
        )
    );
    if (currentMenu && currentMenu.label !== activeMainMenu) {
      setActiveMainMenu(currentMenu.label);
    }
  }, [location.pathname, visibleNavItems, activeMainMenu]);

  useEffect(() => {
    return () => clearHoverTimeout();
  }, []);

  return (
    <>
      {/* Professional Corporate Navigation Bar */}
      <nav className="sticky top-0 z-[1000] w-full bg-white border-b border-slate-200 shadow-sm font-sans">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[72px]">
            {/* Left Section: Logo & Brand */}
            <div className="flex items-center gap-6">
              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {isMobileMenuOpen ? (
                  <FaTimes className="h-6 w-6" />
                ) : (
                  <FaBars className="h-6 w-6" />
                )}
              </button>

              {/* Brand Logo */}
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => navigate("/machine/equipment-status")}
              >
                <div className="relative flex items-center justify-center h-16 w-40 text-white rounded-lg bg-white/10 hover:bg-white/20 transition-all">
                  {/* Qikkle Logo */}
                  <img
                    src="/Images/gdl_logo.png"
                    alt="GDL"
                    className="h-full w-full object-contain p-1"
                    onError={(e) => {
                      e.target.src = "/gdl_logo.png";
                      e.target.onError = function() {
                        this.style.display = "none";
                        this.parentElement.innerHTML =
                          '<span class="text-3xl font-bold text-white">QIKKLE</span>';
                      };
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Center Section: Main Navigation */}
            <div className="hidden lg:flex flex-1 items-stretch justify-center relative h-full mx-4">
              <div className="flex items-stretch h-full gap-0.5 overflow-x-auto no-scrollbar max-w-full">
                {visibleNavItems.map((item) => {
                  const isActive = activeMainMenu === item.label;
                  const isOpen = hoveredMenu === item.label;
                  const hasDropdown = (item.submenus || []).length > 0;

                  return (
                    <div
                      key={item.label}
                      className="h-full flex flex-shrink-0"
                      onMouseEnter={() =>
                        hasDropdown && handleHoverStart(item.label)
                      }
                      onMouseLeave={handleHoverEnd}
                    >
                      <button
                        onClick={() => {
                          if (!hasDropdown && item.path) {
                            handleNavigate(item.path, item.label);
                            return;
                          }
                          setActiveMainMenu(item.label);
                        }}
                        className="group relative flex items-center justify-center px-4 xl:px-5 h-full bg-transparent border-none outline-none cursor-pointer transition-all min-w-[96px]"
                      >
                      {/* Animated Background Pill/Tab */}
                      <div
                        className={`absolute inset-x-1 transition-all duration-300 ease-in-out
                          ${
                            isOpen
                              ? "h-[60px] bottom-0 rounded-t-xl bg-[#c14d4d] shadow-lg"
                              : isActive
                              ? "h-11 bottom-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 group-hover:from-[#c14d4d] group-hover:to-[#a83e3e] shadow-sm"
                              : "h-11 bottom-3 rounded-xl group-hover:bg-gradient-to-br group-hover:from-[#c14d4d] group-hover:to-[#a83e3e] group-hover:shadow-md"
                          }`}
                      />

                      {/* Content Layer */}
                      <div
                        className={`relative z-10 flex flex-col items-center justify-center gap-1 font-bold transition-all duration-300
                          ${
                            isOpen
                              ? "text-white scale-105"
                              : isActive
                              ? "text-[#0e4a78] group-hover:text-white group-hover:scale-105"
                              : "text-slate-600 group-hover:text-white group-hover:scale-105"
                          }`}
                      >
                        <span className="text-base xl:text-lg leading-none">
                          {item.icon}
                        </span>

                        <div className="flex items-center gap-1 leading-none min-w-0">
                          <span className="tracking-wide uppercase text-[10.5px] xl:text-[11.5px] font-extrabold whitespace-nowrap">
                            {item.label}
                          </span>
                          {hasDropdown && (
                            <FaChevronDown
                              className={`w-2.5 h-2.5 xl:w-3 xl:h-3 transition-transform duration-300 ${
                                isOpen ? "rotate-180" : ""
                              } opacity-80`}
                            />
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                  );
                })}
              </div>

              {/* Dropdown Container - Background stays fixed, only content changes */}
              <div
                className={`absolute left-0 top-full w-full transition-opacity duration-300
                ${
                  hoveredMenu
                    ? "opacity-100 visible pointer-events-auto"
                    : "opacity-0 invisible pointer-events-none"
                }`}
              >
                {/* Fixed Background Container */}
                <div
                  onMouseEnter={() =>
                    hoveredMenu && handleHoverStart(hoveredMenu)
                  }
                  onMouseLeave={handleHoverEnd}
                  className="w-full rounded-b-2xl shadow-2xl border-t-2 border-[#9b3535] overflow-hidden"
                  style={{ height: "280px", marginTop: "-3px" }}
                >
                  <div className="w-full h-full bg-gradient-to-br from-[#c14d4d] to-[#a83e3e] pt-3 pb-4 px-6 relative">
                    {/* Background Image with overlay */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1/2 bg-no-repeat bg-right bg-contain opacity-20 pointer-events-none"
                      style={{ backgroundImage: "url(/menu-bg2.png)" }}
                    />

                    {/* Content Layer - Different content for each menu */}
                    <div className="relative z-10 h-full">
                      {visibleNavItems.map((item) => {
                        const isOpen = hoveredMenu === item.label;
                        const denseLayout = (item.submenus?.length || 0) > 20;

                        return (
                          item.submenus.length > 0 && (
                            <div
                              key={item.label}
                              onMouseEnter={() => handleHoverStart(item.label)}
                              onMouseLeave={handleHoverEnd}
                              className={`absolute inset-0 transition-opacity duration-200 overflow-hidden pr-2 custom-scrollbar
                              ${
                                isOpen
                                  ? "opacity-100 visible pointer-events-auto"
                                  : "opacity-0 invisible pointer-events-none"
                              }`}
                            >
                              <div className="px-2 pb-1.5 mb-1.5 border-b border-white/20">
                                <div
                                  className="inline-flex items-center gap-2 rounded-lg  px-3 py-2 " >

                                  <span className="text-base text-white/90">
                                    {item.icon}
                                  </span>
                                  <span className="text-white font-bold tracking-wide uppercase text-[13px]">
                                    {item.label}
                                  </span>
                                </div>
                              </div>

                              {/* Vertical Column Flow with better spacing */}
                              <div
                                className={
                                  denseLayout
                                    ? "grid grid-cols-5 h-[190px] w-full gap-x-2 gap-y-0.5"
                                    : "flex flex-col flex-wrap content-start h-[190px] w-full gap-x-4 gap-y-1"
                                }
                              >
                                {item.submenus.map((submenu) => {
                                  const isExternal = /^(https?:)?\/\//i.test(submenu.path);
                                  const Component = isExternal ? 'a' : Link;
                                  const linkProps = isExternal ? { href: submenu.path, target: '_blank', rel: 'noopener noreferrer' } : { to: submenu.path };
                                  return (
                                  <Component
                                    key={submenu.label}
                                    {...linkProps}
                                    onClick={() => setActiveMainMenu(item.label)}
                                    className={`group flex items-center gap-2 px-2.5 ${
                                      denseLayout ? "py-1.5" : "py-2"
                                    } rounded-lg hover:bg-white/15 active:bg-white/20 transition-all text-left ${
                                      denseLayout ? "w-full" : "w-[18.5%]"
                                    } border border-transparent hover:border-white/20`}
                                  >
                                    <FaCircle className="w-1.5 h-1.5 text-white/60 group-hover:text-white group-hover:scale-125 flex-shrink-0 transition-all" />
                                    <span
                                      className="text-[13px] font-bold text-white/85 group-hover:text-white leading-tight tracking-wide break-words min-w-0"
                                      title={submenu.label}
                                    >
                                      {submenu.label}
                                    </span>
                                  </Component>
                                )})}
                              </div>
                            </div>
                          )
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Section: User Profile & Actions */}
            <div className="flex items-center gap-4">

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() =>
                    setIsProfileDropdownOpen(!isProfileDropdownOpen)
                  }
                  className="flex items-center gap-2 md:gap-3 pl-2 pr-2 md:pl-4 md:pr-3 py-2 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 border border-slate-200 hover:border-slate-300 transition-all duration-300 shadow-sm hover:shadow-md group"
                >
                  <div className="text-right hidden md:block">
                    <div className="text-sm font-bold text-slate-900 leading-tight group-hover:text-[#0e4a78] transition-colors">
                      {currentUser.name}
                    </div>
                    <div className="text-xs text-slate-600 font-semibold tracking-wide">
                      {currentUser.role}
                    </div>
                  </div>
                  <div className="relative">
                    <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-[#0e4a78] to-[#0a3b61] text-white flex items-center justify-center text-base md:text-lg font-bold shadow-md ring-2 ring-white group-hover:ring-[#0e4a78] transition-all group-hover:scale-105">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 md:w-3.5 md:h-3.5 bg-gradient-to-br from-green-400 to-green-600 rounded-full border-2 border-white shadow-sm animate-pulse"></div>
                  </div>
                  <FaChevronDown
                    className={`hidden md:block w-3.5 h-3.5 text-slate-500 group-hover:text-[#0e4a78] transition-all duration-300 ${
                      isProfileDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-200 text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0e4a78] to-[#0a3b61] text-white flex items-center justify-center text-2xl font-bold mx-auto shadow-lg mb-4 ring-4 ring-white">
                        {currentUser.name.charAt(0)}
                      </div>
                      <h4 className="font-bold text-slate-900 text-lg mb-1 tracking-tight">
                        {currentUser.name}
                      </h4>
                      <p className="text-sm text-slate-600 font-medium">
                        {currentUser.role}
                      </p>
                    </div>

                    <div className="p-2 border-t border-slate-100">
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <FaSignOutAlt /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu (Overlay) */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-[1100] bg-slate-900/60 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="fixed inset-0 w-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center justify-center h-10 w-24">
                      <img
                        src="/gdl_logo.png"
                        alt="Brand"
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.parentElement.innerHTML =
                            '<span class="text-2xl font-bold text-[#0e4a78]">GDL</span>';
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <FaTimes className="w-5 h-5" />
                  </button>
                </div>
                
                {/* User Profile Section */}
                <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0e4a78] to-[#0a3b61] text-white flex items-center justify-center text-xl font-bold shadow-sm">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {currentUser.name}
                    </div>
                    <div className="text-xs text-slate-600 font-medium truncate">
                      {currentUser.role}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-1">
                {visibleNavItems.map((item) => (
                  <div
                    key={item.label}
                    className="border-b border-slate-50 last:border-0 pb-2 mb-2"
                  >
                    <button
                      onClick={() => {
                        if (item.submenus.length > 0) {
                          toggleMenu(item.label);
                          return;
                        }
                        if (item.path) {
                          handleNavigate(item.path, item.label);
                          return;
                        }
                        setActiveMainMenu(item.label);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 text-slate-800 hover:bg-slate-100 rounded-lg transition-colors font-semibold"
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-[#0e4a78] text-lg">
                          {item.icon}
                        </span>
                        {item.label}
                      </span>
                      {item.submenus.length > 0 && (
                        <FaChevronDown
                          className={`w-3 h-3 text-slate-400 transition-transform ${
                            expandedMenus[item.label] ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </button>

                    {expandedMenus[item.label] && (
                      <div className="pl-12 pr-4 space-y-1 mt-1">
                        {item.submenus.map((sub) => {
                          const isExternal = /^(https?:)?\/\//i.test(sub.path);
                          const Component = isExternal ? 'a' : Link;
                          const linkProps = isExternal ? { href: sub.path, target: '_blank', rel: 'noopener noreferrer' } : { to: sub.path };
                          return (
                          <Component
                            key={sub.label}
                            {...linkProps}
                            onClick={() => {
                                setIsMobileMenuOpen(false);
                                setActiveMainMenu(item.label);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-slate-600 hover:text-[#0e4a78] hover:bg-slate-100 rounded-lg transition-colors font-medium"
                          >
                            {sub.label}
                          </Component>
                        )})}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-200 bg-white">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all"
                >
                  <FaSignOutAlt /> Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default Navbar;
