import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "../../util/AuthUtil";
import { BASE_API_URL } from "../../constants";
import { ToastContainer, toast } from "react-toastify";
import Loading from "../common/Loading";
import { Link, useNavigate } from "react-router-dom";
import { FiMapPin } from "react-icons/fi";

const formatCurrency = (value) => `${Number(value || 0).toLocaleString("vi-VN")} VND`;
const ADDRESS_REQUIRED_MESSAGE = "User hasn't have an address yet!";
const ADDRESS_NOTICE = "Bạn chưa có địa chỉ nhận hàng. Bấm vào đây để thêm địa chỉ trước khi thanh toán.";

const getShopProductTotal = (shopCheckout) => {
    return (shopCheckout.items || []).reduce((subtotal, item) => subtotal + Number(item.price || 0) * Number(item.quantity || 0), 0);
};

const getErrorMessage = async (res) => {
    try {
        const data = await res.json();
        return data.message || data.detail || "Có lỗi xảy ra, vui lòng thử lại";
    }
    catch {
        return "Có lỗi xảy ra, vui lòng thử lại";
    }
};

const getAddressPartName = (part) => {
    if (!part) return "";
    if (typeof part === "string") return part;
    return part.name || "";
};

const formatAddressLine = (address) => {
    if (!address) return "";
    return [address.ward, address.district, address.province]
        .map(getAddressPartName)
        .filter(Boolean)
        .join(", ");
};

const openPaymentUrl = async (orderId) => {
    const res = await fetchWithAuth(`${BASE_API_URL}/v1/payment/payment_url?orderId=${orderId}`, window.location, true);
    if (!res.ok) {
        throw new Error(await getErrorMessage(res));
    }
    const data = await res.json();
    const paymentUrl = data.paymentUrl || data.url;
    if (!paymentUrl) {
        throw new Error("Khong tao duoc lien ket thanh toan");
    }
    window.location.assign(paymentUrl);
};

