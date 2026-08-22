import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { getStoredUser, logout } from "../../services/authService";
import { confirmAction, notify } from "../../utils/notify";
import { clearAuth } from "../../store/slices/authSlice";
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
    const user = getStoredUser();
    if (user) {
      // Prioritize full name from backend response structure if available
      let name = user.username || user.name || "User";

      if (user.first_name) {
        name = `${user.first_name} ${user.last_name || ""}`.trim();
      }

      const role = user.role || user.ROLE || user.role_name || "User";
      const roleId = user.role_id ?? user.ROLE_ID ?? user.roleId ?? null;
      setCurrentUser({ name, role, roleId });
    }
  }, []);

  const { data: roleMenusResponse, isLoading: roleMenusLoading } =
    useGetRoleMenusQuery(currentUser?.roleId, {
      skip: !currentUser?.roleId,
    });

  const { data: menusResponse } = useGetMenusQuery();

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
        path: String(r?.MENU_URL ?? r?.menu_url ?? "").trim(),
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
        parentId: m.parentId == null ? null : Number(m.parentId),
      }));

    const byParent = new Map();
    menus.forEach((m) => {
      const key = m.parentId || null;
      const next = byParent.get(key) || [];
      next.push(m);
      byParent.set(key, next);
    });

    const sorter = (a, b) => a.sort - b.sort || a.label.localeCompare(b.label);
    const parents = (byParent.get(null) || []).sort(sorter);

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
    if (!path) return;
    navigate(path);
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
      <nav className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm font-sans">
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
                <div className="relative flex items-center justify-center h-16 w-40 text-white rounded-lg">
                  {/* Fallback icon if no image, or the image itself */}
                  <img
                    src="./logo.png"
                    alt="Brand"
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.parentElement.innerHTML =
                        '<span class="text-3xl font-bold text-[#0e4a78]">Q</span>';
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
                              ? "h-[60px] bottom-0 rounded-t-xl bg-[#ed1e25] shadow-lg"
                              : isActive
                              ? "h-11 bottom-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 group-hover:from-[#ed1e25] group-hover:to-[#d91920] shadow-sm"
                              : "h-11 bottom-3 rounded-xl group-hover:bg-gradient-to-br group-hover:from-[#ed1e25] group-hover:to-[#d91920] group-hover:shadow-md"
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
                          <span className="tracking-wide uppercase text-[10.5px] xl:text-[11.5px] font-extrabold whitespace-nowrap truncate max-w-[92px]">
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
                  className="w-full rounded-b-2xl shadow-2xl border-t-2 border-[#b91c1c] overflow-hidden"
                  style={{ height: "350px", marginTop: "-3px" }}
                >
                  <div className="w-full h-full bg-gradient-to-br from-[#ed1e25] to-[#c41e1e] pt-4 pb-6 px-8 relative">
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
                              <div className="px-2 pb-2 mb-2 border-b border-white/20">
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
                                    ? "grid grid-cols-5 h-[230px] w-full gap-x-3 gap-y-1"
                                    : "flex flex-col flex-wrap content-start h-[230px] w-full gap-x-6 gap-y-1.5"
                                }
                              >
                                {item.submenus.map((submenu) => (
                                  <button
                                    key={submenu.label}
                                    onClick={() =>
                                      handleNavigate(submenu.path, item.label)
                                    }
                                    className={`group flex items-center gap-2.5 px-3 ${
                                      denseLayout ? "py-2" : "py-2.5"
                                    } rounded-lg hover:bg-white/15 active:bg-white/20 transition-all text-left ${
                                      denseLayout ? "w-full" : "w-[18.5%]"
                                    } overflow-hidden border border-transparent hover:border-white/20`}
                                  >
                                    <FaCircle className="w-1.5 h-1.5 text-white/60 group-hover:text-white group-hover:scale-125 flex-shrink-0 transition-all" />
                                    <span
                                      className="text-[13px] font-bold text-white/85 group-hover:text-white leading-tight truncate tracking-wide"
                                      title={submenu.label}
                                    >
                                      {submenu.label}
                                    </span>
                                  </button>
                                ))}
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
                  className="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-full hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                >
                  <div className="text-right hidden md:block">
                    <div className="text-sm font-bold text-slate-800 leading-tight">
                      {currentUser.name}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      {currentUser.role}
                    </div>
                  </div>
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[#0e4a78] text-white flex items-center justify-center text-lg font-bold shadow-sm ring-2 ring-white">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <FaChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform ${
                      isProfileDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 text-center">
                      <div className="w-16 h-16 rounded-full bg-[#0e4a78] text-white flex items-center justify-center text-2xl font-bold mx-auto shadow-md mb-3">
                        {currentUser.name.charAt(0)}
                      </div>
                      <h4 className="font-bold text-slate-800 text-lg">
                        {currentUser.name}
                      </h4>
                      <p className="text-sm text-slate-500">
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
          <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm">
            <div className="fixed inset-y-0 left-0 w-[300px] bg-white shadow-2xl overflow-y-auto">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center h-10 w-24 text-white rounded-md">
                    <img
                      src="/logo.png"
                      alt="Brand"
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.parentElement.innerHTML =
                          '<span class="text-xl font-bold text-[#0e4a78]">Q</span>';
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
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
                      className="w-full flex items-center justify-between px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors font-semibold"
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
                        {item.submenus.map((sub) => (
                          <button
                            key={sub.label}
                            onClick={() => handleNavigate(sub.path, item.label)}
                            className="w-full text-left px-4 py-2 text-sm text-slate-500 hover:text-[#0e4a78] hover:bg-blue-50 rounded-md transition-colors"
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg shadow-sm hover:bg-slate-50"
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
