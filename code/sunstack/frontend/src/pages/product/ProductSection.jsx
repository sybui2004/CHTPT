import { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import ProductMedia from './ProductMedia'
import { BASE_API_URL } from '../../constants/index'
import { fetchWithAuth } from '../../util/AuthUtil'
import { toast, ToastContainer } from 'react-toastify';
import { FaStar, FaRegStar, FaStarHalfAlt } from "react-icons/fa";
import { FiShoppingCart, FiAlertCircle } from "react-icons/fi";

export default function ProductSection({ product, isPreview }) {

    const navigate = useNavigate()

    const minPrice = product.price
    const [variationDisplay, setVariationDisplay] = useState([])
    const [selectedAttributes, setSelectedAttributes] = useState([])
    const [selectedQuantity, setSelectedQuantity] = useState(1)
    const [productInfo, setProductInfo] = useState({
        price: product.price,
        stock: product.quantity
    })
    const [errorMessage, setErrorMessage] = useState("");
    const [showMobileOptions, setShowMobileOptions] = useState(false);
    const [modalAction, setModalAction] = useState(""); // 'cart' or 'buy'

    const handleChangeProductInfo = (type, value) => {
        setProductInfo(prev => ({ ...prev, [type]: value }));
    }

    useEffect(() => {
        setVariationDisplay(product.variationDisplayIndicators)
    }, [product])

    const handleClickAttribute = async (name, value) => {
        setSelectedQuantity(1)
        setSelectedAttributes((prev) => {
            const newAttributes = [...prev];
            const index = newAttributes.findIndex((attr) => attr.name === name);

            if (index !== -1 && newAttributes[index].value === value) {
                newAttributes.splice(index, 1);
            } else {
                if (index !== -1) {
                    newAttributes[index].value = value;
                } else {
                    newAttributes.push({ name, value });
                }
            }

            fetchNewVariationDisplay(newAttributes);
            return newAttributes;
        });
    };

    const fetchNewVariationDisplay = async (attributes) => {
        try {
            const response = await fetch(`${BASE_API_URL}/v1/product/select_variation`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: product.id,
                    quantity: selectedQuantity,
                    attributes
                }),
            });
            const data = await response.json();
            if (data.price !== -1) handleChangeProductInfo("price", data.price)
            else handleChangeProductInfo("price", minPrice)
            handleChangeProductInfo("stock", data.quantity)
            setVariationDisplay(data.variationDisplayIndicators);
        } catch (error) {
            console.error("Error fetching variations:", error);
        }
    };

    const isAllAttributesSelected =
        selectedAttributes.length === product.variationDisplayIndicators.length;

    const sameAttributes = (a = [], b = []) => {
        if (a.length !== b.length) return false;
        return a.every(attr => b.some(other => other.name === attr.name && other.value === attr.value));
    };

    const formatSkuAttributes = (attributes = []) =>
        attributes.map(attr => `${attr.name}: ${attr.value}`).join(" · ");

    const selectedSku = isAllAttributesSelected
        ? product.skuList?.find(sku => sameAttributes(sku.attributes || [], selectedAttributes))
        : null;

    const getResponseMessage = (data) => data?.message || data?.detail || "Có lỗi xảy ra, thử lại sau!";

    const handleQuantityChange = (val) => {
        if (!isAllAttributesSelected) return;

        let cleanVal = String(val).replace(/\D/g, "");

        if (cleanVal === "") {
            setSelectedQuantity("");
            return;
        }

        let newQuantity = Number(cleanVal);

        if (newQuantity === 0) {
            setSelectedQuantity("");
            return;
        }

        if (newQuantity > productInfo.stock) newQuantity = productInfo.stock;
        setSelectedQuantity(newQuantity);
    };

    const handleBlurQuantity = () => {
        if (selectedQuantity === "" || selectedQuantity < 1) {
            setSelectedQuantity(1);
        }
    };

    const handleAddToCart = () => {
        if (!isAllAttributesSelected) {
            setErrorMessage("Vui lòng chọn đầy đủ thuộc tính!");
            return;
        }
        else setErrorMessage("")

        const itemDTO = {
            productId: product.id,
            quantity: selectedQuantity,
            attributes: selectedAttributes
        }

        fetchWithAuth(`${BASE_API_URL}/v1/cart/add-to-cart`, window.location, true, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemDTO)
        })
            .then(async res => {
                if (!res.ok) {
                    res.json()
                        .catch(() => toast.error("Có lỗi xảy ra, thử lại sau!"))
                        .then(data => toast.error(getResponseMessage(data)))
                }
                else {
                    toast.success("Thêm vào giỏ hàng thành công!")
                    localStorage.removeItem('cart')
                    window.dispatchEvent(new Event("cartChange"));
                    setShowMobileOptions(false);
                }
            })
    };

    const handleBuyNow = async () => {
        if (!isAllAttributesSelected) {
            setErrorMessage("Vui lòng chọn đầy đủ thuộc tính!");
            return;
        }
        setErrorMessage("");

        const itemDTO = {
            productId: product.id,
            quantity: selectedQuantity,
            attributes: selectedAttributes
        };

        try {
            const addRes = await fetchWithAuth(`${BASE_API_URL}/v1/cart/add-to-cart`, window.location, true, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(itemDTO)
            });

            if (!addRes.ok) {
                const data = await addRes.json().catch(() => null);
                toast.error(getResponseMessage(data));
                return;
            }

            const cartRes = await fetchWithAuth(`${BASE_API_URL}/v1/cart/get`, window.location, true);
            if (!cartRes.ok) {
                toast.error("Có lỗi xảy ra, thử lại sau!");
                return;
            }

            const cart = await cartRes.json();
            const allItems = cart.shopCarts.flatMap(shopCart => shopCart.items);
            const buyItem = allItems.find(item =>
                item.productId === product.id && sameAttributes(item.attributes || [], selectedAttributes)
            );

            if (!buyItem) {
                toast.error("Không tìm thấy sản phẩm vừa chọn trong giỏ hàng!");
                return;
            }

            const updateItems = allItems.map(item => ({
                itemId: item.itemId,
                selected: item.itemId === buyItem.itemId,
                quantity: item.itemId === buyItem.itemId ? selectedQuantity : item.quantity
            }));

            const updateRes = await fetchWithAuth(`${BASE_API_URL}/v1/cart/update`, null, true, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateItems)
            });

            if (!updateRes.ok) {
                toast.error("Có lỗi xảy ra, thử lại sau!");
                return;
            }

            localStorage.removeItem("cart");
            window.dispatchEvent(new Event("cartChange"));
            navigate("/checkout");
        } catch (err) {
            toast.error("Có lỗi xảy ra, thử lại sau!");
        }
    };

    const formatPrice = (p) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

    const VariationsBlock = (
        <div className="mb-8 flex flex-col gap-5 px-3 text-[14px] text-gray-600 sm:px-4 md:gap-6 lg:text-[15px] xl:text-[16px]">
            {variationDisplay.map((attr) => (
                <div key={attr.name} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <p className="shrink-0 text-gray-500 capitalize sm:mt-2 sm:w-24 md:w-28">{attr.name}</p>
                    <div className="flex gap-2.5 flex-wrap flex-1">
                        {attr.variationOptions.map((option) => {
                            const isSelected = selectedAttributes.some((a) => a.name === attr.name && a.value === option.value);
                            return (
                                <button
                                    key={option.value}
                                    disabled={!option.available}
                                    className={`relative flex min-h-10 min-w-0 items-center justify-center rounded-sm border bg-white px-3 py-2 text-center outline-none transition-all sm:min-w-[80px] sm:px-4
                                        ${!option.available
                                            ? "text-gray-300 border-gray-200 cursor-not-allowed border-dashed"
                                            : isSelected
                                                ? "border-primary text-primary overflow-hidden"
                                                : "border-gray-200 text-gray-800 hover:border-primary hover:text-primary cursor-pointer"
                                        }`}
                                    onClick={() => option.available && handleClickAttribute(attr.name, option.value)}
                                >
                                    {option.value}
                                    {isSelected && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-primary flex items-end justify-end"><span className="text-white text-[8px] leading-[10px] mr-px pb-px">✓</span></div>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="shrink-0 text-gray-500 capitalize sm:w-24 md:w-28">Số Lượng</p>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <div className="flex items-center border border-gray-300 rounded-sm">
                        <button
                            className="w-8 h-8 flex items-center justify-center border-r border-gray-300 text-gray-500 hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-300 transition-colors cursor-pointer"
                            onClick={() => handleQuantityChange(Number(selectedQuantity) - 1)}
                            disabled={!isAllAttributesSelected || selectedQuantity <= 1}
                        >
                            −
                        </button>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={selectedQuantity}
                            onChange={(e) => handleQuantityChange(e.target.value)}
                            onBlur={handleBlurQuantity}
                            className="w-12 h-8 text-center text-[16px] text-gray-700 outline-none"
                            disabled={!isAllAttributesSelected}
                        />
                        <button
                            className="w-8 h-8 flex items-center justify-center border-l border-gray-300 text-gray-500 hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-300 transition-colors cursor-pointer"
                            onClick={() => handleQuantityChange(Number(selectedQuantity) + 1)}
                            disabled={!isAllAttributesSelected || selectedQuantity >= productInfo.stock}
                        >
                            +
                        </button>
                    </div>
                    <span className="text-gray-500 text-[14px]">
                        {productInfo.stock > 0 ? `${productInfo.stock} sản phẩm có sẵn` : <span className="text-primary font-medium">Hết hàng</span>}
                    </span>
                </div>
            </div>

            {product.skuList?.length > 0 && (
                <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start">
                    <p className="shrink-0 text-gray-500 capitalize sm:w-24 md:w-28">SKU</p>
                    <div className="min-w-0 flex-1">
                        {selectedSku ? (
                            <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-sm border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-gray-700">
                                <span className="font-mono font-semibold text-primary">{selectedSku.sku}</span>
                                <span className="text-gray-500">{formatSkuAttributes(selectedSku.attributes)}</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-500">Chọn đầy đủ phân loại để xem đúng mã SKU.</p>
                                <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
                                    {product.skuList.map((sku) => (
                                        <div key={sku.sku} className="rounded-sm border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600">
                                            <span className="font-mono font-semibold text-gray-800">{sku.sku}</span>
                                            <span className="ml-2 text-gray-400">{formatSkuAttributes(sku.attributes)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Error Message */}
            {errorMessage && (
                <div className="flex items-center gap-2 text-primary text-[14px] mt-2 bg-primary/10 px-4 py-2 border border-primary/20 rounded-sm w-fit">
                    <FiAlertCircle size={16} />
                    {errorMessage}
                </div>
            )}
        </div>
    );

    return (
        <div className="w-full text-left">
            <div className="bg-white rounded-sm shadow-[0_1px_1px_rgba(0,0,0,0.05)] md:flex p-3 sm:p-5 overflow-hidden gap-6">

                {/* Media */}
                <div className="md:w-5/12 shrink-0 max-w-full">
                    <ProductMedia mediaList={product.mediaList} />
                </div>

                {/* Info Panel */}
                <div className="md:w-7/12 flex flex-col pt-3 sm:pt-0">
                    <h1 className="mb-3 text-[20px] font-medium leading-snug text-gray-800 lg:text-[24px] xl:text-[26px]">
                        <span className="bg-primary text-white text-[12px] px-1 py-0.5 rounded-sm mr-2 font-medium">Yêu thích</span>
                        {product.name}
                    </h1>

                    {/* Rating + stats */}
                    <div className="mb-4 mt-1 flex flex-wrap items-center gap-y-2 overflow-hidden text-[13px] sm:text-[15px] lg:text-[16px]">
                        <div className="flex items-center gap-1 pr-4 border-r border-gray-300">
                            <span className="text-primary font-medium border-b border-primary">{product.averageRating.toFixed(1)}</span>
                            <div className="flex text-primary mt-0.5">
                                {[1, 2, 3, 4, 5].map((index) => {
                                    if (index <= product.averageRating) return <FaStar key={index} size={14} />;
                                    if (index - 0.5 <= product.averageRating) return <FaStarHalfAlt key={index} size={14} />;
                                    return <FaRegStar key={index} size={14} />;
                                })}
                            </div>
                        </div>
                        <div className="flex items-center gap-1 px-4 border-r border-gray-300">
                            <span className="font-medium text-gray-800 border-b border-gray-800">{product.totalReviews}</span>
                            <span className="text-gray-500">Đánh Giá</span>
                        </div>
                        <div className="flex items-center gap-1 pl-4">
                            <span className="text-gray-800">{product.soldCount}</span>
                            <span className="text-gray-500">Đã bán</span>
                        </div>
                    </div>


                    {/* Price */}
                    <div className="bg-[#fafafa] px-5 py-4 mb-6 flex flex-col justify-center">
                        <div className="flex items-center">
                            <p className="break-words text-[24px] font-medium text-primary sm:text-[30px]">{formatPrice(productInfo.price)}</p>
                        </div>
                    </div>

                    {/* Variations */}
                    <div className="hidden md:block">
                        {VariationsBlock}
                    </div>

                    {/* CTA buttons (Desktop only) */}
                    {!isPreview && (
                        <div className="mt-2 hidden flex-wrap gap-3 px-4 pb-4 md:flex">
                            <button
                                className='flex h-12 min-w-0 items-center justify-center gap-2 rounded-sm border border-primary bg-primary/10 px-5 text-[15px] text-primary transition-colors hover:bg-primary/5 lg:min-w-[200px] lg:text-[16px] cursor-pointer'
                                onClick={handleAddToCart}
                            >
                                <FiShoppingCart size={20} />
                                Thêm Vào Giỏ Hàng
                            </button>

                            <button
                                className='h-12 min-w-0 rounded-sm border border-primary bg-primary px-5 text-[15px] text-white transition-opacity hover:bg-opacity-90 lg:min-w-[140px] lg:text-[16px] cursor-pointer'
                                onClick={handleBuyNow}
                            >
                                Mua Ngay
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Fixed CTA */}
            {!isPreview && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex bg-white border-t border-gray-200 h-[56px] shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                    <button
                        className='flex-1 flex flex-col items-center justify-center gap-0.5 bg-[#00bfa5] text-white rounded-none border-none'
                        onClick={() => { setModalAction('cart'); setShowMobileOptions(true); }}
                    >
                        <FiShoppingCart size={18} />
                        <span className="text-[12px]">Thêm vào giỏ</span>
                    </button>

                    <button
                        className='flex-1 flex flex-col items-center justify-center gap-0.5 bg-primary text-white rounded-none border-none font-medium'
                        onClick={() => { setModalAction('buy'); setShowMobileOptions(true); }}
                    >
                        <span className="text-[14px]">Mua ngay</span>
                    </button>
                </div>
            )}

            {/* Mobile Options Modal View */}
            {showMobileOptions && !isPreview && (
                <div className="md:hidden fixed inset-0 z-[100] flex flex-col justify-end">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={() => setShowMobileOptions(false)}></div>

                    {/* Drawer Content */}
                    <div className="relative bg-white w-full rounded-t-sm flex flex-col max-h-[85vh] animate-slide-up pb-5">

                        {/* Header: Product info */}
                        <div className="p-4 border-b border-gray-100 flex gap-4 pr-10">
                            <img src={product.thumbnailUrl} className="w-24 h-24 object-cover border border-gray-100 bg-white rounded-sm -mt-10 shadow-sm" alt="product thumbnail" />
                            <div className="flex flex-col justify-end pb-1">
                                <p className="text-primary text-[18px] font-medium">{formatPrice(productInfo.price)}</p>
                                <p className="text-gray-500 text-[13px] mt-1">Kho: {productInfo.stock}</p>
                            </div>
                            <button className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 cursor-pointer" onClick={() => setShowMobileOptions(false)}>
                                ✕
                            </button>
                        </div>

                        {/* Options Body */}
                        <div className="overflow-y-auto flex-1 py-4">
                            {VariationsBlock}
                        </div>

                        {/* Bottom Confirm Button */}
                        <div className="px-4 pt-3 border-t border-gray-100 bg-white">
                            <button
                                className={`w-full h-11 text-white rounded-sm font-medium text-[14px] cursor-pointer ${modalAction === 'cart' ? 'bg-[#00bfa5]' : 'bg-primary'}`}
                                onClick={() => {
                                    if (modalAction === 'cart') handleAddToCart();
                                    else handleBuyNow();
                                }}
                            >
                                {modalAction === 'cart' ? 'Thêm Vào Giỏ Hàng' : 'Mua Ngay'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ToastContainer position="top-center" theme="colored" autoClose={1500} hideProgressBar={true} />
        </div>
    )
}
