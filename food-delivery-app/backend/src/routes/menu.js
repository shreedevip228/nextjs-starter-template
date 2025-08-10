const express = require('express');
const { body, query, validationResult } = require('express-validator');
const MenuItem = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant');
const { authenticateToken, requireRestaurantOwner, optionalAuth } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');

const router = express.Router();

// @desc    Get menu items for a restaurant
// @route   GET /api/menu/restaurant/:restaurantId
// @access  Public
router.get('/restaurant/:restaurantId', [
  query('category').optional().isString().withMessage('Category must be a string'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('dietaryTags').optional().isString().withMessage('Dietary tags must be a string'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Minimum price must be non-negative'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Maximum price must be non-negative'),
  query('sortBy').optional().isIn(['name', 'price', 'rating', 'popularity']).withMessage('Invalid sort option'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { restaurantId } = req.params;
  const {
    category,
    search,
    dietaryTags,
    minPrice,
    maxPrice,
    sortBy = 'category',
    sortOrder = 'asc'
  } = req.query;

  // Verify restaurant exists
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  // Build query
  let query = { 
    restaurant: restaurantId, 
    status: 'active' 
  };

  // Filter by category
  if (category) {
    query.category = category;
  }

  // Search functionality
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { ingredients: { $in: [new RegExp(search, 'i')] } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  // Filter by dietary tags
  if (dietaryTags) {
    const tags = dietaryTags.split(',').map(tag => tag.trim());
    query.dietaryTags = { $in: tags };
  }

  // Price range filter
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  // Build sort options
  let sortOptions = {};
  switch (sortBy) {
    case 'name':
      sortOptions.name = sortOrder === 'desc' ? -1 : 1;
      break;
    case 'price':
      sortOptions.price = sortOrder === 'desc' ? -1 : 1;
      break;
    case 'rating':
      sortOptions['rating.average'] = sortOrder === 'desc' ? -1 : 1;
      break;
    case 'popularity':
      sortOptions.orderCount = sortOrder === 'desc' ? -1 : 1;
      break;
    default:
      sortOptions.category = 1;
      sortOptions.name = 1;
  }

  const menuItems = await MenuItem.find(query).sort(sortOptions);

  // Group by category
  const menuByCategory = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  // Get available categories for this restaurant
  const categories = await MenuItem.distinct('category', { 
    restaurant: restaurantId, 
    status: 'active' 
  });

  res.json({
    success: true,
    data: {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name
      },
      menu: menuByCategory,
      categories,
      totalItems: menuItems.length,
      filters: {
        category,
        search,
        dietaryTags,
        minPrice,
        maxPrice,
        sortBy,
        sortOrder
      }
    }
  });
}));

// @desc    Get single menu item
// @route   GET /api/menu/:id
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
  const menuItem = await MenuItem.findById(req.params.id)
    .populate('restaurant', 'name images.logo rating deliveryInfo');

  if (!menuItem) {
    throw new NotFoundError('Menu item not found');
  }

  if (menuItem.status !== 'active') {
    throw new NotFoundError('Menu item is not available');
  }

  res.json({
    success: true,
    data: {
      menuItem
    }
  });
}));

// @desc    Create new menu item
// @route   POST /api/menu
// @access  Private (Restaurant Owner)
router.post('/', [
  authenticateToken,
  requireRestaurantOwner,
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('description').trim().isLength({ min: 10, max: 300 }).withMessage('Description must be between 10 and 300 characters'),
  body('restaurant').isMongoId().withMessage('Valid restaurant ID is required'),
  body('category').isIn([
    'Appetizers', 'Main Course', 'Desserts', 'Beverages',
    'Soups', 'Salads', 'Sides', 'Breakfast', 'Lunch',
    'Dinner', 'Snacks', 'Combos', 'Specials'
  ]).withMessage('Valid category is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be non-negative'),
  body('images').isArray({ min: 1 }).withMessage('At least one image is required'),
  body('preparationTime').isInt({ min: 1 }).withMessage('Preparation time must be at least 1 minute')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { restaurant: restaurantId } = req.body;

  // Verify restaurant exists and user owns it
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  if (req.user.role !== 'admin' && restaurant.owner.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only add menu items to your own restaurant');
  }

  const menuItem = await MenuItem.create(req.body);
  await menuItem.populate('restaurant', 'name');

  res.status(201).json({
    success: true,
    message: 'Menu item created successfully',
    data: {
      menuItem
    }
  });
}));

