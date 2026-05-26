import { useState } from "react";

export default function ProductDescriptionSection({ product }) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="w-full bg-white rounded-sm shadow-[0_1px_1px_rgba(0,0,0,0.05)] text-left pb-6">
            <div className="px-5 py-4 bg-gray-50/50 md:px-6 lg:px-8">
                <h2 className="bg-gray-50 p-3 text-[16px] font-medium uppercase text-gray-800 rounded-sm md:text-[18px] lg:text-[20px]">
                    Mô Tả Sản Phẩm
                </h2>
            </div>

            <div className={`relative px-5 py-2 text-[14px] leading-[1.8] text-gray-700 whitespace-pre-wrap font-sans transition-all duration-300 md:px-9 lg:text-[16px] lg:leading-[1.9] xl:text-[17px] ${isExpanded ? '' : 'max-h-[300px] overflow-hidden lg:max-h-[420px]'}`}>
                {product.description}

                {/* Fade gradient cover when truncated */}
                {!isExpanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none"></div>
                )}
            </div>

            <div className="flex justify-center mt-4 relative z-10">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center justify-center gap-1.5 rounded-sm border border-primary px-10 py-2 text-[14px] text-primary transition-colors hover:bg-primary/5 md:border-transparent md:hover:border-primary lg:text-[15px] cursor-pointer"
                >
                    {isExpanded ? 'Thu gọn' : 'Xem thêm'}
                    <span className="text-[12px] font-bold">{isExpanded ? '▲' : '▼'}</span>
                </button>
            </div>
        </div>
    )
}