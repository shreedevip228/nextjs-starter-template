import axios from 'axios'
import toast from 'react-hot-toast'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    // Handle different error scenarios
    if (error.response) {
      const { status, data } = error.response
      
      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('token')
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
          break
        case 403:
          // Forbidden
          toast.error('Access denied')
          break
        case 404:
          // Not found
          toast.error('Resource not found')
          break
        case 429:
          // Rate limited
          toast.error('Too many requests. Please try again later.')
          break
        case 500:
          // Server error
          toast.error('Server error. Please try again later.')
          break
        default:
          // Other errors
          if (data?.message) {
            toast.error(data.message)
          }
      }
      
      return Promise.reject(error)
    } else if (error.request) {
      // Network error
      toast.error('Network error. Please check your connection.')
      return Promise.reject(error)
    } else {
      // Other error
      toast.error('An unexpected error occurred')
      return Promise.reject(error)
    }
  }
)

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (userData) => api.put('/auth/profile', userData),
  changePassword: (passwordData) => api.put('/auth/change-password', passwordData),
  forgotPassword: (email) => api.post('/auth/forgot-password', email),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  verifyPhoneOTP: (data) => api.post('/auth/verify-phone', data),
  resendOTP: () => api.post('/auth/resend-otp'),
}

// Restaurant API
export const restaurantAPI = {
  getAll: (params) => api.get('/restaurants', { params }),
  getById: (id) => api.get(`/restaurants/${id}`),
  getNearby: (params) => api.get('/restaurants/location/nearby', { params }),
  create: (data) => api.post('/restaurants', data),
  update: (id, data) => api.put(`/restaurants/${id}`, data),
  delete: (id) => api.delete(`/restaurants/${id}`),
  getStats: (id, params) => api.get(`/restaurants/${id}/stats`, { params }),
  updateStatus: (id, status) => api.patch(`/restaurants/${id}/status`, { status }),
}

// Menu API
export const menuAPI = {
  getByRestaurant: (restaurantId, params) => 
    api.get(`/menu/restaurant/${restaurantId}`, { params }),
  getById: (id) => api.get(`/menu/${id}`),
  create: (data) => api.post('/menu', data),
  update: (id, data) => api.put(`/menu/${id}`, data),
  delete: (id) => api.delete(`/menu/${id}`),
  updateAvailability: (id, data) => api.patch(`/menu/${id}/availability`, data),
  getPopular: (restaurantId, params) => 
    api.get(`/menu/restaurant/${restaurantId}/popular`, { params }),
  getRecommended: (restaurantId, params) => 
    api.get(`/menu/restaurant/${restaurantId}/recommended`, { params }),
  search: (params) => api.get('/menu/search', { params }),
  bulkUpdateStatus: (data) => api.patch('/menu/bulk-status', data),
}

// Order API
export const orderAPI = {
  create: (data) => api.post('/orders', data),
  getMyOrders: (params) => api.get('/orders/my-orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data),
  cancel: (id, data) => api.patch(`/orders/${id}/cancel`, data),
  rate: (id, data) => api.post(`/orders/${id}/rate`, data),
  getRestaurantOrders: (restaurantId, params) => 
    api.get(`/orders/restaurant/${restaurantId}`, { params }),
  getTracking: (id) => api.get(`/orders/${id}/tracking`),
}

// User API
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  addAddress: (data) => api.post('/users/addresses', data),
  updateAddress: (addressId, data) => api.put(`/users/addresses/${addressId}`, data),
  deleteAddress: (addressId) => api.delete(`/users/addresses/${addressId}`),
  getOrderHistory: (params) => api.get('/users/order-history', { params }),
  getFavorites: () => api.get('/users/favorites'),
  getStats: () => api.get('/users/stats'),
  updatePreferences: (data) => api.put('/users/preferences', data),
  deactivate: (data) => api.patch('/users/deactivate', data),
  getById: (id) => api.get(`/users/${id}`),
}

// Review API
export const reviewAPI = {
  getByRestaurant: (restaurantId, params) => 
    api.get(`/reviews/restaurant/${restaurantId}`, { params }),
  getById: (id) => api.get(`/reviews/${id}`),
  create: (data) => api.post('/reviews', data),
  update: (id, data) => api.put(`/reviews/${id}`, data),
  delete: (id) => api.delete(`/reviews/${id}`),
  markHelpful: (id) => api.post(`/reviews/${id}/helpful`),
  report: (id, data) => api.post(`/reviews/${id}/report`, data),
  addResponse: (id, data) => api.post(`/reviews/${id}/response`, data),
  getMyReviews: (params) => api.get('/reviews/my-reviews', { params }),
  getTop: (params) => api.get('/reviews/top', { params }),
  getRecent: (params) => api.get('/reviews/recent', { params }),
}

// Admin API
export const adminAPI = {
  getDashboard: (params) => api.get('/admin/dashboard', { params }),
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUserStatus: (id, data) => api.patch(`/admin/users/${id}/status`, data),
  getRestaurants: (params) => api.get('/admin/restaurants', { params }),
  approveRestaurant: (id, data) => api.patch(`/admin/restaurants/${id}/approval`, data),
  getOrders: (params) => api.get('/admin/orders', { params }),
  getRevenueAnalytics: (params) => api.get('/admin/analytics/revenue', { params }),
  getUserAnalytics: (params) => api.get('/admin/analytics/users', { params }),
  getReportedReviews: (params) => api.get('/admin/reviews/reported', { params }),
  moderateReview: (id, data) => api.patch(`/admin/reviews/${id}/moderate`, data),
  getSettings: () => api.get('/admin/settings'),
}

// File upload utility
export const uploadFile = async (file, type = 'image') => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', type)
  
  try {
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response
  } catch (error) {
    toast.error('File upload failed')
    throw error
  }
}

// Utility functions
export const apiUtils = {
  // Format error message from API response
  getErrorMessage: (error) => {
    if (error.response?.data?.message) {
      return error.response.data.message
    }
    if (error.message) {
      return error.message
    }
    return 'An unexpected error occurred'
  },
  
  // Check if error is network related
  isNetworkError: (error) => {
    return !error.response && error.request
  },
  
  // Check if error is server related
  isServerError: (error) => {
    return error.response?.status >= 500
  },
  
  // Check if error is client related
  isClientError: (error) => {
    return error.response?.status >= 400 && error.response?.status < 500
  },
  
  // Retry API call with exponential backoff
  retryWithBackoff: async (apiCall, maxRetries = 3, baseDelay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await apiCall()
      } catch (error) {
        if (i === maxRetries - 1 || apiUtils.isClientError(error)) {
          throw error
        }
        
        const delay = baseDelay * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  },
  
  // Cancel token for request cancellation
  createCancelToken: () => axios.CancelToken.source(),
  
  // Check if request was cancelled
  isCancel: (error) => axios.isCancel(error),
}

// Export default api instance
export default api
