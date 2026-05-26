import { useNavigate, useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { fetchWithAuth} from '../../../util/AuthUtil'
import { formatDate } from "../../../util/DateUtil";
import { BASE_API_URL } from "../../../constants";
import { BsClipboard2PlusFill } from "react-icons/bs";
import { FaChevronDown } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import CancelOrderForm from '../../profile/order/CancelOrderForm.jsx'
import Pagination from "../../common/Pagination.jsx";

const tabs = [
    "Tất cả",
    "Chờ xác nhận",
    "Chờ vận chuyển",
    "Đang giao",
    "Đã giao",
    "Đã hủy",
];

const cancelReasons = [
    "Spam",
    "Hết hàng"
]

const paymentTypeMap = {
    'cash_on_delivery': 'COD',
    'bank_transfer': 'Chuyển khoản ngân hàng'
}

const filters = [
    "Tất cả",
    "Mã đơn hàng",
    "Tên người mua",
    "Tên sản phẩm"
];

const statusConfig = [
    { text: "Chờ xác nhận", color: "text-gray-500", bg: "bg-gray-100" },
    { text: "Chuẩn bị hàng", color: "text-blue-500", bg: "bg-blue-50" },
    { text: "Đã gửi hàng", color: "text-orange-500", bg: "bg-orange-50" },
    { text: "Đang giao", color: "text-orange-600", bg: "bg-orange-50" },
    { text: "Thành công", color: "text-green-600", bg: "bg-green-50" },
    { text: "Đã đánh giá", color: "text-green-600", bg: "bg-green-50" },
    { text: "Đã hủy", color: "text-red-500", bg: "bg-red-50" },
];

export default function ShopOrder(){

    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const [isLoading, setIsLoading] = useState(false)
    const [limit, setLimit] = useState(10)
    const [page, setPage] = useState(1)
    const [totalPage, setTotalPage] = useState(1)
    const [totalOrders, setTotalOrders] = useState(0)
    const [cancelOrder, setCancelOrder] = useState(null)
    const [isEmpty, setIsEmpty] = useState(false)
    const navigate = useNavigate()
    const currentType = parseInt(searchParams.get("type")) || 0;
    const [orders, setOrders] = useState([])

    const [filterType, setFilterType] = useState(0);
    const [selectedFilterType, setSelectedFilterType] = useState(0)
    const [searchQuery, setSearchQuery] = useState("");
    const [openFilter, setOpenFilter] = useState(false);

    const [sortType, setSortType] = useState(0)

    const fetchShopOrders = async (type, reset = false) => {
        setIsEmpty(false)
        setOrders([])
        setIsLoading(true)
        try {
            const res = await fetchWithAuth(`${BASE_API_URL}/v1/shop/order/get_list?type=${type}&page=${page - 1}&limit=${limit}&filterType=${filterType}&sortType=${sortType}&keyword=${searchQuery}`,
                window.location,
                true)
            if (!res || !res.ok) {
                setTotalOrders(0)
                setTotalPage(0)
                setOrders([])
                setIsEmpty(true)
                return
            }

            const data = await res.json()
            const content = Array.isArray(data.content) ? data.content : []
            if(reset && content.length === 0) setIsEmpty(true)
            setTotalOrders(Number.isFinite(Number(data.totalElements)) ? Number(data.totalElements) : 0)
            setTotalPage(Number.isFinite(Number(data.totalPages)) ? Number(data.totalPages) : 0)
            setOrders(content)
        }
        catch (err) {
            setTotalOrders(0)
            setTotalPage(0)
            setOrders([])
            setIsEmpty(true)
        }
        finally {
            setIsLoading(false)
        }
    }

    const updateOrderStatus = (shopOrderId, status) => {
        fetchWithAuth(`${BASE_API_URL}/v1/shop/order/update?shopOrderId=${shopOrderId}&currentStatus=${status}`, window.location, true, {
            method: "POST"
        })
            .then(res => {
                if(res.ok){
                    fetchShopOrders(currentType, true)
                }
            })
            .catch(() => {
                toast.error("Có lỗi xảy ra, vui lòng thử lại sau!")
            })
    }

    const resetFilter = () => {
        setSearchQuery("");
        setSelectedFilterType(0)
        setFilterType(0)
        setPage(1)
        fetchShopOrders(currentType, true)
    }

    useEffect(() => {
        resetFilter()
    }, [currentType])

    useEffect(() => {
        fetchShopOrders(currentType, true)
    }, [page, limit, filterType, sortType])

    return (
        <div className="flex w-full max-w-full flex-col gap-4 overflow-x-hidden">
            {/* Page header */}
            <div>
                <h1 className="text-xl font-bold text-gray-800">Danh sách đơn hàng</h1>
                <p className="text-sm text-gray-400 mt-0.5">{totalOrders} đơn hàng</p>
            </div>

            {/* Tab bar */}
            <div className="w-full max-w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex w-full overflow-x-auto scrollbar-hide">
                    {tabs.map((tab, index) => (
                        <button
                            key={index}
                            className={`shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                                currentType === index
                                    ? "border-orange-500 text-orange-500"
                                    : "border-transparent text-gray-500 hover:text-gray-800"
                            }`}
                            onClick={() => navigate(`/myshop/order-list?type=${index}`)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter bar */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center">
                    {/* Filter type dropdown */}
                    <div className="relative min-w-0 sm:w-40">
                        <button
                            onClick={() => setOpenFilter(!openFilter)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:border-gray-300 cursor-pointer"
                        >
                            {filters[selectedFilterType]}
                            <FaChevronDown size={11} className={`text-gray-400 transition-transform ${openFilter ? "rotate-180" : ""}`} />
                        </button>
                        {openFilter && (
                            <ul className="absolute left-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-10">
                                {filters.map((item, index) => (
                                    <li
                                        key={item}
                                        className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                                            index === selectedFilterType
                                                ? "bg-orange-50 text-orange-500 font-semibold"
                                                : "text-gray-700 hover:bg-gray-50"
                                        }`}
                                        onClick={() => {
                                            setSearchQuery("");
                                            setSelectedFilterType(index);
                                            setOpenFilter(false);
                                        }}
                                    >
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Search input */}
                    <input
                        type="text"
                        disabled={selectedFilterType === 0}
                        placeholder={selectedFilterType === 0 ? 'Chọn bộ lọc rồi tìm kiếm...' : `Nhập ${filters[selectedFilterType].toLowerCase()}...`}
                        className={`min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors focus:border-orange-400 focus:outline-none ${
                            selectedFilterType === 0 ? "bg-gray-50 cursor-not-allowed text-gray-400" : "bg-white text-gray-800 placeholder-gray-400"
                        }`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && setFilterType(selectedFilterType)}
                    />

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2 sm:contents">
                        <button
                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 cursor-pointer"
                            onClick={resetFilter}
                        >
                            Đặt lại
                        </button>
                        <button
                            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 cursor-pointer"
                            onClick={() => setFilterType(selectedFilterType)}
                        >
                            Áp dụng
                        </button>
                    </div>
                </div>
            </div>

            {/* Orders table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/80">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[120px]">
                                    <button
                                        className="flex items-center gap-1 cursor-pointer hover:text-gray-700 transition-colors"
                                        onClick={() => setSortType(sortType === 1 ? 0 : 1)}
                                    >
                                        Ngày tạo
                                        <div className="flex flex-col leading-none">
                                            <span className={sortType === 1 ? "text-orange-500" : "text-gray-300"} style={{fontSize: 8}}>▲</span>
                                            <span className={sortType === 0 ? "text-orange-500" : "text-gray-300"} style={{fontSize: 8}}>▼</span>
                                        </div>
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[300px]">Sản phẩm</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[140px]">
                                    <button
                                        className="flex items-center gap-1 mx-auto cursor-pointer hover:text-gray-700 transition-colors"
                                        onClick={() => setSortType(sortType === 3 ? 2 : 3)}
                                    >
                                        Tổng tiền
                                        <div className="flex flex-col leading-none">
                                            <span className={sortType === 3 ? "text-orange-500" : "text-gray-300"} style={{fontSize: 8}}>▲</span>
                                            <span className={sortType === 2 ? "text-orange-500" : "text-gray-300"} style={{fontSize: 8}}>▼</span>
                                        </div>
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[130px]">Trạng thái</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[130px]">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {orders.map((shopOrder) => {
                                const s = statusConfig[shopOrder.status - 1] || statusConfig[0];
                                return (
                                <tr key={shopOrder.id} className="hover:bg-gray-50/50 transition-colors">
                                    {/* Date */}
                                    <td className="px-4 py-4 text-xs text-gray-500 align-top">
                                        {formatDate(shopOrder.createdAt)}
                                    </td>

                                    {/* Products */}
                                    <td className="px-4 py-4 align-top">
                                        <p className="text-xs font-semibold text-gray-500 mb-2">
                                            Người mua: <span className="text-gray-700 font-medium">{shopOrder.buyerName}</span>
                                        </p>
                                        <div className="space-y-2">
                                            {shopOrder.items.map((item) => (
                                                <div key={item.id} className="flex items-start gap-3">
                                                    <img
                                                        src={item.product.thumbnailUrl}
                                                        alt={item.product.name}
                                                        className="w-12 h-12 object-cover rounded-lg border border-gray-100 shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <Link to={`../product/${item.product.id}`}>
                                                            <p className="text-sm font-medium text-gray-800 line-clamp-1 hover:text-orange-500 transition-colors">
                                                                {item.product.name}
                                                            </p>
                                                        </Link>
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            {item.attributes?.map(a => `${a.name}: ${a.value}`).join(" · ")} · x{item.quantity}
                                                        </p>
                                                    </div>
                                                    <span className="text-sm font-semibold text-orange-500 shrink-0">
                                                        {item.price.toLocaleString("vi-VN")}₫
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                            <span className="font-mono">{shopOrder.id.substring(0,8).toUpperCase()}...</span>
                                            <span>•</span>
                                            <span>{paymentTypeMap[shopOrder.paymentType]}</span>
                                        </div>
                                    </td>

                                    {/* Total */}
                                    <td className="px-4 pb-4 pt-11 text-center align-top">
                                        <span className="text-sm font-bold text-orange-500">
                                            {shopOrder.total.toLocaleString("vi-VN")}₫
                                        </span>
                                        {!shopOrder.completedPayment && (
                                            <p className="text-xs text-red-500 mt-1 bg-red-50 px-2 py-0.5 rounded-full inline-block">Chưa TT</p>
                                        )}
                                    </td>

                                    {/* Status */}
                                    <td className="px-4 pb-4 pt-11 text-center align-top">
                                        <span className={`inline-flex min-w-[96px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.color} ${s.bg}`}>
                                            {s.text}
                                        </span>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 pb-4 pt-11 text-center align-top">
                                        <div className="flex flex-col items-center gap-2">
                                            {shopOrder.status === 1 && (
                                                <button
                                                    className={`w-full px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors ${
                                                        shopOrder.completedPayment || shopOrder.paymentType === 'cash_on_delivery'
                                                            ? 'bg-green-500 hover:bg-green-600 cursor-pointer'
                                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                    }`}
                                                    onClick={shopOrder.completedPayment || shopOrder.paymentType === 'cash_on_delivery'
                                                        ? () => updateOrderStatus(shopOrder.id, shopOrder.status)
                                                        : undefined}
                                                >
                                                    ✓ Xác nhận
                                                </button>
                                            )}
                                            {shopOrder.status === 1 && (
                                                <button
                                                    className={`w-full px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                                        !shopOrder.completedPayment || shopOrder.paymentType === 'cash_on_delivery'
                                                            ? 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 cursor-pointer'
                                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    }`}
                                                    onClick={shopOrder.completedPayment && shopOrder.paymentType !== 'cash_on_delivery'
                                                        ? undefined
                                                        : () => setCancelOrder(shopOrder)}
                                                >
                                                    ✕ Hủy đơn
                                                </button>
                                            )}
                                            {shopOrder.status === 2 && (
                                                <button
                                                    className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 cursor-pointer transition-colors"
                                                    onClick={() => updateOrderStatus(shopOrder.id, shopOrder.status)}
                                                >
                                                    Bàn giao
                                                </button>
                                            )}
                                        </div>

                                        {cancelOrder === shopOrder && (
                                            <CancelOrderForm
                                                reasons={cancelReasons}
                                                whoCancel={2}
                                                closeForm={() => setCancelOrder(null)}
                                                order={shopOrder}
                                            />
                                        )}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {orders.length > 0 && (
                    <div className="flex justify-end px-4 py-3 border-t border-gray-100">
                        <Pagination
                            page={page}
                            setPage={setPage}
                            limit={limit}
                            setLimit={setLimit}
                            maxPage={totalPage}
                        />
                    </div>
                )}
            </div>

            {/* Empty state */}
            {isEmpty && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                        <BsClipboard2PlusFill size={28} className="text-orange-300" />
                    </div>
                    <p className="text-base font-semibold text-gray-600 mb-1">Không có đơn hàng nào</p>
                    <p className="text-sm text-gray-400">Đơn hàng mới sẽ xuất hiện ở đây</p>
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-8">
                    <div className="w-7 h-7 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
                </div>
            )}

            <ToastContainer position="bottom-right" />
        </div>
    )
}