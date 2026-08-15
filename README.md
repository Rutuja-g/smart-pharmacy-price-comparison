# Smart Pharmacy Price Comparison Platform

A full-stack web application that allows users to search for medicines, compare prices and availability across pharmacies, and discover lower-cost generic alternatives. Built with Node.js, Express, EJS, and MySQL, the platform provides dedicated portals for consumers, pharmacy owners, and administrators.

## Key Features

- **Medicine Search:** Case-insensitive search by medicine name, generic name, category, dosage form, or strength.
- **Price Comparison & Details:** Detailed medicine page highlighting pharmacy-specific prices, stock levels, and the cheapest available option.
- **Generic Alternatives:** Automatic suggestions for generic equivalents with individual pricing and availability comparison.
- **Wishlist:** Saved medicine list for authenticated users to quickly track prices.
- **User Authentication:** Registration, login, session persistence, and profile management.
- **Pharmacy-Owner Management:** Dedicated dashboard for pharmacy owners to update stock levels, prices, and item availability.
- **Admin Management:** Platform administration to manage users, pharmacies, medicine catalog, and categories.
- **Role-Based Access Control (RBAC):** Strict authorization protecting routes for regular users, pharmacy owners, and admins.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Frontend:** HTML5, CSS3, Vanilla JavaScript, EJS (Server-Side Rendering)
- **Database:** MySQL 8.0 (via `mysql2` connection pool)
- **Authentication:** `express-session` & `bcryptjs`
- **Testing:** Playwright

## Testing

Comprehensive end-to-end (E2E) testing powered by **Playwright** with **30 passing tests** covering:

- Authentication & Registration flows (including account deactivation handling)
- Search, category browsing, and medicine detail views
- Wishlist operations
- Pharmacy-owner inventory, stock updates, and availability toggles
- Admin dashboard CRUD operations (users, pharmacies, medicines, categories)
- Global 404 error handling and unauthorized route redirects

To run the test suite:

```bash
npm test
```

## Project Structure

```
smart-pharmacy-price-comparison/
├── app/
│   ├── config/        # Environment and DB pool setup
│   ├── controllers/   # Request handlers (auth, admin, pharmacy, medicines)
│   ├── middleware/    # Auth, RBAC, and CSRF protection
│   ├── models/        # Database models (MySQL queries)
│   ├── routes/        # Express route definitions
│   ├── utils/         # Helper functions (validation, LIKE escaping)
│   └── views/         # EJS templates and partials
├── database/          # SQL schema, migrations, and seed scripts
├── public/            # Static assets (CSS, client JS)
└── tests/             # Playwright E2E tests and setup fixtures
```

## Setup / Run Locally

### Prerequisites

- Node.js (v18+)
- MySQL 8.0 server running locally

### Installation & Configuration

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and set your local MySQL credentials and session secret:

   ```bash
   cp .env.example .env
   ```

3. **Set up the database:**
   Execute the schema and seed scripts in MySQL:

   ```bash
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/seed.sql
   ```

4. **Run the development server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Run tests:**
   ```bash
   npm test
   ```

## Security

- **Password Hashing:** Passwords hashed using `bcryptjs`.
- **Session Authentication:** Server-side sessions managed via `express-session`.
- **Role-Based Access Control:** Middleware enforces role permissions and verifies active account status against DB on protected routes.
- **CSRF Protection:** Anti-CSRF token verification on state-changing POST routes.
- **SQL Injection Prevention:** Parameterized SQL queries via `mysql2` and wildcard escaping using `escapeLike` in `app/utils/validation.js`.

## Future Improvements

- Map integration for location-based pharmacy distance calculations.
- Prescription upload and verification workflow.
- Price drop notifications for saved wishlist medicines.
