import axios from 'axios';

// Always go through Nginx
const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eenera_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('eenera_token');
      localStorage.removeItem('eenera_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;