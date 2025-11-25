import axios from "axios";

// Tạo instance
const API = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL + "/api",
});

// Thêm access token vào mọi request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// Response interceptor để tự động refresh token
API.interceptors.response.use(
  res => res,
  async (err) => {
    const originalReq = err.config;

    // Nếu lỗi 401 và chưa retry
    if (err.response?.status === 401 && !originalReq._retry) {
      originalReq._retry = true;

      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(err);
      }

      try {
        // Gọi refresh token
        const r = await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } }
        );

        // Lưu access token mới
        localStorage.setItem("access_token", r.data.access_token);

        // Update headers request cũ
        originalReq.headers["Authorization"] = `Bearer ${r.data.access_token}`;

        // Retry request bằng chính API instance
        return API(originalReq);
      } catch (refreshErr) {
        // Refresh token hết hạn → logout
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(err);
  }
);

export default API;
