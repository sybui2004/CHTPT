import { NavLink } from "react-router-dom";
import { FiUser, FiMapPin, FiShoppingBag, FiChevronRight } from "react-icons/fi";

const navItems = [
    { to: "profile", icon: <FiUser size={16} />, label: "Hồ sơ của tôi" },
    { to: "address", icon: <FiMapPin size={16} />, label: "Địa chỉ" },
    { to: "orders", icon: <FiShoppingBag size={16} />, label: "Đơn hàng" },
];

export default function ProfileSidebar() {
    const userData = JSON.parse(localStorage.getItem('userData'))

    return (
        <aside className="w-full md:w-56 shrink-0">
            {/* User info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3 flex items-center gap-3">
                <img
                    src={userData.avatarUrl}
                    alt="Avatar"
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-100 shadow-sm shrink-0"
                />
                <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate text-sm">{userData.username}</p>
                    <span className="text-xs text-gray-400">Tài khoản của tôi</span>
                </div>
            </div>

            {/* Nav */}
            <nav className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {navItems.map((item, i) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `flex items-center justify-between px-4 py-3 text-sm transition-colors group ${
                                i < navItems.length - 1 ? 'border-b border-gray-50' : ''
                            } ${
                                isActive
                                    ? 'bg-orange-50 text-primary font-semibold'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                            }`
                        }
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-gray-400 group-[.active]:text-primary">{item.icon}</span>
                            {item.label}
                        </div>
                        <FiChevronRight size={14} className="text-gray-300" />
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}
