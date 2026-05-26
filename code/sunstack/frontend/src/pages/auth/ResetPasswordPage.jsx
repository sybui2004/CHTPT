import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import Loading from '../common/Loading'
import { BASE_API_URL } from '../../constants';
import { FaArrowRight, FaEye, FaEyeSlash } from "react-icons/fa";

export default function ResetPasswordPage() {

    const { token } = useParams()
    const [newPwd, setNewPwd] = useState('')
    const [retypePwd, setRetypePwd] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [checkingToken, setCheckingToken] = useState(true)
    const [tokenValid, setTokenValid] = useState(false)
    const [showNewPwd, setShowNewPwd] = useState(false)
    const [showRetypePwd, setShowRetypePwd] = useState(false)

    useEffect(() => {
        setCheckingToken(true)
        fetch(`${BASE_API_URL}/v1/auth/verify-reset-token?token=${encodeURIComponent(token || "")}`)
            .then(async res => {
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data.detail || data.message || "Liên kết đặt lại mật khẩu không hợp lệ")
                setTokenValid(true)
            })
            .catch(err => {
                setTokenValid(false)
                setError(err.message)
            })
            .finally(() => setCheckingToken(false))
    }, [token])

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('')
        if (retypePwd !== newPwd) {
            setError("Mật khẩu nhập lại không trùng khớp")
            return
        }

        setProcessing(true)
        fetch(`${BASE_API_URL}/v1/auth/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: token,
                newPassword: newPwd
            })
        })
            .then(async res => {
                const data = await res.json()
                if (!res.ok) throw new Error(data.message || "Không thể đặt lại mật khẩu")
                return data
            })
            .then(() => setSuccess(true))
            .catch(err => setError(err.message))
            .finally(() => setProcessing(false))
    };

    return (
        <div className="flex min-h-screen bg-white flex-col md:flex-row overflow-hidden font-sans">
            {/* Left Side: Modern Graphic Area */}
            <div className="md:w-5/12 w-full mesh-bg relative flex flex-col justify-between p-8 md:p-12 overflow-hidden text-white">
                <div className="relative z-10 stagger-1">
                    <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                    </Link>
                </div>

                <div className="relative z-10 py-12 md:py-0">
                    <h1 className="text-fluid-h1 font-display font-semibold tracking-tighter mb-6 stagger-2">
                        Bảo mật<br />tối đa.
                    </h1>
                    <p className="text-gray-400 text-lg md:text-xl font-light stagger-3 border-l-2 border-primary pl-5 max-w-sm">
                        Khôi phục an toàn. Hãy tạo một mật khẩu mạnh mẽ và dễ nhớ.
                    </p>
                </div>

                <div className="relative z-10 stagger-4 text-xs tracking-widest text-gray-500 uppercase font-medium">
                    © {new Date().getFullYear()} SunStack
                </div>
            </div>

            {/* Right Side: Form Area */}
            <div className="md:w-7/12 w-full relative flex items-center justify-center p-6 sm:p-12 bg-white">
                <div className="w-full max-w-md relative z-10">
                    <div className="mb-12 stagger-1">
                        <h2 className="text-4xl font-display font-bold text-gray-900 tracking-tight">Cài mật khẩu mới</h2>
                        <p className="text-gray-500 mt-2 font-light text-lg">Mật khẩu mới của bạn cần tối thiểu 6 ký tự</p>
                        {error && <div className="mt-4 p-4 border-l-4 border-primary bg-red-50 text-red-900 text-sm font-medium animate-slide-in">{error}</div>}
                    </div>

                    {checkingToken && (
                        <div className="py-8 text-gray-500 font-light">
                            Đang kiểm tra liên kết xác nhận...
                        </div>
                    )}

                    {!checkingToken && !tokenValid && (
                        <div className="space-y-6 stagger-2">
                            <p className="text-gray-500 font-light">
                                Liên kết đặt lại mật khẩu đã hết hạn hoặc không đúng. Vui lòng xác minh email lại để nhận liên kết mới.
                            </p>
                            <Link
                                to="/forgot-password"
                                className="inline-block w-full text-center bg-gray-900 hover:bg-primary text-white font-medium py-3 rounded-none transition-colors"
                            >
                                Xác minh email
                            </Link>
                        </div>
                    )}

                    {!checkingToken && tokenValid && <form onSubmit={handleSubmit} className="space-y-8 stagger-2">
                        <div className="relative group">
                            <input
                                type={showNewPwd ? "text" : "password"}
                                className="input-minimal peer pr-10"
                                placeholder=" "
                                value={newPwd}
                                onChange={e => setNewPwd(e.target.value.trim())}
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-0 top-3 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
                                onClick={() => setShowNewPwd(prev => !prev)}
                                aria-label={showNewPwd ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                            >
                                {showNewPwd ? <FaEyeSlash /> : <FaEye />}
                            </button>
                            <label className="absolute text-gray-500 text-sm duration-300 transform -translate-y-5 scale-75 top-3 z-10 origin-[0] left-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5 font-medium transition-all group-focus-within:text-primary">Mật khẩu mới</label>
                        </div>

                        <div className="relative group">
                            <input
                                type={showRetypePwd ? "text" : "password"}
                                className="input-minimal peer pr-10"
                                placeholder=" "
                                value={retypePwd}
                                onChange={e => setRetypePwd(e.target.value.trim())}
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-0 top-3 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
                                onClick={() => setShowRetypePwd(prev => !prev)}
                                aria-label={showRetypePwd ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                            >
                                {showRetypePwd ? <FaEyeSlash /> : <FaEye />}
                            </button>
                            <label className="absolute text-gray-500 text-sm duration-300 transform -translate-y-5 scale-75 top-3 z-10 origin-[0] left-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5 font-medium transition-all group-focus-within:text-primary">Nhập lại mật khẩu</label>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                className="w-full flex items-center justify-center gap-3 bg-gray-900 hover:bg-primary text-white px-8 py-3.5 rounded-none font-display font-medium text-lg transition-colors cursor-pointer group shadow-xl shadow-gray-200"
                            >
                                Đặt lại mật khẩu
                                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </form>}
                </div>

                {processing && <Loading />}

                {success && (
                    <div className="fixed inset-0 w-full z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white p-10 max-w-sm rounded-[24px] text-center shadow-2xl animate-slide-in border border-gray-100">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </div>
                            <h2 className="text-gray-900 font-display font-bold text-2xl mb-4">
                                Đổi mật khẩu thành công
                            </h2>
                            <p className="text-gray-500 mb-8 font-light">
                                Bạn đã có thể đăng nhập bằng mật khẩu mới.
                            </p>
                            <Link
                                to='/login'
                                className="inline-block w-full bg-gray-900 hover:bg-primary text-white font-medium py-3 rounded-none transition-colors"
                            >
                                Đăng nhập ngay
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