// @desc    Update menu item
// @route   PUT /api/menu/:id
// @access  Private (Restaurant Owner)
router.put('/:id', [
  authenticateToken,
  requireRestaurantOwner,
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('description').optional().trim().isLength({ min: 10, max: 300 }).withMessage('Description must be between 10 and 300 characters'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be non-negative'),
  body('preparationTime').optional().isInt({ min: 1 }).withMessage('Preparation time must be at least 1 minute')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const menuItem = await MenuItem.findById(req.params.id).populate('restaurant');

  if (!menuItem) {
    throw new NotFoundError('Menu item not found');
  }

  // Check ownership
  if (req.user.role !== 'admin' && menuItem.restaurant.owner.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only update menu items from your own restaurant');
  }

  // Update menu item
  Object.keys(req.body).forEach(key => {
    if (req.body[key] !== undefined) {
      menuItem[key] = req.body[key];
    }
  });

  await menuItem.save();
  await menuItem.populate('restaurant', 'name');

  res.json({
    success: true,
    message: 'Menu item updated successfully',
    data: {
      menuItem
    }
  });
}));

// @desc    Delete menu item
// @route   DELETE /api/menu/:id
// @access  Private (Restaurant Owner)
router.delete('/:id', [
  authenticateToken,
  requireRestaurantOwner
], asyncHandler(async (req, res) => {
  const menuItem = await MenuItem.findById(req.params.id).populate('restaurant');

  if (!menuItem) {
    throw new NotFoundError('Menu item not found');
  }

  // Check ownership
  if (req.user.role !== 'admin' && menuItem.restaurant.owner.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only delete menu items from your own restaurant');
  }

  // Soft delete - change status to inactive
  menuItem.status = 'inactive';
  await menuItem.save();

  res.json({
    success: true,
    message: 'Menu item deleted successfully'
  });
}));

// @desc    Update menu item availability
// @route   PATCH /api/menu/:id/availability
// @access  Private (Restaurant Owner)
router.patch('/:id/availability', [
  authenticateToken,
  requireRestaurantOwner,
  body('isAvailable').isBoolean().withMessage('Availability must be true or false'),
  body('availableQuantity').optional().isInt({ min: 0 }).withMessage('Available quantity must be non-negative')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const menuItem = await MenuItem.findById(req.params.id).populate('restaurant');

  if (!menuItem) {
    throw new NotFoundError('Menu item not found');
  }

  // Check ownership
  if (req.user.role !== 'admin' && menuItem.restaurant.owner.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only update menu items from your own restaurant');
  }

  const { isAvailable, availableQuantity } = req.body;

  menuItem.availability.isAvailable = isAvailable;
  if (availableQuantity !== undefined) {
    menuItem.availability.availableQuantity = availableQuantity;
  }

  await menuItem.save();

  res.json({
    success: true,
    message: 'Menu item availability updated successfully',
    data: {
      menuItem: {
        id: menuItem._id,
        name: menuItem.name,
        availability: menuItem.availability
      }
    }
  });
}));

// @desc    Get popular menu items for a restaurant
// @route   GET /api/menu/restaurant/:restaurantId/popular
// @access  Public
router.get('/restaurant/:restaurantId/popular', [
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { restaurantId } = req.params;
  const { limit = 10 } = req.query;

  // Verify restaurant exists
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  const popularItems = await MenuItem.getPopularItems(restaurantId, parseInt(limit));

  res.json({
    success: true,
    data: {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name
      },
      popularItems
    }
  });
}));

