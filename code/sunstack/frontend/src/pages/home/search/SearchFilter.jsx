import React, { useEffect, useRef, useState } from 'react';
import { RiArrowDownSLine, RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';

export default function SearchFilter({sort, setSort, page, setPage, totalPages, showPageControls = true}){
  const sortOptions = [
    { id: 'relevance', label: 'Liên Quan' },
    { id: 'newest', label: 'Mới Nhất' },
    { id: 'sales', label: 'Bán Chạy' },
  ];

  const [openPriceSortDropdown, setOpenPriceSortDropdown] = useState(false)
  const priceDropdownRef = useRef(null)
  const safeTotalPages = Number.isFinite(Number(totalPages)) ? Math.max(Number(totalPages), 0) : 0

  const handlePrevPage = () => {
    if (page > 0) {
      setPage(prevPage => prevPage - 1);
    }
  };

  const handleNextPage = () => {
    if (page < safeTotalPages - 1) {
      setPage(prevPage => prevPage + 1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (priceDropdownRef.current && !priceDropdownRef.current.contains(event.target)) {
        setOpenPriceSortDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="w-full animate-fade-in">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <span className="shrink-0 text-sm text-gray-500">Sắp xếp theo</span>
          <div className="grid min-w-0 grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            {sortOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  setSort({
                    sortBy: option.id,
                    order: "desc"
                  })
                }}
                className={`
                  min-h-10 w-full cursor-pointer rounded-md border border-gray-200 px-3 py-2 text-sm font-medium transition-all focus:outline-none sm:w-auto sm:px-4
                  ${sort.sortBy === option.id
                    ? "bg-blue-500 text-white border-blue-500"
                    : "hover:bg-gray-50"}
                `}
              >
                {option.label}
              </button>
            ))}

            <div
              ref={priceDropdownRef}
              className='relative z-[60] col-span-3 w-full sm:col-span-1 sm:w-56'
            >
              <button
                onClick={() => setOpenPriceSortDropdown(prev => !prev)}
                className={`
                    flex min-h-10 w-full items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-left text-sm font-medium transition-all focus:outline-none sm:px-4
                    ${sort.sortBy === 'price'
                      ? "bg-blue-500 text-white border-blue-500"
                      : "hover:bg-gray-50"}
                  `}
                >
                  {sort.sortBy === 'price' ? ('Giá: ' + (sort.order === 'asc' ? 'Thấp đến Cao' : 'Cao đến Thấp')) : 'Giá'}
                  <RiArrowDownSLine size={16} className={`ml-1 inline-block transition-transform ${openPriceSortDropdown ? "rotate-180" : ""}`} />
              </button>
              {openPriceSortDropdown && (
                <div className='absolute left-0 top-full z-[70] mt-1 w-full overflow-hidden rounded-md border border-gray-100 bg-white shadow-lg'>
                  <button
                    onClick={() => {
                      setSort({
                        sortBy: 'price',
                        order: 'asc'
                      })
                      setOpenPriceSortDropdown(false)
                    }}
                    className={`
                      w-full cursor-pointer px-4 py-2 text-left text-sm font-medium hover:bg-blue-50 hover:text-blue-500
                    `}
                  >
                    Giá: Thấp đến Cao
                  </button>

                  <button
                    onClick={() => {
                      setSort({
                        sortBy: 'price',
                        order: 'desc'
                      })
                      setOpenPriceSortDropdown(false)
                    }}
                    className={`
                      w-full cursor-pointer px-4 py-2 text-left text-sm font-medium hover:bg-blue-50 hover:text-blue-500
                    `}
                  >
                    Giá: Cao đến Thấp
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {showPageControls && safeTotalPages > 0 && (
          <div className="flex shrink-0 items-center justify-end gap-2">
            <span className="text-gray-500">
              <span className='text-blue-700'>{Number(page) + 1}</span>/{safeTotalPages}
            </span>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <button
                onClick={handlePrevPage}
                disabled={page === 0}
                className={`
                  min-h-10 min-w-10 rounded-md border border-blue-500 p-2
                  ${page === 0
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-600 cursor-pointer hover:bg-blue-300"}
                `}
              >
                <RiArrowLeftSLine size={16} />
              </button>
              <button
                onClick={handleNextPage}
                disabled={page === safeTotalPages - 1}
                className={`
                  min-h-10 min-w-10 rounded-md border border-blue-500 p-2
                  ${page === safeTotalPages - 1
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-600 cursor-pointer hover:bg-blue-300"}
                `}
              >
                <RiArrowRightSLine size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
