const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const Review = require('../models/Review');
const { authenticateToken, requireRestaurantOwner, requireAdmin, optionalAuth } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');

const router = express.Router();

// @desc    Get all restaurants with filters and search
// @route   GET /api/restaurants
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('cuisine').optional().isString().withMessage('Cuisine must be a string'),
  query('priceRange').optional().isIn(['$', '$$', '$$$', '$$$$']).withMessage('Invalid price range'),
  query('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('lat').optional().isFloat().withMessage('Latitude must be a number'),
  query('lng').optional().isFloat().withMessage('Longitude must be a number'),
  query('radius').optional().isFloat({ min: 1, max: 50 }).withMessage('Radius must be between 1 and 50 km'),
  query('sortBy').optional().isIn(['rating', 'deliveryTime', 'deliveryFee', 'distance']).withMessage('Invalid sort option')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const {
    page = 1,
    limit = 20,
    cuisine,
    priceRange,
    rating,
    search,
    lat,
    lng,
    radius = 10,
    sortBy = 'rating'
  } = req.query;

  // Build query
  let query = { status: 'active' };

  // Filter by cuisine
  if (cuisine) {
    query.cuisine = { $in: [cuisine] };
  }

  // Filter by price range
  if (priceRange) {
    query.priceRange = priceRange;
  }

  // Filter by minimum rating
  if (rating) {
    query['rating.average'] = { $gte: parseFloat(rating) };
  }

  // Search functionality
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { cuisine: { $in: [new RegExp(search, 'i')] } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  // Location-based filtering
  if (lat && lng) {
    query['address.coordinates'] = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)]
        },
        $maxDistance: parseFloat(radius) * 1000 // Convert km to meters
      }
    };
  }

  // Build sort options
  let sortOptions = {};
  switch (sortBy) {
    case 'rating':
      sortOptions = { 'rating.average': -1, 'rating.count': -1 };
      break;
    case 'deliveryTime':
      sortOptions = { 'deliveryInfo.deliveryTime.min': 1 };
      break;
    case 'deliveryFee':
      sortOptions = { 'deliveryInfo.deliveryFee': 1 };
      break;
    case 'distance':
      // Distance sorting is handled by $near in the query
      sortOptions = {};
      break;
    default:
      sortOptions = { 'rating.average': -1 };
  }

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [restaurants, totalCount] = await Promise.all([
    Restaurant.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('owner', 'name email')
      .lean(),
    Restaurant.countDocuments(query)
  ]);

  // Add distance calculation if coordinates provided
  if (lat && lng) {
    restaurants.forEach(restaurant => {
      restaurant.distance = restaurant.calculateDistance ? 
        restaurant.calculateDistance(parseFloat(lat), parseFloat(lng)) : null;
    });
  }

  // Add current open status
  restaurants.forEach(restaurant => {
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
    const currentTime = now.toTimeString().slice(0, 5);
    
    const todayHours = restaurant.operatingHours[currentDay];
    restaurant.isCurrentlyOpen = todayHours && todayHours.isOpen &&
      currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime;
  });

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
        cuisine,
        priceRange,
        rating,
        search,
        sortBy
      }
    }
  });
}));

// @desc    Get single restaurant by ID
// @route   GET /api/restaurants/:id
// @access  Public
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id)
    .populate('owner', 'name email phone')
    .lean();

  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  // Get restaurant menu
  const menuItems = await MenuItem.find({ 
    restaurant: req.params.id, 
    status: 'active' 
  }).sort({ category: 1, name: 1 });

  // Get recent reviews
  const reviews = await Review.find({ 
    restaurant: req.params.id, 
    status: 'active' 
  })
    .populate('user', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(10);

  // Get review statistics
  const reviewStats = await Review.getRestaurantStats(req.params.id);

  // Add current open status
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
  const currentTime = now.toTimeString().slice(0, 5);
  
  const todayHours = restaurant.operatingHours[currentDay];
  restaurant.isCurrentlyOpen = todayHours && todayHours.isOpen &&
    currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime;

  // Group menu items by category
  const menuByCategory = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      restaurant,
      menu: menuByCategory,
      reviews: {
        items: reviews,
        stats: reviewStats
      }
    }
  });
}));

// @desc    Create new restaurant
// @route   POST /api/restaurants
// @access  Private (Restaurant Owner/Admin)
router.post('/', [
  authenticateToken,
  requireRestaurantOwner,
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('description').trim().isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('cuisine').isArray({ min: 1 }).withMessage('At least one cuisine type is required'),
  body('address.street').notEmpty().withMessage('Street address is required'),
  body('address.city').notEmpty().withMessage('City is required'),
  body('address.state').notEmpty().withMessage('State is required'),
  body('address.zipCode').notEmpty().withMessage('Zip code is required'),
  body('address.coordinates.latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  body('address.coordinates.longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  body('contact.phone').isMobilePhone().withMessage('Valid phone number is required'),
  body('contact.email').isEmail().withMessage('Valid email is required'),
  body('priceRange').isIn(['$', '$$', '$$$', '$$$$']).withMessage('Valid price range is required'),
  body('deliveryInfo.deliveryTime.min').isInt({ min: 10 }).withMessage('Minimum delivery time must be at least 10 minutes'),
  body('deliveryInfo.deliveryTime.max').isInt({ min: 15 }).withMessage('Maximum delivery time must be at least 15 minutes'),
  body('deliveryInfo.deliveryFee').isFloat({ min: 0 }).withMessage('Delivery fee must be non-negative'),
  body('deliveryInfo.minimumOrder').isFloat({ min: 0 }).withMessage('Minimum order must be non-negative'),
  body('deliveryInfo.deliveryRadius').isFloat({ min: 1, max: 50 }).withMessage('Delivery radius must be between 1 and 50 km')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  // Check if user already owns a restaurant (unless admin)
  if (req.user.role !== 'admin') {
    const existingRestaurant = await Restaurant.findOne({ owner: req.user._id });
    if (existingRestaurant) {
      throw new ValidationError('You can only own one restaurant');
    }
  }

  const restaurantData = {
    ...req.body,
    owner: req.user._id
  };

  const restaurant = await Restaurant.create(restaurantData);
  await restaurant.populate('owner', 'name email');

  res.status(201).json({
    success: true,
    message: 'Restaurant created successfully',
    data: {
      restaurant
    }
  });
}));

