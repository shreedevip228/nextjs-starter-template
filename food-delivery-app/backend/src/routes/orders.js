const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const { authenticateToken, requireRestaurantOwner, requireAdmin } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError, AuthorizationError, PaymentError } = require('../middleware/errorHandler');

const router = express.Router();

// Mock payment processing functions
const processPayment = async (paymentMethod, amount, paymentDetails) => {
  // Mock payment processing - in production, integrate with actual payment gateways
  console.log(`Processing ${paymentMethod} payment of $${amount}`);
  
  // Simulate payment processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock success/failure (90% success rate)
  const isSuccess = Math.random() > 0.1;
  
  if (isSuccess) {
    return {
      success: true,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed',
      gateway: paymentMethod === 'card' ? 'stripe' : 'razorpay'
    };
  } else {
    throw new PaymentError('Payment processing failed. Please try again.');
  }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
router.post('/', [
  authenticateToken,
  body('restaurant').isMongoId().withMessage('Valid restaurant ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.menuItem').isMongoId().withMessage('Valid menu item ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('deliveryAddress.street').notEmpty().withMessage('Street address is required'),
  body('deliveryAddress.city').notEmpty().withMessage('City is required'),
  body('deliveryAddress.state').notEmpty().withMessage('State is required'),
  body('deliveryAddress.zipCode').notEmpty().withMessage('Zip code is required'),
  body('contactInfo.phone').isMobilePhone().withMessage('Valid phone number is required'),
  body('paymentInfo.method').isIn(['card', 'upi', 'wallet', 'cash_on_delivery']).withMessage('Valid payment method is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const {
    restaurant: restaurantId,
    items,
    deliveryAddress,
    contactInfo,
    paymentInfo,
    specialRequests,
    isScheduled,
    scheduledFor
  } = req.body;

  // Verify restaurant exists and is active
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant || restaurant.status !== 'active') {
    throw new NotFoundError('Restaurant not found or not available');
  }

  // Verify all menu items exist and are available
  const menuItemIds = items.map(item => item.menuItem);
  const menuItems = await MenuItem.find({
    _id: { $in: menuItemIds },
    restaurant: restaurantId,
    status: 'active'
  });

  if (menuItems.length !== menuItemIds.length) {
    throw new ValidationError('Some menu items are not available');
  }

  // Calculate pricing
  let subtotal = 0;
  const orderItems = [];

  for (const orderItem of items) {
    const menuItem = menuItems.find(item => item._id.toString() === orderItem.menuItem);
    
    if (!menuItem.isCurrentlyAvailable) {
      throw new ValidationError(`${menuItem.name} is currently not available`);
    }

    // Check quantity availability
    if (menuItem.availability.availableQuantity !== null && 
        menuItem.availability.availableQuantity < orderItem.quantity) {
      throw new ValidationError(`Only ${menuItem.availability.availableQuantity} ${menuItem.name} available`);
    }

    // Calculate item total with customizations and add-ons
    const itemPrice = menuItem.calculatePrice(
      orderItem.customizations || [],
      orderItem.addOns || []
    );
    const itemTotal = itemPrice * orderItem.quantity;
    subtotal += itemTotal;

    orderItems.push({
      menuItem: menuItem._id,
      name: menuItem.name,
      price: itemPrice,
      quantity: orderItem.quantity,
      customizations: orderItem.customizations || [],
      addOns: orderItem.addOns || [],
      specialInstructions: orderItem.specialInstructions || '',
      itemTotal
    });
  }

  // Check minimum order amount
  if (subtotal < restaurant.deliveryInfo.minimumOrder) {
    throw new ValidationError(
      `Minimum order amount is $${restaurant.deliveryInfo.minimumOrder}`
    );
  }

  // Calculate additional charges
  const deliveryFee = restaurant.deliveryInfo.deliveryFee;
  const tax = subtotal * 0.08; // 8% tax
  const discount = 0; // Apply coupon logic here if needed
  const tip = req.body.tip || 0;
  const total = subtotal + deliveryFee + tax - discount + tip;

  // Create order
  const orderData = {
    user: req.user._id,
    restaurant: restaurantId,
    items: orderItems,
    pricing: {
      subtotal,
      deliveryFee,
      tax,
      discount: { amount: discount },
      tip,
      total
    },
    deliveryAddress,
    contactInfo,
    paymentInfo: {
      method: paymentInfo.method,
      status: 'pending'
    },
    specialRequests,
    isScheduled: isScheduled || false,
    scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    estimatedDeliveryTime: new Date(Date.now() + 45 * 60000) // 45 minutes from now
  };

  const order = await Order.create(orderData);

  // Process payment (except for cash on delivery)
  if (paymentInfo.method !== 'cash_on_delivery') {
    try {
      const paymentResult = await processPayment(
        paymentInfo.method,
        total,
        paymentInfo
      );

      order.paymentInfo.status = paymentResult.status;
      order.paymentInfo.transactionId = paymentResult.transactionId;
      order.paymentInfo.paymentGateway = paymentResult.gateway;
      order.paymentInfo.paidAt = new Date();
      
      await order.save();
    } catch (paymentError) {
      // Delete the order if payment fails
      await Order.findByIdAndDelete(order._id);
      throw paymentError;
    }
  }

  // Update menu item quantities
  for (const orderItem of items) {
    const menuItem = menuItems.find(item => item._id.toString() === orderItem.menuItem);
    if (menuItem.availability.availableQuantity !== null) {
      menuItem.availability.availableQuantity -= orderItem.quantity;
      await menuItem.save();
    }
    // Update order count
    menuItem.orderCount += orderItem.quantity;
    await menuItem.save();
  }

  // Update restaurant total orders
  restaurant.totalOrders += 1;
  restaurant.totalRevenue += total;
  await restaurant.save();

  // Populate order for response
  await order.populate([
    { path: 'restaurant', select: 'name images.logo contact' },
    { path: 'items.menuItem', select: 'name images' }
  ]);

  // Emit real-time notification to restaurant
  const io = req.app.get('io');
  io.to(`restaurant-${restaurantId}`).emit('new-order', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    customer: req.user.name,
    total: order.pricing.total,
    itemCount: order.items.length
  });

  res.status(201).json({
    success: true,
    message: 'Order placed successfully',
    data: {
      order
    }
  });
}));

