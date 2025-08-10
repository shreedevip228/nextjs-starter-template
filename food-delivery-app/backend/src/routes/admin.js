const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Review = require('../models/Review');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
router.get('/dashboard', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Get overall statistics
  const [
    totalUsers,
    totalRestaurants,
    totalOrders,
    totalRevenue,
    activeRestaurants,
    pendingRestaurants,
    recentOrders,
    topRestaurants,
    userGrowth,
    orderStats
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Restaurant.countDocuments(),
    Order.countDocuments(),
    Order.aggregate([
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]).then(result => result[0]?.total || 0),
    Restaurant.countDocuments({ status: 'active' }),
    Restaurant.countDocuments({ status: 'pending_approval' }),
    Order.find()
      .populate('restaurant', 'name')
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(10),
    Restaurant.find({ status: 'active' })
      .sort({ 'rating.average': -1, totalOrders: -1 })
      .limit(5),
    User.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          role: 'user'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.total' }
        }
      }
    ])
  ]);

  res.json({
    success: true,
    data: {
      overview: {
        totalUsers,
        totalRestaurants,
        totalOrders,
        totalRevenue,
        activeRestaurants,
        pendingRestaurants
      },
      recentOrders,
      topRestaurants,
      charts: {
        userGrowth,
        orderStats
      },
      period: {
        startDate: start,
        endDate: end
      }
    }
  });
}));

// @desc    Get all users with filters
// @route   GET /api/admin/users
// @access  Private (Admin)
router.get('/users', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(['user', 'restaurant_owner', 'admin']).withMessage('Invalid role'),
  query('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  query('search').optional().isString().withMessage('Search must be a string')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const {
    page = 1,
    limit = 20,
    role,
    isActive,
    search
  } = req.query;

  // Build query
  let query = {};
  
  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [users, totalCount] = await Promise.all([
    User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      filters: {
        role,
        isActive,
        search
      }
    }
  });
}));

// @desc    Update user status
// @route   PATCH /api/admin/users/:id/status
// @access  Private (Admin)
router.patch('/users/:id/status', [
  body('isActive').isBoolean().withMessage('isActive must be boolean')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  user.isActive = req.body.isActive;
  await user.save();

  res.json({
    success: true,
    message: `User ${req.body.isActive ? 'activated' : 'deactivated'} successfully`,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      }
    }
  });
}));

// @desc    Get all restaurants with filters
// @route   GET /api/admin/restaurants
// @access  Private (Admin)
router.get('/restaurants', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'inactive', 'temporarily_closed', 'pending_approval']).withMessage('Invalid status'),
  query('search').optional().isString().withMessage('Search must be a string')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const {
    page = 1,
    limit = 20,
    status,
    search
  } = req.query;

  // Build query
  let query = {};
  
  if (status) query.status = status;
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { 'address.city': { $regex: search, $options: 'i' } },
      { cuisine: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [restaurants, totalCount] = await Promise.all([
    Restaurant.find(query)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Restaurant.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.json({
    success: true,
    data: {
      restaurants,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      filters: {
        status,
        search
      }
    }
  });
}));

// @desc    Approve/Reject restaurant
// @route   PATCH /api/admin/restaurants/:id/approval
// @access  Private (Admin)
router.patch('/restaurants/:id/approval', [
  body('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
  body('note').optional().isString().withMessage('Note must be a string')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { status, note } = req.body;

  const restaurant = await Restaurant.findById(req.params.id).populate('owner', 'name email');

  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  restaurant.status = status;
  await restaurant.save();

  // In production, send email notification to restaurant owner
  console.log(`Restaurant ${restaurant.name} ${status === 'active' ? 'approved' : 'rejected'}`);
  if (note) console.log(`Note: ${note}`);

  res.json({
    success: true,
    message: `Restaurant ${status === 'active' ? 'approved' : 'rejected'} successfully`,
    data: {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        status: restaurant.status,
        owner: restaurant.owner
      }
    }
  });
}));

// @desc    Get all orders with filters
// @route   GET /api/admin/orders
// @access  Private (Admin)
router.get('/orders', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isString().withMessage('Status must be a string'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const {
    page = 1,
    limit = 20,
    status,
    startDate,
    endDate
  } = req.query;

  // Build query
  let query = {};
  
  if (status) query.status = status;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [orders, totalCount] = await Promise.all([
    Order.find(query)
      .populate('user', 'name email phone')
      .populate('restaurant', 'name')
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
      },
      filters: {
        status,
        startDate,
        endDate
      }
    }
  });
}));