// @desc    Update restaurant
// @route   PUT /api/restaurants/:id
// @access  Private (Restaurant Owner/Admin)
router.put('/:id', [
  authenticateToken,
  requireRestaurantOwner,
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('description').optional().trim().isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('cuisine').optional().isArray({ min: 1 }).withMessage('At least one cuisine type is required'),
  body('priceRange').optional().isIn(['$', '$$', '$$$', '$$$$']).withMessage('Valid price range is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  // Check ownership (unless admin)
  if (req.user.role !== 'admin' && restaurant.owner.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only update your own restaurant');
  }

  // Update restaurant
  Object.keys(req.body).forEach(key => {
    if (req.body[key] !== undefined) {
      restaurant[key] = req.body[key];
    }
  });

  await restaurant.save();
  await restaurant.populate('owner', 'name email');

  res.json({
    success: true,
    message: 'Restaurant updated successfully',
    data: {
      restaurant
    }
  });
}));

// @desc    Delete restaurant
// @route   DELETE /api/restaurants/:id
// @access  Private (Restaurant Owner/Admin)
router.delete('/:id', [
  authenticateToken,
  requireRestaurantOwner
], asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  // Check ownership (unless admin)
  if (req.user.role !== 'admin' && restaurant.owner.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only delete your own restaurant');
  }

  // Soft delete - change status to inactive
  restaurant.status = 'inactive';
  await restaurant.save();

  res.json({
    success: true,
    message: 'Restaurant deleted successfully'
  });
}));

// @desc    Get restaurant statistics
// @route   GET /api/restaurants/:id/stats
// @access  Private (Restaurant Owner/Admin)
router.get('/:id/stats', [
  authenticateToken,
  requireRestaurantOwner,
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date')
], asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  // Check ownership (unless admin)
  if (req.user.role !== 'admin' && restaurant.owner.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only view your own restaurant statistics');
  }

  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const end = endDate ? new Date(endDate) : new Date();

  // Get order statistics
  const Order = require('../models/Order');
  const orderStats = await Order.getOrderStats(req.params.id, start, end);

  // Get popular items
  const popularItems = await Order.getPopularItems(req.params.id, 10);

  // Get review statistics
  const reviewStats = await Review.getRestaurantStats(req.params.id);

  res.json({
    success: true,
    data: {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        totalOrders: restaurant.totalOrders,
        totalRevenue: restaurant.totalRevenue,
        rating: restaurant.rating
      },
      period: {
        startDate: start,
        endDate: end
      },
      orders: orderStats,
      popularItems,
      reviews: reviewStats
    }
  });
}));

// @desc    Update restaurant status
// @route   PATCH /api/restaurants/:id/status
// @access  Private (Admin only)
router.patch('/:id/status', [
  authenticateToken,
  requireAdmin,
  body('status').isIn(['active', 'inactive', 'temporarily_closed', 'pending_approval']).withMessage('Invalid status')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const restaurant = await Restaurant.findById(req.params.id);

  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  restaurant.status = req.body.status;
  await restaurant.save();

  res.json({
    success: true,
    message: 'Restaurant status updated successfully',
    data: {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        status: restaurant.status
      }
    }
  });
}));

// @desc    Get nearby restaurants
// @route   GET /api/restaurants/nearby
// @access  Public
router.get('/location/nearby', [
  query('lat').isFloat().withMessage('Latitude is required'),
  query('lng').isFloat().withMessage('Longitude is required'),
  query('radius').optional().isFloat({ min: 1, max: 50 }).withMessage('Radius must be between 1 and 50 km')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { lat, lng, radius = 10 } = req.query;

  const restaurants = await Restaurant.findNearby(
    parseFloat(lat), 
    parseFloat(lng), 
    parseFloat(radius)
  ).populate('owner', 'name');

  // Add distance and current status to each restaurant
  restaurants.forEach(restaurant => {
    restaurant.distance = restaurant.calculateDistance(parseFloat(lat), parseFloat(lng));
    
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
    const currentTime = now.toTimeString().slice(0, 5);
    
    const todayHours = restaurant.operatingHours[currentDay];
    restaurant.isCurrentlyOpen = todayHours && todayHours.isOpen &&
      currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime;
  });

  res.json({
    success: true,
    data: {
      restaurants,
      searchLocation: {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        radius: parseFloat(radius)
      }
    }
  });
}));

module.exports = router;
