const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { asyncHandler, ValidationError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');

const router = express.Router();

// @desc    Get reviews for a restaurant
// @route   GET /api/reviews/restaurant/:restaurantId
// @access  Public
router.get('/restaurant/:restaurantId', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  query('sortBy').optional().isIn(['newest', 'oldest', 'highest', 'lowest', 'helpful']).withMessage('Invalid sort option')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { restaurantId } = req.params;
  const {
    page = 1,
    limit = 10,
    rating,
    sortBy = 'newest'
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

  if (rating) {
    query['rating.overall'] = parseInt(rating);
  }

  // Build sort options
  let sortOptions = {};
  switch (sortBy) {
    case 'newest':
      sortOptions = { createdAt: -1 };
      break;
    case 'oldest':
      sortOptions = { createdAt: 1 };
      break;
    case 'highest':
      sortOptions = { 'rating.overall': -1, createdAt: -1 };
      break;
    case 'lowest':
      sortOptions = { 'rating.overall': 1, createdAt: -1 };
      break;
    case 'helpful':
      sortOptions = { 'helpfulVotes.count': -1, createdAt: -1 };
      break;
    default:
      sortOptions = { createdAt: -1 };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [reviews, totalCount, reviewStats] = await Promise.all([
    Review.find(query)
      .populate('user', 'name avatar')
      .populate('menuItem', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Review.countDocuments(query),
    Review.getRestaurantStats(restaurantId)
  ]);

  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.json({
    success: true,
    data: {
      restaurant: {
        id: restaurant._id,
        name: restaurant.name
      },
      reviews,
      stats: reviewStats,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      filters: {
        rating,
        sortBy
      }
    }
  });
}));

// @desc    Get single review
// @route   GET /api/reviews/:id
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id)
    .populate('user', 'name avatar')
    .populate('restaurant', 'name images.logo')
    .populate('menuItem', 'name images')
    .populate('order', 'orderNumber createdAt');

  if (!review || review.status !== 'active') {
    throw new NotFoundError('Review not found');
  }

  res.json({
    success: true,
    data: {
      review
    }
  });
}));

