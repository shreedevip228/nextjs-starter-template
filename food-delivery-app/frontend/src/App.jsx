import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Layout components
import Layout from './components/layout/Layout'
import AdminLayout from './components/layout/AdminLayout'
import RestaurantLayout from './components/layout/RestaurantLayout'

// Loading component
import LoadingSpinner from './components/ui/LoadingSpinner'

// Lazy load pages for better performance
const Home = lazy(() => import('./pages/Home'))
const Restaurants = lazy(() => import('./pages/Restaurants'))
const RestaurantDetail = lazy(() => import('./pages/RestaurantDetail'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderTracking = lazy(() => import('./pages/OrderTracking'))
const Profile = lazy(() => import('./pages/Profile'))
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const AdminRestaurants = lazy(() => import('./pages/admin/Restaurants'))
const AdminOrders = lazy(() => import('./pages/admin/Orders'))
const AdminReviews = lazy(() => import('./pages/admin/Reviews'))
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics'))

// Restaurant owner pages
const RestaurantDashboard = lazy(() => import('./pages/restaurant/Dashboard'))
const RestaurantMenu = lazy(() => import('./pages/restaurant/Menu'))
const RestaurantOrders = lazy(() => import('./pages/restaurant/Orders'))
const RestaurantProfile = lazy(() => import('./pages/restaurant/Profile'))
const RestaurantAnalytics = lazy(() => import('./pages/restaurant/Analytics'))

// Error pages
const NotFound = lazy(() => import('./pages/NotFound'))
const Unauthorized = lazy(() => import('./pages/Unauthorized'))

// Protected Route component
const ProtectedRoute = ({ children, requiredRole = null, redirectTo = '/login' }) => {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

// Public Route component (redirect if already authenticated)
const PublicRoute = ({ children, redirectTo = '/' }) => {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (user) {
    // Redirect based on user role
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />
    } else if (user.role === 'restaurant_owner') {
      return <Navigate to="/restaurant" replace />
    } else {
      return <Navigate to={redirectTo} replace />
    }
  }

  return children
}

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-secondary-600">Loading...</p>
    </div>
  </div>
)

function App() {
  return (
    <div className="App">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } />
          <Route path="/forgot-password" element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          } />
          <Route path="/reset-password" element={
            <PublicRoute>
              <ResetPassword />
            </PublicRoute>
          } />

          {/* Main App Routes */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="restaurants" element={<Restaurants />} />
            <Route path="restaurants/:id" element={<RestaurantDetail />} />
            <Route path="cart" element={<Cart />} />
            
            {/* Protected User Routes */}
            <Route path="checkout" element={
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            } />
            <Route path="orders" element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            } />
            <Route path="orders/:id/track" element={
              <ProtectedRoute>
                <OrderTracking />
              </ProtectedRoute>
            } />
            <Route path="profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="restaurants" element={<AdminRestaurants />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="analytics" element={<AdminAnalytics />} />
          </Route>

          {/* Restaurant Owner Routes */}
          <Route path="/restaurant" element={
            <ProtectedRoute requiredRole="restaurant_owner">
              <RestaurantLayout />
            </ProtectedRoute>
          }>
            <Route index element={<RestaurantDashboard />} />
            <Route path="menu" element={<RestaurantMenu />} />
            <Route path="orders" element={<RestaurantOrders />} />
            <Route path="profile" element={<RestaurantProfile />} />
            <Route path="analytics" element={<RestaurantAnalytics />} />
          </Route>

          {/* Error Routes */}
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default App