// @desc    Get user's orders
// @route   GET /api/orders/my-orders
// @access  Private
router.get('/my-orders', [
  authenticateToken,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('status').optional().isString().withMessage('Status must be a string')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const {
    page = 1,
    limit = 10,
    status
  } = req.query;

  // Build query
  let query = { user: req.user._id };
  if (status) {
    query.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [orders, totalCount] = await Promise.all([
    Order.find(query)
      .populate('restaurant', 'name images.logo rating')
      .populate('items.menuItem', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Order.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    }
  });
}));

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('restaurant', 'name images contact address operatingHours')
    .populate('items.menuItem', 'name images')
    .populate('user', 'name phone email')
    .populate('deliveryPerson', 'name phone');

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Check if user can access this order
  const canAccess = 
    order.user._id.toString() === req.user._id.toString() ||
    req.user.role === 'admin' ||
    (req.user.role === 'restaurant_owner' && order.restaurant.owner.toString() === req.user._id.toString());

  if (!canAccess) {
    throw new AuthorizationError('You can only access your own orders');
  }

  res.json({
    success: true,
    data: {
      order
    }
  });
}));

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private (Restaurant Owner/Admin)
router.patch('/:id/status', [
  authenticateToken,
  body('status').isIn([
    'pending', 'confirmed', 'preparing', 'ready_for_pickup',
    'out_for_delivery', 'delivered', 'cancelled'
  ]).withMessage('Invalid status'),
  body('note').optional().isString().withMessage('Note must be a string')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { status, note } = req.body;

  const order = await Order.findById(req.params.id).populate('restaurant');

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Check authorization
  const canUpdate = 
    req.user.role === 'admin' ||
    (req.user.role === 'restaurant_owner' && order.restaurant.owner.toString() === req.user._id.toString());

  if (!canUpdate) {
    throw new AuthorizationError('You can only update orders for your own restaurant');
  }

  // Validate status transition
  const validTransitions = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['preparing', 'cancelled'],
    'preparing': ['ready_for_pickup', 'cancelled'],
    'ready_for_pickup': ['out_for_delivery'],
    'out_for_delivery': ['delivered'],
    'delivered': [],
    'cancelled': []
  };

  if (!validTransitions[order.status].includes(status)) {
    throw new ValidationError(`Cannot change status from ${order.status} to ${status}`);
  }

  // Update order status
  await order.updateStatus(status, note, req.user._id);

  // Emit real-time update to customer
  const io = req.app.get('io');
  io.to(`order-${order._id}`).emit('order-status-update', {
    orderId: order._id,
    status: order.status,
    estimatedDeliveryTime: order.estimatedDeliveryTime,
    note
  });

  res.json({
    success: true,
    message: 'Order status updated successfully',
    data: {
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        estimatedDeliveryTime: order.estimatedDeliveryTime
      }
    }
  });
}));

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private
router.patch('/:id/cancel', [
  authenticateToken,
  body('reason').notEmpty().withMessage('Cancellation reason is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { reason } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Check if user can cancel this order
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new AuthorizationError('You can only cancel your own orders');
  }

  // Check if order can be cancelled
  if (!order.canBeCancelled()) {
    throw new ValidationError('Order cannot be cancelled at this stage');
  }

  // Calculate refund amount
  const refundAmount = order.calculateRefundAmount();

  // Update order
  order.status = 'cancelled';
  order.cancellationReason = reason;
  order.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    note: `Cancelled by ${req.user.role === 'admin' ? 'admin' : 'customer'}: ${reason}`,
    updatedBy: req.user._id
  });

  // Process refund if payment was made
  if (order.paymentInfo.status === 'completed' && refundAmount > 0) {
    // Mock refund processing
    order.paymentInfo.status = 'refunded';
    order.paymentInfo.refundedAt = new Date();
    order.paymentInfo.refundAmount = refundAmount;
  }

  await order.save();

  // Restore menu item quantities
  for (const item of order.items) {
    const menuItem = await MenuItem.findById(item.menuItem);
    if (menuItem && menuItem.availability.availableQuantity !== null) {
      menuItem.availability.availableQuantity += item.quantity;
      await menuItem.save();
    }
  }

  // Emit real-time notification
  const io = req.app.get('io');
  io.to(`restaurant-${order.restaurant}`).emit('order-cancelled', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    reason
  });

  res.json({
    success: true,
    message: 'Order cancelled successfully',
    data: {
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        refundAmount
      }
    }
  });
}));