// @desc    Create new review
// @route   POST /api/reviews
// @access  Private
router.post('/', [
  authenticateToken,
  body('restaurant').isMongoId().withMessage('Valid restaurant ID is required'),
  body('order').isMongoId().withMessage('Valid order ID is required'),
  body('rating.overall').isInt({ min: 1, max: 5 }).withMessage('Overall rating must be between 1 and 5'),
  body('rating.food').optional().isInt({ min: 1, max: 5 }).withMessage('Food rating must be between 1 and 5'),
  body('rating.delivery').optional().isInt({ min: 1, max: 5 }).withMessage('Delivery rating must be between 1 and 5'),
  body('rating.service').optional().isInt({ min: 1, max: 5 }).withMessage('Service rating must be between 1 and 5'),
  body('rating.packaging').optional().isInt({ min: 1, max: 5 }).withMessage('Packaging rating must be between 1 and 5'),
  body('review.comment').notEmpty().withMessage('Review comment is required'),
  body('review.comment').isLength({ max: 1000 }).withMessage('Review comment cannot exceed 1000 characters'),
  body('menuItem').optional().isMongoId().withMessage('Valid menu item ID required if specified'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('isAnonymous').optional().isBoolean().withMessage('isAnonymous must be boolean')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const {
    restaurant: restaurantId,
    order: orderId,
    rating,
    review,
    menuItem,
    tags,
    images,
    isAnonymous
  } = req.body;

  // Verify order exists and belongs to user
  const order = await Order.findById(orderId);
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.user.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only review your own orders');
  }

  if (order.status !== 'delivered') {
    throw new ValidationError('You can only review delivered orders');
  }

  if (order.restaurant.toString() !== restaurantId) {
    throw new ValidationError('Restaurant ID does not match order');
  }

  // Check if user has already reviewed this order
  const existingReview = await Review.findOne({
    user: req.user._id,
    order: orderId
  });

  if (existingReview) {
    throw new ValidationError('You have already reviewed this order');
  }

  // Verify menu item belongs to restaurant if specified
  if (menuItem) {
    const menuItemDoc = await MenuItem.findById(menuItem);
    if (!menuItemDoc || menuItemDoc.restaurant.toString() !== restaurantId) {
      throw new ValidationError('Menu item does not belong to this restaurant');
    }
  }

  // Create review
  const reviewData = {
    user: req.user._id,
    restaurant: restaurantId,
    order: orderId,
    rating,
    review,
    menuItem: menuItem || null,
    tags: tags || [],
    images: images || [],
    isAnonymous: isAnonymous || false,
    isVerifiedPurchase: true
  };

  const newReview = await Review.create(reviewData);
  await newReview.populate([
    { path: 'user', select: 'name avatar' },
    { path: 'restaurant', select: 'name' },
    { path: 'menuItem', select: 'name' }
  ]);

  res.status(201).json({
    success: true,
    message: 'Review created successfully',
    data: {
      review: newReview
    }
  });
}));

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
router.put('/:id', [
  authenticateToken,
  body('rating.overall').optional().isInt({ min: 1, max: 5 }).withMessage('Overall rating must be between 1 and 5'),
  body('rating.food').optional().isInt({ min: 1, max: 5 }).withMessage('Food rating must be between 1 and 5'),
  body('rating.delivery').optional().isInt({ min: 1, max: 5 }).withMessage('Delivery rating must be between 1 and 5'),
  body('rating.service').optional().isInt({ min: 1, max: 5 }).withMessage('Service rating must be between 1 and 5'),
  body('rating.packaging').optional().isInt({ min: 1, max: 5 }).withMessage('Packaging rating must be between 1 and 5'),
  body('review.comment').optional().isLength({ max: 1000 }).withMessage('Review comment cannot exceed 1000 characters'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new NotFoundError('Review not found');
  }

  // Check if user owns this review
  if (review.user.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only update your own reviews');
  }

  // Check if review can be updated (within 24 hours of creation)
  const hoursSinceCreation = (Date.now() - review.createdAt) / (1000 * 60 * 60);
  if (hoursSinceCreation > 24) {
    throw new ValidationError('Reviews can only be updated within 24 hours of creation');
  }

  // Update review
  const { rating, review: reviewContent, tags, images } = req.body;

  if (rating) {
    review.rating = { ...review.rating, ...rating };
  }

  if (reviewContent) {
    review.review = { ...review.review, ...reviewContent };
  }

  if (tags) review.tags = tags;
  if (images) review.images = images;

  await review.save();
  await review.populate([
    { path: 'user', select: 'name avatar' },
    { path: 'restaurant', select: 'name' },
    { path: 'menuItem', select: 'name' }
  ]);

  res.json({
    success: true,
    message: 'Review updated successfully',
    data: {
      review
    }
  });
}));

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new NotFoundError('Review not found');
  }

  // Check if user owns this review or is admin
  if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new AuthorizationError('You can only delete your own reviews');
  }

  // Soft delete - change status to deleted
  review.status = 'deleted';
  await review.save();

  res.json({
    success: true,
    message: 'Review deleted successfully'
  });
}));

// @desc    Mark review as helpful
// @route   POST /api/reviews/:id/helpful
// @access  Private
router.post('/:id/helpful', authenticateToken, asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review || review.status !== 'active') {
    throw new NotFoundError('Review not found');
  }

  // Check if user has already marked this review as helpful
  const hasMarked = review.helpfulVotes.users.includes(req.user._id);

  if (hasMarked) {
    // Remove helpful vote
    await review.unmarkHelpful(req.user._id);
    res.json({
      success: true,
      message: 'Helpful vote removed',
      data: {
        helpfulCount: review.helpfulVotes.count,
        isHelpful: false
      }
    });
  } else {
    // Add helpful vote
    await review.markHelpful(req.user._id);
    res.json({
      success: true,
      message: 'Review marked as helpful',
      data: {
        helpfulCount: review.helpfulVotes.count,
        isHelpful: true
      }
    });
  }
}));

