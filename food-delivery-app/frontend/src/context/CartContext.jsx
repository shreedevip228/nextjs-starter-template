import React, { createContext, useContext, useReducer, useEffect } from 'react'
import toast from 'react-hot-toast'

// Initial state
const initialState = {
  items: [],
  restaurant: null,
  subtotal: 0,
  deliveryFee: 0,
  tax: 0,
  total: 0,
  isOpen: false,
}

// Action types
const CART_ACTIONS = {
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
  SET_RESTAURANT: 'SET_RESTAURANT',
  TOGGLE_CART: 'TOGGLE_CART',
  LOAD_CART: 'LOAD_CART',
}

// Helper function to calculate totals
const calculateTotals = (items, deliveryFee = 0) => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const tax = subtotal * 0.08 // 8% tax
  const total = subtotal + deliveryFee + tax
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  }
}

// Helper function to generate item key for comparison
const getItemKey = (item) => {
  const customizations = item.customizations || []
  const addOns = item.addOns || []
  
  const customizationKey = customizations
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => `${c.name}:${c.selectedOption}`)
    .join('|')
  
  const addOnKey = addOns
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(a => `${a.name}:${a.quantity}`)
    .join('|')
  
  return `${item.menuItem._id}|${customizationKey}|${addOnKey}`
}

// Reducer
const cartReducer = (state, action) => {
  switch (action.type) {
    case CART_ACTIONS.ADD_ITEM: {
      const newItem = action.payload
      const itemKey = getItemKey(newItem)
      
      // Check if item with same customizations already exists
      const existingItemIndex = state.items.findIndex(item => getItemKey(item) === itemKey)
      
      let updatedItems
      if (existingItemIndex >= 0) {
        // Update quantity of existing item
        updatedItems = state.items.map((item, index) =>
          index === existingItemIndex
            ? { ...item, quantity: item.quantity + newItem.quantity }
            : item
        )
      } else {
        // Add new item
        updatedItems = [...state.items, { ...newItem, id: Date.now() }]
      }
      
      const totals = calculateTotals(updatedItems, state.deliveryFee)
      
      return {
        ...state,
        items: updatedItems,
        ...totals,
      }
    }
    
    case CART_ACTIONS.REMOVE_ITEM: {
      const updatedItems = state.items.filter(item => item.id !== action.payload)
      const totals = calculateTotals(updatedItems, state.deliveryFee)
      
      // Clear restaurant if no items left
      const restaurant = updatedItems.length > 0 ? state.restaurant : null
      const deliveryFee = updatedItems.length > 0 ? state.deliveryFee : 0
      
      return {
        ...state,
        items: updatedItems,
        restaurant,
        deliveryFee,
        ...calculateTotals(updatedItems, deliveryFee),
      }
    }
    
    case CART_ACTIONS.UPDATE_QUANTITY: {
      const { itemId, quantity } = action.payload
      
      if (quantity <= 0) {
        // Remove item if quantity is 0 or less
        const updatedItems = state.items.filter(item => item.id !== itemId)
        const totals = calculateTotals(updatedItems, state.deliveryFee)
        
        // Clear restaurant if no items left
        const restaurant = updatedItems.length > 0 ? state.restaurant : null
        const deliveryFee = updatedItems.length > 0 ? state.deliveryFee : 0
        
        return {
          ...state,
          items: updatedItems,
          restaurant,
          deliveryFee,
          ...calculateTotals(updatedItems, deliveryFee),
        }
      }
      
      const updatedItems = state.items.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
      
      const totals = calculateTotals(updatedItems, state.deliveryFee)
      
      return {
        ...state,
        items: updatedItems,
        ...totals,
      }
    }
    
    case CART_ACTIONS.CLEAR_CART:
      return {
        ...initialState,
        isOpen: state.isOpen,
      }
    
    case CART_ACTIONS.SET_RESTAURANT: {
      const restaurant = action.payload
      const deliveryFee = restaurant?.deliveryInfo?.deliveryFee || 0
      const totals = calculateTotals(state.items, deliveryFee)
      
      return {
        ...state,
        restaurant,
        deliveryFee,
        ...totals,
      }
    }
    
    case CART_ACTIONS.TOGGLE_CART:
      return {
        ...state,
        isOpen: !state.isOpen,
      }
    
    case CART_ACTIONS.LOAD_CART: {
      const cartData = action.payload
      const totals = calculateTotals(cartData.items, cartData.deliveryFee)
      
      return {
        ...cartData,
        ...totals,
      }
    }
    
    default:
      return state
  }
}

// Create context
const CartContext = createContext()

