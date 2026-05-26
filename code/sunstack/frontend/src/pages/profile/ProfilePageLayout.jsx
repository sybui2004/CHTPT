import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { FiUser, FiMapPin, FiShoppingBag, FiChevronRight, FiMenu, FiX } from "react-icons/fi";

const navItems = [
    { to: "profile", icon: <FiUser size={16} />, label: "Hồ sơ của tôi" },
    { to: "address", icon: <FiMapPin size={16} />, label: "Địa chỉ" },
    { to: "orders", icon: <FiShoppingBag size={16} />, label: "Đơn hàng" },
];

function SidebarContent({ onClose }) {
    const userData = JSON.parse(localStorage.getItem('userData'))

    return (
        <div className="flex flex-col h-full">
            {/* Mobile close button */}
            {onClose && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 md:hidden">
                    <span className="text-sm font-semibold text-gray-700">Tài khoản</span>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full cursor-pointer">
                        <FiX size={18} className="text-gray-500" />
                    </button>
                </div>
            )}

            {/* User info */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <img
                        src={userData.avatarUrl}
                        alt="Avatar"
                        className="w-11 h-11 rounded-full object-cover border-2 border-gray-100 shadow-sm shrink-0"
                    />
                    <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate text-sm">{userData.username}</p>
                        <span className="text-xs text-gray-400">Tài khoản của tôi</span>
                    </div>
                </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 py-2">
                {navItems.map((item, i) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                            `flex items-center justify-between px-4 py-3 text-sm transition-colors group ${
                                isActive
                                    ? 'bg-orange-50 text-primary font-semibold border-r-2 border-primary'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                            }`
                        }
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-gray-400">{item.icon}</span>
                            {item.label}
                        </div>
                        <FiChevronRight size={14} className="text-gray-300" />
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}

export default function ProfilePageLayout(){
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const userData = JSON.parse(localStorage.getItem('userData'));
    const activeItem = navItems.find((item) => location.pathname.includes(item.to)) || navItems[0];

    return (
        <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gray-100">
            <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4">

                {/* Mobile account drawer trigger */}
                <div className="mb-4 md:hidden">
                    <button
                        className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:bg-gray-50"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <div className="flex min-w-0 items-center gap-3">
                            <img
                                src={userData?.avatarUrl}
                                alt="Avatar"
                                className="h-9 w-9 shrink-0 rounded-full border border-gray-100 object-cover"
                            />
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-400">Tài khoản của tôi</p>
                                <p className="truncate text-sm font-semibold text-gray-800">{activeItem.label}</p>
                            </div>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-primary">
                            <FiMenu size={14} /> Menu
                        </span>
                    </button>
                </div>

                <div className="flex min-w-0 flex-col gap-4 md:flex-row md:gap-6">
                    {/* Desktop sidebar */}
                    <aside className="hidden md:block w-56 shrink-0">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <SidebarContent />
                        </div>
                    </aside>

                    {/* Main content — scrollable horizontally on mobile */}
                    <div className="min-w-0 flex-1">
                        <Outlet/>
                    </div>
                </div>
            </div>

            {/* Mobile drawer overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Mobile drawer panel */}
            <aside
                className={`fixed left-0 top-0 z-50 h-full w-[82vw] max-w-xs rounded-r-2xl border-r border-gray-100 bg-white shadow-2xl transition-transform duration-300 md:hidden ${
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <SidebarContent onClose={() => setSidebarOpen(false)} />
            </aside>
        </div>
    )
}