// @desc    Get revenue analytics
// @route   GET /api/admin/analytics/revenue
// @access  Private (Admin)
router.get('/analytics/revenue', [
  query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']).withMessage('Invalid period'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const {
    period = 'daily',
    startDate,
    endDate
  } = req.query;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Build aggregation pipeline based on period
  let groupBy = {};
  switch (period) {
    case 'daily':
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
      break;
    case 'weekly':
      groupBy = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
      break;
    case 'monthly':
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
      break;
    case 'yearly':
      groupBy = {
        year: { $year: '$createdAt' }
      };
      break;
  }

  const revenueData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: 'delivered'
      }
    },
    {
      $group: {
        _id: groupBy,
        totalRevenue: { $sum: '$pricing.total' },
        totalOrders: { $sum: 1 },
        averageOrderValue: { $avg: '$pricing.total' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
  ]);

  // Get top performing restaurants
  const topRestaurants = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: 'delivered'
      }
    },
    {
      $group: {
        _id: '$restaurant',
        totalRevenue: { $sum: '$pricing.total' },
        totalOrders: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'restaurants',
        localField: '_id',
        foreignField: '_id',
        as: 'restaurant'
      }
    },
    { $unwind: '$restaurant' },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 }
  ]);

  res.json({
    success: true,
    data: {
      revenueData,
      topRestaurants,
      period: {
        type: period,
        startDate: start,
        endDate: end
      }
    }
  });
}));

// @desc    Get user analytics
// @route   GET /api/admin/analytics/users
// @access  Private (Admin)
router.get('/analytics/users', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const [
    userGrowth,
    usersByRole,
    activeUsers,
    topCustomers
  ] = await Promise.all([
    User.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]),
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]),
    User.countDocuments({ isActive: true }),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: '$user',
          totalSpent: { $sum: '$pricing.total' },
          totalOrders: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ])
  ]);

  res.json({
    success: true,
    data: {
      userGrowth,
      usersByRole,
      activeUsers,
      topCustomers,
      period: {
        startDate: start,
        endDate: end
      }
    }
  });
}));

// @desc    Get reported reviews
// @route   GET /api/admin/reviews/reported
// @access  Private (Admin)
router.get('/reviews/reported', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [reviews, totalCount] = await Promise.all([
    Review.find({ 
      $or: [
        { status: 'reported' },
        { 'reportedBy.0': { $exists: true } }
      ]
    })
      .populate('user', 'name email')
      .populate('restaurant', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Review.countDocuments({ 
      $or: [
        { status: 'reported' },
        { 'reportedBy.0': { $exists: true } }
      ]
    })
  ]);

  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.json({
    success: true,
    data: {
      reviews,
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

// @desc    Moderate review
// @route   PATCH /api/admin/reviews/:id/moderate
// @access  Private (Admin)
router.patch('/reviews/:id/moderate', [
  body('action').isIn(['approve', 'hide', 'delete']).withMessage('Action must be approve, hide, or delete'),
  body('moderationNotes').optional().isString().withMessage('Moderation notes must be a string')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { action, moderationNotes } = req.body;

  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new NotFoundError('Review not found');
  }

  switch (action) {
    case 'approve':
      review.status = 'active';
      break;
    case 'hide':
      review.status = 'hidden';
      break;
    case 'delete':
      review.status = 'deleted';
      break;
  }

  if (moderationNotes) {
    review.moderationNotes = moderationNotes;
  }

  await review.save();

  res.json({
    success: true,
    message: `Review ${action}d successfully`,
    data: {
      review: {
        id: review._id,
        status: review.status,
        moderationNotes: review.moderationNotes
      }
    }
  });
}));

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Private (Admin)
router.get('/settings', asyncHandler(async (req, res) => {
  // In a real app, these would be stored in database
  const settings = {
    platform: {
      name: 'FoodDelivery',
      version: '1.0.0',
      maintenanceMode: false
    },
    fees: {
      platformFee: 0.05, // 5%
      paymentGatewayFee: 0.029, // 2.9%
      deliveryFeeRange: { min: 2, max: 10 }
    },
    limits: {
      maxOrderValue: 500,
      minOrderValue: 5,
      maxDeliveryRadius: 50
    },
    features: {
      realTimeTracking: true,
      multiplePaymentMethods: true,
      reviewSystem: true,
      loyaltyProgram: false
    }
  };

  res.json({
    success: true,
    data: {
      settings
    }
  });
}));

module.exports = router;
