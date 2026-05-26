import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { FiChevronLeft, FiChevronRight, FiChevronDown } from "react-icons/fi";
import { FaBox, FaClipboardList, FaComments } from "react-icons/fa";
import { IoSettings } from "react-icons/io5";
import { useDispatch } from "react-redux";
import { setChatOpen } from "../../redux/chatSlice";

const menuList = [
  {
    title: "Quản lý đơn hàng",
    icon: <FaClipboardList size={15} />,
    subMenu: [
      { title: "Tất cả đơn hàng", to: "order-list" }
    ]
  },
  {
    title: "Quản lý sản phẩm",
    icon: <FaBox size={15} />,
    subMenu: [
      { title: "Danh sách sản phẩm", to: "product-list" },
      { title: "Thêm sản phẩm mới", to: "add-product" }
    ]
  },
  {
    title: "Quản lý Shop",
    icon: <IoSettings size={15} />,
    subMenu: [
      { title: "Hồ sơ cửa hàng", to: "setting/profile" },
      { title: "Cài đặt vận chuyển", to: "setting/shipping" }
    ]
  }
];

export default function Sidebar({isOpen, toggle}) {
  const [openSubMenus, setOpenSubMenus] = useState({});
  const location = useLocation();
  const dispatch = useDispatch();

  const openChat = () => {
    dispatch(setChatOpen(true));
  };

  useEffect(() => {
    if (!isOpen) setOpenSubMenus({});
  }, [isOpen]);

  useEffect(() => {
    const initialOpen = {};
    menuList.forEach((item, index) => {
      if (item.subMenu?.some(sub => location.pathname.includes(sub.to))) {
        initialOpen[index] = true;
      }
    });
    setOpenSubMenus(initialOpen);
  }, [location.pathname]);

  const toggleSubMenu = (index) => {
    if (!isOpen) {
      toggle();
      setOpenSubMenus({ [index]: true });
      return;
    }
    setOpenSubMenus((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={toggle}
        />
      )}

      <div className={`flex h-screen top-0 left-0 fixed z-40 shadow-2xl transition-all duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className={`mt-12 bg-gray-900 text-white transition-all duration-300 ${isOpen ? "w-56" : "w-56 md:w-14"} relative flex flex-col justify-between overflow-hidden`}>
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-track]:bg-transparent">
            <ul className="px-2 space-y-0.5">
              {menuList.map((item, index) => {
                const isParentActive = item.subMenu?.some(sub => location.pathname.includes(sub.to));
                return (
                  <li key={index}>
                    {item.subMenu ? (
                      <>
                        <div
                          className={`flex items-center ${isOpen ? "justify-between" : "justify-center"} px-2 py-2.5 rounded-lg cursor-pointer transition-colors ${
                            isParentActive
                              ? "bg-gray-700 text-orange-400"
                              : "text-gray-400 hover:bg-gray-800 hover:text-white"
                          }`}
                          onClick={() => toggleSubMenu(index)}
                          title={!isOpen ? item.title : undefined}
                        >
                          <div className="flex items-center gap-3">
                            <span className="shrink-0">{item.icon}</span>
                            {isOpen && <span className="text-sm font-medium">{item.title}</span>}
                          </div>
                          {isOpen && (
                            <FiChevronDown
                              size={13}
                              className={`text-gray-500 transition-transform duration-200 ${openSubMenus[index] ? "rotate-180" : ""}`}
                            />
                          )}
                        </div>

                        <div className={`transition-all duration-200 overflow-hidden ${
                          isOpen && openSubMenus[index] ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                        }`}>
                          <ul className="mt-0.5 ml-3 pl-4 border-l border-gray-700 space-y-0.5">
                            {item.subMenu.map((subItem, subIndex) => (
                              <li key={subIndex}>
                                <NavLink
                                  to={subItem.to}
                                  className={({ isActive }) =>
                                    `block px-3 py-2 text-xs rounded-lg transition-colors ${
                                      isActive
                                        ? "bg-orange-500/20 text-orange-400 font-semibold"
                                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                                    }`
                                  }
                                >
                                  {subItem.title}
                                </NavLink>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    ) : item.action ? (
                      <div
                        className="flex items-center gap-3 px-2 py-2.5 rounded-lg cursor-pointer transition-colors text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
                        onClick={item.action}
                        title={!isOpen ? item.title : undefined}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        {isOpen && <span className="font-medium">{item.title}</span>}
                      </div>
                    ) : item.to === "chat" ? (
                      <div
                        className="flex items-center gap-3 px-2 py-2.5 rounded-lg cursor-pointer transition-colors text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
                        onClick={openChat}
                        title={!isOpen ? "Chat với khách hàng" : undefined}
                      >
                        <span className="shrink-0"><FaComments size={15} /></span>
                        {isOpen && <span className="font-medium">Chat với khách hàng</span>}
                      </div>
                    ) : (
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center ${isOpen ? "gap-3" : "justify-center"} px-2 py-2.5 rounded-lg transition-colors text-sm ${
                            isActive
                              ? "bg-orange-500/20 text-orange-400 font-semibold"
                              : "text-gray-400 hover:bg-gray-800 hover:text-white"
                          }`
                        }
                        title={!isOpen ? item.title : undefined}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        {isOpen && <span className="font-medium">{item.title}</span>}
                      </NavLink>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            className="m-2 p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white cursor-pointer rounded-lg flex items-center justify-center transition-colors"
            onClick={toggle}
          >
            {isOpen ? <FiChevronLeft size={16} /> : <FiChevronRight size={16} />}
          </button>
        </div>
      </div>
    </>
  );
}
