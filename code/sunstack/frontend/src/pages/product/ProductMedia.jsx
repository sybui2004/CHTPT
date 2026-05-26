import { useEffect, useState } from "react"
import { FaChevronRight, FaChevronLeft, FaTimes } from "react-icons/fa";

export default function ProductMedia({ mediaList }) {

    const [selectedMedia, setselectedMedia] = useState(null);
    const [startIndex, setStartIndex] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const visibleThumbnails = 5;

    useEffect(() => {
        if (mediaList && mediaList.length > 0)
            setselectedMedia(mediaList[0])
    }, [mediaList])

    const handlePrev = () => {
        setStartIndex((prev) => Math.max(0, prev - 1));
    };

    const handleNext = () => {
        setStartIndex((prev) => Math.min(mediaList.length - visibleThumbnails, prev + 1));
    };

    if (!mediaList || mediaList.length === 0) return null;

    return (
        <div className="w-full flex flex-col items-center px-2">
            {/* Main Image */}
            <div className="relative aspect-square w-full mb-4 cursor-zoom-in group" onClick={() => setIsModalOpen(true)}>
                {selectedMedia ? (
                    <img
                        src={selectedMedia.url}
                        alt="Selected Product"
                        className="w-full h-full object-cover border border-gray-100"
                    />
                ) : (
                    <div className="animate-pulse bg-gray-200 w-full h-full"></div>
                )}
            </div>

            {/* Thumbnails array */}
            {mediaList.length > 1 && (
                <div className="relative w-full px-4">
                    {startIndex > 0 && (
                        <button
                            onClick={handlePrev}
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-gray-900/30 hover:bg-gray-900/60 text-white rounded-full transition-colors cursor-pointer shadow-sm"
                        >
                            <FaChevronLeft size={10} />
                        </button>
                    )}

                    <div className="flex gap-2 overflow-hidden justify-center w-full">
                        {mediaList.slice(startIndex, startIndex + visibleThumbnails).map((media, index) => (
                            <div
                                key={index}
                                className={`relative aspect-square flex-1 max-w-[80px] cursor-pointer box-border transition-all duration-200 ${selectedMedia?.url === media.url
                                        ? 'border-2 border-primary'
                                        : 'border-2 border-transparent hover:border-gray-200'
                                    }`}
                                onMouseEnter={() => setselectedMedia(media)}
                            >
                                <img
                                    src={media.url}
                                    alt={`Thumbnail ${index}`}
                                    className="w-full h-full object-cover bg-gray-50"
                                />
                            </div>
                        ))}
                    </div>

                    {startIndex + visibleThumbnails < mediaList.length && (
                        <button
                            onClick={handleNext}
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-gray-900/30 hover:bg-gray-900/60 text-white rounded-full transition-colors cursor-pointer shadow-sm"
                        >
                            <FaChevronRight size={10} />
                        </button>
                    )}
                </div>
            )}

            {/* Lightbox/Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/95 z-50 flex justify-center items-center">
                    <button
                        className="absolute top-6 right-6 text-white/50 hover:text-white p-2 transition-all cursor-pointer"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <FaTimes size={32} />
                    </button>
                    <img
                        src={selectedMedia?.url}
                        alt="Enlarged"
                        className="max-w-[90vw] max-h-[90vh] object-contain"
                    />
                </div>
            )}
        </div>
    )
}