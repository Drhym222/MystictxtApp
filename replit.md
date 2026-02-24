# MysticTxt

## Overview

MysticTxt is a psychic services marketplace (inspired by PsychicTxt) with two portals:

- **Client Portal**: Public-facing where clients sign up, browse mystical services (psychic readings, tarot, telepathy, etc.), place orders, pay, and view order history.
- **Legacy Portal (Admin)**: Private admin dashboard where a single admin user receives orders, delivers responses, manages order statuses, and views notifications.

The app is built as a React Native/Expo application with file-based routing (expo-router), backed by an Express.js API server and PostgreSQL database. It targets iOS, Android, and Web platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo/React Native)

- **Framework**: Expo SDK 54 with expo-router v6 for file-based routing
- **Styling**: React Native StyleSheet with LinearGradient backgrounds, dark mystical theme (deep purples, golds)
- **State Management**: TanStack React Query for server state, React Context for auth
- **Fonts**: Cinzel (Google Fonts) for mystical branding
- **Navigation Structure**:
  - `app/index.tsx` — Welcome/landing screen with auto-redirect based on auth state
  - `app/(auth)/` — Login, Register, and Legacy (admin) Login screens
  - `app/(main)/` — Client portal with tab navigation: Services, Orders, Profile
  - `app/(admin)/` — Admin portal with tab navigation: Dashboard, Orders, Notifications, Profile
  - `app/service/[slug].tsx` — Service detail page
  - `app/order/[id].tsx` — Order detail page
  - `app/order-form.tsx` — Order placement form (modal)
- **Platform Handling**: Uses platform checks (`Platform.OS`) extensively for web vs native differences. BlurView for iOS tab bars, custom styling for web.

### Backend (Express.js)

- **Server**: Express 5 running on the same Replit instance, serves API routes and static builds
- **API Prefix**: All API routes are under `/api/`
- **Authentication**: JWT-based (jsonwebtoken), tokens stored in SecureStore (native) or AsyncStorage (web). Bearer token pattern in Authorization header.
- **Password Hashing**: bcryptjs
- **Key API Endpoints**:
  - `POST /api/auth/register` — Client registration
  - `POST /api/auth/login` — Login (both client and admin)
  - `GET /api/services` — List active services
  - `GET /api/services/:slug` — Service detail
  - `POST /api/orders` — Create order (authenticated)
  - `GET /api/orders` — Client's orders
  - `GET /api/orders/:id` — Order detail
  - `GET /api/admin/orders` — All orders (admin only)
  - `PUT /api/admin/orders/:id` — Update order status/response (admin only)
  - `POST /api/payments/initialize` — Initialize payment
  - `GET/PUT /api/notifications/*` — Notification management
- **Middleware**: Auth middleware (JWT verification), Admin middleware (role check)
- **CORS**: Dynamic origin allowlist based on Replit environment variables, plus localhost for development

### Database (PostgreSQL + Drizzle ORM)

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema** (`shared/schema.ts`):
  - `users` — id (UUID), email, passwordHash, role (client/admin), createdAt
  - `services` — id (UUID), slug, title, description, priceUsdCents, imageUrl, active
  - `orders` — id (UUID), clientId → users, serviceId → services, deliveryType (standard/express), status (pending/paid/delivered/cancelled), priceUsdCents, paymentReference, adminResponse, timestamps
  - `order_intake` — id (UUID), orderId → orders, fullName, dobOptional, question, detailsJson
  - `notifications` — id (UUID), userId → users, type, message, read status, timestamps
- **Validation**: drizzle-zod for schema-to-Zod validation (registerSchema, loginSchema, createOrderSchema)
- **Migrations**: Drizzle Kit with `drizzle-kit push` for schema sync
- **Database seeding**: `seedDatabase()` function runs on server start to populate initial services and admin user

### Pricing Model

- Services are listed and stored in USD cents (each service has its own base price)
- Two delivery tiers: Standard (base price) and Express (base price + $10.00 surcharge)
- **Service prices**: Psychic Reading $4.99, Tarot Reading $4.99, Telepathy Mind Reading $4.99, Find Lost/Missing Items $89.99, Live Chat $3.99/5min (time-based)
- **Live Chat**: Time-based pricing at $0.80/min ($3.99/5min, $7.99/10min, $11.99/15min, $19.99/30min, $35.99/60min, custom minutes)
### Payment Integration (Stripe)

- Payment flow: Create order → Initialize Stripe Checkout Session → Redirect to Stripe hosted checkout → Callback verification + webhook → Mark as paid
- Payment is confirmed via Stripe Checkout Session verification on callback, and optionally via webhook
- Uses `expo-web-browser` to open Stripe checkout URLs on native platforms
- All prices are in USD cents, charged directly in USD (no currency conversion)

### Shared Code

- `shared/schema.ts` contains database schema and Zod validation schemas, shared between server and client
- Path aliases: `@/*` maps to project root, `@shared/*` maps to `./shared/*`

### Build & Deploy

- **Development**: Two processes — `expo:dev` for the Expo frontend, `server:dev` for the Express backend (via tsx)
- **Production Build**: `expo:static:build` creates a static web build, `server:build` bundles server with esbuild, `server:prod` runs the production server
- **Environment**: `EXPO_PUBLIC_DOMAIN` connects frontend to backend API, `DATABASE_URL` for PostgreSQL, `SESSION_SECRET` for JWT signing

## External Dependencies

### Database
- **PostgreSQL** — Primary data store, connected via `DATABASE_URL` environment variable, accessed through `pg` pool + Drizzle ORM

### Payment Processing
- **Stripe** — Handles payment processing via Stripe Checkout Sessions. Prices are charged in USD. Payment is verified via session retrieval on callback and optionally via Stripe webhook.

### Authentication & Security
- **jsonwebtoken** — JWT token generation and verification (7-day expiry)
- **bcryptjs** — Password hashing
- **expo-secure-store** — Secure token storage on native platforms
- **@react-native-async-storage/async-storage** — Token storage fallback for web

### UI & UX
- **expo-linear-gradient** — Gradient backgrounds throughout the app
- **expo-haptics** — Haptic feedback on interactions (native only)
- **expo-blur** — BlurView for iOS tab bar backgrounds
- **@expo-google-fonts/cinzel** — Cinzel font for mystical branding
- **react-native-reanimated** — Entry animations (FadeIn, etc.)
- **react-native-gesture-handler** — Gesture handling
- **react-native-keyboard-controller** — Keyboard-aware scroll views
- **expo-web-browser** — Opening payment URLs in-app browser

### Data Fetching
- **@tanstack/react-query** — Server state management, caching, auto-refetch (e.g., notification count polls every 15 seconds)

### Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — JWT signing secret
- `EXPO_PUBLIC_DOMAIN` — API server domain (set automatically on Replit)
- `STRIPE_SECRET_KEY` — Stripe secret API key
- `STRIPE_PUBLISHABLE_KEY` — Stripe publishable API key
- `STRIPE_WEBHOOK_SECRET` — (Optional) Stripe webhook signing secret