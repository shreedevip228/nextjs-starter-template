const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Restaurant name is required'],
    trim: true,
    maxlength: [100, 'Restaurant name cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Restaurant description is required'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  cuisine: [{
    type: String,
    required: true,
    enum: [
      'Indian', 'Chinese', 'Italian', 'Mexican', 'Thai', 'Japanese',
      'American', 'Mediterranean', 'French', 'Korean', 'Vietnamese',
      'Lebanese', 'Greek', 'Spanish', 'Turkish', 'Continental'
    ]
  }],
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    zipCode: {
      type: String,
      required: [true, 'Zip code is required']
    },
    coordinates: {
      latitude: {
        type: Number,
        required: true
      },
      longitude: {
        type: Number,
        required: true
      }
    }
  },
  contact: {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email'
      ]
    }
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  images: {
    logo: {
      type: String,
      required: [true, 'Restaurant logo is required']
    },
    banner: {
      type: String,
      required: [true, 'Restaurant banner is required']
    },
    gallery: [String]
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
  priceRange: {
    type: String,
    enum: ['$', '$$', '$$$', '$$$$'],
    required: true
  },
  deliveryInfo: {
    deliveryTime: {
      min: {
        type: Number,
        required: true,
        min: 10
      },
      max: {
        type: Number,
        required: true,
        min: 15
      }
    },
    deliveryFee: {
      type: Number,
      required: true,
      min: 0
    },
    minimumOrder: {
      type: Number,
      required: true,
      min: 0
    },
    deliveryRadius: {
      type: Number,
      required: true,
      min: 1,
      max: 50 // in kilometers
    }
  },
  operatingHours: {
    monday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '09:00' },
      closeTime: { type: String, default: '23:00' }
    },
    tuesday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '09:00' },
      closeTime: { type: String, default: '23:00' }
    },
    wednesday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '09:00' },
      closeTime: { type: String, default: '23:00' }
    },
    thursday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '09:00' },
      closeTime: { type: String, default: '23:00' }
    },
    friday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '09:00' },
      closeTime: { type: String, default: '23:00' }
    },
    saturday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '09:00' },
      closeTime: { type: String, default: '23:00' }
    },
    sunday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '09:00' },
      closeTime: { type: String, default: '23:00' }
    }
  },
  features: [{
    type: String,
    enum: [
      'Pure Veg', 'Non-Veg', 'Vegan Options', 'Gluten Free',
      'Organic', 'Healthy', 'Fast Delivery', 'Late Night',
      'Breakfast', 'Desserts', 'Beverages', 'Alcohol Available'
    ]
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'temporarily_closed', 'pending_approval'],
    default: 'pending_approval'
  },
  isPromoted: {
    type: Boolean,
    default: false
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  tags: [String],
  socialMedia: {
    facebook: String,
    instagram: String,
    twitter: String,
    website: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
restaurantSchema.index({ 'address.city': 1 });
restaurantSchema.index({ cuisine: 1 });
restaurantSchema.index({ 'rating.average': -1 });
restaurantSchema.index({ priceRange: 1 });
restaurantSchema.index({ status: 1 });
restaurantSchema.index({ 'address.coordinates': '2dsphere' });

// Virtual for checking if restaurant is currently open
restaurantSchema.virtual('isCurrentlyOpen').get(function() {
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  const todayHours = this.operatingHours[currentDay];
  
  if (!todayHours || !todayHours.isOpen) {
    return false;
  }
  
  return currentTime >= todayHours.openTime && currentTime <= todayHours.closeTime;
});

// Method to calculate distance from a point
restaurantSchema.methods.calculateDistance = function(lat, lng) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat - this.address.coordinates.latitude) * Math.PI / 180;
  const dLng = (lng - this.address.coordinates.longitude) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(this.address.coordinates.latitude * Math.PI / 180) *
    Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

// Method to check if delivery is available to a location
restaurantSchema.methods.canDeliverTo = function(lat, lng) {
  const distance = this.calculateDistance(lat, lng);
  return distance <= this.deliveryInfo.deliveryRadius;
};

// Static method to find restaurants near a location
restaurantSchema.statics.findNearby = function(lat, lng, maxDistance = 10) {
  return this.find({
    'address.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: maxDistance * 1000 // Convert km to meters
      }
    },
    status: 'active'
  });
};

// Update rating when new review is added
restaurantSchema.methods.updateRating = async function(newRating) {
  const Review = mongoose.model('Review');
  const reviews = await Review.find({ restaurant: this._id });
  
  if (reviews.length === 0) {
    this.rating.average = newRating;
    this.rating.count = 1;
  } else {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating.average = Math.round((totalRating / reviews.length) * 10) / 10;
    this.rating.count = reviews.length;
  }
  
  await this.save();
};

module.exports = mongoose.model('Restaurant', restaurantSchema);
