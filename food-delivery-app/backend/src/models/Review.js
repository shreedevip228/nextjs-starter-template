const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: [true, 'Restaurant reference is required']
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order reference is required']
  },
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    default: null // null for restaurant reviews, specific item for item reviews
  },
  rating: {
    overall: {
      type: Number,
      required: [true, 'Overall rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot be more than 5']
    },
    food: {
      type: Number,
      min: [1, 'Food rating must be at least 1'],
      max: [5, 'Food rating cannot be more than 5']
    },
    delivery: {
      type: Number,
      min: [1, 'Delivery rating must be at least 1'],
      max: [5, 'Delivery rating cannot be more than 5']
    },
    service: {
      type: Number,
      min: [1, 'Service rating must be at least 1'],
      max: [5, 'Service rating cannot be more than 5']
    },
    packaging: {
      type: Number,
      min: [1, 'Packaging rating must be at least 1'],
      max: [5, 'Packaging rating cannot be more than 5']
    }
  },
  review: {
    title: {
      type: String,
      maxlength: [100, 'Review title cannot be more than 100 characters']
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      maxlength: [1000, 'Review comment cannot be more than 1000 characters']
    },
    pros: [String],
    cons: [String]
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    caption: String
  }],
  tags: [{
    type: String,
    enum: [
      'Great Food', 'Fast Delivery', 'Good Packaging', 'Value for Money',
      'Fresh Ingredients', 'Hot Food', 'Polite Delivery', 'On Time',
      'Tasty', 'Hygienic', 'Generous Portions', 'Good Quality',
      'Cold Food', 'Late Delivery', 'Poor Packaging', 'Expensive',
      'Stale Food', 'Rude Delivery', 'Small Portions', 'Poor Quality'
    ]
  }],
  helpfulVotes: {
    count: {
      type: Number,
      default: 0
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  restaurantResponse: {
    message: String,
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: true
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'hidden', 'reported', 'deleted'],
    default: 'active'
  },
  reportedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'fake', 'offensive', 'other']
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  moderationNotes: String
}, {
  timestamps: true
});

// Indexes for better query performance
reviewSchema.index({ restaurant: 1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ order: 1 });
reviewSchema.index({ menuItem: 1 });
reviewSchema.index({ 'rating.overall': -1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ status: 1 });

// Compound index for restaurant reviews
reviewSchema.index({ restaurant: 1, status: 1, createdAt: -1 });

// Virtual for review age
reviewSchema.virtual('reviewAge').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
});

// Virtual for checking if review is helpful
reviewSchema.virtual('isHelpful').get(function() {
  return this.helpfulVotes.count >= 5;
});

// Method to mark review as helpful
reviewSchema.methods.markHelpful = function(userId) {
  if (!this.helpfulVotes.users.includes(userId)) {
    this.helpfulVotes.users.push(userId);
    this.helpfulVotes.count += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to unmark review as helpful
reviewSchema.methods.unmarkHelpful = function(userId) {
  const index = this.helpfulVotes.users.indexOf(userId);
  if (index > -1) {
    this.helpfulVotes.users.splice(index, 1);
    this.helpfulVotes.count = Math.max(0, this.helpfulVotes.count - 1);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to add restaurant response
reviewSchema.methods.addRestaurantResponse = function(message, respondedBy) {
  this.restaurantResponse = {
    message,
    respondedAt: new Date(),
    respondedBy
  };
  return this.save();
};

// Method to report review
reviewSchema.methods.reportReview = function(userId, reason) {
  const existingReport = this.reportedBy.find(report => 
    report.user.toString() === userId.toString()
  );
  
  if (!existingReport) {
    this.reportedBy.push({
      user: userId,
      reason,
      reportedAt: new Date()
    });
    
    // Auto-hide if reported by multiple users
    if (this.reportedBy.length >= 3) {
      this.status = 'reported';
    }
    
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Static method to get review statistics for a restaurant
reviewSchema.statics.getRestaurantStats = async function(restaurantId) {
  const pipeline = [
    {
      $match: {
        restaurant: mongoose.Types.ObjectId(restaurantId),
        status: 'active'
      }
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating.overall' },
        averageFoodRating: { $avg: '$rating.food' },
        averageDeliveryRating: { $avg: '$rating.delivery' },
        averageServiceRating: { $avg: '$rating.service' },
        averagePackagingRating: { $avg: '$rating.packaging' },
        ratingDistribution: {
          $push: '$rating.overall'
        }
      }
    },
    {
      $addFields: {
        ratingBreakdown: {
          5: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 5] }
              }
            }
          },
          4: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 4] }
              }
            }
          },
          3: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 3] }
              }
            }
          },
          2: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 2] }
              }
            }
          },
          1: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 1] }
              }
            }
          }
        }
      }
    },
    {
      $project: {
        totalReviews: 1,
        averageRating: { $round: ['$averageRating', 1] },
        averageFoodRating: { $round: ['$averageFoodRating', 1] },
        averageDeliveryRating: { $round: ['$averageDeliveryRating', 1] },
        averageServiceRating: { $round: ['$averageServiceRating', 1] },
        averagePackagingRating: { $round: ['$averagePackagingRating', 1] },
        ratingBreakdown: 1
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalReviews: 0,
    averageRating: 0,
    averageFoodRating: 0,
    averageDeliveryRating: 0,
    averageServiceRating: 0,
    averagePackagingRating: 0,
    ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  };
};

// Static method to get recent reviews for a restaurant
reviewSchema.statics.getRecentReviews = function(restaurantId, limit = 10) {
  return this.find({
    restaurant: restaurantId,
    status: 'active'
  })
  .populate('user', 'name avatar')
  .populate('menuItem', 'name')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Static method to get top reviews (most helpful)
reviewSchema.statics.getTopReviews = function(restaurantId, limit = 5) {
  return this.find({
    restaurant: restaurantId,
    status: 'active'
  })
  .populate('user', 'name avatar')
  .populate('menuItem', 'name')
  .sort({ 'helpfulVotes.count': -1, createdAt: -1 })
  .limit(limit);
};

// Post-save middleware to update restaurant rating
reviewSchema.post('save', async function(doc) {
  if (doc.status === 'active') {
    const Restaurant = mongoose.model('Restaurant');
    const restaurant = await Restaurant.findById(doc.restaurant);
    if (restaurant) {
      await restaurant.updateRating();
    }

    // Update menu item rating if this is an item review
    if (doc.menuItem) {
      const MenuItem = mongoose.model('MenuItem');
      const menuItem = await MenuItem.findById(doc.menuItem);
      if (menuItem) {
        await menuItem.updateRating();
      }
    }
  }
});

// Post-remove middleware to update restaurant rating
reviewSchema.post('remove', async function(doc) {
  const Restaurant = mongoose.model('Restaurant');
  const restaurant = await Restaurant.findById(doc.restaurant);
  if (restaurant) {
    await restaurant.updateRating();
  }

  if (doc.menuItem) {
    const MenuItem = mongoose.model('MenuItem');
    const menuItem = await MenuItem.findById(doc.menuItem);
    if (menuItem) {
      await menuItem.updateRating();
    }
  }
});

module.exports = mongoose.model('Review', reviewSchema);