export default function CheckoutPage() {
    const navigate = useNavigate();
    const [checkingOut, setCheckingOut] = useState(false);

    const [checkoutList, setCheckoutList] = useState([]);
    const [addressList, setAddressList] = useState([]);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpenAddressList, setIsOpenAddressList] = useState(false);
    const [selectingAddressId, setSelectingAddressId] = useState();
    const [paymentType, setPaymentType] = useState("cash_on_delivery");
    const [addressNotice, setAddressNotice] = useState("");

    const fetchCheckoutList = async (body) => {
        try {
            const res = await fetchWithAuth(`${BASE_API_URL}/v1/checkout/get`, window.location, true, body ? {
                method: "POST",
                headers: {
                    "Content-type": "application/json"
                },
                body: JSON.stringify(body),
            } : {});
            const data = await res.json();
            if (data.message) {
                if (data.message === ADDRESS_REQUIRED_MESSAGE) {
                    setAddressNotice(ADDRESS_NOTICE);
                    setCheckoutList([]);
                    return [];
                }
                alert(data.message);
                navigate("/cart");
                return [];
            }
            setAddressNotice("");
            const shops = data.shopCheckouts || [];
            setCheckoutList(shops);
            return shops;
        }
        catch (err) {
            console.log("Error: " + err);
            alert("Có lỗi xảy ra, vui lòng thử lại sau");
            navigate("/cart");
            return [];
        }
    };

    const fetchAddressList = async () => {
        const res = await fetchWithAuth(`${BASE_API_URL}/v1/user/address/get-list`, window.location, true);
        const data = await res.json();
        setAddressList(data);
        const primaryAddress = data.find((addr) => addr.primary) || data[0] || null;
        setSelectedAddress(primaryAddress);
        setAddressNotice(primaryAddress ? "" : ADDRESS_NOTICE);
    };

    const fetchCheckoutData = async () => {
        setIsLoading(true);
        await fetchCheckoutList();
        await fetchAddressList();
        setIsLoading(false);
    };

    useEffect(() => {
        fetchCheckoutData();
    }, []);

    const handleChangeAddress = async () => {
        setIsOpenAddressList(false);
        if (selectingAddressId === selectedAddress?.id) return;
        const body = {
            addressId: selectingAddressId
        };
        setIsLoading(true);
        setSelectedAddress(addressList.find((addr) => addr.id === selectingAddressId) || selectedAddress);
        await fetchCheckoutList(body);
        setIsLoading(false);
    };

    const totalProductPrice = useMemo(() => checkoutList.reduce((total, shopCheckout) => {
        return total + getShopProductTotal(shopCheckout);
    }, 0), [checkoutList]);

    const totalShippingFee = useMemo(
        () => checkoutList.reduce((total, shopCheckout) => total + shopCheckout.shipmentFee, 0),
        [checkoutList]
    );

    const totalOrderPrice = totalProductPrice + totalShippingFee;

    const handlePlaceOrder = () => {
        if (!selectedAddress) {
            setAddressNotice(ADDRESS_NOTICE);
            return;
        }
        setCheckingOut(true);
        const body = {
            addressId: selectedAddress.id,
            shopOrders: [],
            paymentType: paymentType
        };
        checkoutList.forEach((shopCheckout) => {
            const shopId = shopCheckout.shop.id;
            body.shopOrders.push({
                shopId,
                shippingFee: shopCheckout.shipmentFee,
                totalPrice: getShopProductTotal(shopCheckout),
            });
        });
        try {
            fetchWithAuth(`${BASE_API_URL}/v1/order/place_order`, null, true, {
                method: "POST",
                headers: {
                    "Content-type": "application/json"
                },
                body: JSON.stringify(body)
            })
                .then(res => {
                    if (res.ok) return res.json();
                    return getErrorMessage(res).then((message) => {
                        throw new Error(message);
                    });
                })
                .then(async (res) => {
                    if (res.paymentUrl || res.url) {
                        window.location.assign(res.paymentUrl || res.url);
                        return;
                    }
                    if (paymentType === "bank_transfer") {
                        await openPaymentUrl(res.orderId);
                        return;
                    }
                    window.location.assign("/checkout/success");
                })
                .catch((err) => {
                    alert(err.message || "Sản phẩm không còn đủ!");
                    setCheckingOut(false);
                });
        }
        catch (err) {
            console.log(err);
            alert("Có lỗi xảy ra");
            setCheckingOut(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 overflow-x-hidden p-3 sm:p-4 lg:flex-row lg:gap-6">
            {isLoading ? (
                <Loading />
            ) : (
                <>
                <div className="min-w-0 w-full lg:w-2/3">
                    <h2 className="text-2xl font-bold mb-4">Thanh toán</h2>
                    {checkoutList.length === 0 ? (
                        <p className="text-gray-500">Không có sản phẩm nào để thanh toán.</p>
                    ) : (
                        checkoutList.map((shopCheckout) => {
                            const shopId = shopCheckout.shop?.id || shopCheckout.shopId;
                            const shopProductTotal = getShopProductTotal(shopCheckout);
                            return (
                            <div key={shopId} className="mb-6 rounded-lg border border-gray-100 bg-white p-3 shadow-lg sm:p-4">
                                <div className="flex items-center mb-3">
                                    <Link to="#" className="text-xl font-semibold">{shopCheckout.shop?.name || "Shop"}</Link>
                                </div>
                                {(shopCheckout.items || []).map((item) => (
                                    <div key={item.itemId} className="flex flex-col gap-3 border-b py-3 sm:flex-row sm:items-center">
                                        <Link to={`/product/${encodeURIComponent((item.name || "san-pham").replace(/\s+/g, "-"))}.${item.productId}`}>
                                            <img src={item.thumbnailUrl} alt={item.name || "Sản phẩm"} className="h-20 w-20 shrink-0 object-cover rounded-lg" />
                                        </Link>
                                        <div className="min-w-0 flex-1 sm:ml-4">
                                            <Link to={`/product/${encodeURIComponent((item.name || "san-pham").replace(/\s+/g, "-"))}.${item.productId}`}
                                                className="text-lg font-medium line-clamp-2 overflow-hidden w-full">
                                                {item.name || "Sản phẩm"}
                                            </Link>
                                            <div className="mt-2 grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2 md:grid-cols-4 md:gap-5">
                                                <div>
                                                    <p className="font-bold">Phân loại</p>
                                                    {(item.attributes || []).map((attr) => (
                                                        <p key={attr.id}>{attr.name}: {attr.value}</p>
                                                    ))}
                                                </div>
                                                <div>
                                                    <p className="font-bold">Giá</p>
                                                    <p>{formatCurrency(item.price)}</p>
                                                </div>
                                                <div>
                                                    <p className="font-bold">Số lượng</p>
                                                    <p>{item.quantity}</p>
                                                </div>
                                                <div>
                                                    <p className="font-bold justify-center">Tổng</p>
                                                    <p>{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <div className="mt-4 p-3 flex flex-wrap justify-end gap-6">
                                    <div className="text-right ml-auto">
                                        <p className="font-bold">Tổng sản phẩm</p>
                                        <p className="text-gray-700">{formatCurrency(shopProductTotal)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">Phí vận chuyển</p>
                                        <p className="text-gray-700">{formatCurrency(shopCheckout.shipmentFee)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">Ngày giao dự kiến</p>
                                        <p className="text-gray-700">{new Date(shopCheckout.expectedDeliveryDate).toLocaleDateString("vi-VN")}</p>
                                    </div>
                                </div>
                            </div>
                            )
                        })
                    )}
                </div>

                <div className="h-fit w-full min-w-0 lg:sticky lg:top-20 lg:w-auto lg:min-w-[340px]">
                    <div className={`p-6 bg-white shadow-lg rounded-lg h-fit mb-6 ${
                        checkingOut ? "opacity-50 pointer-events-none" : ""
                    }`}>
                        <div className="flex justify-between">
                            <h3 className="text-xl font-bold mb-4">Địa chỉ</h3>
                            {selectedAddress ? (
                                <button className="cursor-pointer mb-2 text-blue-400" onClick={() => {
                                    setSelectingAddressId(selectedAddress?.id);
                                    setIsOpenAddressList(true);
                                }}>
                                    Thay đổi
                                </button>
                            ) : (
                                <Link to="/account/address" className="mb-2 text-blue-400 hover:underline">
                                    Thêm địa chỉ
                                </Link>
                            )}
                        </div>
                        {selectedAddress && (
                            <div key={selectedAddress.id} className="mb-4 break-words rounded-lg border p-4 shadow">
                                <p className="font-semibold">{selectedAddress.receiverName} <span className="text-gray-500">({selectedAddress.phoneNumber})</span></p>
                                <p>{selectedAddress.detail}</p>
                                <p>{formatAddressLine(selectedAddress)}</p>
                                {selectedAddress.primary && <span className="text-md text-red-500 text-sm font-semibold border-2 border-solid border-red-100">Chính</span>}
                            </div>
                        )}
                        {!selectedAddress && addressNotice && (
                            <Link
                                to="/account/address"
                                className="mb-4 flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-700 transition-colors hover:border-orange-300 hover:bg-orange-100"
                            >
                                <FiMapPin className="mt-0.5 shrink-0" size={20} />
                                <div>
                                    <p className="font-semibold">Chưa có địa chỉ nhận hàng</p>
                                    <p className="mt-1 text-sm">{addressNotice}</p>
                                </div>
                            </Link>
                        )}
                    </div>

                    <div className={`p-6 bg-white shadow-lg rounded-lg h-fit mb-6 ${
                        checkingOut ? "opacity-50 pointer-events-none" : ""
                    }`}>
                        <h3 className="text-xl font-bold mb-4">Hình thức thanh toán</h3>
                        <div className="space-y-3">
                            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer">
                                <span>Thanh toán tiền mặt</span>
                                <input
                                    type="radio"
                                    name="payment"
                                    value="cash_on_delivery"
                                    checked={paymentType === "cash_on_delivery"}
                                    onChange={() => setPaymentType("cash_on_delivery")}
                                    className="hidden"
                                />
                                <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center ${
                                    paymentType === "cash_on_delivery" ? "border-primary" : "border-gray-300"
                                }`}>
                                    {paymentType === "cash_on_delivery" && (
                                        <div className="w-3 h-3 bg-primary rounded-full"></div>
                                    )}
                                </div>
                            </label>

                            <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer">
                                <span>Chuyển khoản</span>
                                <input
                                    type="radio"
                                    name="payment"
                                    value="bank_transfer"
                                    checked={paymentType === "bank_transfer"}
                                    onChange={() => setPaymentType("bank_transfer")}
                                    className="hidden"
                                />
                                <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center ${
                                    paymentType === "bank_transfer" ? "border-primary" : "border-gray-300"
                                }`}>
                                    {paymentType === "bank_transfer" && (
                                        <div className="w-3 h-3 bg-primary rounded-full"></div>
                                    )}
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="p-6 bg-white shadow-lg rounded-lg h-fit">
                        <h3 className="text-xl font-bold mb-4">Đơn hàng</h3>
                        <div className="flex justify-between text-md mb-2">
                            <span>Tổng tiền sản phẩm:</span>
                            <span>{formatCurrency(totalProductPrice)}</span>
                        </div>
                        <div className="flex justify-between text-md mb-2">
                            <span>Phí vận chuyển:</span>
                            <span>{formatCurrency(totalShippingFee)}</span>
                        </div>
                        <div className="flex justify-between text-lg mb-4 border-t pt-2">
                            <span>Tổng cộng:</span>
                            <span className="font-bold text-primary text-xl">{formatCurrency(totalOrderPrice)}</span>
                        </div>
                        <button
                            onClick={handlePlaceOrder}
                            disabled={checkingOut || checkoutList.length === 0 || !selectedAddress}
                            className="w-full bg-primary text-white text-lg py-2 rounded-sm hover:bg-primary-dark cursor-pointer mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {checkingOut ? "Đang đặt hàng..." : "Đặt hàng"}
                        </button>
                    </div>
                </div>
                </>
            )}

            {isOpenAddressList && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-50/75 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-xl m-4 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4">
                            Chọn địa chỉ
                        </h3>
                        {addressList.map((addr) => (
                            <div key={addr.id} className="flex items-start border border-gray-200 ps-4 rounded-sm">
                                <input type="radio"
                                    defaultChecked={addr.id === selectedAddress?.id}
                                    name="bordered-radio"
                                    className="w-4 h-4 text-primary bg-gray-100 border-gray-300 focus:ring-primary focus:ring-2"
                                    onClick={() => {
                                        setSelectingAddressId(addr.id);
                                    }}
                                />
                                <div className="mb-4 min-w-0 break-words p-4">
                                    <p className="font-semibold">{addr.receiverName} <span className="text-gray-500">({addr.phoneNumber})</span></p>
                                    <p>{addr.detail}</p>
                                    <p>{formatAddressLine(addr)}</p>
                                    {addr.primary && <span className="text-md text-red-500 text-sm font-semibold border-2 border-solid border-red-100">Chính</span>}
                                </div>
                            </div>
                        ))}
                        <div className="flex justify-between items-center mt-4">
                            <button className="text-gray-500 hover:underline" onClick={() => setIsOpenAddressList(false)}>Hủy</button>
                            <button
                                className="px-5 py-2 bg-primary text-white rounded-sm hover:bg-primary-dark cursor-pointer"
                                onClick={handleChangeAddress}
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ToastContainer position="bottom-right" />
        </div>
    );
}
