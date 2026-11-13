# NexaCart
NexaCart -- Modern E-Commerce Web Application
NexaCart is a full-stack e-commerce web application developed as part of
the NextGen Web internship at Thiranex -- Skill Development &
Future Tech. The application provides an online shopping experience
with product discovery, cart and checkout functionality, order tracking,
and an administration panel.
Project Overview
- Project: NexaCart -- Modern E-Commerce Web Application
- Internship organization: Thiranex
- Internship title: NextGen Web
- Internship duration: 19 April 2026 -- 18 May 2026
- Developer: Sai Spandana Vegulla
- Department: Computer Science and Engineering
- College: Stanley College of Engineering and Technology for Women
Key Features
Authentication and User Access
- User registration and login with input validation
- Password hashing using scrypt
- Signed tokens with a seven-day validity period
- Login attempt limit
- Separate User and Admin roles
Product Catalog
- Browse products
- Search products
- Filter by category and price
- Sort by price, rating, or newest
- Product reviews and ratings
Shopping Cart and Pricing
- Stock-checked cart operations
- Coupon support
- Shipping and GST calculation
- Wishlist functionality
Orders and Tracking
- Address, phone number, and pincode validation
- Order prices stored at the time of purchase
- Order cancellation with stock restoration
- Order history
- Six order statuses with timestamps
- Printable invoice
Admin Panel
- Add, edit, and delete products
- Update order status
- View revenue and top-selling products
- Monitor low-stock products
Technology Stack
  Area                                Technologies
  Frontend                            HTML5, CSS3, JavaScript

  Backend                             Node.js

  API                                 REST API

  Data storage                        JSON file-based database
Development tools                   Visual Studio Code, browser
developer tools, API testing tools
The frontend communicates with the Node.js REST API. The server
processes requests, updates application data in the JSON data store, and
returns JSON responses.
Application Modules
1. Authentication
2. Product catalog
3. Shopping cart and pricing
4. Orders
5. Order tracking
6. Admin panel
The project includes REST API endpoints for product, cart, order,
review, and administration operations.
   
