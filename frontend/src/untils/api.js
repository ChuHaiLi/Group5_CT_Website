import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:5000/api", // backend Flask
});

// Thêm token vào headers
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// Tự động refresh khi 401
API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalReq = err.config;
    if (err.response?.status === 401 && !originalReq._retry) {
      originalReq._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        const res = await axios.post("http://127.0.0.1:5000/api/auth/refresh", {}, {
          headers: { Authorization: `Bearer ${refreshToken}` }
        });
        localStorage.setItem("access_token", res.data.access_token);
        originalReq.headers["Authorization"] = `Bearer ${res.data.access_token}`;
        return axios(originalReq);
      } catch {
        localStorage.clear();
        try {
          window.location.href = "/login";
        } catch (e) {
          // In some test environments jsdom disallows navigation; set a test-only flag
          try {
            window.__TEST_NAV_REDIRECT__ = '/login';
          } catch (_) {}
        }
      }
    }
    return Promise.reject(err);
  }
);

export default API;
