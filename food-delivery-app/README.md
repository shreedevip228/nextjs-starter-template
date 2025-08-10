# 🍕 FoodDelivery - Complete Food Delivery Application

A full-stack food delivery application built with React, Node.js, Express, and MongoDB. Features include user authentication, restaurant management, order processing, real-time tracking, admin dashboard, and payment integration.

## 🚀 Features

### User Features
- **Authentication**: Email/password login with phone OTP verification
- **Restaurant Discovery**: Browse restaurants by cuisine, rating, price range, and location
- **Menu Browsing**: View detailed menus with customization options
- **Cart Management**: Add items with customizations, manage quantities
- **Order Placement**: Secure checkout with multiple payment options
- **Order Tracking**: Real-time order status updates
- **Reviews & Ratings**: Rate restaurants and dishes
- **Profile Management**: Manage addresses, preferences, and order history

### Restaurant Owner Features
- **Restaurant Management**: Create and manage restaurant profiles
- **Menu Management**: Add, edit, and manage menu items
- **Order Management**: View and process incoming orders
- **Analytics Dashboard**: Track sales, popular items, and performance
- **Review Management**: Respond to customer reviews

### Admin Features
- **Dashboard**: Overview of platform statistics
- **User Management**: Manage user accounts and permissions
- **Restaurant Approval**: Approve new restaurant registrations
- **Order Monitoring**: Monitor all platform orders
- **Content Moderation**: Manage reviews and reported content
- **Analytics**: Platform-wide analytics and reporting

### Technical Features
- **Real-time Updates**: Socket.io for live order tracking
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Payment Integration**: Mock Razorpay/Stripe integration
- **Search & Filters**: Advanced search and filtering capabilities
- **Geolocation**: Location-based restaurant discovery
- **Image Optimization**: Optimized image loading and caching
- **Error Handling**: Comprehensive error handling and user feedback

## 🛠 Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **React Query** - Server state management
- **Axios** - HTTP client
- **React Hook Form** - Form handling
- **React Hot Toast** - Notifications
- **Headless UI** - Accessible UI components

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication
- **Socket.io** - Real-time communication
- **Bcrypt** - Password hashing
- **Express Validator** - Input validation
- **Multer** - File upload handling
- **Nodemailer** - Email service

## 📋 Prerequisites

- Node.js 18+ and npm
- MongoDB 4.4+
- Git

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd food-delivery-app
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Setup

Create environment files:

**Backend (.env)**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your configuration:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/food-delivery-app

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development

# Email (for OTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Payment (Mock)
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

**Frontend (.env)**
```bash
cd ../frontend
echo "VITE_API_URL=http://localhost:5000/api" > .env
```

### 4. Database Setup

Start MongoDB and seed the database:

```bash
# Start MongoDB (if not running as service)
mongod

# Seed the database with sample data
cd backend
npm run seed
```

### 5. Start the Application

```bash
# From root directory - starts both frontend and backend
npm run dev

# Or start individually:
# Backend (from backend directory)
npm run dev

# Frontend (from frontend directory)
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 👥 Sample Login Credentials

After seeding the database, you can use these credentials:

**Admin**
- Email: admin@fooddelivery.com
- Password: admin123

**Regular User**
- Email: john@example.com
- Password: password123

**Restaurant Owner**
- Email: owner1@example.com
- Password: password123

## 📁 Project Structure

```
food-delivery-app/
├── backend/                 # Backend API
│   ├── src/
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Custom middleware
│   │   ├── scripts/        # Utility scripts
│   │   └── server.js       # Entry point
│   ├── package.json
│   └── .env.example
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React contexts
│   │   ├── services/       # API services
│   │   ├── hooks/          # Custom hooks
│   │   └── utils/          # Utility functions
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── package.json            # Root package.json
└── README.md
```

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
```

### Frontend Testing
```bash
cd frontend
npm test
```

### Run All Tests
```bash
npm test
```

## 📦 Building for Production

### Build Frontend
```bash
cd frontend
npm run build
```

### Build Backend
```bash
cd backend
npm run build
```

### Build All
```bash
npm run build
```

## 🚀 Deployment

### Frontend Deployment (Vercel)

1. **Prepare for deployment:**
```bash
cd frontend
npm run build
```

2. **Deploy to Vercel:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

3. **Environment Variables on Vercel:**
- `VITE_API_URL`: Your backend API URL

### Backend Deployment (Render/Heroku)

#### Render Deployment

