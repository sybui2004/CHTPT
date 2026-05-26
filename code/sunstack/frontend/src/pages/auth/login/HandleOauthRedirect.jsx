import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BASE_API_URL } from "../../../constants/index";
import { normalizeReturnPath, setUserData } from '../../../util/AuthUtil';

async function sendApi(code) {
  if (!code) {
    window.location.replace('/login');
    return;
  }

  try {
    const res = await fetch(`${BASE_API_URL}/v1/auth/oauth2/login?provider=google&code=${code}`, {
      method: "POST",
      credentials: "include"
    });

    if (res.status !== 200) throw new Error("OAuth login failed");

    const data = await res.json();
    if (!data?.token) throw new Error("Missing access token");

    localStorage.setItem("access_token", data.token);
    setUserData(data.token);

    const from = normalizeReturnPath(localStorage.getItem('from'));
    localStorage.removeItem('from');
    // Use replace so the one-time OAuth code is not reused from browser history.
    window.location.replace(from);
  } catch (err) {
    alert("Something wrong, please try again!");
    window.location.replace('/login');
  }
}

function HandleRedirect() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  useEffect(() => { sendApi(code); }, []);

  return (
    <p> Redirecting... </p>
  );
}

export default HandleRedirect;
