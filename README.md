# 💍 WedPlan — Wedding Planning Platform

<p align="center">
  **Your Day. Your Story. Beautifully Unforgettable.**
</p>

<p align="center">
  A Full-Stack Wedding Planning Platform Connecting Customers with Trusted Wedding Professionals.
</p>

<p align="center">
  <a href="https://wedplan-brown.vercel.app/">🌐 Live Website</a> •
  <a href="https://wedplan-backend-lime.vercel.app/">📚 Backend API Documentation</a>
</p>

---

## 📖 Project Overview

**WedPlan** is a full-stack wedding planning platform designed to simplify the wedding planning journey by connecting customers with professional wedding service providers.

Customers can explore wedding services, search and filter providers, view service details, and submit booking requests. Vendors can create their profiles, publish wedding services, manage bookings, and upgrade their accounts to Premium subscriptions for additional benefits.

The platform also provides an Admin Dashboard where administrators can manage users, review submitted services, and monitor platform transactions.

WedPlan offers a role-based experience for three types of users:

- **Customer:** Discover wedding services and manage bookings.
- **Vendor:** Publish services and manage customer booking requests.
- **Admin:** Manage users, approve services, and monitor transactions.

The application is built with Next.js, TypeScript, Express.js, MongoDB, Better Auth, and Stripe, following modern full-stack development practices.

## 🌐 Live Links

| Resource | Link |
|---|---|
| Live Website | https://wedplan-brown.vercel.app/ |
| Backend API Documentation | https://wedplan-backend-lime.vercel.app/docs |
| Client Repository | YOUR_CLIENT_GITHUB_REPOSITORY_URL |
| Server Repository | YOUR_SERVER_GITHUB_REPOSITORY_URL |

## ✨ Key Features

### 👰 Customer Features

- Browse approved and active wedding services.
- Search services by name.
- Filter services by category and location.
- Sort services by price (Low to High / High to Low).
- View detailed service information and images.
- Explore vendor information.
- Submit wedding booking requests.
- Track booking request status.
- Cancel pending booking requests.
- View personal booking history.
- Manage profile information.
- Access a personalized Customer Dashboard.

### 💼 Vendor Features

- Create and manage vendor profiles.
- Add new wedding services with multiple images.
- Update and delete existing services.
- Manage service availability.
- View submitted services and approval status.
- Manage customer booking requests.
- Accept or reject pending booking requests.
- View booking and service statistics.
- Manage subscription plans.
- Upgrade to Premium membership.
- Access a dedicated Vendor Dashboard.

### 🛡️ Admin Features

- Access a dedicated Admin Dashboard.
- View total registered users.
- View total vendors and customers.
- Monitor total services and pending services.
- View platform transaction statistics.
- Search users by name or email.
- Filter users by role.
- View registered user information.
- Block or unblock user accounts.
- Review submitted wedding services.
- Approve or reject pending services.
- Manage published services.
- Delete inappropriate services.
- Monitor platform transactions.

### 💳 Subscription & Payment Features

- Free and Premium vendor subscription plans.
- Stripe Checkout integration.
- Secure payment processing.
- Premium subscription upgrade.
- Free vendors can publish up to 3 active services.
- Premium vendors can publish unlimited active services.
- Premium vendor benefits.
- Transaction records.
- Stripe webhook verification for payment confirmation.
- Subscription status management.

### 🔐 Authentication & Security

- Email and password authentication.
- Google authentication.
- Better Auth integration.
- JWT-based backend authentication.
- Role-based authorization.
- Protected dashboard routes.
- Server-side role verification.
- Resource ownership verification.
- Blocked account protection.
- Secure environment variable configuration.

### 🎨 User Interface & Experience

- Professional wedding-themed design.
- Fully responsive layout.
- Mobile, tablet, and desktop support.
- Modern dashboard layouts.
- Reusable UI components.
- Smooth Framer Motion animations.
- Loading and empty states.
- Form validation.
- Toast notifications.
- User-friendly navigation.
- Custom error handling.

