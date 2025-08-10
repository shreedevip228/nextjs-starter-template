const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Review = require('../models/Review');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected for seeding');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Sample data
const sampleUsers = [
  {
    name: 'Admin User',
    email: 'admin@fooddelivery.com',
    password: 'admin123',
    phone: '+1234567890',
    role: 'admin',
    isEmailVerified: true,
    isPhoneVerified: true
  },
  {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    phone: '+1234567891',
    role: 'user',
    isEmailVerified: true,
    isPhoneVerified: true,
    addresses: [{
      type: 'home',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      isDefault: true
    }]
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'password123',
    phone: '+1234567892',
    role: 'user',
    isEmailVerified: true,
    isPhoneVerified: true,
    addresses: [{
      type: 'home',
      street: '456 Oak Ave',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90210',
      isDefault: true
    }]
  },
  {
    name: 'Restaurant Owner 1',
    email: 'owner1@example.com',
    password: 'password123',
    phone: '+1234567893',
    role: 'restaurant_owner',
    isEmailVerified: true,
    isPhoneVerified: true
  },
  {
    name: 'Restaurant Owner 2',
    email: 'owner2@example.com',
    password: 'password123',
    phone: '+1234567894',
    role: 'restaurant_owner',
    isEmailVerified: true,
    isPhoneVerified: true
  }
];

