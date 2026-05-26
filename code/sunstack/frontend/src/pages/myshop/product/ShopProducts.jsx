import { useLocation, Link, useNavigate } from "react-router-dom";
import React from "react";
import { useState, useEffect } from "react";
import { fetchWithAuth } from '../../../util/AuthUtil'
import { formatDate } from '../../../util/DateUtil'
import { BASE_API_URL } from "../../../constants";
import Pagination from "../../common/Pagination";
import { ToastContainer, toast } from "react-toastify";
import { LuPackageX } from "react-icons/lu";
import TableLoading from '../../common/TableLoading'
import Modal from '../../common/Modal'
import { FiPlus, FiEdit2, FiEye, FiEyeOff, FiTrash2, FiChevronDown, FiChevronUp, FiPackage, FiSearch } from "react-icons/fi";

const tabs = [
    "Đang kích hoạt",
    "Vi phạm",
    "Chờ kiểm duyệt",
    "Chưa được đăng",
    "Hết hàng"
];

export default function ShopProducts(){

    const navigate = useNavigate()
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const currentType = parseInt(searchParams.get("type")) || 0;

    const [changeVisibleProductId, setChangeVisibleProductId] = useState(null)
    const [deleteProductId, setDeleteProductId] = useState(null)
    const [openOtherActionDropdowm, setOpenOtherActionDropdown] = useState({})
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)
    const [products, setProducts] = useState([]);
    const [totalPages, setTotalPages] = useState(1)
    const [totalProducts, setTotalProducts] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [isShowingSKUList, setIsShowingSKUList] = useState({})

    const [keyword, setKeyword] = useState("")
    const [sortType, setSortType] = useState(0)

    const [searchInputKeyword, setSearchInputKeyword] = useState("")
    const formatCurrency = (value) => Number(value > 0 ? value : 0).toLocaleString("vi-VN")

    const loadProduct = async () => {
        setIsLoading(true)
        try {
            const res = await fetchWithAuth(`${BASE_API_URL}/v1/shop/product/list?type=${currentType}&sortType=${sortType}&keyword=${keyword}&page=${page - 1}&limit=${limit}`)
            if (!res || !res.ok) {
                setProducts([])
                setTotalProducts(0)
                setTotalPages(0)
                return
            }

            const data = await res.json()
            if(data.message){
                toast.error(data.message)
                setProducts([])
                setTotalProducts(0)
                setTotalPages(0)
                return
            }

            setTotalPages(Number.isFinite(Number(data.totalPages)) ? Number(data.totalPages) : 0)
            setTotalProducts(Number.isFinite(Number(data.totalElements)) ? Number(data.totalElements) : 0)
            setProducts(Array.isArray(data.content) ? data.content : [])
        }
        catch (err) {
            toast.error('Có lỗi xảy ra, vui lòng thử lại sau!')
            setProducts([])
            setTotalProducts(0)
            setTotalPages(0)
        }
        finally {
            setIsLoading(false)
        }
    }

    const toggleShowSKUList = (productId) => {
        setIsShowingSKUList((prev) => ({
        ...prev,
        [productId]: !prev[productId]
        }))
    }

    const changeProductVisible = (productId) => {
        fetchWithAuth(`${BASE_API_URL}/v1/shop/product/change_visible?productId=${productId}`, window.location, true, {
            method: "POST"
        })
            .then(res => {
                if(!res.ok){
                    toast.error(res.message)
                    return
                }
                const updateProd = [...products]
                updateProd.map(prod => {
                    if(prod.id === productId){
                        prod.visible = !prod.visible
                    }
                    return prod
                })
                setProducts(updateProd)
            })
            .catch(() => toast.error('Có lỗi xảy ra, vui lòng thử lại sau!'))
    }

    const handleDeleteProduct = (productId) => {
        fetchWithAuth(`${BASE_API_URL}/v1/shop/product/delete/${productId}`, window.location, true, {
            method: "POST"
        })
            .then(res => {
                if(!res.ok){
                    toast.error(res.message)
                    return
                }
                toast.success("Xóa sản phẩm thành công")
                setProducts(prev => prev.filter(prod => prod.id !== productId))
            })
            .catch(() => toast.error("Có lỗi xảy ra, vui lòng thử lại sau!"))
    }

    useEffect(() => {
        loadProduct()
    }, [currentType, page, limit, sortType, keyword])

    const SortIcon = ({ asc, desc }) => (
        <div className="flex flex-col leading-none ml-1">
            <span className={sortType === asc ? "text-orange-500" : "text-gray-300"} style={{fontSize: 8}}>▲</span>
            <span className={sortType === desc ? "text-orange-500" : "text-gray-300"} style={{fontSize: 8}}>▼</span>
        </div>
    )

    return (
        <div className="w-full flex flex-col gap-4">
            {/* Page header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FiPackage className="text-orange-500" size={20} />
                        Quản lý sản phẩm
                    </h1>
                    <p className="text-sm text-gray-400 mt-0.5">{totalProducts} sản phẩm</p>
                </div>
                <Link
                    to="../add-product"
                    className="ml-auto inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 sm:px-5"
                >
                    <FiPlus size={16} />
                    Thêm sản phẩm
                </Link>
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
                            onClick={() => navigate(`/myshop/product-list?type=${index}`)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter bar */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    {/* Keyword search */}
                    <div className="relative min-w-0 sm:col-span-1">
                        <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={searchInputKeyword}
                            type="text"
                            placeholder="Tìm tên sản phẩm hoặc SKU..."
                            onChange={e => setSearchInputKeyword(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && setKeyword(searchInputKeyword)}
                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 transition-colors placeholder-gray-400"
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2 sm:contents">
                        <button
                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 cursor-pointer"
                            onClick={() => { setSearchInputKeyword(""); setKeyword(""); }}
                        >
                            Đặt lại
                        </button>
                        <button
                            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 cursor-pointer"
                            onClick={() => { setKeyword(searchInputKeyword); }}
                        >
                            Áp dụng
                        </button>
                    </div>
                </div>
            </div>

            {/* Products table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/80">
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[40px]">#</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[280px]">Sản phẩm</th>
                                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[120px]">
                                    <button className="flex items-center gap-0.5 mx-auto cursor-pointer hover:text-gray-700" onClick={() => setSortType(sortType === 5 ? 4 : 5)}>
                                        Giá <SortIcon asc={5} desc={4} />
                                    </button>
                                </th>
                                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[100px]">
                                    <button className="flex items-center gap-0.5 mx-auto cursor-pointer hover:text-gray-700" onClick={() => setSortType(sortType === 3 ? 2 : 3)}>
                                        Kho <SortIcon asc={3} desc={2} />
                                    </button>
                                </th>
                                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[120px]">
                                    <button className="flex items-center gap-0.5 mx-auto cursor-pointer hover:text-gray-700" onClick={() => setSortType(sortType === 1 ? 0 : 1)}>
                                        Doanh số <SortIcon asc={1} desc={0} />
                                    </button>
                                </th>
                                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[90px]">
                                    <button className="flex items-center gap-0.5 mx-auto cursor-pointer hover:text-gray-700" onClick={() => setSortType(sortType === 9 ? 8 : 9)}>
                                        Bán <SortIcon asc={9} desc={8} />
                                    </button>
                                </th>
                                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[110px]">
                                    <button className="flex items-center gap-0.5 mx-auto cursor-pointer hover:text-gray-700" onClick={() => setSortType(sortType === 7 ? 6 : 7)}>
                                        Ngày tạo <SortIcon asc={7} desc={6} />
                                    </button>
                                </th>
                                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[120px]">Thao tác</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-50">
                        {products.map((product, index) => (
                            <React.Fragment key={product.id}>
                            <tr className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-3 py-4 text-xs text-gray-400 text-center align-top">{(page - 1) * limit + index + 1}</td>
                                <td className="px-3 py-4 align-top">
                                    <div className="flex items-start gap-3">
                                        <img
                                            src={product.thumbnailUrl}
                                            alt={product.name}
                                            className="w-14 h-14 object-cover rounded-lg border border-gray-100 shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">{product.name}</p>
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                {!product.visible && (
                                                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Đã ẩn</span>
                                                )}
                                                {product.restricted && (
                                                    <span className="text-xs bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full">
                                                        Đình chỉ: {product.restrictReason}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-4 text-center align-top text-sm font-semibold text-orange-500">
                                    {formatCurrency(product.price)}₫
                                </td>
                                <td className="px-3 py-4 text-center align-top text-sm text-gray-600">{product.quantity}</td>
                                <td className="px-3 py-4 text-center align-top text-sm text-gray-600">
                                    {formatCurrency(product.revenue)}₫
                                </td>
                                <td className="px-3 py-4 text-center align-top text-sm text-gray-600">{product.sold}</td>
                                <td className="px-3 py-4 text-center align-top text-xs text-gray-500">{formatDate(product.createdAt)}</td>
                                <td className="px-3 py-4 text-center align-top">
                                    <div className="flex flex-col items-center gap-1.5">
                                        <Link
                                            to={`../product/${product.id}`}
                                            className="w-full flex items-center justify-center gap-1 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 px-2.5 py-1.5 rounded-lg transition-colors"
                                        >
                                            <FiEdit2 size={11} /> Sửa
                                        </Link>
                                        {(product.skuList || []).length > 0 && (
                                            <button
                                                className="w-full flex items-center justify-center gap-1 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                onClick={() => toggleShowSKUList(product.id)}
                                            >
                                                {isShowingSKUList[product.id] ? <FiChevronUp size={11} /> : <FiChevronDown size={11} />}
                                                {isShowingSKUList[product.id] ? "Thu gọn" : "SKU"}
                                            </button>
                                        )}
                                        {/* More actions */}
                                        <div className="relative w-full">
                                            <button
                                                className="w-full text-xs text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 py-1 cursor-pointer"
                                                onClick={() => setOpenOtherActionDropdown(prev => ({
                                                    ...prev,
                                                    [index]: !prev[index]
                                                }))}
                                            >
                                                Khác <FiChevronDown size={9} className={`transition-transform ${openOtherActionDropdowm[index] ? "rotate-180" : ""}`} />
                                            </button>
                                            {openOtherActionDropdowm[index] && (
                                                <ul className="absolute right-0 z-10 top-full mt-1 w-32 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                                                    <li
                                                        className="px-3 py-2.5 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 flex items-center gap-2"
                                                        onClick={() => window.open(`/preview/${product.id}`, '_blank')}
                                                    >
                                                        <FiEye size={12} className="text-gray-400" /> Xem trước
                                                    </li>
                                                    <li
                                                        className="px-3 py-2.5 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 flex items-center gap-2"
                                                        onClick={() => setChangeVisibleProductId(product.id)}
                                                    >
                                                        {product.visible
                                                            ? <><FiEyeOff size={12} className="text-gray-400" /> Ẩn</>
                                                            : <><FiEye size={12} className="text-green-500" /> Hiện</>
                                                        }
                                                    </li>
                                                    <li
                                                        className="px-3 py-2.5 text-xs text-red-500 cursor-pointer hover:bg-red-50 flex items-center gap-2"
                                                        onClick={() => setDeleteProductId(product.id)}
                                                    >
                                                        <FiTrash2 size={12} /> Xóa
                                                    </li>
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </td>
                            </tr>

                            {/* SKU rows */}
                            {isShowingSKUList[product.id] && (product.skuList || []).map((skuProduct, si) => (
                                <tr key={`${product.id}-sku-${si}`} className="bg-orange-50/30">
                                    <td></td>
                                    <td className="px-3 py-3 pl-10">
                                        <p className="text-xs text-gray-500">
                                            {(skuProduct.attributes || []).map(a => `${a.name}: ${a.value}`).join(" · ")}
                                        </p>
                                        <p className="text-xs font-mono text-gray-400 mt-0.5">SKU: {skuProduct.sku}</p>
                                    </td>
                                    <td className="px-3 py-3 text-center text-xs text-orange-500 font-semibold">{formatCurrency(skuProduct.price)}₫</td>
                                    <td className="px-3 py-3 text-center text-xs text-gray-600">{skuProduct.quantity}</td>
                                    <td colSpan={4}></td>
                                </tr>
                            ))}

                            <Modal
                                open={changeVisibleProductId === product.id}
                                title='Thay đổi hiển thị sản phẩm?'
                                content='Người mua sẽ không thấy sản phẩm nếu bạn ẩn đi, và ngược lại'
                                onClose={() => setChangeVisibleProductId(null)}
                                onSucess={() => { changeProductVisible(changeVisibleProductId); setChangeVisibleProductId(null); }}
                            />
                            <Modal
                                open={deleteProductId === product.id}
                                title='Xóa sản phẩm?'
                                content='Thao tác này sẽ xóa hoàn toàn sản phẩm và không thể hoàn tác'
                                onClose={() => setDeleteProductId(null)}
                                onSucess={() => { handleDeleteProduct(deleteProductId); setDeleteProductId(null); }}
                            />

                            </React.Fragment>
                        ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {products.length > 0 && (
                    <div className="flex justify-end px-4 py-3 border-t border-gray-100">
                        <Pagination
                            page={page}
                            setPage={setPage}
                            limit={limit}
                            setLimit={setLimit}
                            maxPage={totalPages}
                        />
                    </div>
                )}
            </div>

            {/* Loading */}
            {isLoading && <TableLoading/>}

            {/* Empty state */}
            {products.length === 0 && !isLoading && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                        <LuPackageX size={28} className="text-orange-300" />
                    </div>
                    <p className="text-base font-semibold text-gray-600 mb-1">Không có sản phẩm nào</p>
                    <p className="text-sm text-gray-400 mb-5">Thêm sản phẩm để bắt đầu bán hàng</p>
                    <Link
                        to="../add-product"
                        className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors"
                    >
                        <FiPlus size={15} /> Thêm sản phẩm
                    </Link>
                </div>
            )}

            <ToastContainer position="bottom-right" />
        </div>
    )
}
