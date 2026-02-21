# MysticTxt

A psychic services marketplace where clients can browse mystical services, place orders, and receive personalized readings from advisors.

## Features

### Client Portal
- Browse 5 mystical services: Psychic Reading, Tarot Reading, Telepathy Mind Reading, Telepathy Mind Implants, and Live Chat
- Two delivery options for all services:
  - **Standard** - $4.99 with 24-hour delivery
  - **Express** - $14.99 with 59-minute delivery
- Secure payment processing via Korapay
- Order history with status tracking
- In-app notifications when readings are delivered

### Legacy Portal (Advisor)
- Dashboard with order overview and stats
- Manage and respond to client orders
- Mark orders as delivered with written responses
- Notification center for new orders

## Tech Stack

- **Frontend**: React Native / Expo with expo-router (file-based routing)
- **Backend**: Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM
- **Payments**: Korapay checkout integration
- **Auth**: JWT-based authentication with secure token storage
- **Styling**: Dark mystical theme with gold accents, Cinzel font family

## Getting Started

### Environment Variables

The following environment variables are required:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | JWT signing secret |
| `KORAPAY_SECRET_KEY` | Korapay API secret key |
| `KORAPAY_PUBLIC_KEY` | Korapay API public key |

### Running the App

The app runs two processes:

1. **Backend** - Express server on port 5000
2. **Frontend** - Expo dev server on port 8081

### Default Advisor Login

- **Email**: mysticsughter@gmail.com
- **Password**: Makurdi@1

Access the advisor portal via the "Legacy User Login" link on the welcome screen.

## Project Structure

```
app/                    # Expo Router screens
  (auth)/               # Authentication screens (login, register, legacy login)
  (main)/               # Client portal (services, orders, profile)
  (admin)/              # Advisor portal (dashboard, orders, notifications, profile)
  service/[slug].tsx    # Service detail with delivery selection
  order-form.tsx        # Order placement with Korapay payment
  order/[id].tsx        # Order detail view
server/                 # Express.js backend
  routes.ts             # API route handlers
  storage.ts            # Database queries and seed data
  db.ts                 # Database connection
shared/                 # Shared code (schema, types, validation)
lib/                    # Frontend utilities (auth context, API helpers)
constants/              # Theme colors and configuration
```

## Payment Flow

1. Client selects a service and delivery speed (Standard/Express)
2. Client fills out the intake form (name, question, optional DOB)
3. Order is created with "pending" status
4. Korapay checkout is initialized and client completes payment
5. Korapay webhook confirms payment, order status updates to "paid"
6. Advisor receives notification and delivers the reading
7. Client receives notification when reading is delivered