// Cart provider component
export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState)

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('cart')
    if (savedCart) {
      try {
        const cartData = JSON.parse(savedCart)
        dispatch({ type: CART_ACTIONS.LOAD_CART, payload: cartData })
      } catch (error) {
        console.error('Failed to load cart from localStorage:', error)
        localStorage.removeItem('cart')
      }
    }
  }, [])

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (state.items.length > 0 || state.restaurant) {
      localStorage.setItem('cart', JSON.stringify({
        items: state.items,
        restaurant: state.restaurant,
        deliveryFee: state.deliveryFee,
      }))
    } else {
      localStorage.removeItem('cart')
    }
  }, [state.items, state.restaurant, state.deliveryFee])

  // Add item to cart
  const addItem = (menuItem, quantity = 1, customizations = [], addOns = [], specialInstructions = '') => {
    // Check if adding from different restaurant
    if (state.restaurant && state.restaurant._id !== menuItem.restaurant._id) {
      const confirmSwitch = window.confirm(
        `Your cart contains items from ${state.restaurant.name}. Adding items from ${menuItem.restaurant.name} will clear your current cart. Continue?`
      )
      
      if (!confirmSwitch) {
        return false
      }
      
      // Clear cart and set new restaurant
      dispatch({ type: CART_ACTIONS.CLEAR_CART })
      dispatch({ type: CART_ACTIONS.SET_RESTAURANT, payload: menuItem.restaurant })
    } else if (!state.restaurant) {
      // Set restaurant if cart is empty
      dispatch({ type: CART_ACTIONS.SET_RESTAURANT, payload: menuItem.restaurant })
    }

    // Calculate item price with customizations and add-ons
    let itemPrice = menuItem.price
    
    // Add customization prices
    customizations.forEach(customization => {
      const customizationConfig = menuItem.customizations?.find(c => c.name === customization.name)
      if (customizationConfig) {
        const selectedOption = customizationConfig.options.find(o => o.name === customization.selectedOption)
        if (selectedOption) {
          itemPrice += selectedOption.price
        }
      }
    })
    
    // Add add-on prices
    addOns.forEach(addOn => {
      const addOnConfig = menuItem.addOns?.find(a => a.name === addOn.name)
      if (addOnConfig) {
        itemPrice += addOnConfig.price * (addOn.quantity || 1)
      }
    })

    const cartItem = {
      menuItem,
      quantity,
      price: itemPrice,
      customizations,
      addOns,
      specialInstructions,
    }

    dispatch({ type: CART_ACTIONS.ADD_ITEM, payload: cartItem })
    
    toast.success(`${menuItem.name} added to cart`)
    return true
  }

  // Remove item from cart
  const removeItem = (itemId) => {
    dispatch({ type: CART_ACTIONS.REMOVE_ITEM, payload: itemId })
    toast.success('Item removed from cart')
  }

  // Update item quantity
  const updateQuantity = (itemId, quantity) => {
    dispatch({ type: CART_ACTIONS.UPDATE_QUANTITY, payload: { itemId, quantity } })
  }

  // Clear entire cart
  const clearCart = () => {
    dispatch({ type: CART_ACTIONS.CLEAR_CART })
    toast.success('Cart cleared')
  }

  // Toggle cart visibility
  const toggleCart = () => {
    dispatch({ type: CART_ACTIONS.TOGGLE_CART })
  }

  // Open cart
  const openCart = () => {
    if (!state.isOpen) {
      dispatch({ type: CART_ACTIONS.TOGGLE_CART })
    }
  }

  // Close cart
  const closeCart = () => {
    if (state.isOpen) {
      dispatch({ type: CART_ACTIONS.TOGGLE_CART })
    }
  }

  // Get cart summary
  const getCartSummary = () => ({
    itemCount: state.items.reduce((sum, item) => sum + item.quantity, 0),
    uniqueItemCount: state.items.length,
    subtotal: state.subtotal,
    deliveryFee: state.deliveryFee,
    tax: state.tax,
    total: state.total,
    restaurant: state.restaurant,
  })

  // Check if cart meets minimum order requirement
  const meetsMinimumOrder = () => {
    if (!state.restaurant?.deliveryInfo?.minimumOrder) return true
    return state.subtotal >= state.restaurant.deliveryInfo.minimumOrder
  }

  // Get minimum order amount needed
  const getMinimumOrderDeficit = () => {
    if (!state.restaurant?.deliveryInfo?.minimumOrder) return 0
    const deficit = state.restaurant.deliveryInfo.minimumOrder - state.subtotal
    return Math.max(0, deficit)
  }

  // Context value
  const value = {
    // State
    items: state.items,
    restaurant: state.restaurant,
    subtotal: state.subtotal,
    deliveryFee: state.deliveryFee,
    tax: state.tax,
    total: state.total,
    isOpen: state.isOpen,
    
    // Actions
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    toggleCart,
    openCart,
    closeCart,
    
    // Utility functions
    getCartSummary,
    meetsMinimumOrder,
    getMinimumOrderDeficit,
    isEmpty: state.items.length === 0,
    itemCount: state.items.reduce((sum, item) => sum + item.quantity, 0),
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

// Custom hook to use cart context
export const useCart = () => {
  const context = useContext(CartContext)
  
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  
  return context
}

export default CartContext
