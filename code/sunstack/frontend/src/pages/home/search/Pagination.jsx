export default function Pagination({page, totalPages, setPage}){

    const safeTotalPages = Number.isFinite(Number(totalPages)) ? Math.max(Number(totalPages), 0) : 0

    if (safeTotalPages <= 1) return null

    const getPaginationNumbers = () => {
        if (safeTotalPages <= 5) return [...Array(safeTotalPages).keys()].map((i) => i + 1);
        if (page <= 3) return [1, 2, 3, "...", safeTotalPages];
        if (page >= safeTotalPages - 2) return [1, "...", safeTotalPages - 2, safeTotalPages - 1, safeTotalPages];
        return [1, "...", page - 1, page, page + 1, "...", safeTotalPages];
    };

    return (
        <div className='mt-5 flex flex-wrap items-center justify-center gap-2 sm:gap-3'>
            <button
                className={`min-h-10 min-w-10 px-2 py-1 text-2xl sm:text-3xl ${page === 0 ? "text-gray-400 cursor-not-allowed" : "cursor-pointer text-gray-600"}`}
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
            >
                &lt;
            </button>

            {getPaginationNumbers().map((num, index) => (
                <button
                    key={index}
                    className={`min-h-9 min-w-9 cursor-pointer rounded-sm px-2 py-1 text-base sm:text-xl ${num === page + 1 ? "bg-blue-500 text-white font-semibold" : "text-gray-600"}`}
                    onClick={() => num !== "..." && setPage(num - 1)}
                >
                {num}
                </button>
            ))}

            <button
                className={`min-h-10 min-w-10 px-2 py-1 text-2xl sm:text-3xl ${page === safeTotalPages - 1 ? "text-gray-400 cursor-not-allowed" : "cursor-pointer text-gray-600"}`}
                disabled={page === safeTotalPages - 1}
                onClick={() => setPage(page + 1)}
            >
                &gt;
            </button>
        </div>
    )
}
