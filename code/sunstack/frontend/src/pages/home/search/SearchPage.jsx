import FilterSidebar from './FilterSidebar'
import SearchFilter from './SearchFilter'
import ProductGrid from './ProductGrid'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BASE_API_URL } from '../../../constants'
import { PiListMagnifyingGlass } from "react-icons/pi";
import { GoLightBulb } from "react-icons/go";
import { RiCloseLine, RiFilterLine } from 'react-icons/ri'
import Pagination from './Pagination'

const cleanSearchParams = (params) => {
  return Object.fromEntries(
    Object.entries(params)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return [key, value.filter(item => item !== undefined && item !== null && item !== "")]
        }
        return [key, value]
      })
      .filter(([_, value]) => {
        if (Array.isArray(value)) return value.length > 0
        return value !== undefined && value !== null && value !== ""
      })
  )
}

export default function SearchPage(){

  const [searchParams, setSearchParams] = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const limit = 60
  const [page, setPage] = useState(Number(searchParams.get('page') || 0))
  const [totalPages, setTotalPages] = useState(1)
  const keyword = searchParams.get('keyword') || ''
  const [sort, setSort] = useState({
    sortBy: searchParams.get('sortBy') || "relevance",
    order: searchParams.get('order') || "desc"
  })
  const [filters, setFilters] = useState({
    locations: searchParams.getAll('locations') || [],
    minPrice: searchParams.get('minPrice') || null,
    maxPrice: searchParams.get('maxPrice') || null,
    minRating: searchParams.get('minRating') || null,
    shopId: searchParams.get('shopId') || null
  })

  const resetFilters = () => {
    setFilters({
      locations: [],
      minPrice: null,
      maxPrice: null,
      minRating: null,
      shopId: searchParams.get('shopId') || null
    })
  }
  const [products, setProducts] = useState([])

  const searchProducts = () => {
    setIsLoading(true)
    setIsEmpty(false)
    fetch(`${BASE_API_URL}/v1/homepage/search?limit=${limit}&${searchParams.toString()}`)
      .then(res => res.json())
      .then(res => {
        const content = Array.isArray(res.content) ? res.content : []
        const total = Number(res.totalPages)

        setIsEmpty(content.length === 0)
        setTotalPages(Number.isFinite(total) && total > 0 ? total : 0)
        setProducts(content)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    const params = {
      page,
      keyword,
      sortBy: sort.sortBy,
      order: sort.order,
      locations: filters.locations,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      minRating: filters.minRating,
      shopId: filters.shopId
    }
    setSearchParams(cleanSearchParams(params))
  }, [sort, filters, page, keyword])

  useEffect(() => {
    searchProducts()
  }, [searchParams])

  return (
      <div className="w-full max-w-full overflow-x-hidden px-3 py-4 sm:px-5 lg:px-10 lg:pt-5">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="hidden w-[240px] shrink-0 lg:block lg:sticky lg:top-44 lg:self-start">
              <FilterSidebar
                filters={filters}
                setFilters={setFilters}
                resetFilters={resetFilters}/>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex min-w-0 items-center gap-2 text-sm text-gray-500 sm:text-base">
                  <GoLightBulb size={16} className="shrink-0"/>
                  <span className="min-w-0 truncate">
                    Kết quả tìm kiếm cho từ khóa '<span className="text-blue-500 font-medium">{keyword}</span>'
                  </span>
                </span>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-blue-500 bg-white px-3 py-2 text-sm font-medium text-blue-600 shadow-sm sm:w-auto lg:hidden"
                  onClick={() => setIsFilterOpen(true)}
                >
                  <RiFilterLine size={18} />
                  Bộ lọc
                </button>
              </div>
              <div className="relative z-20 mb-4 w-full rounded-lg border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
                <SearchFilter sort={sort} setSort={setSort} page={page} setPage={setPage} totalPages={totalPages} showPageControls={!isEmpty && products.length > 0}/>
              </div>
              {isLoading && (
                <div role="status" className="flex justify-center mt-2">
                  <svg aria-hidden="true" className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
                      <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
                  </svg>
                </div>
              )}
              {!isEmpty ?
                (
                  <>
                    <ProductGrid products={products}/>
                    {totalPages > 1 && <Pagination page={page} setPage={setPage} totalPages={totalPages}/>}
                  </>
                )
                : (
                  <div className="mt-8 flex min-h-60 w-full items-center justify-center px-4">
                      <div className="text-center">
                      <PiListMagnifyingGlass className="text-blue-500 text-8xl mx-auto mb-2"/>
                      <p className="text-base sm:text-xl">Không tìm thấy sản phẩm với từ khóa '<span className="text-blue-500 font-medium">{keyword}</span>'</p>
                      </div>
                  </div>
                )}
            </div>
          </div>

          {isFilterOpen && (
            <div className="fixed inset-0 z-[70] lg:hidden">
              <button
                type="button"
                aria-label="Đóng bộ lọc"
                className="absolute inset-0 bg-black/40"
                onClick={() => setIsFilterOpen(false)}
              />
              <aside className="absolute left-0 top-0 h-full w-[88vw] max-w-[360px] overflow-y-auto bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-base font-semibold text-gray-800">Bộ lọc</span>
                  <button
                    type="button"
                    aria-label="Đóng bộ lọc"
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                    onClick={() => setIsFilterOpen(false)}
                  >
                    <RiCloseLine size={22} />
                  </button>
                </div>
                <FilterSidebar
                  filters={filters}
                  setFilters={setFilters}
                  resetFilters={resetFilters}
                />
              </aside>
            </div>
          )}
      </div>
  )
}
