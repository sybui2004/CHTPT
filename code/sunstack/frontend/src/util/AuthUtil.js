import { BASE_API_URL } from "../constants"

export function getCurrentReturnPath() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
}

export function getLoginUrl(from = getCurrentReturnPath()) {
    return `/login?from=${encodeURIComponent(from || "/")}`;
}

export function normalizeReturnPath(from) {
    if (!from) return "/";

    try {
        const parsed = new URL(from, window.location.origin);
        if (parsed.origin !== window.location.origin) return "/";
        return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    } catch {
        return from.startsWith("/") ? from : "/";
    }
}

// Validate JWT token format
function isValidJWT(token) {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Check header is valid base64url encoded JSON
    try {
        const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
        if (!header.alg || !header.typ) return false;
        return true;
    } catch {
        return false;
    }
}

export async function checkAuthenticated(){
    const accessToken = localStorage.getItem("access_token")
    if (!accessToken || !isValidJWT(accessToken)) {
        // Invalid token - clear it
        localStorage.removeItem("access_token");
        localStorage.removeItem("userData");
        return false;
    }
    
    var ok = false
    try{
        const res = await fetch(`${BASE_API_URL}/v1/auth/ping`, {
            headers:{
                Authorization: `Bearer ${accessToken}`
            }
        })
        if(res.status !== 200) throw new Error("Cannot ping")
        ok = true
    }
    catch (err){
        try{
            const ref = await fetch(`${BASE_API_URL}/v1/auth/refreshToken`, {
                credentials: "include"
            })
            if(ref.status !== 200) ok = false
            else{
                await ref.json()
                .then(data => {
                    if (data.token && isValidJWT(data.token)) {
                        localStorage.setItem("access_token", data.token)
                        setUserData(data.token)
                        ok = true
                    } else {
                        ok = false
                    }
                })
            }
        }
        catch(error){
            ok = false
        }
    }
    return ok
}

export async function fetchWithAuth(url, from, isCompulsory, options = {}){
    let res;
    
    // Check if token exists and is valid
    const token = localStorage.getItem("access_token");
    if (!token || !isValidJWT(token)) {
        // Invalid token - clear it
        localStorage.removeItem("access_token");
        localStorage.removeItem("userData");
        
        if (isCompulsory) {
            const returnPath = typeof from === "string" ? from : getCurrentReturnPath();
            localStorage.setItem('from', returnPath);
            window.location.assign(getLoginUrl(returnPath));
        }
        return { ok: false, status: 401 };
    }
    
    try {
        res = await fetch(url, {
            ...options,
            headers:{
                ...options.headers,
                'Authorization': `Bearer ${token}`,
            }
        });
    } catch (err) {
        console.log(err.status)
        if(err.status === 403) window.location.assign("/error?error=UNAUTHORIZED")
        return { ok: false, status: 0 };
    }
    if(!res.ok){
        if(res.status === 401){
            // Token expired or invalid - try to refresh
            console.log('AuthUtil: Got 401, attempting refresh...');
            try {
                const ref = await fetch(`${BASE_API_URL}/v1/auth/refreshToken`, {
                    credentials: "include"
                })
                console.log('AuthUtil: Refresh response status:', ref.status);
                
                if(ref.ok){
                    const resJson = await ref.json().catch(() => null);
                    console.log('AuthUtil: Refresh response data:', resJson);
                    
                    if (resJson?.token && isValidJWT(resJson.token)) {
                        localStorage.setItem("access_token", resJson.token)
                        setUserData(resJson.token)
                        // Retry with new token
                        console.log('AuthUtil: Retrying with new token...');
                        return await fetch(url, {
                            ...options,
                            headers:{
                                ...options.headers,
                                'Authorization': `Bearer ${resJson.token}`,
                            }
                        });
                    }
                }
                
                // Refresh failed - clear token and redirect to login
                console.log('AuthUtil: Refresh failed, redirecting to login...');
                if (isCompulsory) {
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("userData");
                    const returnPath = typeof from === "string" ? from : getCurrentReturnPath();
                    localStorage.setItem('from', returnPath);
                    window.location.assign(getLoginUrl(returnPath));
                }
                return { ok: false, status: 401 };
                
            } catch (refreshError) {
                console.error('AuthUtil: Refresh token error:', refreshError);
                if (isCompulsory) {
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("userData");
                    const returnPath = typeof from === "string" ? from : getCurrentReturnPath();
                    localStorage.setItem('from', returnPath);
                    window.location.assign(getLoginUrl(returnPath));
                }
                return { ok: false, status: 401 };
            }
        }
        else{
            console.log("Unknown error fetchWithAuth")
            return res
        }
    }
    else{
        return res
    }
}

export const setUserData = (accessToken) => {
    if (!accessToken || !isValidJWT(accessToken)) {
        console.error('Invalid token format');
        return;
    }
    try{
        var base64Url = accessToken.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload)
        const fallbackUsername = payload.email || payload.preferred_username || payload.name || payload.sub
        const userData = {
            username: payload.username || fallbackUsername,
            avatarUrl: payload.avatarUrl || "",
            fullName: payload.fullName || payload.name || payload.username || fallbackUsername
        }
        localStorage.setItem("userData", JSON.stringify(userData))
    }
    catch(err){
        console.log('setUserData error:', err)
    }
}

export const logout = async () => {
    await fetchWithAuth(`${BASE_API_URL}/v1/auth/logout`, null, false, {
        method: "POST",
        credentials: "include",
    })
    await localStorage.removeItem("access_token")
    await localStorage.removeItem("userData")
    await localStorage.removeItem("cart")
    window.location.assign("/login")
}

export const getJwtUsername = () => {
    const token = localStorage.getItem("access_token");
    if (!token || !isValidJWT(token)) return null;
    try {
        var base64Url = token.split(".")[1];
        var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        var jsonPayload = decodeURIComponent(
            window.atob(base64).split("").map(function (c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            }).join("")
        );
        const payload = JSON.parse(jsonPayload);
        return payload.sub || payload.username || null;
    } catch {
        return null;
    }
}