// @desc    Rate order
// @route   POST /api/orders/:id/rate
// @access  Private
router.post('/:id/rate', [
  authenticateToken,
  body('food').isInt({ min: 1, max: 5 }).withMessage('Food rating must be between 1 and 5'),
  body('delivery').isInt({ min: 1, max: 5 }).withMessage('Delivery rating must be between 1 and 5'),
  body('overall').isInt({ min: 1, max: 5 }).withMessage('Overall rating must be between 1 and 5'),
  body('review').optional().isLength({ max: 500 }).withMessage('Review cannot exceed 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { food, delivery, overall, review } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Check if user can rate this order
  if (order.user.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only rate your own orders');
  }

  // Check if order is delivered
  if (order.status !== 'delivered') {
    throw new ValidationError('You can only rate delivered orders');
  }

  // Check if already rated
  if (order.rating.overall) {
    throw new ValidationError('Order has already been rated');
  }

  // Update order rating
  order.rating = {
    food,
    delivery,
    overall,
    review: review || '',
    ratedAt: new Date()
  };

  await order.save();

  // Create review for restaurant
  const Review = require('../models/Review');
  await Review.create({
    user: req.user._id,
    restaurant: order.restaurant,
    order: order._id,
    rating: {
      overall,
      food,
      delivery,
      service: overall, // Use overall rating for service
      packaging: food // Use food rating for packaging
    },
    review: {
      comment: review || 'No comment provided'
    },
    isVerifiedPurchase: true
  });

  res.json({
    success: true,
    message: 'Order rated successfully',
    data: {
      rating: order.rating
    }
  });
}));

// @desc    Get restaurant orders
// @route   GET /api/orders/restaurant/:restaurantId
// @access  Private (Restaurant Owner/Admin)
router.get('/restaurant/:restaurantId', [
  authenticateToken,
  requireRestaurantOwner,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('status').optional().isString().withMessage('Status must be a string'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { restaurantId } = req.params;
  const {
    page = 1,
    limit = 20,
    status,
    startDate,
    endDate
  } = req.query;

  // Verify restaurant exists and user owns it
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  if (req.user.role !== 'admin' && restaurant.owner.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only view orders for your own restaurant');
  }

  // Build query
  let query = { restaurant: restaurantId };
  
  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [orders, totalCount] = await Promise.all([
    Order.find(query)
      .populate('user', 'name phone email')
      .populate('items.menuItem', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Order.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.json({
    success: true,
    data: {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name
      },
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      filters: {
        status,
        startDate,
        endDate
      }
    }
  });
}));

// @desc    Get order tracking info
// @route   GET /api/orders/:id/tracking
// @access  Private
router.get('/:id/tracking', authenticateToken, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('restaurant', 'name address contact')
    .populate('deliveryPerson', 'name phone')
    .select('orderNumber status statusHistory estimatedDeliveryTime actualDeliveryTime deliveryTracking deliveryAddress');

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Check if user can track this order
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new AuthorizationError('You can only track your own orders');
  }

  res.json({
    success: true,
    data: {
      order
    }
  });
}));

module.exports = router;
