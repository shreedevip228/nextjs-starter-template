const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Menu item name is required'],
    trim: true,
    maxlength: [100, 'Menu item name cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Menu item description is required'],
    maxlength: [300, 'Description cannot be more than 300 characters']
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: [true, 'Restaurant reference is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Appetizers', 'Main Course', 'Desserts', 'Beverages',
      'Soups', 'Salads', 'Sides', 'Breakfast', 'Lunch',
      'Dinner', 'Snacks', 'Combos', 'Specials'
    ]
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    default: null // For showing discounts
  },
  images: [{
    type: String,
    required: true
  }],
  ingredients: [{
    type: String,
    trim: true
  }],
  allergens: [{
    type: String,
    enum: [
      'Gluten', 'Dairy', 'Eggs', 'Fish', 'Shellfish',
      'Tree Nuts', 'Peanuts', 'Soy', 'Sesame'
    ]
  }],
  nutritionalInfo: {
    calories: {
      type: Number,
      min: 0
    },
    protein: {
      type: Number,
      min: 0
    },
    carbs: {
      type: Number,
      min: 0
    },
    fat: {
      type: Number,
      min: 0
    },
    fiber: {
      type: Number,
      min: 0
    },
    sugar: {
      type: Number,
      min: 0
    },
    sodium: {
      type: Number,
      min: 0
    }
  },
  dietaryTags: [{
    type: String,
    enum: [
      'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free',
      'Nut-Free', 'Low-Carb', 'Keto', 'Paleo', 'Organic',
      'Spicy', 'Mild', 'Medium Spicy', 'Extra Spicy'
    ]
  }],
  spiceLevel: {
    type: String,
    enum: ['None', 'Mild', 'Medium', 'Hot', 'Extra Hot'],
    default: 'None'
  },
  preparationTime: {
    type: Number,
    required: [true, 'Preparation time is required'],
    min: [1, 'Preparation time must be at least 1 minute']
  },
  servingSize: {
    type: String,
    required: true,
    default: '1 serving'
  },
  customizations: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['single', 'multiple'],
      default: 'single'
    },
    required: {
      type: Boolean,
      default: false
    },
    options: [{
      name: {
        type: String,
        required: true
      },
      price: {
        type: Number,
        default: 0
      }
    }]
  }],
  addOns: [{
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    category: {
      type: String,
      enum: ['Extra Toppings', 'Sides', 'Beverages', 'Desserts'],
      default: 'Extra Toppings'
    }
  }],
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    availableQuantity: {
      type: Number,
      default: null // null means unlimited
    },
    availableDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    availableHours: {
      start: {
        type: String,
        default: '00:00'
      },
      end: {
        type: String,
        default: '23:59'
      }
    }
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  orderCount: {
    type: Number,
    default: 0
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isRecommended: {
    type: Boolean,
    default: false
  },
  tags: [String],
  status: {
    type: String,
    enum: ['active', 'inactive', 'out_of_stock'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
menuItemSchema.index({ restaurant: 1 });
menuItemSchema.index({ category: 1 });
menuItemSchema.index({ price: 1 });
menuItemSchema.index({ 'rating.average': -1 });
menuItemSchema.index({ orderCount: -1 });
menuItemSchema.index({ dietaryTags: 1 });
menuItemSchema.index({ status: 1 });

// Virtual for discount percentage
menuItemSchema.virtual('discountPercentage').get(function() {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
});

// Virtual for checking if item is currently available
menuItemSchema.virtual('isCurrentlyAvailable').get(function() {
  if (!this.availability.isAvailable || this.status !== 'active') {
    return false;
  }

  // Check quantity availability
  if (this.availability.availableQuantity !== null && this.availability.availableQuantity <= 0) {
    return false;
  }

  // Check day availability
  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' });
  if (this.availability.availableDays.length > 0 && !this.availability.availableDays.includes(currentDay)) {
    return false;
  }

  // Check time availability
  const currentTime = new Date().toTimeString().slice(0, 5); // HH:MM format
  const startTime = this.availability.availableHours.start;
  const endTime = this.availability.availableHours.end;

  if (currentTime < startTime || currentTime > endTime) {
    return false;
  }

  return true;
});

// Method to calculate total price with customizations and add-ons
menuItemSchema.methods.calculatePrice = function(customizations = [], addOns = []) {
  let totalPrice = this.price;

  // Add customization prices
  customizations.forEach(customization => {
    const customizationConfig = this.customizations.find(c => c.name === customization.name);
    if (customizationConfig) {
      const selectedOption = customizationConfig.options.find(o => o.name === customization.selectedOption);
      if (selectedOption) {
        totalPrice += selectedOption.price;
      }
    }
  });

  // Add add-on prices
  addOns.forEach(addOn => {
    const addOnConfig = this.addOns.find(a => a.name === addOn.name);
    if (addOnConfig) {
      totalPrice += addOnConfig.price * (addOn.quantity || 1);
    }
  });

  return totalPrice;
};

// Method to update rating
menuItemSchema.methods.updateRating = async function() {
  const Review = mongoose.model('Review');
  const reviews = await Review.find({ menuItem: this._id });
  
  if (reviews.length === 0) {
    this.rating.average = 0;
    this.rating.count = 0;
  } else {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating.average = Math.round((totalRating / reviews.length) * 10) / 10;
    this.rating.count = reviews.length;
  }
  
  await this.save();
};

// Static method to get popular items
menuItemSchema.statics.getPopularItems = function(restaurantId, limit = 10) {
  return this.find({
    restaurant: restaurantId,
    status: 'active',
    'availability.isAvailable': true
  })
  .sort({ orderCount: -1, 'rating.average': -1 })
  .limit(limit);
};

// Static method to get recommended items
menuItemSchema.statics.getRecommendedItems = function(restaurantId, limit = 5) {
  return this.find({
    restaurant: restaurantId,
    status: 'active',
    'availability.isAvailable': true,
    isRecommended: true
  })
  .sort({ 'rating.average': -1 })
  .limit(limit);
};

// Pre-save middleware to set popular flag based on order count
menuItemSchema.pre('save', function(next) {
  if (this.orderCount >= 50) {
    this.isPopular = true;
  }
  next();
});

module.exports = mongoose.model('MenuItem', menuItemSchema);