1. **Create `render.yaml`:**
```yaml
services:
  - type: web
    name: food-delivery-api
    env: node
    buildCommand: cd backend && npm install
    startCommand: cd backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        fromDatabase:
          name: food-delivery-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: FRONTEND_URL
        value: https://your-frontend-url.vercel.app

databases:
  - name: food-delivery-db
    databaseName: food-delivery-app
    user: food-delivery-user
```

2. **Deploy to Render:**
- Connect your GitHub repository
- Render will automatically deploy using the `render.yaml` configuration

#### Heroku Deployment

1. **Create Heroku app:**
```bash
heroku create your-app-name
```

2. **Set environment variables:**
```bash
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=your-mongodb-uri
heroku config:set JWT_SECRET=your-jwt-secret
heroku config:set FRONTEND_URL=your-frontend-url
```

3. **Deploy:**
```bash
git subtree push --prefix backend heroku main
```

### Database Deployment (MongoDB Atlas)

1. **Create MongoDB Atlas cluster**
2. **Get connection string**
3. **Update environment variables with Atlas URI**
4. **Seed production database:**
```bash
NODE_ENV=production npm run seed
```

## 🔧 Configuration

### Environment Variables

**Backend Environment Variables:**
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `JWT_EXPIRES_IN`: JWT token expiration time
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment (development/production)
- `EMAIL_HOST`: SMTP host for emails
- `EMAIL_PORT`: SMTP port
- `EMAIL_USER`: SMTP username
- `EMAIL_PASS`: SMTP password
- `FRONTEND_URL`: Frontend application URL
- `RAZORPAY_KEY_ID`: Razorpay API key
- `RAZORPAY_KEY_SECRET`: Razorpay secret key

**Frontend Environment Variables:**
- `VITE_API_URL`: Backend API base URL

### Database Configuration

The application uses MongoDB with the following collections:
- `users`: User accounts and profiles
- `restaurants`: Restaurant information
- `menuitems`: Menu items for restaurants
- `orders`: Order data and history
- `reviews`: Customer reviews and ratings

## 🔍 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/forgot-password` - Forgot password
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/verify-phone` - Verify phone OTP

### Restaurant Endpoints
- `GET /api/restaurants` - Get all restaurants
- `GET /api/restaurants/:id` - Get restaurant by ID
- `POST /api/restaurants` - Create restaurant
- `PUT /api/restaurants/:id` - Update restaurant
- `DELETE /api/restaurants/:id` - Delete restaurant

### Menu Endpoints
- `GET /api/menu/restaurant/:id` - Get restaurant menu
- `GET /api/menu/:id` - Get menu item
- `POST /api/menu` - Create menu item
- `PUT /api/menu/:id` - Update menu item
- `DELETE /api/menu/:id` - Delete menu item

### Order Endpoints
- `POST /api/orders` - Create order
- `GET /api/orders/my-orders` - Get user orders
- `GET /api/orders/:id` - Get order by ID
- `PATCH /api/orders/:id/status` - Update order status
- `PATCH /api/orders/:id/cancel` - Cancel order

### Review Endpoints
- `GET /api/reviews/restaurant/:id` - Get restaurant reviews
- `POST /api/reviews` - Create review
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review

## 🐛 Troubleshooting

### Common Issues

**1. MongoDB Connection Error**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
- Ensure MongoDB is running
- Check MongoDB URI in environment variables
- Verify MongoDB service is started

**2. Port Already in Use**
```
Error: listen EADDRINUSE :::5000
```
- Kill process using the port: `lsof -ti:5000 | xargs kill -9`
- Or change PORT in environment variables

**3. JWT Token Issues**
```
Error: JsonWebTokenError: invalid token
```
- Clear localStorage in browser
- Check JWT_SECRET in environment variables
- Ensure token is being sent in Authorization header

**4. CORS Issues**
```
Access to XMLHttpRequest blocked by CORS policy
```
- Verify FRONTEND_URL in backend environment
- Check CORS configuration in server.js

**5. Build Errors**
```
Module not found: Can't resolve
```
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check import paths and file names
- Verify all dependencies are installed

### Performance Optimization

**Frontend:**
- Enable code splitting with lazy loading
- Optimize images and use WebP format
- Implement service worker for caching
- Use React.memo for expensive components

**Backend:**
- Add database indexes for frequently queried fields
- Implement Redis for caching
- Use compression middleware
- Optimize database queries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- React team for the amazing framework
- MongoDB team for the database
- Tailwind CSS for the utility-first CSS framework
- All open-source contributors

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Email: support@fooddelivery.com

---

**Happy Coding! 🚀**
