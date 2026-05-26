import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../util/AuthUtil";
import { BASE_API_URL } from "../../constants";
import { Link, useNavigate } from 'react-router-dom'
import { ToastContainer, toast } from "react-toastify";
import { FiShoppingCart, FiTrash2, FiMinus, FiPlus, FiArrowRight } from "react-icons/fi";
import { BsShopWindow } from "react-icons/bs";

const FALLBACK_PRODUCT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23f3f4f6'/%3E%3Cpath d='M20 52l14-16 10 11 6-7 10 12H20z' fill='%23d1d5db'/%3E%3Ccircle cx='54' cy='27' r='6' fill='%23d1d5db'/%3E%3C/svg%3E";
const SEED_IMAGE_PREFIX = "/seed/demo/";

const getLocalSeedImageUrl = (url) => {
    const marker = "/seed/demo/";
    const index = url?.indexOf(marker) ?? -1;
    return index >= 0 ? `${SEED_IMAGE_PREFIX}${url.slice(index + marker.length)}` : "";
};

export default function CartPage() {
    const [shopCarts, setShopCarts] = useState([]);
    const navigate = useNavigate()

    useEffect(() => {
        localStorage.removeItem('cart')
        const fetchCart = async () => {
            const res = await fetchWithAuth(`${BASE_API_URL}/v1/cart/get`, window.location, true);
            const data = await res.json();
            setShopCarts(await hydrateCartImages(data.shopCarts || []));
        };
        fetchCart();
    }, []);

    const getItemProductId = (item) => item.productId || item.product_id;
    const getItemId = (item) => item.itemId || item.item_id;

    const getProductImage = async (item) => {
        const productId = getItemProductId(item);
        if (!productId) return "";
        try {
            const res = await fetchWithAuth(`${BASE_API_URL}/v1/product/${productId}`, window.location, false);
            if (!res?.ok) return "";
            const product = await res.json();
            return product.mediaList?.[0]?.url || product.thumbnailUrl || product.thumbnail_url || "";
        } catch {
            return "";
        }
    };

    const hydrateCartImages = async (cartGroups) => {
        const imageCache = new Map();
        const hydratedGroups = [];
        for (const shopCart of cartGroups) {
            const items = [];
            for (const item of shopCart.items || []) {
                const productId = getItemProductId(item);
                let thumbnailUrl = item.thumbnailUrl || item.thumbnail_url || "";
                if (!thumbnailUrl && productId) {
                    if (!imageCache.has(productId)) {
                        imageCache.set(productId, await getProductImage(item));
                    }
                    thumbnailUrl = imageCache.get(productId);
                }
                items.push({ ...item, itemId: getItemId(item), productId, thumbnailUrl });
            }
            hydratedGroups.push({ ...shopCart, items });
        }
        return hydratedGroups;
    };

    const selectedTotal = shopCarts.reduce((total, shopCart) => {
        return total + shopCart.items.reduce((sum, item) => {
            return item.selected ? sum + item.price * item.quantity : sum;
        }, 0);
    }, 0);

    const selectedCount = shopCarts.reduce((total, shopCart) => {
        return total + shopCart.items.filter(item => item.selected).length;
    }, 0);

    const isAllSelected = shopCarts.length > 0 && shopCarts.every(sc => sc.items.every(i => i.selected));

    const updateSelectItems = (items, selected) => {
        items.map(item => { item.selected = selected })
        updateCart(items)
    }

    const updateSelectAll = (selected) => {
        const allItems = [];
        shopCarts.forEach(sc => {
            sc.items.forEach(item => {
                if (item.selected !== selected) {
                    item.selected = selected;
                    allItems.push(item);
                }
            })
        });
        if (allItems.length > 0) updateCart(allItems);
    }

    const updateItemQuantity = (item, newQuantity) => {
        if (newQuantity === item.quantity || newQuantity < 1) return
        item.quantity = newQuantity
        updateCart([item])
    }

    const deleteItem = async (item) => {
        try {
            fetchWithAuth(`${BASE_API_URL}/v1/cart/item/remove?itemId=${item.itemId}`, window.location, true, {
                method: "POST"
            })
                .then(res => {
                    if (!res.ok) toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
                    else {
                        res.json().then(async data => setShopCarts(await hydrateCartImages(data.shopCarts || [])))
                        toast.success("Đã xóa sản phẩm khỏi giỏ hàng");
                    }
                })
                .catch(() => toast.error("Có lỗi xảy ra, vui lòng thử lại sau!"))
        }
        catch (err) {
            toast.error("Có lỗi xảy ra, vui lòng thử lại sau!")
        }
    }

    const deleteSelectedItems = async () => {
        const itemIds = [];
        shopCarts.forEach(sc => {
            sc.items.forEach(item => {
                if (item.selected) itemIds.push(item.itemId);
            })
        });
        if (itemIds.length === 0) {
            toast.info("Vui lòng tích chọn sản phẩm để xóa");
            return;
        }

        try {
            const res = await fetchWithAuth(`${BASE_API_URL}/v1/cart/items/remove`, window.location, true, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemIds)
            });
            if (!res.ok) toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
            else {
                const data = await res.json();
                setShopCarts(await hydrateCartImages(data.shopCarts || []));
                toast.success("Đã xóa các sản phẩm được chọn");
            }
        } catch (err) {
            toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
        }
    }

    const updateCart = async (updateItems) => {
        const lst = updateItems.map(item => ({
            itemId: getItemId(item),
            selected: item.selected,
            quantity: item.quantity
        })).filter(item => item.itemId)
        try {
            const res = await fetchWithAuth(`${BASE_API_URL}/v1/cart/update`, null, true, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lst)
            })
            if (!res.ok) toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
            else {
                res.json()
                    .then(async data => {
                        if (data.warnMsg) toast.warn(data.warnMsg);
                        setShopCarts(await hydrateCartImages(data.cart?.shopCarts || []))
                    })
                    .catch(() => toast.error("Có lỗi xảy ra, vui lòng thử lại sau!"))
            }
        }
        catch (err) {
            toast.error("Có lỗi xảy ra, vui lòng thử lại sau!")
        }
    }

    const formatPrice = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    if (shopCarts.length === 0) {
        return (
            <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-center px-3 py-16 sm:px-4 sm:py-20">
                <div className="w-full max-w-md rounded-sm border border-gray-100 bg-white p-6 text-center shadow-[0_1px_1px_rgba(0,0,0,0.05)] sm:p-12">
                    <img src="https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/cart/9bdd8040b334d31946f4.png" alt="Empty Cart" className="w-32 h-32 mx-auto mb-6 object-contain opacity-80" />
                    <h2 className="text-[18px] font-medium text-gray-800 mb-2">Giỏ hàng của bạn còn trống</h2>
                    <p className="text-[14px] text-gray-500 mb-6">Mua sắm ngay bây giờ để nhận các ưu đãi lớn!</p>
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center bg-primary text-white mt-2 px-10 py-2.5 rounded-sm font-medium text-[15px] hover:bg-opacity-90 transition-opacity uppercase tracking-wide cursor-pointer"
                    >
                        Mua Ngay
                    </Link>
                </div>
                <ToastContainer position="top-center" theme="colored" autoClose={1500} hideProgressBar={true} />
            </div>
        );
    }

    return (
        <div className="relative mx-auto w-full max-w-[1400px] overflow-x-hidden px-2 py-6 md:px-4 md:py-8">
            <h1 className="text-[20px] font-medium text-primary mb-6 flex items-center gap-2 uppercase tracking-wide">
                <FiShoppingCart size={24} />
                Giỏ hàng
            </h1>

            <div className="w-full flex flex-col gap-4">

                {/* Desktop Header Row */}
                <div className="hidden md:flex items-center px-4 md:px-6 py-4 bg-white rounded-sm shadow-[0_1px_1px_rgba(0,0,0,0.05)] text-gray-500 text-[14px]">
                    <div className="w-[45%] flex items-center gap-4">
                        <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={(e) => updateSelectAll(e.target.checked)}
                            className="w-4 h-4 accent-primary cursor-pointer shrink-0"
                        />
                        <span className="capitalize">Sản Phẩm</span>
                    </div>
                    <div className="w-[15%] text-center capitalize">Đơn Giá</div>
                    <div className="w-[15%] text-center capitalize">Số Lượng</div>
                    <div className="w-[15%] text-center capitalize">Số Tiền</div>
                    <div className="w-[10%] text-center capitalize">Thao Tác</div>
                </div>

                {/* Items Container */}
                <div className="flex flex-col gap-4 pb-48">
                    {shopCarts.map((shopCart) => (
                        <div key={shopCart.shop.id} className="bg-white rounded-sm shadow-[0_1px_1px_rgba(0,0,0,0.05)] overflow-hidden">

                            {/* Shop header */}
                            <div className="flex min-w-0 items-center gap-3 border-b border-gray-100 px-4 py-4 md:px-6">
                                <input
                                    type="checkbox"
                                    checked={shopCart.items.length > 0 && shopCart.items.every(item => item.selected)}
                                    className="w-4 h-4 accent-primary cursor-pointer shrink-0"
                                    onChange={(e) => updateSelectItems(shopCart.items, e.target.checked)}
                                />
                                <BsShopWindow size={16} className="text-gray-600" />
                                <Link to={`/shop/${shopCart.shop.username}`} className="min-w-0 truncate text-[14px] font-medium text-gray-800 transition-colors hover:text-primary">
                                    {shopCart.shop.name}
                                </Link>
                            </div>

                            {/* Items */}
                            <div className="divide-y divide-gray-100">
                                {shopCart.items.map((item) => (
                                    <div key={item.itemId} className="flex flex-col md:flex-row md:items-center px-4 md:px-6 py-5 transition-colors relative group hover:bg-gray-50/20">

                                        {/* Product Info Col */}
                                        <div className="mb-4 flex w-full min-w-0 items-start gap-3 md:mb-0 md:w-[45%] md:gap-4">
                                            <div className="pt-6 md:pt-6">
                                                <input
                                                    type="checkbox"
                                                    disabled={item.quantity > item.stock}
                                                    checked={item.selected}
                                                    className="w-4 h-4 accent-primary cursor-pointer shrink-0"
                                                    onChange={(e) => updateSelectItems([item], e.target.checked)}
                                                />
                                            </div>
                                            <Link to={`/product/${encodeURIComponent(item.name.replace(/\s+/g, "-"))}.${item.productId}`} className="shrink-0 border border-gray-100 p-0.5 rounded-sm bg-white">
                                                <img
                                                    src={item.thumbnailUrl || item.thumbnail_url || FALLBACK_PRODUCT_IMAGE}
                                                    alt={item.name}
                                                    className="w-[80px] h-[80px] object-cover"
                                                    onError={(e) => {
                                                        const localSeedUrl = getLocalSeedImageUrl(e.currentTarget.src);
                                                        if (localSeedUrl && !e.currentTarget.dataset.triedLocalSeed) {
                                                            e.currentTarget.dataset.triedLocalSeed = "true";
                                                            e.currentTarget.src = localSeedUrl;
                                                        } else {
                                                            e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                                                        }
                                                    }}
                                                />
                                            </Link>
                                            <div className="flex min-h-[80px] min-w-0 flex-1 flex-col justify-center md:pr-4">
                                                <Link
                                                    to={`/product/${encodeURIComponent(item.name.replace(/\s+/g, "-"))}.${item.productId}`}
                                                    className="text-[14px] text-gray-800 hover:text-primary transition-colors line-clamp-2 leading-relaxed"
                                                >
                                                    {item.name}
                                                </Link>
                                                {item.attributes && item.attributes.length > 0 && (
                                                    <div className="text-[14px] text-gray-500 mt-1.5 flex items-center gap-1">
                                                        Phân loại: {item.attributes.map(a => a.value).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Desktop Price */}
                                        <div className="hidden md:flex w-[15%] justify-center font-medium text-gray-800 text-[14px]">
                                            {formatPrice(item.price)}
                                        </div>

                                        {/* Mobile Price & Qty Row */}
                                        <div className="mb-3 flex w-full items-center justify-between gap-3 pl-7 md:hidden">
                                            <div className="font-medium text-primary text-[14px]">{formatPrice(item.price)}</div>
                                            {/* Quantity Component Mobile */}
                                            <div className="flex items-center border border-gray-300 rounded-sm bg-white">
                                                <button
                                                    className="w-7 h-7 flex items-center justify-center border-r border-gray-300 text-gray-500 hover:bg-gray-50 cursor-pointer"
                                                    onClick={() => updateItemQuantity(item, item.quantity - 1)}
                                                >
                                                    <FiMinus size={12} />
                                                </button>
                                                <input
                                                    type="number"
                                                    className="w-10 text-center text-[13px] outline-none bg-transparent"
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        if (!v) return;
                                                        updateItemQuantity(item, Number(v));
                                                    }}
                                                    value={item.quantity}
                                                    onBlur={(e) => {
                                                        if (!e.target.value || Number(e.target.value) < 1) updateItemQuantity(item, 1);
                                                    }}
                                                />
                                                <button
                                                    className="w-7 h-7 flex items-center justify-center border-l border-gray-300 text-gray-500 hover:bg-gray-50 cursor-pointer"
                                                    onClick={() => updateItemQuantity(item, item.quantity + 1)}
                                                >
                                                    <FiPlus size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Desktop Quantity Base */}
                                        <div className="hidden md:flex w-[15%] justify-center">
                                            <div className="flex items-center border border-gray-300 rounded-sm">
                                                <button
                                                    className="w-8 h-8 flex items-center justify-center border-r border-gray-300 text-gray-500 hover:bg-gray-50 cursor-pointer"
                                                    onClick={() => updateItemQuantity(item, item.quantity - 1)}
                                                >
                                                    <FiMinus size={12} />
                                                </button>
                                                <input
                                                    type="number"
                                                    className="w-12 text-center text-[14px] outline-none"
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        if (!v) return;
                                                        updateItemQuantity(item, Number(v));
                                                    }}
                                                    value={item.quantity}
                                                    onBlur={(e) => {
                                                        if (!e.target.value || Number(e.target.value) < 1) updateItemQuantity(item, 1);
                                                    }}
                                                />
                                                <button
                                                    className="w-8 h-8 flex items-center justify-center border-l border-gray-300 text-gray-500 hover:bg-gray-50 cursor-pointer"
                                                    onClick={() => updateItemQuantity(item, item.quantity + 1)}
                                                >
                                                    <FiPlus size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Desktop Total Price */}
                                        <div className="hidden md:flex w-[15%] justify-center font-medium text-primary text-[14px]">
                                            {formatPrice(item.price * item.quantity)}
                                        </div>

                                        {/* Mobile Delete & Errors */}
                                        <div className="flex items-center justify-between gap-3 pl-7 md:hidden">
                                            <div className="flex flex-col gap-1">
                                                {item.stock <= 10 && (
                                                    <p className="text-[11px] text-orange-500">⚠ Còn lại: {item.stock}</p>
                                                )}
                                                {item.quantity > item.stock && (
                                                    <p className="text-[11px] text-red-500">⚠ Vượt số lượng ({item.stock})</p>
                                                )}
                                            </div>
                                            <button
                                                className="text-[13px] text-gray-500 hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                                                onClick={() => deleteItem(item)}
                                            >
                                                <span>Xóa</span>
                                            </button>
                                        </div>

                                        {/* Desktop Actions */}
                                        <div className="hidden md:flex w-[10%] flex-col items-center justify-center gap-1">
                                            <button
                                                className="text-[14px] text-gray-800 hover:text-primary transition-colors cursor-pointer"
                                                onClick={() => deleteItem(item)}
                                            >
                                                Xóa
                                            </button>
                                            <div className="flex flex-col items-center justify-center mt-2">
                                                {item.stock <= 10 && (
                                                    <p className="text-[11px] text-orange-500 text-center leading-tight">Còn lại {item.stock}</p>
                                                )}
                                                {item.quantity > item.stock && (
                                                    <p className="text-[11px] text-red-500 text-center leading-tight mt-1">Hết hàng</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* Sticky Bottom Summary Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 mt-20 max-w-full overflow-x-hidden border-t border-gray-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                <div className="mx-auto flex w-full max-w-[1400px] flex-col items-stretch justify-between md:flex-row md:items-center">

                    {/* Left Actions */}
                    <div className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-3 md:w-auto md:justify-start md:gap-8 md:border-b-0 md:px-8 md:py-0">
                        <label className="flex items-center gap-3 cursor-pointer text-[14px] md:text-[16px] text-gray-700">
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={(e) => updateSelectAll(e.target.checked)}
                                className="w-5 h-5 accent-primary cursor-pointer shrink-0"
                            />
                            Chọn Tất Cả ({shopCarts.reduce((acc, sc) => acc + sc.items.length, 0)})
                        </label>
                        <button
                            className="text-[14px] md:text-[16px] text-gray-600 hover:text-primary cursor-pointer transition-colors"
                            onClick={deleteSelectedItems}
                        >
                            Xóa
                        </button>
                    </div>

                    {/* Right Summary */}
                    <div className="flex w-full items-stretch justify-between md:w-auto md:items-center md:justify-end">
                        <div className="flex flex-1 flex-col items-end justify-center px-3 py-2 md:px-6 md:py-4">
                            <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                                <span className="text-right text-[13px] text-gray-800 md:text-[16px]">Tổng thanh toán ({selectedCount} Sản phẩm):</span>
                                <span className="text-[18px] font-medium leading-none text-primary md:text-[24px]">{formatPrice(selectedTotal)}</span>
                            </div>
                            <span className="text-[12px] md:text-[14px] text-gray-500 mt-1">Tiết kiệm 0₫</span>
                        </div>
                        <button
                            disabled={selectedCount === 0}
                            className={`flex h-auto min-h-[64px] shrink-0 items-center justify-center px-5 text-[14px] font-medium uppercase transition-colors md:h-[80px] md:px-14 md:text-[16px] ${selectedCount > 0
                                ? "bg-primary text-white hover:bg-opacity-90 cursor-pointer"
                                : "bg-gray-300 text-white cursor-not-allowed"
                                }`}
                            onClick={() => navigate('/checkout')}
                        >
                            Mua Hàng
                        </button>
                    </div>
                </div>
            </div>

            <ToastContainer position="top-center" theme="colored" autoClose={1500} hideProgressBar={true} />
        </div>
    );
}
