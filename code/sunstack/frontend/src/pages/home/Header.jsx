import { useEffect, useState, useRef } from "react"
import { FiSearch, FiShoppingCart, FiChevronDown } from "react-icons/fi"
import { fetchWithAuth } from "../../util/AuthUtil"
import { BASE_API_URL } from "../../constants"
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

export default function Header({ isAuthenticated }) {

    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const maxMiniCartDisplay = 5;
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [cartItems, setCartItems] = useState([]);
    const location = useLocation()
    const showMiniCart = !['/cart', '/checkout'].includes(location.pathname)
    const [scrolled, setScrolled] = useState(false)
    const [keyword, setKeyword] = useState(searchParams.get('keyword') || '')
    const shopId = searchParams.get('shopId')
    const [searchScope, setSearchScope] = useState(shopId ? 'shop' : 'all');
    const inputRef = useRef(null)

    const fetchMiniCart = async () => {
        try {
            const res = await fetch(`${BASE_API_URL}/v1/cart/get-mini`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
                }
            })
            if (res.ok) {
                const cart = await res.json()
                localStorage.setItem('cart', JSON.stringify(cart))
                return cart
            }
        } catch (err) {
            console.log('Mini cart fetch error:', err)
        }
        return { items: [] }
    }

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    useEffect(() => {
        setIsCartOpen(false)
        const updateCartCount = async () => {
            let cart = JSON.parse(localStorage.getItem('cart'))
            if (!cart) {
                try { cart = await fetchMiniCart() }
                catch (err) { cart = { items: [] } }
            }
            setCartItems(Array.isArray(cart?.items) ? cart.items : [])
        }
        if (showMiniCart) {
            updateCartCount()
            window.addEventListener("cartChange", updateCartCount);
            return () => window.removeEventListener("cartChange", updateCartCount);
        }
        setCartItems([])
    }, [location.pathname])

    useEffect(() => {
        setKeyword(searchParams.get('keyword') || '')
        setSearchScope(searchParams.get('shopId') ? 'shop' : 'all')
    }, [searchParams])

    const handleSearch = () => {
        const normalizedKeyword = keyword.trim()
        if (!normalizedKeyword) return
        const params = new URLSearchParams()
        params.set('keyword', normalizedKeyword)
        if (searchScope === 'shop' && shopId) {
            params.set('shopId', shopId)
        }
        navigate(`/search?${params.toString()}`)
    }

    return (
        <div className={`sticky top-0 z-40 w-full max-w-full overflow-visible transition-all duration-300 ${scrolled ? 'bg-[#0f1011]/95 backdrop-blur-md shadow-xl shadow-black/20' : 'bg-[#0f1011]'}`}>
            <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4">

                {/* Logo */}
                <Link to="/" className="flex shrink-0 items-center gap-2.5 group">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary transition-transform group-hover:scale-110 duration-200">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                    </svg>
                    <span className="hidden sm:block text-xl font-display font-semibold tracking-tight text-white">
                        Sun<span className="text-primary">Stack</span>
                    </span>
                </Link>

                {/* Search bar */}
                <div className="mx-auto flex min-w-0 flex-1 items-center sm:max-w-2xl">
                    <div className="flex min-w-0 w-full overflow-hidden rounded-none border border-white/10 bg-white/10 transition-all duration-300 focus-within:border-primary/60 focus-within:bg-white/15">
                        {shopId && (
                            <div className="relative border-r border-white/10 shrink-0">
                                <select
                                    className="appearance-none h-full pl-3 pr-7 text-white/80 text-xs bg-transparent focus:outline-none cursor-pointer"
                                    value={searchScope}
                                    onChange={(e) => setSearchScope(e.target.value)}
                                >
                                    <option value="shop" className="bg-[#0f1011]">Trong shop</option>
                                    <option value="all" className="bg-[#0f1011]">Toàn bộ</option>
                                </select>
                                <FiChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                            </div>
                        )}

                        <input
                            ref={inputRef}
                            type="text"
                            value={keyword}
                            placeholder="Tìm kiếm sản phẩm, thương hiệu..."
                            onChange={e => setKeyword(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none sm:px-4"
                        />

                        <button
                            onClick={handleSearch}
                            className="flex w-12 shrink-0 cursor-pointer items-center justify-center bg-primary text-white transition-colors duration-200 hover:bg-primary-dark"
                        >
                            <FiSearch size={16} />
                        </button>
                    </div>
                </div>

                {/* Cart */}
                {showMiniCart && (
                    <div
                        className="relative shrink-0"
                        onMouseEnter={() => setIsCartOpen(true)}
                        onMouseLeave={() => setIsCartOpen(false)}
                    >
                        <Link to="/cart" className="relative flex items-center gap-2 text-white/80 hover:text-white transition-colors group">
                            <div className="relative">
                                <FiShoppingCart size={22} />
                                {cartItems.length > 0 && (
                                    <span className="absolute -top-2.5 -right-2.5 bg-primary text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-lg">
                                        {cartItems.length > 99 ? '99+' : cartItems.length}
                                    </span>
                                )}
                            </div>
                            <span className="hidden md:block text-sm font-medium font-display">Giỏ hàng</span>
                        </Link>

                        {isCartOpen && (
                            <div className="absolute right-0 top-full z-[100] mt-3 w-[calc(100vw-1.5rem)] max-w-80">
                                <div className="bg-white text-gray-800 shadow-2xl border border-gray-100 overflow-hidden rounded-none">
                                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                        <h4 className="text-xs font-display font-semibold text-gray-500 uppercase tracking-widest">Giỏ hàng</h4>
                                        <span className="text-xs text-gray-400">{cartItems.length} sản phẩm</span>
                                    </div>
                                    {cartItems.length > 0 ? (
                                        <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto scrollbar-hide">
                                            {cartItems.map((item, index) => {
                                                if (index > 4) return null
                                                return (
                                                    <li key={index} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                                                        <img src={item.thumbnailUrl} alt={item.name} className="w-12 h-12 object-cover shrink-0 border border-gray-100" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium line-clamp-1 text-gray-800">{item.name}</p>
                                                            <p className="text-xs text-gray-400 mt-0.5">{(item.attributes || []).map(attr => `${attr.name}: ${attr.value}`).join(' · ')}</p>
                                                            <p className="text-xs text-primary font-semibold mt-0.5">{item.quantity} × {item.price?.toLocaleString()} ₫</p>
                                                        </div>
                                                    </li>
                                                )
                                            })}
                                            {cartItems.length > maxMiniCartDisplay && (
                                                <li className="px-4 py-2 text-center text-xs text-gray-400">
                                                    và {cartItems.length - maxMiniCartDisplay} sản phẩm khác...
                                                </li>
                                            )}
                                        </ul>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                            <FiShoppingCart size={32} className="mb-2 text-gray-200" />
                                            <p className="text-sm">Giỏ hàng đang trống</p>
                                        </div>
                                    )}
                                    <div className="px-4 py-3 border-t border-gray-100">
                                        <Link
                                            to="/cart"
                                            className="block w-full text-center bg-gray-900 hover:bg-primary text-white py-2.5 text-sm font-display font-medium transition-colors duration-200"
                                        >
                                            Xem giỏ hàng ({cartItems.length})
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
