import ErrorPage, { ERROR_TYPE } from "./ErrorPage"
import { useState, useEffect } from "react"
import { BASE_API_URL } from "../../constants"
import ProductSection from "./ProductSection"
import ShopSection from "./ShopSection"
import ProductDescriptionSection from "./ProductDescriptionSection"

export default function ProductPage() {
    const parts = window.location.pathname.split('.')
    if (parts.length < 2) {
        return <ErrorPage errorType={ERROR_TYPE.INFOMATION_MISSING} />
    }
    const [isLoading, setIsLoading] = useState(true)
    const [product, setProduct] = useState(null)
    const [error, setError] = useState(null)

    const productId = parts.at(-1)
    useEffect(() => {
        async function fetchProduct() {
            try {
                const productResponse = await fetch(`${BASE_API_URL}/v1/product/${productId}`)
                if (productResponse.status === 200) {
                    const data = await productResponse.json()
                    setProduct(data)
                    setIsLoading(false)
                }
                else if (productResponse.status === 404) {
                    setError(ERROR_TYPE.PRODUCT_NOT_EXIST)
                }
                else {
                    setError(ERROR_TYPE.UNKNOWN_ERROR)
                }

            }
            catch (err) {
                setError(ERROR_TYPE.UNKNOWN_ERROR)
            }
        }

        fetchProduct()
    }, [productId])

    if (error) {
        return <ErrorPage errorType={error} />
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-medium text-gray-500 uppercase text-sm">Đang tải SunStack...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f5f5f5] pt-4 pb-20 font-sans text-gray-800">
            <div className="max-w-[1200px] w-full mx-auto px-4 space-y-4 text-left">
                <ProductSection product={product} />
                <ShopSection shop={product.shop} />
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 flex flex-col gap-4">
                        <ProductDescriptionSection product={product} />
                    </div>
                </div>
            </div>
        </div>
    )
}