import { useEffect, useState } from "react";
import { BASE_API_URL } from "../../constants";
import { useSearchParams, Link } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import ProductCard from "./ProductCard";
import { FiZap, FiArrowRight } from "react-icons/fi";

const defaultSections = [
    { sectionKey: "recommendation", type: "recommendation", title: "Gợi ý hôm nay", active: true },
];

function ProductSkeleton() {
    return (
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
            <div className="w-full aspect-square bg-gray-100 rounded-2xl" />
            <div className="p-3.5 space-y-2.5">
                <div className="h-3 bg-gray-100 rounded-full w-full" />
                <div className="h-3 bg-gray-100 rounded-full w-3/4" />
                <div className="h-5 bg-gray-100 rounded-full w-2/5 mt-4" />
            </div>
        </div>
    );
}

export default function HomePage() {
    const [searchParams] = useSearchParams();
    const pageLimit = 60;
    const [productList, setProductList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sections, setSections] = useState(defaultSections);
    const [collectionProducts, setCollectionProducts] = useState({});
    const [collectionLoading, setCollectionLoading] = useState({});

    useEffect(() => {
        const fetchProducts = async (page, limit) => {
            setIsLoading(true);
            try {
                const res = await fetch(`${BASE_API_URL}/v1/homepage/get-items?page=${page}&limit=${limit}`);
                if (res.ok) {
                    const data = await res.json();
                    setProductList(data.content);
                }
            } catch (error) {
                toast.error('Có lỗi xảy ra, vui lòng thử lại sau!')
            } finally {
                setIsLoading(false);
            }
        };
        const page = searchParams.get("page") || 0;
        fetchProducts(page, pageLimit);
    }, [searchParams]);

    useEffect(() => {
        fetch(`${BASE_API_URL}/v1/homepage/get_sections`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) setSections(data);
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        const productSections = sections.filter((section) => section.active !== false && section.type === "product_collection");
        if (productSections.length === 0) return;

        productSections.forEach((section) => {
            const config = section.config || {};
            const limit = Math.min(Math.max(Number(config.limit || 12), 1), 24);
            const sortByBySource = {
                best_selling: "sales",
                newest: "newest",
                recommended: "relevance",
            };
            const params = new URLSearchParams({
                sortBy: sortByBySource[config.source] || "sales",
                order: "desc",
                page: "0",
                limit: String(limit),
            });

            setCollectionLoading((prev) => ({ ...prev, [section.sectionKey]: true }));
            fetch(`${BASE_API_URL}/v1/homepage/search?${params.toString()}`)
                .then((res) => res.ok ? res.json() : Promise.reject())
                .then((data) => {
                    setCollectionProducts((prev) => ({ ...prev, [section.sectionKey]: Array.isArray(data.content) ? data.content : [] }));
                })
                .catch(() => {
                    setCollectionProducts((prev) => ({ ...prev, [section.sectionKey]: [] }));
                })
                .finally(() => {
                    setCollectionLoading((prev) => ({ ...prev, [section.sectionKey]: false }));
                });
        });
    }, [sections]);

    const getSectionProducts = (section) => {
        if (section.type === "product_collection") {
            return collectionProducts[section.sectionKey] || [];
        }
        const limit = Math.min(Math.max(Number(section.config?.limit || 12), 1), 60);
        return Array.isArray(productList) ? productList.slice(0, limit) : [];
    };

    const getSectionSubtitle = (section) => {
        const source = section.config?.source || (section.type === "recommendation" ? "recommended" : "best_selling");
        if (source === "best_selling") return "Những sản phẩm đang được mua nhiều trên sàn.";
        if (source === "newest") return "Các sản phẩm mới được người bán đăng gần đây.";
        return "Được chọn lọc riêng biệt dựa trên sở thích của bạn.";
    };

    const renderProductCollectionSection = (section) => {
        const products = getSectionProducts(section);
        const link = section.config?.link || "/search";
        const sectionLoading = section.type === "product_collection" ? collectionLoading[section.sectionKey] : isLoading;
        const skeletonCount = Math.min(Math.max(Number(section.config?.limit || 12), 1), 24);

        return (
        <div key={section.sectionKey} className="space-y-6">
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-3xl font-display font-black text-gray-900 tracking-tight">
                        {section.title || "Gợi ý hôm nay"}
                    </h2>
                    <p className="text-gray-400 mt-1.5 font-medium text-sm">{getSectionSubtitle(section)}</p>
                </div>
                <Link
                    to={link}
                    className="hidden sm:flex items-center gap-2 text-primary font-bold text-sm border border-primary/20 bg-primary/5 hover:bg-primary hover:text-white px-4 py-2 rounded-full transition-all duration-200"
                >
                    Xem tất cả <FiArrowRight size={14} />
                </Link>
            </div>

            {sectionLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {Array.from({ length: skeletonCount }).map((_, i) => (
                        <ProductSkeleton key={i} />
                    ))}
                </div>
            ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-gray-50/80 rounded-2xl border border-dashed border-gray-200">
                    <div className="w-20 h-20 flex items-center justify-center bg-white rounded-full mb-5 shadow-sm border border-gray-100">
                        <FiZap size={32} className="text-gray-300" />
                    </div>
                    <p className="text-xl font-display font-bold text-gray-500">Chưa có sản phẩm nào</p>
                    <p className="text-sm mt-2 text-gray-400 font-medium">Hãy quay lại sau để xem các sản phẩm mới nhất!</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {products.map((product, index) => (
                        <ProductCard key={index} product={product} />
                    ))}
                </div>
            )}
        </div>
        );
    };

    const renderContentSection = (section) => (
        <section key={section.sectionKey} className="rounded-2xl border border-orange-100 bg-orange-50/70 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-display font-black text-gray-900 tracking-tight">{section.title || "Khối nội dung"}</h2>
                    {section.config?.description && <p className="mt-1 text-sm font-medium text-gray-500">{section.config.description}</p>}
                </div>
                {section.config?.link && (
                    <Link to={section.config.link} className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-white">
                        Xem thêm <FiArrowRight size={14} />
                    </Link>
                )}
            </div>
        </section>
    );

    const renderSection = (section) => {
        if (section.active === false) return null;
        const type = section.type || section.sectionKey;
        switch (type) {
            case "recommendation":
                return renderProductCollectionSection({ ...section, config: { limit: "60", source: "recommended", ...(section.config || {}) } });
            case "product_collection":
                return renderProductCollectionSection(section);
            case "content":
                return renderContentSection(section);
            default:
                return null;
        }
    };

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-8 overflow-x-hidden px-3 py-6 sm:space-y-10 sm:px-4 sm:py-8">
            {sections.map((section) => renderSection(section))}
            <ToastContainer position="bottom-right" />
        </div>
    );
}
