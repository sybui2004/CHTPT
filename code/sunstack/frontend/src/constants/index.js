const browserOrigin = typeof window !== "undefined" ? window.location.origin : ""

export const BASE_API_URL = import.meta.env.VITE_BASE_API_URL || "/api"
export const BASE_BE_URL = import.meta.env.VITE_BASE_BE_URL || browserOrigin
export const UPLOAD_API_URL = import.meta.env.VITE_UPLOAD_API_URL || `${BASE_API_URL}/v1/upload`
export const MAX_IMAGE_SIZE = Number.parseInt(import.meta.env.VITE_MAX_IMAGE_SIZE || "1048576", 10)
export const BASE_FE_URL = import.meta.env.VITE_BASE_FE_URL || browserOrigin
export const GOOGLE_LOGIN_URL=`${BASE_BE_URL}/oauth2/authorization/google`
