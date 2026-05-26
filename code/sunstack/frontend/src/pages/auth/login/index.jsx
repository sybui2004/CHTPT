import React, { useState } from "react"
import { BASE_API_URL, GOOGLE_LOGIN_URL } from "../../../constants/index.js"
import { normalizeReturnPath, setUserData } from "../../../util/AuthUtil.js"
import { FaGoogle, FaArrowRight, FaEye, FaEyeSlash } from "react-icons/fa";
import { useSearchParams, Link } from "react-router-dom"

export default function LoginPage({ isAuthenticated }) {

  const [searchParams] = useSearchParams()

  const from = normalizeReturnPath(searchParams.get("from"))

  if (isAuthenticated == true) {
    window.location.assign(from)
  }

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    const normalizedUsername = username.trim()
    if (/\s/.test(normalizedUsername)) {
      setError("Tên đăng nhập không được chứa dấu cách!")
      return
    }

    const loginDto = {
      "username": normalizedUsername,
      "password": password
    }

    fetch(`${BASE_API_URL}/v1/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginDto)
    })
      .then(res => {
        if (!res.ok) {
          const status = res.status
          res.json()
            .then(data => {
              if (status == 400) setError(data.message)
              else setError("Something wrong, try again later!")
            })
        }
        else {
          res.json()
            .then(data => {
              localStorage.setItem('access_token', data.token)
              setUserData(data.token)
            })
          window.location.assign(from)
        }
      })
      .catch(err => {
        console.log(err)
        setError("Something wrong, try again later!")
      })
  }

  const openGoogleLoginPage = () => {
    window.location.href = GOOGLE_LOGIN_URL
  }

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
            Chào mừng<br />trở lại.
          </h1>
          <p className="text-gray-400 text-lg md:text-xl font-light stagger-3 border-l-2 border-primary pl-5 max-w-sm">
            Hệ sinh thái mua sắm hiện đại. Không rườm rà, chỉ tập trung vào bạn.
          </p>
        </div>

        <div className="relative z-10 stagger-4 text-xs tracking-widest text-gray-500 uppercase font-medium">
          © {new Date().getFullYear()} SunStack
        </div>
      </div>

      {/* Right Side: Form Area */}
      <div className="md:w-7/12 w-full relative flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-12 stagger-1">
            <h2 className="text-4xl font-display font-bold text-gray-900 tracking-tight">Đăng Nhập</h2>
            <p className="text-gray-500 mt-2 font-light text-lg">Tiếp tục hành trình của bạn</p>
            {error && <div className="mt-4 p-4 border-l-4 border-primary bg-red-50 text-red-900 text-sm font-medium animate-slide-in">{error}</div>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 stagger-2">
            <div className="relative group">
              <input
                type="text"
                className="input-minimal peer"
                placeholder=" "
                value={username}
                onChange={e => setUsername(e.target.value.replace(/\s/g, ""))}
                required
              />
              <label className="absolute text-gray-500 text-sm duration-300 transform -translate-y-5 scale-75 top-3 z-10 origin-[0] left-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5 font-medium transition-all group-focus-within:text-primary">Tên đăng nhập</label>
            </div>

            <div className="relative group">
              <input
                type={showPassword ? "text" : "password"}
                className="input-minimal peer pr-10"
                placeholder=" "
                onChange={e => setPassword(e.target.value.trim())}
                required
              />
              <button
                type="button"
                className="absolute right-0 top-3 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
              <label className="absolute text-gray-500 text-sm duration-300 transform -translate-y-5 scale-75 top-3 z-10 origin-[0] left-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5 font-medium transition-all group-focus-within:text-primary">Mật khẩu</label>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Link to="/forgot-password" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors underline decoration-transparent hover:decoration-gray-900 decoration-2 underline-offset-4">
                Quên mật khẩu?
              </Link>

              <button type="submit" className="flex items-center justify-center gap-3 bg-gray-900 hover:bg-primary text-white px-8 py-3.5 rounded-none font-display font-medium text-lg transition-colors cursor-pointer group shadow-xl shadow-gray-200">
                Đăng nhập
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </form>

          <div className="mt-14 stagger-3">
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
            Chưa có tài khoản?{" "}
            <Link to={`/register${from ? `?from=${from}` : ''}`} className="text-primary font-bold hover:text-primary-dark transition-colors underline decoration-transparent hover:decoration-primary decoration-2 underline-offset-4">
              Tạo tài khoản mới
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
