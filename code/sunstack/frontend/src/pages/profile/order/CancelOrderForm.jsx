import { useState } from "react"
import { fetchWithAuth } from "../../../util/AuthUtil"
import { BASE_API_URL } from "../../../constants"
import { ToastContainer, toast } from "react-toastify"

export default function CancelOrderForm({ reasons, whoCancel, closeForm, order }){

    const [otherReason, setOtherReason] = useState('')
    const [selectedReasonIdx, setselectedReasonIdx] = useState(null)

    const handleCancelOrder = () => {
        if(selectedReasonIdx === null || (selectedReasonIdx == reasons.length && !otherReason)){
            toast.warning("Vui lòng chọn lý do hủy đơn hàng")
            return
        }
        const cancelReason = selectedReasonIdx < reasons.length ? reasons[selectedReasonIdx] : otherReason
        const orderId = order.orderId || order.order_id || order.id
        const shopId = order.shopId || order.shop_id || order.shop?.id

        if (!orderId) {
            toast.error("KhÃ´ng tÃ¬m tháº¥y mÃ£ Ä‘Æ¡n hÃ ng")
            return
        }
        
        // Build URL with query params
        // Note: order-service uses /api/v1/orders prefix (plural)
        const url = new URL(`${BASE_API_URL}/v1/orders/${orderId}/cancel`)
        url.searchParams.append('whoCancel', whoCancel)
        
        // For shop owner (whoCancel=2), add shopId
        if (whoCancel === 2) {
            if (!shopId) {
                toast.error("KhÃ´ng tÃ¬m tháº¥y mÃ£ shop cá»§a Ä‘Æ¡n hÃ ng")
                return
            }
            url.searchParams.append('shopId', shopId)
        }
        url.searchParams.append('reason', cancelReason)
        
        fetchWithAuth(url.toString(), window.location, true, {
            method: "PUT"
        })
            .then(res => {
                if (res && res.ok) {
                    window.location.reload()
                } else {
                    toast.error("Có lỗi xảy ra, vui lòng thử lại sau!")
                }
            })
            .catch(() => toast.error("Có lỗi xảy ra, vui lòng thử lại sau!"))
    }

    return (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-gray-100/60">
            <div className="bg-white w-full max-w-md rounded-sm p-6 border border-gray-600 m-4">
                <h2 className="text-2xl font-bold mb-10"> Hủy đơn hàng </h2>

                <div className="flex flex-col gap-5 mb-10">
                    {reasons.map((reason, index) => (
                        <label 
                            key={index}
                            className="flex gap-2 items-center cursor-pointer"
                        >
                            <input
                                type="radio"
                                checked={selectedReasonIdx === index}
                                className="w-5 h-5 accent-blue-400"
                                onChange={() => setselectedReasonIdx(index)}
                            />
                            <span className="">{reason}</span>
                        </label>
                    ))}

                    <label className="flex gap-2 items-center cursor-pointer">
                        <input
                            type="radio"
                            checked={selectedReasonIdx === reasons.length}
                            className="w-5 h-5 accent-blue-400"
                            onChange={() => setselectedReasonIdx(reasons.length)}
                        />
                        <span>Lý do khác</span>
                    </label>
                    {selectedReasonIdx === reasons.length && (
                        <input
                            type="text"
                            placeholder="Lý do khác..."
                            className="w-full px-2 py-1 border border-gray-500 rounded"
                            onChange={e => setOtherReason(e.target.value)}
                        />
                    )}
                </div>
                <div className="flex justify-evenly">
                    <button 
                        className="cursor-pointer w-30 p-2 text-l text-white font-semibold rounded-sm bg-blue-400 hover:bg-blue-500"
                        onClick={closeForm}
                    >
                        Thoát
                    </button>

                    <button 
                        className="cursor-pointer w-30 p-2 text-l font-semibold rounded-sm bg-white border border-red-500 hover:bg-gray-100"
                        onClick={handleCancelOrder}    
                    >
                        Hủy đơn
                    </button>
                </div>
            </div>
            <ToastContainer
                position="bottom-right"
            />
        </div>
    )
}