const sampleRestaurants = [
  {
    name: 'Spice Garden',
    description: 'Authentic Indian cuisine with traditional spices and flavors',
    cuisine: ['Indian'],
    address: {
      street: '789 Curry Lane',
      city: 'New York',
      state: 'NY',
      zipCode: '10002',
      coordinates: {
        latitude: 40.7128,
        longitude: -74.0060
      }
    },
    contact: {
      phone: '+1234567895',
      email: 'info@spicegarden.com'
    },
    images: {
      logo: 'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/3494f73e-369e-49aa-adb8-51bd47997c05.png',
      banner: 'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/3ac257ab-ca93-45cd-aed6-dbf7362d33f5.png',
      gallery: [
        'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/25ce0cf9-1f99-430a-a359-b7b4827ecd0d.png',
        'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/c627aa88-7a0a-46b3-8394-a9fb24053d13.png'
      ]
    },
    rating: {
      average: 4.5,
      count: 150
    },
    priceRange: '$$',
    deliveryInfo: {
      deliveryTime: { min: 30, max: 45 },
      deliveryFee: 3.99,
      minimumOrder: 15,
      deliveryRadius: 10
    },
    features: ['Pure Veg', 'Spicy', 'Healthy'],
    status: 'active',
    totalOrders: 500,
    totalRevenue: 12500
  },
  {
    name: 'Dragon Palace',
    description: 'Delicious Chinese food with fresh ingredients and authentic recipes',
    cuisine: ['Chinese'],
    address: {
      street: '456 Dragon St',
      city: 'New York',
      state: 'NY',
      zipCode: '10003',
      coordinates: {
        latitude: 40.7589,
        longitude: -73.9851
      }
    },
    contact: {
      phone: '+1234567896',
      email: 'info@dragonpalace.com'
    },
    images: {
      logo: 'https://placehold.co/200x200?text=Dragon+Palace+Logo',
      banner: 'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/2097f457-f575-4e7f-890b-41bab39b085a.png',
      gallery: [
        'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/1f2b7ef8-149c-4180-bd35-455e0ae69abd.png',
        'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/3af494f7-3db8-45b9-b224-d0b2f406a998.png'
      ]
    },
    rating: {
      average: 4.2,
      count: 200
    },
    priceRange: '$$',
    deliveryInfo: {
      deliveryTime: { min: 25, max: 40 },
      deliveryFee: 2.99,
      minimumOrder: 20,
      deliveryRadius: 8
    },
    features: ['Non-Veg', 'Fast Delivery'],
    status: 'active',
    totalOrders: 750,
    totalRevenue: 18750
  },
  {
    name: 'Mama Mia Pizzeria',
    description: 'Authentic Italian pizza and pasta made with love',
    cuisine: ['Italian'],
    address: {
      street: '321 Pizza Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '10004',
      coordinates: {
        latitude: 40.7505,
        longitude: -73.9934
      }
    },
    contact: {
      phone: '+1234567897',
      email: 'info@mamamiapizza.com'
    },
    images: {
      logo: 'https://placehold.co/200x200?text=Mama+Mia+Logo',
      banner: 'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/2e45c2bd-0a1a-45aa-ab30-ef131d9cab32.png',
      gallery: [
        'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/490cf9e0-6739-480b-b531-454e8cdd52bb.png',
        'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/7e1c81e4-805a-42eb-b8a0-9c7214e068d8.png'
      ]
    },
    rating: {
      average: 4.7,
      count: 300
    },
    priceRange: '$$',
    deliveryInfo: {
      deliveryTime: { min: 20, max: 35 },
      deliveryFee: 4.99,
      minimumOrder: 12,
      deliveryRadius: 12
    },
    features: ['Fast Delivery', 'Late Night'],
    status: 'active',
    totalOrders: 1200,
    totalRevenue: 24000
  },
  {
    name: 'Taco Fiesta',
    description: 'Fresh Mexican food with authentic flavors and spices',
    cuisine: ['Mexican'],
    address: {
      street: '654 Taco Street',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90211',
      coordinates: {
        latitude: 34.0522,
        longitude: -118.2437
      }
    },
    contact: {
      phone: '+1234567898',
      email: 'info@tacofiesta.com'
    },
    images: {
      logo: 'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/d759807a-c3a7-4639-97e8-03a63f0ea2d6.png',
      banner: 'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/319d1c81-9db5-4a12-a7ae-85239b96d5d2.png',
      gallery: [
        'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/c96274bb-cf38-4235-8a17-6e11faa819e6.png',
        'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/511006fa-dbd6-4ce9-86b6-2dd688ae3722.png'
      ]
    },
    rating: {
      average: 4.3,
      count: 180
    },
    priceRange: '$',
    deliveryInfo: {
      deliveryTime: { min: 15, max: 30 },
      deliveryFee: 2.49,
      minimumOrder: 10,
      deliveryRadius: 15
    },
    features: ['Fast Delivery', 'Spicy', 'Value for Money'],
    status: 'active',
    totalOrders: 800,
    totalRevenue: 12000
  },
  {
    name: 'Sushi Zen',
    description: 'Fresh sushi and Japanese cuisine prepared by expert chefs',
    cuisine: ['Japanese'],
    address: {
      street: '987 Sushi Lane',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90212',
      coordinates: {
        latitude: 34.0736,
        longitude: -118.4004
      }
    },
    contact: {
      phone: '+1234567899',
      email: 'info@sushizen.com'
    },
    images: {
      logo: 'https://placehold.co/200x200?text=Sushi+Zen+Logo',
      banner: 'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/589ed176-7e2b-4588-9a17-45f933ca4973.png',
      gallery: [
        'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/cb0df465-6023-4d99-bdf8-ee26f39ffdef.png',
        'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/3d31bdc5-a11b-4d50-b814-dc291561c149.png'
      ]
    },
    rating: {
      average: 4.8,
      count: 120
    },
    priceRange: '$$$',
    deliveryInfo: {
      deliveryTime: { min: 35, max: 50 },
      deliveryFee: 5.99,
      minimumOrder: 25,
      deliveryRadius: 8
    },
    features: ['Fresh Ingredients', 'Premium Quality'],
    status: 'active',
    totalOrders: 400,
    totalRevenue: 16000
  }
];

