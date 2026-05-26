import React, { useState } from "react"
import { BASE_API_URL, GOOGLE_LOGIN_URL } from "../../../constants/index.js"
import { sanitizePhoneNumber } from "../../../util/FormUtil.js"
import { normalizeReturnPath } from "../../../util/AuthUtil.js"
import { FaGoogle, FaArrowRight, FaEye, FaEyeSlash } from "react-icons/fa";
import { useSearchParams, Link } from "react-router-dom"

export default function RegisterPage({ isAuthenticated }) {

    const [searchParams] = useSearchParams()
    const from = normalizeReturnPath(searchParams.get('from'))

    if (isAuthenticated === true) {
        window.location.assign(from)
    }

    const [fullName, setFullName] = useState("")
    const [email, setEmail] = useState("")
    const [username, setUsername] = useState("")
    const [phoneNumber, setPhoneNumber] = useState("")
    const [dob, setDob] = useState("")
    const [password, setPassword] = useState("")
    const [passwordRetype, setPasswordRetype] = useState("")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setSuccess(false)

        const normalizedUsername = username.trim()
        const normalizedPhoneNumber = phoneNumber.trim()

        if (!fullName || !email || !normalizedUsername || !normalizedPhoneNumber || !dob || !password || !passwordRetype) {
            setError("Vui lòng điền đầy đủ thông tin!")
            return
        }

        if (/\s/.test(normalizedUsername)) {
            setError("Tên đăng nhập không được chứa dấu cách!")
            return
        }

        if (!/^0\d+$/.test(normalizedPhoneNumber)) {
            setError("Số điện thoại phải bắt đầu bằng số 0 và chỉ chứa chữ số!")
            return
        }

        const fullNameRegex = /^[\p{L}\p{M}\s-]+$/u;
        if (!fullNameRegex.test(fullName)) {
            setError("Họ và tên không được chứa số hoặc ký tự đặc biệt (ngoại trừ dấu gạch nối)!")
            return
        }
        if (password !== passwordRetype) {
            setError("Mật khẩu nhập lại không khớp!")
            return
        }

        const regDto = { fullName, email, username: normalizedUsername, phoneNumber: normalizedPhoneNumber, dob, password }

        fetch(`${BASE_API_URL}/v1/auth/register`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(regDto),
            credentials: "include"
        })
            .then(async res => {
                const data = await res.json()
                if (!res.ok) {
                    throw new Error(res.status === 400 ? data.message : "Đã có lỗi xảy ra, thử lại sau!")
                }
                setSuccess(true)
            })
            .catch(err => setError(err.message || "Đã có lỗi xảy ra, thử lại sau!"))
    }

    const openGoogleLoginPage = () => {
        window.location.href = GOOGLE_LOGIN_URL
    }

    return (
        <div className="flex min-h-screen bg-white flex-col md:flex-row overflow-hidden font-sans">
            <div className="md:w-5/12 w-full mesh-bg relative flex flex-col justify-between p-8 md:p-12 overflow-hidden text-white order-2 md:order-1">
                <div className="relative z-10 stagger-1">
                    <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                    </Link>
                </div>

                <div className="relative z-10 py-12 md:py-0">
                    <h1 className="text-fluid-h1 font-display font-semibold tracking-tighter mb-6 stagger-2">
                        Bắt đầu<br />hành trình.
                    </h1>
                    <p className="text-gray-400 text-lg md:text-xl font-light stagger-3 border-l-2 border-primary pl-5 max-w-sm">
                        Đăng ký ngay hôm nay để tận hưởng các đặc quyền mua sắm không giới hạn.
                    </p>
                </div>

                <div className="relative z-10 stagger-4 text-xs tracking-widest text-gray-500 uppercase font-medium">
                    © {new Date().getFullYear()} SunStack
                </div>
            </div>

            <div className="md:w-7/12 w-full relative flex items-center justify-center p-6 sm:p-12 bg-white order-1 md:order-2">
                <div className="w-full max-w-md">
                    <div className="mb-10 stagger-1">
                        <h2 className="text-4xl font-display font-bold text-gray-900 tracking-tight">Tạo Tài Khoản</h2>
                        <p className="text-gray-500 mt-2 font-light text-lg">Tham gia cùng chúng tôi</p>
                        {error && <div className="mt-4 p-4 border-l-4 border-primary bg-red-50 text-red-900 text-sm font-medium animate-slide-in">{error}</div>}
                    </div>

                    <form className="space-y-6 stagger-2" onSubmit={handleSubmit}>
                        <Input
                            label="Họ và Tên"
                            type="text"
                            value={fullName}
                            setValue={setFullName}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="Tên đăng nhập" type="text" value={username} setValue={(value) => setUsername(value.replace(/\s/g, ""))} />
                            <Input label="Ngày sinh" type="date" value={dob} setValue={setDob} focusedPlaceholder lang="vi-VN" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="Email" type="email" value={email} setValue={setEmail} />
                            <Input label="Số điện thoại" type="tel" value={phoneNumber} setValue={(value) => setPhoneNumber(sanitizePhoneNumber(value))} inputMode="numeric" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="Mật khẩu" type="password" value={password} setValue={setPassword} />
                            <Input label="Nhập lại mật khẩu" type="password" value={passwordRetype} setValue={setPasswordRetype} />
                        </div>

                        <div className="pt-6">
                            <button type="submit" className="w-full flex items-center justify-center gap-3 bg-gray-900 hover:bg-primary text-white px-8 py-3.5 rounded-none font-display font-medium text-lg transition-colors cursor-pointer group shadow-xl shadow-gray-200">
                                Đăng Ký
                                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </form>

                    <div className="mt-10 stagger-3">
                        <div className="relative flex py-5 items-center">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">Hoặc tiếp tục với</span>
                            <div className="flex-grow border-t border-gray-200"></div>
                        </div>

                        <button
                            onClick={openGoogleLoginPage}
                            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-gray-900 text-gray-900 font-medium py-3.5 rounded-none transition-colors cursor-pointer"
                        >
                            <FaGoogle className="text-xl" />
                            Google
                        </button>
                    </div>

                    <p className="text-center text-gray-500 mt-8 stagger-4 text-sm font-medium">
                        Đã có tài khoản?{" "}
                        <Link to={`/login${from ? `?from=${from}` : ''}`} className="text-primary font-bold hover:text-primary-dark transition-colors underline decoration-transparent hover:decoration-primary decoration-2 underline-offset-4">
                            Đăng nhập
                        </Link>
                    </p>
                </div>

                {success && (
                    <div className="fixed inset-0 w-full z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white p-10 max-w-sm rounded-[24px] text-center shadow-2xl animate-slide-in border border-gray-100">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <h3 className="text-gray-900 font-display font-bold text-2xl mb-4">
                                Kiểm tra email
                            </h3>
                            <p className="text-gray-500 mb-8 font-light">
                                Tài khoản đã được tạo. Hãy mở email và bấm liên kết xác nhận để kích hoạt tài khoản trước khi đăng nhập.
                            </p>
                            <Link
                                to='/login'
                                className="inline-block w-full bg-gray-900 hover:bg-primary text-white font-medium py-3 rounded-none transition-colors"
                            >
                                Đến trang đăng nhập
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function Input({ label, type, value, setValue, focusedPlaceholder = false, ...inputProps }) {
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === "password"
    const inputType = isPassword && showPassword ? "text" : type

    return (
        <div className="relative group">
            <input
                type={inputType}
                className={`input-minimal peer ${isPassword ? "pr-10" : ""}`}
                placeholder=" "
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                {...inputProps}
            />
            {isPassword && (
                <button
                    type="button"
                    className="absolute right-0 top-3 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
                    onClick={() => setShowPassword(prev => !prev)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
            )}
            <label className={`absolute text-gray-500 text-sm duration-300 transform -translate-y-5 scale-75 top-3 z-10 origin-[0] left-0 font-medium transition-all group-focus-within:text-primary ${focusedPlaceholder || value ? 'scale-75 -translate-y-5' : 'peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5'}`}>
                {label}
            </label>
        </div>
    )
}
