import { useState, useRef, useEffect } from "react";
import { Link } from 'react-router-dom'
import { logout } from "../../util/AuthUtil";
import { FiMenu, FiSettings, FiLogOut, FiChevronDown, FiHome } from "react-icons/fi";
import { FaStore } from "react-icons/fa";

export default function Navbar({ toggleSidebar }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const userData = JSON.parse(localStorage.getItem('userData'));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="fixed z-50 flex h-12 w-full max-w-full items-center justify-between overflow-visible bg-gray-900 px-2 text-white shadow-lg sm:px-3">
      {/* Left */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          className="md:hidden p-2 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
          onClick={toggleSidebar}
        >
          <FiMenu size={18} />
        </button>
        <a href="/" className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-orange-500">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          <span className="truncate text-sm font-bold tracking-wide">SunStack</span>
          <span className="hidden sm:block text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium">Kênh bán hàng</span>
        </a>
      </div>

      {/* Right */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Visit store */}
        <a
          href="/"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <FiHome size={13} />
          Về trang chủ
        </a>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            className="ml-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-700 cursor-pointer"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <img
              src={userData?.avatarUrl}
              className="w-6 h-6 rounded-full object-cover border border-gray-600"
              alt="avatar"
            />
            <FiChevronDown
              size={12}
              className={`text-gray-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
            />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full z-[100] mt-2 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white text-gray-700 shadow-xl animate-slide-in">
              <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-400">Đăng nhập với</p>
                <p className="text-sm font-semibold text-gray-800 truncate">{userData?.username}</p>
              </div>
              <Link
                to="./setting/profile"
                className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-orange-50 hover:text-primary transition-colors"
                onClick={() => setShowDropdown(false)}
              >
                <FiSettings size={14} className="text-gray-400" />
                Thông tin cửa hàng
              </Link>
              <button
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm hover:bg-red-50 hover:text-red-500 transition-colors border-t border-gray-100 cursor-pointer"
                onClick={() => logout()}
              >
                <FiLogOut size={14} className="text-gray-400" />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
