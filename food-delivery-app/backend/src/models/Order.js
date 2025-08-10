const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
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
  items: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    customizations: [{
      name: String,
      selectedOption: String,
      price: {
        type: Number,
        default: 0
      }
    }],
    addOns: [{
      name: String,
      price: {
        type: Number,
        required: true
      },
      quantity: {
        type: Number,
        default: 1
      }
    }],
    specialInstructions: String,
    itemTotal: {
      type: Number,
      required: true
    }
  }],
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    deliveryFee: {
      type: Number,
      required: true,
      min: 0
    },
    tax: {
      type: Number,
      required: true,
      min: 0
    },
    discount: {
      amount: {
        type: Number,
        default: 0,
        min: 0
      },
      couponCode: String,
      description: String
    },
    tip: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  },
  deliveryAddress: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    landmark: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    deliveryInstructions: String
  },
  contactInfo: {
    phone: {
      type: String,
      required: true
    },
    alternatePhone: String
  },
  status: {
    type: String,
    enum: [
      'pending',           // Order placed, waiting for restaurant confirmation
      'confirmed',         // Restaurant confirmed the order
      'preparing',         // Food is being prepared
      'ready_for_pickup',  // Food is ready for delivery pickup
      'out_for_delivery',  // Delivery person picked up the order
      'delivered',         // Order delivered successfully
      'cancelled',         // Order cancelled
      'refunded'          // Order refunded
    ],
    default: 'pending'
  },
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  estimatedDeliveryTime: {
    type: Date,
    required: true
  },
  actualDeliveryTime: Date,
  paymentInfo: {
    method: {
      type: String,
      enum: ['card', 'upi', 'wallet', 'cash_on_delivery'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    paymentGateway: {
      type: String,
      enum: ['razorpay', 'stripe', 'paytm', 'phonepe']
    },
    paidAt: Date,
    refundedAt: Date,
    refundAmount: {
      type: Number,
      default: 0
    }
  },
  deliveryPerson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  deliveryTracking: {
    assignedAt: Date,
    pickedUpAt: Date,
    estimatedArrival: Date,
    currentLocation: {
      latitude: Number,
      longitude: Number,
      lastUpdated: Date
    }
  },
  rating: {
    food: {
      type: Number,
      min: 1,
      max: 5
    },
    delivery: {
      type: Number,
      min: 1,
      max: 5
    },
    overall: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String,
    ratedAt: Date
  },
  specialRequests: String,
  cancellationReason: String,
  refundReason: String,
  isScheduled: {
    type: Boolean,
    default: false
  },
  scheduledFor: Date,
  notifications: {
    sms: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
orderSchema.index({ user: 1 });
orderSchema.index({ restaurant: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'paymentInfo.status': 1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    this.orderNumber = `ORD${Date.now()}${String(count + 1).padStart(4, '0')}`;
    
    // Add initial status to history
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      note: 'Order placed'
    });
  }
  next();
});

// Virtual for order age in minutes
orderSchema.virtual('orderAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60));
});

// Virtual for delivery time remaining
orderSchema.virtual('deliveryTimeRemaining').get(function() {
  if (!this.estimatedDeliveryTime) return null;
  const remaining = this.estimatedDeliveryTime - Date.now();
  return remaining > 0 ? Math.floor(remaining / (1000 * 60)) : 0;
});

// Method to update order status
orderSchema.methods.updateStatus = function(newStatus, note = '', updatedBy = null) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note,
    updatedBy
  });

  // Set specific timestamps based on status
  switch (newStatus) {
    case 'confirmed':
      // Calculate estimated delivery time (restaurant prep time + delivery time)
      const prepTime = 30; // minutes
      const deliveryTime = 20; // minutes
      this.estimatedDeliveryTime = new Date(Date.now() + (prepTime + deliveryTime) * 60000);
      break;
    case 'out_for_delivery':
      this.deliveryTracking.pickedUpAt = new Date();
      this.deliveryTracking.estimatedArrival = new Date(Date.now() + 20 * 60000); // 20 minutes
      break;
    case 'delivered':
      this.actualDeliveryTime = new Date();
      break;
  }

  return this.save();
};

// Method to calculate delivery delay
orderSchema.methods.getDeliveryDelay = function() {
  if (!this.actualDeliveryTime || !this.estimatedDeliveryTime) return 0;
  return Math.max(0, Math.floor((this.actualDeliveryTime - this.estimatedDeliveryTime) / (1000 * 60)));
};

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  const nonCancellableStatuses = ['out_for_delivery', 'delivered', 'cancelled', 'refunded'];
  return !nonCancellableStatuses.includes(this.status);
};

// Method to calculate refund amount
orderSchema.methods.calculateRefundAmount = function() {
  if (this.status === 'pending' || this.status === 'confirmed') {
    return this.pricing.total; // Full refund
  } else if (this.status === 'preparing') {
    return this.pricing.total * 0.8; // 80% refund
  } else if (this.status === 'ready_for_pickup') {
    return this.pricing.total * 0.5; // 50% refund
  }
  return 0; // No refund for delivered orders
};

// Static method to get order statistics
orderSchema.statics.getOrderStats = async function(restaurantId, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        restaurant: mongoose.Types.ObjectId(restaurantId),
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.total' },
        averageOrderValue: { $avg: '$pricing.total' },
        completedOrders: {
          $sum: {
            $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
          }
        },
        cancelledOrders: {
          $sum: {
            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
          }
        }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    completedOrders: 0,
    cancelledOrders: 0
  };
};

// Static method to get popular items from orders
orderSchema.statics.getPopularItems = async function(restaurantId, limit = 10) {
  const pipeline = [
    {
      $match: {
        restaurant: mongoose.Types.ObjectId(restaurantId),
        status: 'delivered'
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.menuItem',
        name: { $first: '$items.name' },
        totalOrdered: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.itemTotal' }
      }
    },
    { $sort: { totalOrdered: -1 } },
    { $limit: limit }
  ];

  return await this.aggregate(pipeline);
};

module.exports = mongoose.model('Order', orderSchema);