// @desc    Report review
// @route   POST /api/reviews/:id/report
// @access  Private
router.post('/:id/report', [
  authenticateToken,
  body('reason').isIn(['spam', 'inappropriate', 'fake', 'offensive', 'other']).withMessage('Valid reason is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { reason } = req.body;

  const review = await Review.findById(req.params.id);

  if (!review || review.status !== 'active') {
    throw new NotFoundError('Review not found');
  }

  // Check if user is trying to report their own review
  if (review.user.toString() === req.user._id.toString()) {
    throw new ValidationError('You cannot report your own review');
  }

  await review.reportReview(req.user._id, reason);

  res.json({
    success: true,
    message: 'Review reported successfully'
  });
}));

// @desc    Add restaurant response to review
// @route   POST /api/reviews/:id/response
// @access  Private (Restaurant Owner)
router.post('/:id/response', [
  authenticateToken,
  body('message').notEmpty().withMessage('Response message is required'),
  body('message').isLength({ max: 500 }).withMessage('Response cannot exceed 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { message } = req.body;

  const review = await Review.findById(req.params.id).populate('restaurant');

  if (!review || review.status !== 'active') {
    throw new NotFoundError('Review not found');
  }

  // Check if user owns the restaurant
  if (req.user.role !== 'admin' && review.restaurant.owner.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only respond to reviews for your own restaurant');
  }

  // Check if restaurant has already responded
  if (review.restaurantResponse.message) {
    throw new ValidationError('Restaurant has already responded to this review');
  }

  await review.addRestaurantResponse(message, req.user._id);

  res.json({
    success: true,
    message: 'Response added successfully',
    data: {
      response: review.restaurantResponse
    }
  });
}));

// @desc    Get user's reviews
// @route   GET /api/reviews/my-reviews
// @access  Private
router.get('/my-reviews', [
  authenticateToken,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [reviews, totalCount] = await Promise.all([
    Review.find({ 
      user: req.user._id,
      status: { $ne: 'deleted' }
    })
      .populate('restaurant', 'name images.logo')
      .populate('menuItem', 'name images')
      .populate('order', 'orderNumber createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Review.countDocuments({ 
      user: req.user._id,
      status: { $ne: 'deleted' }
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

// @desc    Get top reviews (most helpful)
// @route   GET /api/reviews/top
// @access  Public
router.get('/top', [
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20'),
  query('restaurantId').optional().isMongoId().withMessage('Valid restaurant ID required if specified')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { limit = 10, restaurantId } = req.query;

  let query = { status: 'active' };
  if (restaurantId) {
    query.restaurant = restaurantId;
  }

  const topReviews = await Review.find(query)
    .populate('user', 'name avatar')
    .populate('restaurant', 'name images.logo')
    .populate('menuItem', 'name')
    .sort({ 'helpfulVotes.count': -1, 'rating.overall': -1, createdAt: -1 })
    .limit(parseInt(limit));

  res.json({
    success: true,
    data: {
      reviews: topReviews
    }
  });
}));

// @desc    Get recent reviews
// @route   GET /api/reviews/recent
// @access  Public
router.get('/recent', [
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20'),
  query('restaurantId').optional().isMongoId().withMessage('Valid restaurant ID required if specified')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(err => err.msg).join(', '));
  }

  const { limit = 10, restaurantId } = req.query;

  let query = { status: 'active' };
  if (restaurantId) {
    query.restaurant = restaurantId;
  }

  const recentReviews = await Review.find(query)
    .populate('user', 'name avatar')
    .populate('restaurant', 'name images.logo')
    .populate('menuItem', 'name')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  res.json({
    success: true,
    data: {
      reviews: recentReviews
    }
  });
}));

module.exports = router;