// @desc    Get recommended menu items for a restaurant
// @route   GET /api/menu/restaurant/:restaurantId/recommended
// @access  Public
router.get('/restaurant/:restaurantId/recommended', [
  query('limit').optional().isInt({ min: 1, max: 10 }).withMessage('Limit must be between 1 and 10')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { restaurantId } = req.params;
  const { limit = 5 } = req.query;

  // Verify restaurant exists
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  const recommendedItems = await MenuItem.getRecommendedItems(restaurantId, parseInt(limit));

  res.json({
    success: true,
    data: {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name
      },
      recommendedItems
    }
  });
}));

// @desc    Search menu items across all restaurants
// @route   GET /api/menu/search
// @access  Public
router.get('/search', [
  query('q').notEmpty().withMessage('Search query is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('cuisine').optional().isString().withMessage('Cuisine must be a string'),
  query('dietaryTags').optional().isString().withMessage('Dietary tags must be a string'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Minimum price must be non-negative'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Maximum price must be non-negative')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const {
    q: searchQuery,
    page = 1,
    limit = 20,
    cuisine,
    dietaryTags,
    minPrice,
    maxPrice
  } = req.query;

  // Build query
  let query = {
    status: 'active',
    $or: [
      { name: { $regex: searchQuery, $options: 'i' } },
      { description: { $regex: searchQuery, $options: 'i' } },
      { ingredients: { $in: [new RegExp(searchQuery, 'i')] } },
      { tags: { $in: [new RegExp(searchQuery, 'i')] } }
    ]
  };

  // Filter by dietary tags
  if (dietaryTags) {
    const tags = dietaryTags.split(',').map(tag => tag.trim());
    query.dietaryTags = { $in: tags };
  }

  // Price range filter
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  let menuItemsQuery = MenuItem.find(query)
    .populate('restaurant', 'name images.logo rating deliveryInfo address.city cuisine')
    .sort({ orderCount: -1, 'rating.average': -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Filter by cuisine if specified
  if (cuisine) {
    menuItemsQuery = menuItemsQuery.populate({
      path: 'restaurant',
      match: { cuisine: { $in: [cuisine] } },
      select: 'name images.logo rating deliveryInfo address.city cuisine'
    });
  }

  const [menuItems, totalCount] = await Promise.all([
    menuItemsQuery.exec(),
    MenuItem.countDocuments(query)
  ]);

  // Filter out items where restaurant didn't match cuisine filter
  const filteredItems = cuisine ? 
    menuItems.filter(item => item.restaurant) : 
    menuItems;

  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.json({
    success: true,
    data: {
      menuItems: filteredItems,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount: filteredItems.length,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      searchQuery,
      filters: {
        cuisine,
        dietaryTags,
        minPrice,
        maxPrice
      }
    }
  });
}));

// @desc    Bulk update menu item status
// @route   PATCH /api/menu/bulk-status
// @access  Private (Restaurant Owner)
router.patch('/bulk-status', [
  authenticateToken,
  requireRestaurantOwner,
  body('menuItemIds').isArray({ min: 1 }).withMessage('Menu item IDs array is required'),
  body('status').isIn(['active', 'inactive', 'out_of_stock']).withMessage('Valid status is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { menuItemIds, status } = req.body;

  // Get all menu items and verify ownership
  const menuItems = await MenuItem.find({
    _id: { $in: menuItemIds }
  }).populate('restaurant');

  if (menuItems.length !== menuItemIds.length) {
    throw new NotFoundError('Some menu items not found');
  }

  // Check ownership for all items
  const unauthorizedItems = menuItems.filter(item => 
    req.user.role !== 'admin' && 
    item.restaurant.owner.toString() !== req.user._id.toString()
  );

  if (unauthorizedItems.length > 0) {
    throw new AuthorizationError('You can only update menu items from your own restaurant');
  }

  // Update all items
  await MenuItem.updateMany(
    { _id: { $in: menuItemIds } },
    { status }
  );

  res.json({
    success: true,
    message: `${menuItems.length} menu items updated successfully`,
    data: {
      updatedCount: menuItems.length,
      status
    }
  });
}));

module.exports = router;
