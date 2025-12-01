// src/untils/axios.js
import axios from "axios";

// Lấy base URL từ biến môi trường, fallback về localhost khi dev
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const API = axios.create({
  baseURL: `${BACKEND_URL}/api`,
});

// Thêm access token vào mọi request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor để tự động refresh token khi 401
API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalReq = err.config;

    // Nếu lỗi 401 và chưa retry lần nào
    if (err.response?.status === 401 && !originalReq._retry) {
      originalReq._retry = true;

      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        // Không có refresh token -> logout
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(err);
      }

      try {
        // Gọi API refresh token (dùng axios gốc, không dùng instance để tránh loop)
        const r = await axios.post(
          `${BACKEND_URL}/api/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } }
        );

        // Lưu access token mới
        localStorage.setItem("access_token", r.data.access_token);

        // Gắn token mới vào request cũ
        originalReq.headers["Authorization"] = `Bearer ${r.data.access_token}`;

        // Retry lại request ban đầu bằng instance API
        return API(originalReq);
      } catch (refreshErr) {
        // Refresh token hết hạn → xóa hết & chuyển về login
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      }
    }

    // Các lỗi khác trả về như bình thường
    return Promise.reject(err);
  }
);

export default API;
