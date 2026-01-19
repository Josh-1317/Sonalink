import axios from 'axios';

// Base URL must match your running backend server port
const API_BASE_URL = 'http://localhost:3001/api'; 

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach the JWT Token to every request
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); 

    if (token) {
      config.headers.Authorization = `Bearer ${token}`; 
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Optional: Global error handler for token expiration (401/403)
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.error("Token expired or unauthorized. Redirecting to login.");
      localStorage.removeItem('token');
      // In a real app, you'd use a router hook here:
      // window.location.href = '/auth/login'; 
    }
    return Promise.reject(error);
  }
);

export default axiosClient;