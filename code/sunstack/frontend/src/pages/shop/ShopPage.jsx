import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { BASE_API_URL } from "../../constants/index";
import ShopHeader from "./ShopHeader";
import SortOptions from "./SortOptions.jsx";
import ProductGrid from "../home/search/ProductGrid";
import Pagination from "../home/search/Pagination";
import { ToastContainer, toast } from "react-toastify";
import { VscInbox } from "react-icons/vsc";

export default function ShopPage() {
    const [, setSearchParams] = useSearchParams();
    const { username } = useParams();
    const [isLoading, setIsLoading] = useState(false);
    const [isEmpty, setIsEmpty] = useState(false);
    const [shopInfo, setShopInfo] = useState(null);
    const [products, setProducts] = useState([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [activeTab, setActiveTab] = useState("products");
    const [sort, setSort] = useState({
        sortBy: "popular",
        order: "desc",
    });
    const limit = 50;

    const fetchShop = () => {
        const token = localStorage.getItem("access_token");
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        fetch(`${BASE_API_URL}/v1/shopinfo/get_info?username=${username}`, { headers })
            .then((res) => {
                if (!res.ok) {
                    window.location.assign("/error/?errorType=NOT_FOUND");
                    return null;
                }
                return res.json();
            })
            .then((res) => {
                if (!res) return;
                if (res.detail) {
                    window.location.assign("/error/?errorType=NOT_FOUND");
                }
                else {
                    setShopInfo(res);
                    setSearchParams((prev) => ({
                        ...prev,
                        shopId: res.id,
                    }));
                }
            })
            .catch((e) => {
                console.log(e);
                toast.error("Có lỗi xảy ra, vui lòng thử lại sau");
            });
    };

    const fetchProducts = () => {
        if (!shopInfo) return;
        setIsLoading(true);
        setIsEmpty(false);
        fetch(`${BASE_API_URL}/v1/shopinfo/get_product_list?shopId=${shopInfo.id}&sortBy=${sort.sortBy}&order=${sort.order}&page=${page}&limit=${limit}`)
            .then((res) => res.json())
            .then((res) => {
                setProducts(res.content);
                setTotalPages(res.totalPages);
                if (res.numberOfElements === 0) setIsEmpty(true);
            })
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        fetchShop();
    }, [username]);

    useEffect(() => {
        fetchProducts();
    }, [shopInfo, sort, page]);

    return (
        <div className="min-h-screen max-w-full overflow-x-hidden bg-gray-100">
            <div className="bg-white shadow-sm">
                <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
                    {shopInfo && <ShopHeader shopInfo={shopInfo} />}
                </div>
            </div>

            <div className="w-full px-3 py-5 sm:px-6 lg:p-10 lg:pt-5">
                {!isEmpty ? (
                    <>
                        {activeTab === "products" && (
                            <div className="mb-4 w-full rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                                <SortOptions sort={sort} setSort={setSort} page={page} setPage={setPage} totalPages={totalPages} />
                            </div>
                        )}
                        <div id="shop-products">
                            <ProductGrid products={products} />
                        </div>
                        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
                    </>
                ) : (
                    <div className="mt-3 flex w-full items-center justify-center">
                        <div className="text-center">
                            <VscInbox className="mx-auto mb-2 text-8xl text-blue-500" />
                            <p className="text-xl">Không có sản phẩm</p>
                        </div>
                    </div>
                )}

                {isLoading && (
                    <div role="status" className="mt-2 flex justify-center">
                        <svg aria-hidden="true" className="h-8 w-8 animate-spin fill-blue-600 text-gray-200 dark:text-gray-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.4013 9.08144 50.5908Z" fill="currentColor" />
                            <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
                        </svg>
                    </div>
                )}
            </div>

            <ToastContainer position="bottom-right" />
        </div>
    );
}