const sampleMenuItems = [
  // Spice Garden Menu Items
  {
    name: 'Butter Chicken',
    description: 'Tender chicken in rich, creamy tomato-based curry',
    category: 'Main Course',
    price: 16.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/6979533c-4ea7-4f3e-808e-026b45ccbcee.png'],
    ingredients: ['Chicken', 'Tomatoes', 'Cream', 'Spices', 'Onions'],
    dietaryTags: ['Non-Veg', 'Mild'],
    spiceLevel: 'Mild',
    preparationTime: 25,
    servingSize: '1 serving',
    isPopular: true,
    orderCount: 150
  },
  {
    name: 'Vegetable Biryani',
    description: 'Fragrant basmati rice with mixed vegetables and aromatic spices',
    category: 'Main Course',
    price: 14.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/29e537a3-a2f6-42c0-968d-b71e6ff8d97d.png'],
    ingredients: ['Basmati Rice', 'Mixed Vegetables', 'Spices', 'Saffron'],
    dietaryTags: ['Vegetarian', 'Vegan'],
    spiceLevel: 'Medium',
    preparationTime: 30,
    servingSize: '1 serving',
    isRecommended: true,
    orderCount: 120
  },
  {
    name: 'Samosa (2 pieces)',
    description: 'Crispy pastry filled with spiced potatoes and peas',
    category: 'Appetizers',
    price: 6.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/da4bf1c2-0784-40b8-87f6-aba865a439c7.png'],
    ingredients: ['Potatoes', 'Peas', 'Spices', 'Pastry'],
    dietaryTags: ['Vegetarian', 'Vegan'],
    spiceLevel: 'Mild',
    preparationTime: 10,
    servingSize: '2 pieces',
    orderCount: 200
  },
  {
    name: 'Mango Lassi',
    description: 'Refreshing yogurt drink with sweet mango',
    category: 'Beverages',
    price: 4.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/cc22417d-a14b-4f5f-a8d1-3c2295c1685e.png'],
    ingredients: ['Yogurt', 'Mango', 'Sugar', 'Cardamom'],
    dietaryTags: ['Vegetarian'],
    preparationTime: 5,
    servingSize: '1 glass',
    orderCount: 80
  },
  // Dragon Palace Menu Items
  {
    name: 'Sweet and Sour Chicken',
    description: 'Crispy chicken with bell peppers in tangy sweet and sour sauce',
    category: 'Main Course',
    price: 15.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/738280ee-9049-4bed-878c-71f76a384abc.png'],
    ingredients: ['Chicken', 'Bell Peppers', 'Pineapple', 'Sweet & Sour Sauce'],
    dietaryTags: ['Non-Veg'],
    preparationTime: 20,
    servingSize: '1 serving',
    isPopular: true,
    orderCount: 180
  },
  {
    name: 'Vegetable Fried Rice',
    description: 'Wok-fried rice with fresh vegetables and soy sauce',
    category: 'Main Course',
    price: 12.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/77148c4a-d624-4763-9613-8cc9ed8fad04.png'],
    ingredients: ['Rice', 'Mixed Vegetables', 'Soy Sauce', 'Garlic'],
    dietaryTags: ['Vegetarian', 'Vegan'],
    preparationTime: 15,
    servingSize: '1 serving',
    orderCount: 140
  },
  {
    name: 'Spring Rolls (4 pieces)',
    description: 'Crispy rolls filled with fresh vegetables',
    category: 'Appetizers',
    price: 7.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/9edd7a99-2710-4388-86e9-f74cb61c394a.png'],
    ingredients: ['Cabbage', 'Carrots', 'Bean Sprouts', 'Wrapper'],
    dietaryTags: ['Vegetarian', 'Vegan'],
    preparationTime: 12,
    servingSize: '4 pieces',
    orderCount: 100
  },
  // Mama Mia Menu Items
  {
    name: 'Margherita Pizza',
    description: 'Classic pizza with fresh mozzarella, tomatoes, and basil',
    category: 'Main Course',
    price: 18.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/41b97b6a-4941-4fa8-97ed-703ef37c6bab.png'],
    ingredients: ['Pizza Dough', 'Mozzarella', 'Tomatoes', 'Basil'],
    dietaryTags: ['Vegetarian'],
    preparationTime: 18,
    servingSize: '12 inch pizza',
    isPopular: true,
    orderCount: 250
  },
  {
    name: 'Spaghetti Carbonara',
    description: 'Creamy pasta with bacon, eggs, and parmesan cheese',
    category: 'Main Course',
    price: 16.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/074914b5-e209-479c-acbb-954eb0caac7b.png'],
    ingredients: ['Spaghetti', 'Bacon', 'Eggs', 'Parmesan', 'Cream'],
    dietaryTags: ['Non-Veg'],
    preparationTime: 15,
    servingSize: '1 serving',
    orderCount: 160
  },
  {
    name: 'Caesar Salad',
    description: 'Fresh romaine lettuce with caesar dressing and croutons',
    category: 'Salads',
    price: 11.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/408865d9-9231-4873-ad49-fc66760d9934.png'],
    ingredients: ['Romaine Lettuce', 'Caesar Dressing', 'Croutons', 'Parmesan'],
    dietaryTags: ['Vegetarian'],
    preparationTime: 8,
    servingSize: '1 serving',
    orderCount: 90
  },
  // Taco Fiesta Menu Items
  {
    name: 'Chicken Tacos (3 pieces)',
    description: 'Soft tacos with grilled chicken, lettuce, and salsa',
    category: 'Main Course',
    price: 12.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/29c9ffa8-525c-48f5-9c5b-cdb8e8664ef4.png'],
    ingredients: ['Chicken', 'Tortillas', 'Lettuce', 'Salsa', 'Cheese'],
    dietaryTags: ['Non-Veg'],
    preparationTime: 12,
    servingSize: '3 tacos',
    isPopular: true,
    orderCount: 220
  },
  {
    name: 'Veggie Burrito',
    description: 'Large burrito with beans, rice, vegetables, and cheese',
    category: 'Main Course',
    price: 10.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/245eea71-7faa-4c73-97fb-b4c766bc4462.png'],
    ingredients: ['Beans', 'Rice', 'Vegetables', 'Cheese', 'Tortilla'],
    dietaryTags: ['Vegetarian'],
    preparationTime: 10,
    servingSize: '1 burrito',
    orderCount: 130
  },
  {
    name: 'Guacamole & Chips',
    description: 'Fresh guacamole served with crispy tortilla chips',
    category: 'Appetizers',
    price: 8.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/42b01440-ef94-418e-9601-23ac100c96a0.png'],
    ingredients: ['Avocado', 'Lime', 'Onions', 'Tomatoes', 'Tortilla Chips'],
    dietaryTags: ['Vegetarian', 'Vegan'],
    preparationTime: 8,
    servingSize: '1 serving',
    orderCount: 110
  },
  // Sushi Zen Menu Items
  {
    name: 'Salmon Sashimi (6 pieces)',
    description: 'Fresh salmon slices served with wasabi and ginger',
    category: 'Main Course',
    price: 22.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/8ed069b5-43bb-4c85-89d7-444348c1019e.png'],
    ingredients: ['Fresh Salmon', 'Wasabi', 'Pickled Ginger'],
    dietaryTags: ['Non-Veg', 'Fresh'],
    preparationTime: 10,
    servingSize: '6 pieces',
    isRecommended: true,
    orderCount: 85
  },
  {
    name: 'California Roll (8 pieces)',
    description: 'Crab, avocado, and cucumber roll with sesame seeds',
    category: 'Main Course',
    price: 18.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/35b1c3f1-ca19-4188-9eee-8396454dbd27.png'],
    ingredients: ['Crab', 'Avocado', 'Cucumber', 'Nori', 'Rice'],
    dietaryTags: ['Non-Veg'],
    preparationTime: 15,
    servingSize: '8 pieces',
    isPopular: true,
    orderCount: 120
  },
  {
    name: 'Miso Soup',
    description: 'Traditional Japanese soup with tofu and seaweed',
    category: 'Soups',
    price: 6.99,
    images: ['https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/f1ff6379-9d32-423c-a745-0cbce343296b.png'],
    ingredients: ['Miso Paste', 'Tofu', 'Seaweed', 'Green Onions'],
    dietaryTags: ['Vegetarian', 'Vegan'],
    preparationTime: 8,
    servingSize: '1 bowl',
    orderCount: 70
  }
];

