import { useEffect, useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import { fetchWithAuth } from "../../../util/AuthUtil"
import { BASE_API_URL } from "../../../constants"
import { FiArrowLeft, FiMapPin, FiPhone, FiShoppingBag, FiCheck, FiTruck, FiPackage, FiStar, FiAlertCircle, FiClock, FiX, FiRefreshCw } from "react-icons/fi"
import { FaClipboardList, FaDollarSign, FaShippingFast, FaBoxOpen } from "react-icons/fa"
import { ToastContainer, toast } from "react-toastify"
import CancelOrderForm from "./CancelOrderForm"

const statusConfig = [
    { label: "Chờ xác nhận", color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", dot: "bg-gray-400" },
    { label: "Chuẩn bị hàng", color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-400" },
    { label: "Đã gửi hàng", color: "text-indigo-500", bg: "bg-indigo-50", border: "border-indigo-200", dot: "bg-indigo-400" },
    { label: "Đang giao hàng", color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-400" },
    { label: "Thành công", color: "text-green-500", bg: "bg-green-50", border: "border-green-200", dot: "bg-green-400" },
    { label: "Đã đánh giá", color: "text-green-600", bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500" },
    { label: "Đã hủy", color: "text-red-500", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-400" },
];

const paymentMethodMapping = {
    'cash_on_delivery': 'Thanh toán khi nhận hàng',
    'bank_transfer': 'Chuyển khoản ngân hàng'
}

const whoCancel = { 1: "bạn", 2: "cửa hàng" }

const cancelReason = [
    "Thay đổi địa chỉ nhận hàng",
    "Điều chỉnh đơn hàng (phân loại, số lượng, ...)",
    "Quy trình thanh toán quá phức tạp",
    "Tìm được chỗ khác rẻ hơn",
    "Không muốn mua nữa",
]

const trackSteps = [
    { status: 1, label: "Đặt đơn", icon: FaClipboardList },
    { status: 2, label: "Xác nhận", icon: FaDollarSign },
    { status: 4, label: "Vận chuyển", icon: FaShippingFast },
    { status: 5, label: "Nhận hàng", icon: FaBoxOpen },
    { status: 6, label: "Đánh giá", icon: FiStar },
];

export default function OrderDetail(){
    const navigate = useNavigate()
    const [shopOrder, setShopOrder] = useState(null)
    const [cancelOrder, setCancelOrder] = useState(null)
    const { shopOrderId } = useParams()

    const fetchOrder = () => {
        fetchWithAuth(`${BASE_API_URL}/v1/order/detail?shopOrderId=${shopOrderId}`, null, true)
            .then(res => res.json())
            .then(res => {
                // Backend returns { id, status, shop_order, shipping_address } - convert for frontend
                const orderData = { ...res.shop_order, orderId: res.id }
                // Convert snake_case to camelCase
                orderData.shippingAddress = res.shipping_address
                orderData.paymentMethod = res.payment_method
                orderData.createdAt = res.created_at
                orderData.updatedAt = res.updated_at
                setShopOrder(orderData)
            })
            .catch(() => navigate('/error'))
    }

    useEffect(() => { fetchOrder() }, [])

    if (!shopOrder) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        )
    }

    const handleMarkOrderAsReceived = () => {
        fetchWithAuth(`${BASE_API_URL}/v1/order/mark_as_received?shopOrderId=${shopOrderId}`, window.location, true, { method: "POST" })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => null)
                    toast.error(data?.message || "Không thể xác nhận đã nhận hàng")
                    return
                }
                toast.success("Đã xác nhận nhận hàng")
                fetchOrder()
            })
            .catch(() => toast.error("Có lỗi xảy ra, vui lòng thử lại sau"))
    }

    const handleCreatePayment = () => {
        const orderId = shopOrder?.orderId
        if (!orderId) {
            toast.error("Không tìm thấy mã đơn thanh toán")
            return
        }
        fetchWithAuth(`${BASE_API_URL}/v1/payment/payment_url?orderId=${orderId}`, window.location, true)
            .then(async (res) => {
                const data = await res.json().catch(() => ({}))
                if (!res.ok) {
                    throw new Error(data.detail || data.message || "CÃ³ lá»—i xáº£y ra, vui lÃ²ng thá»­ láº¡i sau")
                }
                return data
            })
            .then((res) => {
                if (res.message) {
                    toast.error(res.message === "Payment expired" ? "Đơn hàng đã quá hạn thanh toán" : "Có lỗi xảy ra, vui lòng thử lại sau")
                    fetchOrder()
                } else {
                    const paymentUrl = res.paymentUrl || res.url
                    if (!paymentUrl) throw new Error("Khong tao duoc lien ket thanh toan")
                    window.open(paymentUrl, "_blank")
                }
            })
            .catch(() => toast.error("Có lỗi xảy ra, vui lòng thử lại sau"))
    }

    if (!shopOrder) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="w-10 h-10 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin"></div>
            </div>
        )
    }

    const statusIdx = shopOrder.status - 1;
    const cfg = statusConfig[statusIdx] || statusConfig[0];
    const total = (shopOrder.items || []).reduce((sum, item) => sum + item.price * item.quantity, 0);
    const grandTotal = total + (shopOrder.shippingFee || 0);

    return (
        <div className="max-w-3xl mx-auto space-y-4 pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-800 cursor-pointer transition-colors text-sm font-medium self-start"
                    onClick={() => window.history.back()}
                >
                    <FiArrowLeft size={16} /> Quay lại đơn hàng
                </button>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                    <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                </div>
            </div>

            {/* Order ID Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Mã đơn hàng</p>
                        <p className="text-xs sm:text-sm font-mono font-semibold text-gray-700 mt-0.5 break-all">{shopOrder.id}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Ngày đặt</p>
                        <p className="text-sm font-medium text-gray-600 mt-0.5">{new Date(shopOrder.createdAt || Date.now()).toLocaleDateString('vi-VN')}</p>
                    </div>
                </div>
            </div>

            {/* Order Track */}
            {shopOrder.status !== 7 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-6">
                    <p className="text-sm font-semibold text-gray-700 mb-5">Trạng thái đơn hàng</p>
                    <div className="flex items-start justify-between overflow-x-auto pb-2">
                        {trackSteps.map((step, index) => {
                            const StepIcon = step.icon;
                            const track = shopOrder.tracks?.find(t => t.status === step.status);
                            const isCompleted = !!track;
                            const isCurrent = !isCompleted && shopOrder.status === step.status;
                            return (
                                <div key={step.status} className="flex flex-col items-center relative min-w-[64px] flex-1">
                                    {/* Connector line */}
                                    {index < trackSteps.length - 1 && (
                                        <div className={`absolute top-5 left-[50%] w-full h-0.5 ${isCompleted ? 'bg-orange-400' : 'bg-gray-200'}`} style={{ zIndex: 0 }} />
                                    )}
                                    {/* Icon circle */}
                                    <div className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm transition-all ${
                                        isCompleted ? 'border-orange-400 bg-orange-400 text-white' :
                                        isCurrent ? 'border-orange-300 bg-orange-50 text-orange-400' :
                                        'border-gray-200 bg-white text-gray-300'
                                    }`}>
                                        {isCompleted ? <FiCheck size={16} /> : <StepIcon size={16} />}
                                    </div>
                                    <p className={`text-[10px] text-center mt-2 font-medium leading-tight max-w-[60px] ${isCompleted || isCurrent ? 'text-gray-700' : 'text-gray-400'}`}>{step.label}</p>
                                    {track && (
                                        <p className="text-[9px] text-gray-400 text-center mt-0.5">{new Date(track.updatedAt).toLocaleDateString('vi-VN')}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Cancelled Banner */}
            {shopOrder.status === 7 && shopOrder.cancelReason && (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
                    <FiAlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-red-700 font-semibold text-sm">Đơn hàng đã bị hủy bởi {whoCancel[shopOrder.canceledBy]}</p>
                        <p className="text-red-600 text-xs mt-1">Lý do: {shopOrder.cancelReason}</p>
                    </div>
                </div>
            )}

            {/* Address + Actions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-5">
                <div className="flex flex-col sm:flex-row gap-5 sm:justify-between">
                    {/* Address */}
                    <div className="flex gap-3 flex-1">
                        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                            <FiMapPin size={16} className="text-orange-500" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800 mb-0.5">Địa chỉ nhận hàng</p>
                            <p className="text-sm font-semibold text-gray-700">{shopOrder.shippingAddress?.receiverName}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <FiPhone size={11} /> {shopOrder.shippingAddress?.phoneNumber}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{shopOrder.shippingAddress?.detail},</p>
                            <p className="text-xs text-gray-500">{shopOrder.shippingAddress?.ward?.name}, {shopOrder.shippingAddress?.district?.name}, {shopOrder.shippingAddress?.province?.name}</p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-row sm:flex-col gap-2 flex-wrap sm:items-end justify-start">
                        {shopOrder.payment?.status === "PENDING" && (
                            <button onClick={handleCreatePayment} className="text-sm font-semibold bg-orange-500 text-white px-4 py-2 rounded-xl hover:bg-orange-600 transition-colors cursor-pointer active:scale-95">Thanh toán</button>
                        )}
                        {(shopOrder.status === 4 || shopOrder.status === 3) && (
                            <button onClick={handleMarkOrderAsReceived} className="text-sm font-semibold bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 transition-colors cursor-pointer active:scale-95">
                                <span className="flex items-center gap-1.5"><FiCheck size={14} /> Đã nhận hàng</span>
                            </button>
                        )}
                        {shopOrder.status === 6 && (
                            <>
                                <button className="text-sm font-semibold bg-orange-500 text-white px-4 py-2 rounded-xl hover:bg-orange-600 transition-colors cursor-pointer active:scale-95">
                                    <span className="flex items-center gap-1.5"><FiRefreshCw size={14} /> Mua lại</span>
                                </button>
                            </>
                        )}
                        {shopOrder.status <= 2 && (
                            <button onClick={() => setCancelOrder({ id: shopOrder.orderId, shopOrders: [{ id: shopOrder.id }] })} className="text-sm font-semibold border border-red-200 text-red-500 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors cursor-pointer active:scale-95">
                                <span className="flex items-center gap-1.5"><FiX size={14} /> Hủy đơn</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {cancelOrder && (
                <CancelOrderForm
                    reasons={cancelReason}
                    whoCancel={1}
                    closeForm={() => setCancelOrder(null)}
                    order={cancelOrder}
                />
            )}

            {/* Shop Items */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                    <FiShoppingBag size={16} className="text-orange-500" />
                    <Link to="#" className="text-sm font-semibold text-gray-800 hover:text-orange-500 transition-colors">{shopOrder.shopName}</Link>
                </div>

                <div className="divide-y divide-gray-100">
                    {shopOrder.items.map((item) => (
                        <div key={item.id} className="flex items-start gap-4 px-5 py-4">
                            <img src={item.product.thumbnailUrl} alt={item.product.name}
                                className="w-16 h-16 object-cover rounded-xl border border-gray-200 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 line-clamp-2">{item.product.name}</p>
                                {item.attributes?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {item.attributes.map((attr) => (
                                            <span key={attr.name} className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{attr.name}: {attr.value}</span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-gray-400 mt-1.5">x{item.quantity}</p>
                            </div>
                            <p className="text-sm font-semibold text-orange-500 shrink-0">{item.price.toLocaleString()}₫</p>
                        </div>
                    ))}
                </div>

                {/* Price breakdown */}
                <div className="border-t border-gray-100 px-5 py-4 space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Tổng tiền hàng</span>
                        <span className="text-gray-700 font-medium">{total.toLocaleString()}₫</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-1"><FiTruck size={13} /> Phí vận chuyển</span>
                        <span className="text-gray-700 font-medium">{shopOrder.shippingFee.toLocaleString()}₫</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-gray-700 font-semibold">Tổng thanh toán</span>
                        <span className="text-orange-500 font-bold text-lg">{grandTotal.toLocaleString()}₫</span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1">
                        <span className="text-gray-500">Phương thức thanh toán</span>
                        <span className="text-gray-700 font-medium text-right">{paymentMethodMapping[shopOrder.payment?.type] || shopOrder.payment?.type}</span>
                    </div>
                </div>
            </div>
            <ToastContainer position="bottom-right" />
        </div>
    )
}
