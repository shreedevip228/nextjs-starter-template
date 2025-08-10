const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Order = require('../models/Order');
const { authenticateToken, requireOwnershipOrAdmin } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');

const router = express.Router();

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  res.json({
    success: true,
    data: {
      user
    }
  });
}));

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', [
  authenticateToken,
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { name, email, phone, preferences } = req.body;
  const user = await User.findById(req.user._id);

  // Check if email is being changed and if it's already taken
  if (email && email !== user.email) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ValidationError('Email is already taken');
    }
    user.email = email;
    user.isEmailVerified = false;
  }

  // Check if phone is being changed and if it's already taken
  if (phone && phone !== user.phone) {
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      throw new ValidationError('Phone number is already taken');
    }
    user.phone = phone;
    user.isPhoneVerified = false;
  }

  if (name) user.name = name;
  if (preferences) user.preferences = { ...user.preferences, ...preferences };

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user
    }
  });
}));

// @desc    Add user address
// @route   POST /api/users/addresses
// @access  Private
router.post('/addresses', [
  authenticateToken,
  body('type').isIn(['home', 'work', 'other']).withMessage('Address type must be home, work, or other'),
  body('street').notEmpty().withMessage('Street address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('zipCode').notEmpty().withMessage('Zip code is required'),
  body('isDefault').optional().isBoolean().withMessage('isDefault must be a boolean')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { type, street, city, state, zipCode, landmark, isDefault } = req.body;
  const user = await User.findById(req.user._id);

  // If this is set as default, unset other default addresses
  if (isDefault) {
    user.addresses.forEach(addr => {
      addr.isDefault = false;
    });
  }

  // If this is the first address, make it default
  const makeDefault = isDefault || user.addresses.length === 0;

  user.addresses.push({
    type,
    street,
    city,
    state,
    zipCode,
    landmark,
    isDefault: makeDefault
  });

  await user.save();

  res.status(201).json({
    success: true,
    message: 'Address added successfully',
    data: {
      address: user.addresses[user.addresses.length - 1]
    }
  });
}));

// @desc    Update user address
// @route   PUT /api/users/addresses/:addressId
// @access  Private
router.put('/addresses/:addressId', [
  authenticateToken,
  body('type').optional().isIn(['home', 'work', 'other']).withMessage('Address type must be home, work, or other'),
  body('street').optional().notEmpty().withMessage('Street address cannot be empty'),
  body('city').optional().notEmpty().withMessage('City cannot be empty'),
  body('state').optional().notEmpty().withMessage('State cannot be empty'),
  body('zipCode').optional().notEmpty().withMessage('Zip code cannot be empty'),
  body('isDefault').optional().isBoolean().withMessage('isDefault must be a boolean')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);

  if (!address) {
    throw new NotFoundError('Address not found');
  }

  const { type, street, city, state, zipCode, landmark, isDefault } = req.body;

  // If this is set as default, unset other default addresses
  if (isDefault) {
    user.addresses.forEach(addr => {
      if (addr._id.toString() !== req.params.addressId) {
        addr.isDefault = false;
      }
    });
  }

  // Update address fields
  if (type) address.type = type;
  if (street) address.street = street;
  if (city) address.city = city;
  if (state) address.state = state;
  if (zipCode) address.zipCode = zipCode;
  if (landmark !== undefined) address.landmark = landmark;
  if (isDefault !== undefined) address.isDefault = isDefault;

  await user.save();

  res.json({
    success: true,
    message: 'Address updated successfully',
    data: {
      address
    }
  });
}));

// @desc    Delete user address
// @route   DELETE /api/users/addresses/:addressId
// @access  Private
router.delete('/addresses/:addressId', authenticateToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);

  if (!address) {
    throw new NotFoundError('Address not found');
  }

  const wasDefault = address.isDefault;
  user.addresses.pull(req.params.addressId);

  // If deleted address was default, make the first remaining address default
  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();

  res.json({
    success: true,
    message: 'Address deleted successfully'
  });
}));

// @desc    Get user's order history
// @route   GET /api/users/order-history
// @access  Private
router.get('/order-history', authenticateToken, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

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

// @desc    Get user's favorite restaurants
// @route   GET /api/users/favorites
// @access  Private
router.get('/favorites', authenticateToken, asyncHandler(async (req, res) => {
  // Get restaurants user has ordered from most frequently
  const favoriteRestaurants = await Order.aggregate([
    { $match: { user: req.user._id, status: 'delivered' } },
    { $group: { _id: '$restaurant', orderCount: { $sum: 1 } } },
    { $sort: { orderCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'restaurants',
        localField: '_id',
        foreignField: '_id',
        as: 'restaurant'
      }
    },
    { $unwind: '$restaurant' },
    {
      $project: {
        restaurant: 1,
        orderCount: 1
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      favoriteRestaurants
    }
  });
}));

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await Order.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$pricing.total' },
        averageOrderValue: { $avg: '$pricing.total' },
        deliveredOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        }
      }
    }
  ]);

  const userStats = stats[0] || {
    totalOrders: 0,
    totalSpent: 0,
    averageOrderValue: 0,
    deliveredOrders: 0,
    cancelledOrders: 0
  };

  // Get most ordered cuisine
  const cuisineStats = await Order.aggregate([
    { $match: { user: userId, status: 'delivered' } },
    {
      $lookup: {
        from: 'restaurants',
        localField: 'restaurant',
        foreignField: '_id',
        as: 'restaurant'
      }
    },
    { $unwind: '$restaurant' },
    { $unwind: '$restaurant.cuisine' },
    { $group: { _id: '$restaurant.cuisine', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  res.json({
    success: true,
    data: {
      orderStats: userStats,
      topCuisines: cuisineStats,
      memberSince: req.user.createdAt
    }
  });
}));

// @desc    Update user preferences
// @route   PUT /api/users/preferences
// @access  Private
router.put('/preferences', [
  authenticateToken,
  body('cuisine').optional().isArray().withMessage('Cuisine must be an array'),
  body('dietaryRestrictions').optional().isArray().withMessage('Dietary restrictions must be an array'),
  body('notifications.email').optional().isBoolean().withMessage('Email notification preference must be boolean'),
  body('notifications.sms').optional().isBoolean().withMessage('SMS notification preference must be boolean'),
  body('notifications.push').optional().isBoolean().withMessage('Push notification preference must be boolean')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const user = await User.findById(req.user._id);
  
  // Update preferences
  if (req.body.cuisine) user.preferences.cuisine = req.body.cuisine;
  if (req.body.dietaryRestrictions) user.preferences.dietaryRestrictions = req.body.dietaryRestrictions;
  if (req.body.notifications) {
    user.preferences.notifications = {
      ...user.preferences.notifications,
      ...req.body.notifications
    };
  }

  await user.save();

  res.json({
    success: true,
    message: 'Preferences updated successfully',
    data: {
      preferences: user.preferences
    }
  });
}));

// @desc    Deactivate user account
// @route   PATCH /api/users/deactivate
// @access  Private
router.patch('/deactivate', [
  authenticateToken,
  body('reason').optional().isString().withMessage('Reason must be a string')
], asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  user.isActive = false;
  await user.save();

  res.json({
    success: true,
    message: 'Account deactivated successfully'
  });
}));

// @desc    Get user by ID (Admin only)
// @route   GET /api/users/:id
// @access  Private (Admin)
router.get('/:id', [
  authenticateToken,
  requireOwnershipOrAdmin('id')
], asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json({
    success: true,
    data: {
      user
    }
  });
}));

module.exports = router;