## 🛠️ Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| Next.js | React framework |
| React | User interface development |
| TypeScript | Type-safe development |
| Tailwind CSS | Styling and responsive design |
| Shadcn UI | Reusable UI components |
| Framer Motion | Animations and transitions |
| Lucide React / React Icons | Icons |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | REST API development |
| MongoDB | Database |
| Better Auth | Authentication |
| Jose | JWT verification |

### Payment & Image Hosting

| Technology | Purpose |
|---|---|
| Stripe Checkout | Subscription payments |
| Stripe Webhooks | Payment event verification |
| ImgBB | Image hosting |

### Development & Deployment

- Git
- GitHub
- Vercel
- Postman
- npm

## 🗂️ Database Architecture

WedPlan uses MongoDB for storing application data. Better Auth manages authentication-related collections, while the application uses separate business collections for its core functionality.

### Main Collections

**1. Users**

Stores user and profile information.

- `_id`
- `name`
- `email`
- `image`
- `role`
- `isBlocked`
- `businessName`
- `subscriptionPlan`
- `subscriptionExpiresAt`

**2. Services**

Stores wedding services created by vendors.

- `_id`
- `vendorId`
- `serviceName`
- `category`
- `description`
- `price`
- `location`
- `images`
- `status`
- `createdAt`

**3. Bookings**

Stores customer booking requests.

- `_id`
- `serviceId`
- `vendorId`
- `customerId`
- `eventDate`
- `eventLocation`
- `message`
- `status`
- `createdAt`

**4. Transactions**

Stores subscription payment information.

- `_id`
- `vendorId`
- `plan`
- `amount`
- `currency`
- `stripeSessionId`
- `stripeSubscriptionId`
- `status`
- `createdAt`

## 📋 Booking System

Customers can submit booking requests for available wedding services.

**Booking Workflow:**

1. Customer explores available services.
2. Customer opens a service details page.
3. Customer provides event date, event location, and an additional message.
4. The system identifies the customer and selected vendor.
5. A booking request is created with `Pending` status.
6. The vendor reviews the request.
7. The vendor accepts or rejects the request.
8. The customer can track the updated booking status.

**Booking Statuses:**

- Pending
- Accepted
- Rejected
- Cancelled

**Booking Validations:**

- Customers cannot book their own services.
- Duplicate active booking requests are prevented for the same service and event date.
- Only pending requests can be accepted or rejected.
- Customers cannot cancel processed booking requests.
- Vendors cannot modify bookings belonging to other vendors.

## 💰 Subscription System

WedPlan provides two subscription plans for vendors.

| Feature | Free Plan | Premium Plan |
|---|---|---|
| Active Services | Up to 3 | Unlimited |
| Vendor Dashboard | Included | Included |
| Booking Management | Included | Included |
| Premium Vendor Badge | Not Included | Included |

**Payment Workflow:**

1. Vendor selects the Premium plan.
2. Backend creates a Stripe Checkout Session.
3. Vendor is redirected to Stripe Checkout.
4. Stripe processes the payment.
5. Stripe sends a webhook event to the backend.
6. Backend verifies the webhook event.
7. Transaction information is stored.
8. Premium access is activated after verified payment confirmation.

Payment success redirects alone are not trusted to activate Premium access.

## 📁 Project Structure

The project is maintained in two separate repositories.

### Client Repository

```text
client/
├── public/
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── types/
├── .env.local
├── package.json
└── README.md
```

### Server Repository

```text
server/
├── middleware/
├── routes/
├── index.js
├── .env
└── package.json
```

*Note: This is a simplified overview of the project structure.*

## ⚙️ Installation & Setup

Follow the instructions below to run WedPlan locally.

### Prerequisites

Make sure you have installed:

- Node.js (LTS recommended)
- npm
- Git
- MongoDB account or MongoDB local server