// Seed function
const seedData = async () => {
  try {
    console.log('Starting data seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Restaurant.deleteMany({});
    await MenuItem.deleteMany({});
    await Order.deleteMany({});
    await Review.deleteMany({});
    console.log('Cleared existing data');

    // Create users
    const users = [];
    for (const userData of sampleUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const user = await User.create({
        ...userData,
        password: hashedPassword
      });
      users.push(user);
    }
    console.log(`Created ${users.length} users`);

    // Create restaurants
    const restaurants = [];
    for (let i = 0; i < sampleRestaurants.length; i++) {
      const restaurantData = sampleRestaurants[i];
      // Assign restaurant owners (skip admin and regular users)
      const ownerIndex = i + 3; // Start from index 3 (restaurant owners)
      const restaurant = await Restaurant.create({
        ...restaurantData,
        owner: users[ownerIndex]._id
      });
      restaurants.push(restaurant);
    }
    console.log(`Created ${restaurants.length} restaurants`);

    // Create menu items
    const menuItems = [];
    let menuItemIndex = 0;
    for (let i = 0; i < restaurants.length; i++) {
      const restaurant = restaurants[i];
      const itemsPerRestaurant = Math.ceil(sampleMenuItems.length / restaurants.length);
      
      for (let j = 0; j < itemsPerRestaurant && menuItemIndex < sampleMenuItems.length; j++) {
        const menuItemData = sampleMenuItems[menuItemIndex];
        const menuItem = await MenuItem.create({
          ...menuItemData,
          restaurant: restaurant._id
        });
        menuItems.push(menuItem);
        menuItemIndex++;
      }
    }
    console.log(`Created ${menuItems.length} menu items`);

    // Create sample orders
    const orders = [];
    const regularUsers = users.filter(user => user.role === 'user');
    
    for (let i = 0; i < 20; i++) {
      const user = regularUsers[Math.floor(Math.random() * regularUsers.length)];
      const restaurant = restaurants[Math.floor(Math.random() * restaurants.length)];
      const restaurantMenuItems = menuItems.filter(item => 
        item.restaurant.toString() === restaurant._id.toString()
      );
      
      if (restaurantMenuItems.length === 0) continue;

      const orderItems = [];
      const numItems = Math.floor(Math.random() * 3) + 1; // 1-3 items
      
      for (let j = 0; j < numItems; j++) {
        const menuItem = restaurantMenuItems[Math.floor(Math.random() * restaurantMenuItems.length)];
        const quantity = Math.floor(Math.random() * 2) + 1; // 1-2 quantity
        
        orderItems.push({
          menuItem: menuItem._id,
          name: menuItem.name,
          price: menuItem.price,
          quantity,
          customizations: [],
          addOns: [],
          itemTotal: menuItem.price * quantity
        });
      }

      const subtotal = orderItems.reduce((sum, item) => sum + item.itemTotal, 0);
      const deliveryFee = restaurant.deliveryInfo.deliveryFee;
      const tax = subtotal * 0.08;
      const total = subtotal + deliveryFee + tax;

      const statuses = ['delivered', 'delivered', 'delivered', 'out_for_delivery', 'preparing'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const order = await Order.create({
        user: user._id,
        restaurant: restaurant._id,
        items: orderItems,
        pricing: {
          subtotal,
          deliveryFee,
          tax,
          discount: { amount: 0 },
          tip: 0,
          total
        },
        deliveryAddress: user.addresses[0],
        contactInfo: {
          phone: user.phone
        },
        paymentInfo: {
          method: 'card',
          status: 'completed',
          transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        },
        status,
        estimatedDeliveryTime: new Date(Date.now() + 45 * 60000),
        actualDeliveryTime: status === 'delivered' ? new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000) : null
      });
      orders.push(order);
    }
    console.log(`Created ${orders.length} orders`);

    // Create sample reviews for delivered orders
    const deliveredOrders = orders.filter(order => order.status === 'delivered');
    const reviews = [];
    
    for (const order of deliveredOrders.slice(0, 15)) { // Create reviews for first 15 delivered orders
      const rating = {
        overall: Math.floor(Math.random() * 2) + 4, // 4-5 stars
        food: Math.floor(Math.random() * 2) + 4,
        delivery: Math.floor(Math.random() * 2) + 4,
        service: Math.floor(Math.random() * 2) + 4,
        packaging: Math.floor(Math.random() * 2) + 4
      };

      const comments = [
        'Great food and fast delivery!',
        'Delicious meal, will order again.',
        'Food was fresh and tasty.',
        'Excellent service and quality.',
        'Really enjoyed the meal.',
        'Good value for money.',
        'Fresh ingredients and great taste.',
        'Quick delivery and hot food.',
        'Highly recommended!',
        'Amazing flavors and presentation.'
      ];

      const review = await Review.create({
        user: order.user,
        restaurant: order.restaurant,
        order: order._id,
        rating,
        review: {
          comment: comments[Math.floor(Math.random() * comments.length)]
        },
        isVerifiedPurchase: true,
        helpfulVotes: {
          count: Math.floor(Math.random() * 10),
          users: []
        }
      });
      reviews.push(review);
    }
    console.log(`Created ${reviews.length} reviews`);

    console.log('Data seeding completed successfully!');
    console.log('\nSample login credentials:');
    console.log('Admin: admin@fooddelivery.com / admin123');
    console.log('User: john@example.com / password123');
    console.log('User: jane@example.com / password123');
    console.log('Restaurant Owner: owner1@example.com / password123');
    console.log('Restaurant Owner: owner2@example.com / password123');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run seeding
connectDB().then(() => {
  seedData();
});
