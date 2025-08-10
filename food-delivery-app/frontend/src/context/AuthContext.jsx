import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

// Initial state
const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,
  isAuthenticated: false,
}

// Action types
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  UPDATE_USER: 'UPDATE_USER',
  CLEAR_ERROR: 'CLEAR_ERROR',
}

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      }
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      }
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      }
    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      }
    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      }
    default:
      return state
  }
}

// Create context
const AuthContext = createContext()

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      
      if (!token) {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })
        return
      }

      try {
        const response = await authAPI.getProfile()
        
        if (response.success) {
          dispatch({
            type: AUTH_ACTIONS.LOGIN_SUCCESS,
            payload: {
              user: response.data.user,
              token,
            },
          })
        } else {
          // Invalid token, remove it
          localStorage.removeItem('token')
          dispatch({ type: AUTH_ACTIONS.LOGOUT })
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        localStorage.removeItem('token')
        dispatch({ type: AUTH_ACTIONS.LOGOUT })
      }
    }

    checkAuth()
  }, [])

  // Login function
  const login = async (credentials) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true })
      
      const response = await authAPI.login(credentials)
      
      if (response.success) {
        const { user, token } = response.data
        
        // Store token in localStorage
        localStorage.setItem('token', token)
        
        // Update state
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user, token },
        })
        
        toast.success(`Welcome back, ${user.name}!`)
        return { success: true }
      } else {
        toast.error(response.message || 'Login failed')
        return { success: false, message: response.message }
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed. Please try again.'
      toast.error(message)
      return { success: false, message }
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })
    }
  }

  // Register function
  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true })
      
      const response = await authAPI.register(userData)
      
      if (response.success) {
        const { user, token } = response.data
        
        // Store token in localStorage
        localStorage.setItem('token', token)
        
        // Update state
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user, token },
        })
        
        toast.success(`Welcome to FoodDelivery, ${user.name}!`)
        return { success: true }
      } else {
        toast.error(response.message || 'Registration failed')
        return { success: false, message: response.message }
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed. Please try again.'
      toast.error(message)
      return { success: false, message }
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false })
    }
  }

  // Logout function
  const logout = async () => {
    try {
      // Call logout API
      await authAPI.logout()
    } catch (error) {
      console.error('Logout API call failed:', error)
    } finally {
      // Clear local storage and state regardless of API call result
      localStorage.removeItem('token')
      dispatch({ type: AUTH_ACTIONS.LOGOUT })
      toast.success('Logged out successfully')
    }
  }

  // Update user profile
  const updateProfile = async (userData) => {
    try {
      const response = await authAPI.updateProfile(userData)
      
      if (response.success) {
        dispatch({
          type: AUTH_ACTIONS.UPDATE_USER,
          payload: response.data.user,
        })
        toast.success('Profile updated successfully')
        return { success: true }
      } else {
        toast.error(response.message || 'Profile update failed')
        return { success: false, message: response.message }
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed'
      toast.error(message)
      return { success: false, message }
    }
  }

  // Change password
  const changePassword = async (passwordData) => {
    try {
      const response = await authAPI.changePassword(passwordData)
      
      if (response.success) {
        toast.success('Password changed successfully')
        return { success: true }
      } else {
        toast.error(response.message || 'Password change failed')
        return { success: false, message: response.message }
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Password change failed'
      toast.error(message)
      return { success: false, message }
    }
  }

  // Forgot password
  const forgotPassword = async (email) => {
    try {
      const response = await authAPI.forgotPassword({ email })
      
      if (response.success) {
        toast.success('Password reset link sent to your email')
        return { success: true }
      } else {
        toast.error(response.message || 'Failed to send reset link')
        return { success: false, message: response.message }
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to send reset link'
      toast.error(message)
      return { success: false, message }
    }
  }

  // Reset password
  const resetPassword = async (token, password) => {
    try {
      const response = await authAPI.resetPassword({ token, password })
      
      if (response.success) {
        const { user, token: authToken } = response.data
        
        // Store token and update state
        localStorage.setItem('token', authToken)
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user, token: authToken },
        })
        
        toast.success('Password reset successfully')
        return { success: true }
      } else {
        toast.error(response.message || 'Password reset failed')
        return { success: false, message: response.message }
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Password reset failed'
      toast.error(message)
      return { success: false, message }
    }
  }

  // Verify phone OTP
  const verifyPhoneOTP = async (otp) => {
    try {
      const response = await authAPI.verifyPhoneOTP({ otp })
      
      if (response.success) {
        dispatch({
          type: AUTH_ACTIONS.UPDATE_USER,
          payload: response.data.user,
        })
        toast.success('Phone number verified successfully')
        return { success: true }
      } else {
        toast.error(response.message || 'OTP verification failed')
        return { success: false, message: response.message }
      }
    } catch (error) {
      const message = error.response?.data?.message || 'OTP verification failed'
      toast.error(message)
      return { success: false, message }
    }
  }

  // Resend OTP
  const resendOTP = async () => {
    try {
      const response = await authAPI.resendOTP()
      
      if (response.success) {
        toast.success('OTP sent successfully')
        return { success: true }
      } else {
        toast.error(response.message || 'Failed to send OTP')
        return { success: false, message: response.message }
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to send OTP'
      toast.error(message)
      return { success: false, message }
    }
  }

  // Context value
  const value = {
    // State
    user: state.user,
    token: state.token,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    
    // Actions
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyPhoneOTP,
    resendOTP,
    
    // Utility functions
    isAdmin: () => state.user?.role === 'admin',
    isRestaurantOwner: () => state.user?.role === 'restaurant_owner',
    isUser: () => state.user?.role === 'user',
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext)
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
}

export default AuthContext
