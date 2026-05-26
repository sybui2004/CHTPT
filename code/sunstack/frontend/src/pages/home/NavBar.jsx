import { useState, useRef, useEffect } from "react";
import { Link } from 'react-router-dom'
import { getCurrentReturnPath, getLoginUrl, logout } from "../../util/AuthUtil";
import { FiChevronDown, FiUser, FiLogOut, FiPackage } from "react-icons/fi";
import { FaStore } from "react-icons/fa";

const Navbar = ({ isAuthenticated }) => {
    const [isOptionsDropdownOpen, setIsOptionsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOptionsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative z-50 w-full max-w-full overflow-visible border-b border-white/10 bg-primary/90 text-white/90">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-1.5 text-xs sm:px-4">
                {/* Left: Seller center */}
                <div className="min-w-0 shrink flex items-center gap-4">
                    <a
                        href="/myshop/order-list"
                        className="flex min-w-0 items-center gap-1.5 font-medium transition-colors duration-200 hover:text-white"
                    >
                        <FaStore size={11} />
                        <span className="truncate">Kênh người bán</span>
                    </a>
                </div>

                {/* Right: Notification + User */}
                {isAuthenticated ? (
                    <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
                        {/* User dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                className="flex min-w-0 items-center gap-1.5 cursor-pointer select-none transition-colors duration-200 hover:text-white"
                                onClick={() => setIsOptionsDropdownOpen(!isOptionsDropdownOpen)}
                            >
                                <img
                                    src={JSON.parse(localStorage.getItem('userData'))['avatarUrl']}
                                    className="w-5 h-5 rounded-full object-cover border border-white/30"
                                    alt="avatar"
                                />
                                <span className="max-w-[72px] truncate font-medium sm:max-w-[100px]">
                                    {JSON.parse(localStorage.getItem('userData'))['username']}
                                </span>
                                <FiChevronDown
                                    size={11}
                                    className={`transition-transform duration-200 ${isOptionsDropdownOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {isOptionsDropdownOpen && (
                                <div className="absolute right-0 top-full z-[100] mt-2 w-56 overflow-hidden border border-gray-100 bg-white text-gray-700 shadow-2xl animate-slide-in rounded-none">
                                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Xin chào,</p>
                                        <p className="font-display font-semibold text-sm text-gray-900 truncate mt-0.5">
                                            {JSON.parse(localStorage.getItem('userData'))['username']}
                                        </p>
                                    </div>
                                    <Link
                                        to="/account/profile"
                                        className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm hover:bg-orange-50 hover:text-primary transition-colors"
                                        onClick={() => setIsOptionsDropdownOpen(false)}
                                    >
                                        <FiUser size={13} />
                                        Tài khoản của tôi
                                    </Link>
                                    <Link
                                        to="/account/orders?type=1"
                                        className="flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm hover:bg-orange-50 hover:text-primary transition-colors"
                                        onClick={() => setIsOptionsDropdownOpen(false)}
                                    >
                                        <FiPackage size={13} />
                                        Đơn hàng của tôi
                                    </Link>
                                    <button
                                        className="flex w-full items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm hover:bg-red-50 hover:text-red-500 transition-colors border-t border-gray-100 cursor-pointer"
                                        onClick={() => logout()}
                                    >
                                        <FiLogOut size={13} />
                                        Đăng xuất
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className='flex items-center gap-3'>
                        <a
                            href={`/register?from=${encodeURIComponent(getCurrentReturnPath())}`}
                            className="hover:text-white transition-colors duration-200 font-medium"
                        >
                            Đăng ký
                        </a>
                        <span className="text-white/30">|</span>
                        <a
                            href={getLoginUrl()}
                            className="hover:text-white transition-colors duration-200 font-medium"
                        >
                            Đăng nhập
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Navbar;
