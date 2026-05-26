import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import Loading from "../common/Loading"
import { BASE_API_URL } from "../../constants"

export default function VerifyEmailPage() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get("token") || ""

    const [status, setStatus] = useState("loading")
    const [message, setMessage] = useState("")

    useEffect(() => {
        if (!token) {
            setStatus("error")
            setMessage("Thiếu token xác nhận")
            return
        }

        fetch(`${BASE_API_URL}/v1/auth/verify-email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data.detail || data.message || "Không thể xác nhận email")
                setStatus("success")
            })
            .catch((err) => {
                setMessage(err.message)
                setStatus("error")
            })
    }, [token])

    return (
        <div className="flex min-h-screen bg-white flex-col md:flex-row overflow-hidden font-sans">
            <div className="md:w-5/12 w-full mesh-bg relative flex flex-col justify-between p-8 md:p-12 overflow-hidden text-white">
                <div className="relative z-10">
                    <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                    </Link>
                </div>

                <div className="relative z-10 py-12 md:py-0">
                    <h1 className="text-fluid-h1 font-display font-semibold tracking-tighter mb-6">
                        Xác nhận<br />email.
                    </h1>
                    <p className="text-gray-400 text-lg md:text-xl font-light border-l-2 border-primary pl-5 max-w-sm">
                        Kích hoạt tài khoản để bắt đầu đăng nhập và mua sắm.
                    </p>
                </div>

                <div className="relative z-10 text-xs tracking-widest text-gray-500 uppercase font-medium">
                    © {new Date().getFullYear()} SunStack
                </div>
            </div>

            <div className="md:w-7/12 w-full relative flex items-center justify-center p-6 sm:p-12 bg-white">
                {status === "loading" && <Loading />}

                <div className="w-full max-w-md relative z-10 text-center">
                    {status === "loading" && (
                        <>
                            <h2 className="text-4xl font-display font-bold text-gray-900 tracking-tight">Đang xác nhận</h2>
                            <p className="text-gray-500 mt-4 font-light text-lg">Vui lòng chờ trong giây lát...</p>
                        </>
                    )}

                    {status === "success" && (
                        <>
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <h2 className="text-4xl font-display font-bold text-gray-900 tracking-tight">Email đã xác nhận</h2>
                            <p className="text-gray-500 mt-4 mb-8 font-light text-lg">Tài khoản của bạn đã được kích hoạt. Bây giờ bạn có thể đăng nhập.</p>
                            <Link to="/login" className="inline-block w-full bg-gray-900 hover:bg-primary text-white font-medium py-3 rounded-none transition-colors">
                                Đăng nhập ngay
                            </Link>
                        </>
                    )}

                    {status === "error" && (
                        <>
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </div>
                            <h2 className="text-4xl font-display font-bold text-gray-900 tracking-tight">Không thể xác nhận</h2>
                            <p className="text-gray-500 mt-4 mb-8 font-light text-lg">{message}</p>
                            <Link to="/register" className="inline-block w-full bg-gray-900 hover:bg-primary text-white font-medium py-3 rounded-none transition-colors">
                                Đăng ký lại
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
