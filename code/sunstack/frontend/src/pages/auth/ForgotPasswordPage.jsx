import { useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import Loading from '../common/Loading'
import { BASE_API_URL } from "../../constants"
import { FaArrowRight } from "react-icons/fa";

export default function ForgotPasswordPage() {

    const { purpose: purposeParam } = useParams()
    const [searchParams] = useSearchParams()
    const purpose = purposeParam || searchParams.get("purpose") || "forgot-password"
    const isChangePassword = purpose === "change-password"

    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [processing, setProcessing] = useState(false)

    const content = useMemo(() => {
        if (isChangePassword) {
            return {
                heroTitle: <>Bảo mật<br />tài khoản.</>,
                heroText: "Xác minh email trước khi tạo mật khẩu mới cho tài khoản của bạn.",
                title: "Xác minh email",
                description: "Nhập email tài khoản để nhận liên kết đổi mật khẩu",
                button: "Gửi liên kết đổi mật khẩu",
                success: "Thư đã được gửi tới địa chỉ email của bạn. Hãy kiểm tra hộp thư để đổi mật khẩu."
            }
        }

        return {
            heroTitle: <>Tìm lại<br />mật khẩu.</>,
            heroText: "Đừng lo lắng, chúng tôi sẽ giúp bạn lấy lại quyền truy cập ngay lập tức.",
            title: "Quên mật khẩu",
            description: "Nhập email để nhận liên kết khôi phục",
            button: "Gửi liên kết xác nhận",
            success: "Thư đã được gửi tới địa chỉ email của bạn. Hãy kiểm tra hộp thư để đặt lại mật khẩu."
        }
    }, [isChangePassword])

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('')
        setSuccess(false)
        setProcessing(true)

        fetch(`${BASE_API_URL}/v1/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email
            })
        })
            .then(async res => {
                const data = await res.json()
                if (!res.ok) throw new Error(data.message || "Không thể gửi email xác nhận")
                return data
            })
            .then(() => setSuccess(true))
            .catch(err => setError(err.message))
            .finally(() => setProcessing(false))
    }

    return (
        <div className="flex min-h-screen bg-white flex-col md:flex-row overflow-hidden font-sans">
            <div className="md:w-5/12 w-full mesh-bg relative flex flex-col justify-between p-8 md:p-12 overflow-hidden text-white">
                <div className="relative z-10 stagger-1">
                    <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                    </Link>
                </div>

                <div className="relative z-10 py-12 md:py-0">
                    <h1 className="text-fluid-h1 font-display font-semibold tracking-tighter mb-6 stagger-2">
                        {content.heroTitle}
                    </h1>
                    <p className="text-gray-400 text-lg md:text-xl font-light stagger-3 border-l-2 border-primary pl-5 max-w-sm">
                        {content.heroText}
                    </p>
                </div>

                <div className="relative z-10 stagger-4 text-xs tracking-widest text-gray-500 uppercase font-medium">
                    © {new Date().getFullYear()} SunStack
                </div>
            </div>

            <div className="md:w-7/12 w-full relative flex items-center justify-center p-6 sm:p-12 bg-white">
                <div className="w-full max-w-md relative z-10">
                    <div className="mb-12 stagger-1">
                        <h2 className="text-4xl font-display font-bold text-gray-900 tracking-tight">{content.title}</h2>
                        <p className="text-gray-500 mt-2 font-light text-lg">{content.description}</p>
                        {error && <div className="mt-4 p-4 border-l-4 border-primary bg-red-50 text-red-900 text-sm font-medium animate-slide-in">{error}</div>}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8 stagger-2">
                        <div className="relative group">
                            <input
                                type="email"
                                className="input-minimal peer"
                                placeholder=" "
                                value={email}
                                onChange={e => setEmail(e.target.value.trim())}
                                required
                            />
                            <label className="absolute text-gray-500 text-sm duration-300 transform -translate-y-5 scale-75 top-3 z-10 origin-[0] left-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5 font-medium transition-all group-focus-within:text-primary">Địa chỉ Email</label>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                className="w-full flex items-center justify-center gap-3 bg-gray-900 hover:bg-primary text-white px-8 py-3.5 rounded-none font-display font-medium text-lg transition-colors cursor-pointer group shadow-xl shadow-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                disabled={processing}
                            >
                                {content.button}
                                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </form>

                    <p className="text-center text-gray-500 mt-12 stagger-4 text-sm font-medium">
                        <Link to={`/login`} className="text-gray-900 font-semibold hover:text-primary transition-colors underline decoration-transparent hover:decoration-primary decoration-2 underline-offset-4">
                            Trở về đăng nhập
                        </Link>
                    </p>
                </div>

                {processing && <Loading />}

                {success && (
                    <div className="fixed inset-0 w-full z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white p-10 max-w-sm rounded-[24px] text-center shadow-2xl animate-slide-in border border-gray-100">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <h3 className="text-gray-900 font-display font-bold text-2xl mb-4">
                                Thành công!
                            </h3>
                            <p className="text-gray-500 mb-8 font-light">
                                {content.success}
                            </p>
                            <Link
                                to='/login'
                                className="inline-block w-full bg-gray-900 hover:bg-primary text-white font-medium py-3 rounded-none transition-colors"
                            >
                                Đồng ý
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
