// src/utils/axios.js
import axios from "axios";

// Lấy base URL từ biến môi trường, fallback về localhost khi dev
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const API = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor - Thêm access token vào mọi request
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor - Tự động refresh token khi 401
API.interceptors.response.use(
  (response) => {
    // Response thành công, trả về như bình thường
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Nếu lỗi 401 (Unauthorized) và chưa retry lần nào
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Nếu đang ở trang auth, không cần refresh token
      const authUrls = ["/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password"];
      if (authUrls.some(url => originalRequest.url?.includes(url))) {
        // Trả về lỗi để component tự xử lý
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem("refresh_token");
      
      if (!refreshToken) {
        // Không có refresh token -> logout
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        // Gọi API refresh token (dùng axios gốc để tránh loop)
        const response = await axios.post(
          `${BACKEND_URL}/api/auth/refresh`,
          {},
          { 
            headers: { 
              Authorization: `Bearer ${refreshToken}` 
            } 
          }
        );

        // Lưu access token mới
        const newAccessToken = response.data.access_token;
        localStorage.setItem("access_token", newAccessToken);

        // Gắn token mới vào request cũ
        originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;

        // Retry lại request ban đầu bằng instance API
        return API(originalRequest);
      } catch (refreshError) {
        // Refresh token hết hạn -> logout
        console.error("Refresh token expired:", refreshError);
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    // QUAN TRỌNG: Luôn reject error để component có thể catch
    // Không reload trang, chỉ trả về error
    return Promise.reject(error);
  }
);

export default API;