### 1. Clone the Client Repository

```bash
git clone YOUR_CLIENT_GITHUB_REPOSITORY_URL
cd YOUR_CLIENT_PROJECT_FOLDER
```

### 2. Clone the Server Repository

Open another terminal:

```bash
git clone YOUR_SERVER_GITHUB_REPOSITORY_URL
cd YOUR_SERVER_PROJECT_FOLDER
```

### 3. Install Dependencies

Run the following command inside both client and server directories:

```bash
npm install
```

### 4. Configure Environment Variables

Create the required environment files.

**Client `.env.local`**

```env
NEXT_PUBLIC_API_URL=YOUR_BACKEND_API_URL

BETTER_AUTH_SECRET=YOUR_BETTER_AUTH_SECRET
BETTER_AUTH_URL=YOUR_FRONTEND_URL

GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

NEXT_PUBLIC_IMGBB_API_KEY=YOUR_IMGBB_API_KEY
```

**Server `.env`**

```env
PORT=8000

MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING

CLIENT_URL=YOUR_FRONTEND_URL

STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET
```

**Important:**

These are example environment variable names. Use the exact variable names configured in your actual client and server source code.

Never commit `.env` or `.env.local` files to GitHub. Keep all sensitive credentials private.

### 5. Run the Backend Server

Navigate to the server directory:

```bash
npm run dev
```

The backend server will run at:

```text
http://localhost:8000
```

### 6. Run the Frontend Application

Open another terminal and navigate to the client directory:

```bash
npm run dev
```

Open your browser:

```text
http://localhost:3000
```

## 🔒 Security Practices

WedPlan follows important security practices:

- Authentication is managed through Better Auth.
- JWT tokens are verified on the Express backend.
- Role-based middleware protects restricted API routes.
- Admin, Vendor, and Customer permissions are verified on the server.
- Resource ownership is checked before protected updates and deletions.
- Blocked users cannot access protected platform features.
- MongoDB credentials are stored in environment variables.
- Stripe secret keys remain on the server.
- Stripe webhook signatures are verified before processing payment events.
- Users cannot change their own role or subscription status through profile updates.
- Sensitive credentials are never committed to GitHub.

## 🚀 Deployment

The frontend and backend are deployed separately.

- **Frontend:** Vercel
- **Backend:** Vercel
- **Database:** MongoDB Atlas
- **Payment:** Stripe Test Mode

**Live Application:** https://wedplan-brown.vercel.app/

### Production Configuration

Before deployment, configure the required environment variables in the hosting platform.

Ensure that:

- Frontend API URL points to the deployed backend.
- Backend CORS allows the production frontend origin.
- Better Auth uses the correct production URL and secret.
- Google OAuth redirect URLs are configured correctly.
- MongoDB credentials are configured securely.
- Stripe webhook endpoint is configured correctly.
- Stripe success and cancel URLs use the production frontend URL.
- Protected routes work after refreshing the page.

## 🎯 Project Objectives

This project demonstrates practical full-stack development skills, including:

- Building a complete role-based web application.
- Designing RESTful APIs with Express.js.
- Managing application data with MongoDB.
- Implementing authentication and authorization.
- Integrating third-party services.
- Handling Stripe Checkout and webhook events.
- Managing booking and subscription workflows.
- Creating responsive and reusable UI components.
- Deploying frontend and backend applications.

## 🙏 Acknowledgements

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [MongoDB](https://www.mongodb.com/)
- [Express.js](https://expressjs.com/)
- [Better Auth](https://www.better-auth.com/)
- [Stripe](https://stripe.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Framer Motion](https://motion.dev/)
- [ImgBB](https://imgbb.com/)

---

<p align="center">
  **WedPlan — Your Day. Your Story. Beautifully Unforgettable.** ❤️
</p>

<p align="center">
  © 2026 WedPlan. All Rights Reserved.
</p>
