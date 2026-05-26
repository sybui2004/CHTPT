import { useNavigate, useLocation, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { fetchWithAuth } from "../../../util/AuthUtil";
import { BASE_API_URL } from "../../../constants";
import { ToastContainer, toast } from "react-toastify";
import CancelOrderForm from "./CancelOrderForm";
import { FiPackage, FiShoppingBag, FiArrowRight, FiX, FiCreditCard, FiCheckCircle, FiRefreshCw } from "react-icons/fi";
import { BsShopWindow } from "react-icons/bs";

const tabs = [
  { label: "Tất cả", icon: null },
  { label: "Chờ thanh toán", icon: null },
  { label: "Chờ xác nhận", icon: null },
  { label: "Chờ vận chuyển", icon: null },
  { label: "Đã nhận", icon: null },
  { label: "Đã hủy", icon: null },
];

const statusConfig = {
  0: { text: "Chờ xác nhận", color: "text-gray-500", bg: "bg-gray-100" },
  1: { text: "Chuẩn bị hàng", color: "text-blue-500", bg: "bg-blue-50" },
  2: { text: "Đã gửi hàng", color: "text-orange-500", bg: "bg-orange-50" },
  3: { text: "Đang giao hàng", color: "text-orange-600", bg: "bg-orange-50" },
  4: { text: "Thành công", color: "text-green-600", bg: "bg-green-50" },
  5: { text: "Đã đánh giá", color: "text-green-600", bg: "bg-green-50" },
  6: { text: "Đã hủy", color: "text-red-500", bg: "bg-red-50" },
};

const stringStatusConfig = {
  PENDING: 0,
  CONFIRMED: 1,
  PREPARING: 1,
  SHIPPING: 2,
  SHIPPED: 3,
  DELIVERED: 4,
  COMPLETED: 5,
  RATED: 5,
  CANCELLED: 6,
};

const getPaymentType = (order) => order.paymentType || order.payment_type || order.payment?.type || order.payment?.payment_type;
const isBankTransferOrder = (order) => getPaymentType(order) === "bank_transfer";
const isPaymentCompleted = (order) =>
  Boolean(order.completedPayment || order.completed_payment || order.payment?.status === "COMPLETED");
const getPaymentExpireTime = (order) =>
  order.payment?.expireAt ? new Date(order.payment.expireAt).getTime() : null;
const isPaymentExpiredOrder = (order, now) => {
  const expireAt = getPaymentExpireTime(order);
  return isBankTransferOrder(order) && !isPaymentCompleted(order) && Boolean(expireAt && expireAt <= now);
};
const isPaymentPendingOrder = (order, now) =>
  isBankTransferOrder(order) && !isPaymentCompleted(order) && !isPaymentExpiredOrder(order, now);

const cancelReason = [
  "Thay đổi địa chỉ nhận hàng",
  "Điều chỉnh đơn hàng (phân loại, số lượng, ...)",
  "Quy trình thanh toán quá phức tạp",
  "Tìm được chỗ khác rẻ hơn",
  "Không muốn mua nữa",
];

const formatPrice = (amount) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

// Helper to get shop_orders from order (supports both snake_case and camelCase)
const getShopOrders = (order) => order.shop_orders || order.shopOrders || [];

export default function OrdersPage() {
  const limit = 5;
  const [now, setNow] = useState(Date.now());
  const [cancelOrder, setCancelOrder] = useState(null);
  const [offset, setOffset] = useState(0);
  const [isEndOfOrders, setIsEndOfOrders] = useState(false);
  const [isEmptyList, setIsEmptyList] = useState(false);
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentType = parseInt(searchParams.get("type")) || 0;
  const [orders, setOrders] = useState({});

  const fetchOrders = (type, reset = false) => {
    setIsFetchingOrders(true);
    fetchWithAuth(
      `${BASE_API_URL}/v1/order/get_order_list?type=${type}&offset=${reset ? 0 : offset}&limit=${limit}`,
      window.location,
      true
    )
      .then((res) => res.json())
      .then((res) => {
        setOrders((prev) => ({
          ...prev,
          [type]: {
            list: reset
              ? res.content
              : prev[type]?.list
              ? prev[type].list.concat(res.content)
              : res.content,
            orderCount: res.nextOffset,
          },
        }));
        setOffset(res.nextOffset);
        if (reset && res.content.length === 0) setIsEmptyList(true);
        if (res.content.length < limit) setIsEndOfOrders(true);
        setIsFetchingOrders(false);
      })
      .catch(() => setIsFetchingOrders(false));
  };

  const handleMarkOrderAsReceived = (shopOrderId) => {
    fetchWithAuth(`${BASE_API_URL}/v1/order/mark_as_received?shopOrderId=${shopOrderId}`, window.location, true, {
      method: "POST",
    })
      .then((res) => {
        if (res.ok) fetchOrders(currentType, true);
      })
      .catch(() => toast.error("Có lỗi xảy ra, vui lòng thử lại sau"));
  };

  const handleCreatePayment = (orderId) => {
    fetchWithAuth(`${BASE_API_URL}/v1/payment/payment_url?orderId=${orderId}`, window.location, true)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || data.message || "CÃ³ lá»—i xáº£y ra, vui lÃ²ng thá»­ láº¡i sau");
        }
        return data;
      })
      .then((res) => {
        if (res.message) {
          toast.error(res.message === "Payment expired"
            ? "Đơn hàng đã quá hạn thanh toán"
            : "Có lỗi xảy ra, vui lòng thử lại sau");
          fetchOrders(currentType, true);
        }
        else {
          const paymentUrl = res.paymentUrl || res.url;
          if (!paymentUrl) throw new Error("Khong tao duoc lien ket thanh toan");
          window.open(paymentUrl, "_blank");
        }
      })
      .catch((err) => {
        toast.error(err.message === "Payment expired"
          ? "ÄÆ¡n hÃ ng Ä‘Ã£ quÃ¡ háº¡n thanh toÃ¡n"
          : err.message || "CÃ³ lá»—i xáº£y ra, vui lÃ²ng thá»­ láº¡i sau");
        fetchOrders(currentType, true);
      });
  };

  useEffect(() => {
    if (!orders[currentType]) {
      setOffset(0);
      setIsEmptyList(false);
      setIsEndOfOrders(false);
      fetchOrders(currentType, true);
    } else {
      setIsEmptyList(orders[currentType].list.length === 0);
      setOffset(orders[currentType].list.length);
      setIsEndOfOrders(orders[currentType].list.length % limit !== 0);
    }
  }, [currentType]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadMoreRef = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingOrders && !isEndOfOrders) {
          fetchOrders(currentType);
        }
      },
      { threshold: 1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [isFetchingOrders, isEndOfOrders, currentType]);

  const getStatusIndex = (order) => {
    const firstShopOrder = getShopOrders(order)[0];
    const shopStatus = firstShopOrder?.status;
    if (shopStatus && stringStatusConfig[shopStatus] !== undefined) {
      return stringStatusConfig[shopStatus];
    }
    if (order.status && stringStatusConfig[order.status] !== undefined) {
      return stringStatusConfig[order.status];
    }
    const idx = parseInt(order.status, 10);
    return isNaN(idx) ? 0 : idx - 1;
  };

  const status = (order) => isPaymentExpiredOrder(order, now) ? statusConfig[6] : statusConfig[getStatusIndex(order)] || statusConfig[0];

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* Tab bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-x-auto scrollbar-hide">
        <div className="flex min-w-max">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => navigate(`/account/orders?type=${index}`)}
              className={`cursor-pointer px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                currentType === index
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Order list */}
      <div className={`space-y-3 ${isEmptyList ? "" : "flex-1"}`}>
        {orders[currentType]?.list.map((order, index) => {
          const s = status(order);
          const isPaymentExpired = isPaymentExpiredOrder(order, now);
          const isPaymentPending = isPaymentPendingOrder(order, now);
          return (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Order header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-gray-50/50">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <BsShopWindow size={14} />
                  <span className="font-medium text-gray-700">
                    {order.shop_orders?.[0]?.name || order.shopOrders?.[0]?.name || "Shop"}
                  </span>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.color} ${s.bg}`}>
                  {s.text}
                </span>
              </div>

              {/* Items */}
              {getShopOrders(order).map((shopOrder) => (
                <div key={shopOrder.id}>
                  {shopOrder.items?.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/30 transition-colors">
                      <Link to={`/product/${encodeURIComponent((item.product?.name || "san-pham").replace(/\s+/g, "-"))}.${item.product?.id || item.product_id || ""}`}>
                        <img
                          src={item.product?.thumbnailUrl || item.thumbnail_url || ""}
                          alt={item.product?.name || item.name || "Sản phẩm"}
                          className="w-16 h-16 object-cover rounded-xl border border-gray-100 shrink-0"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/product/${encodeURIComponent((item.product?.name || "san-pham").replace(/\s+/g, "-"))}.${item.product?.id || item.product_id || ""}`}>
                          <p className="text-sm font-medium text-gray-800 line-clamp-2 hover:text-primary transition-colors">
                            {item.product?.name || item.name || "Sản phẩm"}
                          </p>
                        </Link>
                        {item.attributes && item.attributes.length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.attributes.map((a) => `${a.name}: ${a.value}`).join(" · ")}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">x{item.quantity}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary shrink-0">{formatPrice(item.price)}</span>
                    </div>
                  ))}

                </div>
              ))}

              {/* Cancel form */}
              {cancelOrder === order && (
                <div className="px-4 pb-4">
                  <CancelOrderForm
                    reasons={cancelReason}
                    whoCancel={1}
                    closeForm={() => setCancelOrder(null)}
                    onSuccess={null}
                    order={cancelOrder}
                  />
                </div>
              )}

              {/* Footer */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 bg-gray-50/50 gap-3">
                {/* Payment deadline */}
                <div>
                  {order.payment?.expireAt && (isPaymentPending || isPaymentExpired) && (
                    <p className={`text-xs flex items-center gap-1 ${isPaymentExpired ? "text-red-500" : "text-orange-500"}`}>
                      <FiCreditCard size={12} />
                      {isPaymentExpired
                        ? "Đã quá hạn thanh toán"
                        : `Thanh toán trước ${new Date(order.payment.expireAt).toLocaleString("vi-VN")}`}
                    </p>
                  )}
                  <p className="text-sm font-bold text-gray-800 mt-1">
                    Tổng:{" "}
                    <span className="text-primary text-base">
                      {formatPrice(
                        getShopOrders(order).length > 1
                          ? order.payment.amount
                          : (() => {
                              const firstShopOrder = getShopOrders(order)[0];
                              return (firstShopOrder?.items?.reduce?.((t, i) => t + i.price * i.quantity, 0) || 0) 
                                + (firstShopOrder?.shippingFee || firstShopOrder?.shipping_fee || 0);
                            })()
                      )}
                    </span>
                  </p>
                </div>

                  {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {isPaymentPending && (
                    <button
                      className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-orange-600 transition-colors"
                      onClick={() => handleCreatePayment(order.id)}
                    >
                      <FiCreditCard size={13} /> Thanh toán
                    </button>
                  )}
                  {isPaymentExpired && (
                    <button
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-500 text-xs font-semibold rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => fetchOrders(currentType, true)}
                    >
                      <FiRefreshCw size={13} /> Cập nhật trạng thái
                    </button>
                  )}
                  {(() => {
                    const firstShopOrder = getShopOrders(order)[0];
                    return firstShopOrder?.status === "SHIPPING" || firstShopOrder?.status === "SHIPPED";
                  })() && (
                    <button
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-green-600 transition-colors"
                      onClick={() => handleMarkOrderAsReceived(order.id)}
                    >
                      <FiCheckCircle size={13} /> Đã nhận hàng
                    </button>
                  )}
                  {/* Tab Chờ xác nhận: luôn hiển thị nút Hủy đơn */}
                  {currentType === 2 && (
                    <button
                      className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-500 text-xs font-semibold rounded-lg cursor-pointer hover:bg-red-50 transition-colors"
                      onClick={() => setCancelOrder(order)}
                    >
                      <FiX size={13} /> Hủy đơn
                    </button>
                  )}
                  {/* Tab Tất cả: hiện Hủy đơn cho PENDING và CHỜ THANH TOÁN, xóa Chi tiết cho các trạng thái khác */}
                  {currentType === 0 && (isPaymentPending || (() => {
                    const firstShopOrder = getShopOrders(order)[0];
                    return firstShopOrder?.status === "PENDING" || firstShopOrder?.status === "1";
                  })()) && (
                    <button
                      className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-500 text-xs font-semibold rounded-lg cursor-pointer hover:bg-red-50 transition-colors"
                      onClick={() => setCancelOrder(order)}
                    >
                      <FiX size={13} /> Hủy đơn
                    </button>
                  )}
                  {/* Chi tiết: ẩn ở tất cả các tab */}
                  {/* {!(currentType === 0 && (isPaymentPending || (() => {
                    const firstShopOrder = getShopOrders(order)[0];
                    return firstShopOrder?.status === "PENDING" || firstShopOrder?.status === "1";
                  })())) && !isPaymentPending && (
                    <Link to={`/account/orders/${order.id}`}>
                      <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        Chi tiết <FiArrowRight size={12} />
                      </button>
                    </Link>
                  )} */}
                  {currentType !== 0 && currentType !== 2 && order.cancelable && !isPaymentCompleted(order) && !isPaymentExpired && (
                    <button
                      className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-500 text-xs font-semibold rounded-lg cursor-pointer hover:bg-red-50 transition-colors"
                      onClick={() => setCancelOrder(order)}
                    >
                      <FiX size={13} /> Hủy đơn
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {isEmptyList && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white px-4 py-14 text-center shadow-sm sm:py-20">
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-4">
            <FiShoppingBag size={36} className="text-primary" />
          </div>
          <p className="text-lg font-semibold text-gray-700 mb-1">Không có đơn hàng nào</p>
          <p className="text-sm text-gray-400 mb-6">Hãy mua sắm và quay lại sau nhé!</p>
          <Link
            to="/"
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            Khám phá ngay <FiArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* Loading spinner */}
      {isFetchingOrders && (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      <div ref={loadMoreRef} />
      <ToastContainer position="bottom-right" />
    </div>
  );
}
