# Smart Pharmacy Price Comparison Platform

A full-stack web application that lets users search for medicines, compare prices across multiple pharmacies, check availability, and discover generic alternatives.

## Project Purpose

Buying medicine can be expensive, and prices vary significantly between pharmacies. This platform aims to:

- Let users search for a medicine by name.
- Show which pharmacies have it in stock and at what price.
- Highlight the cheapest available pharmacy.
- Suggest **generic alternatives** with their prices and availability.
- Empower users to make informed, cost-effective purchasing decisions.

## Tech Stack

| Layer        | Technology                           |
| ------------ | ------------------------------------ |
| Frontend     | HTML5, CSS3, Vanilla JavaScript, EJS |
| Backend      | Node.js, Express.js                  |
| Database     | MySQL (via `mysql2`)                 |
| Auth         | Session-based (express-session)      |
| Architecture | MVC (server-side rendered)           |

### Why these choices

- **EJS**: Server-side rendering keeps templates simple and works well with Express.
- **Vanilla JavaScript**: No heavy frontend framework; keeps the bundle small and the code easy to explain.
- **MySQL + mysql2**: Robust relational database with parameterized/prepared queries for safety.
- **express-session**: Simple, reliable session-based authentication.

## Planned Modules

1. User Authentication (register, login, logout)
2. Pharmacy Dashboard
3. Medicine Search
4. Medicine Details
5. Medicine Categories
6. Wishlist
7. Pharmacy Management
8. Admin Dashboard

## Planned Standout Feature

**Medicine Availability + Generic Alternative Finder**

- User searches for a medicine.
- System checks stock across multiple pharmacies.
- Displays availability, price, pharmacy, and quantity where appropriate.
- Shows the cheapest available pharmacy.
- Suggests generic alternatives, each with its own price and availability.

## Project Structure

```
smart-pharmacy-price-comparison/
├── app/
│   ├── config/          # env config + DB connection
│   ├── controllers/     # request handlers
│   ├── middleware/      # auth/session middleware (future)
│   ├── models/          # DB models (future)
│   ├── routes/          # route definitions
│   ├── utils/           # shared helpers (as needed)
│   ├── views/           # EJS templates + partials
│   ├── app.js           # Express app configuration
│   └── server.js        # HTTP server entry point
├── public/
│   ├── css/             # stylesheets
│   ├── js/              # browser-side JS
│   └── images/          # static images
├── database/
│   └── schema.sql       # SQL scripts
├── .env                 # secrets / config (git-ignored)
├── .env.example         # template for .env
├── .gitignore
├── package.json
└── README.md
```

This project implements all phases described above (Phases 1–8), from initialization through the completed price-comparison, generic-alternative, wishlist, and dashboard features.

## Initial Setup Instructions

### Prerequisites

- Node.js (v18+ recommended; tested on v20)
- npm
- MySQL 8.0 running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example environment file and fill in your local values:

```bash
cp .env.example .env
```

Edit `.env` and set at least:

```
DB_USER=root
DB_PASSWORD=your_mysql_password
SESSION_SECRET=some_long_random_string
```

> Never commit the real `.env` file. It is already git-ignored.

### 3. Create the database

```sql
-- Run the schema script (creates the `smart_pharmacy` database + placeholder table)
mysql -u root -p < database/schema.sql
```

### 4. Run the application

```bash
# Production
npm start

# Development (auto-restart with nodemon)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Verify the setup

- **Express + EJS + CSS**: The home page should render with styling.
- **Static JS**: Open the browser dev tools console; you should see the base script log message.
- **MySQL**: The connection is configured but not auto-connected at startup (so the app runs even if the DB is down). The connection can be tested with the pool utilities in `app/config/db.js`.

## Environment Variables

| Variable         | Description                                   | Default                     |
| ---------------- | --------------------------------------------- | --------------------------- |
| `PORT`           | Port the server listens on                    | `3000`                      |
| `NODE_ENV`       | Environment mode (`development`/`production`) | `development`               |
| `SESSION_SECRET` | Secret used to sign session cookies           | _required, no real default_ |
| `DB_HOST`        | MySQL host                                    | `localhost`                 |
| `DB_PORT`        | MySQL port                                    | `3306`                      |
| `DB_USER`        | MySQL user                                    | `root`                      |
| `DB_PASSWORD`    | MySQL password                                | _(empty)_                   |
| `DB_NAME`        | MySQL database name                           | `smart_pharmacy`            |

## Roadmap

- [x] Phase 1: Project initialization
- [x] Phase 2: Database schema & seed data
- [x] Phase 3: User authentication & authorization
- [x] Phase 4: Shared UI structure
- [x] Phase 5: Medicine Management (admin CRUD, categories, medicine detail)
- [x] Phase 6: Medicine search & category browsing
- [x] Phase 7: Price comparison, availability, generic alternatives & wishlist
- [x] Phase 8: Pharmacy & admin dashboards

## Medicine Search & Category Browsing (Phase 6)

Users can search medicines by **name (brand)**, **generic name**, **category name**, **dosage form**, or **strength**, using **partial (substring) matches**. Search is case-insensitive (thanks to the `utf8mb4_unicode_ci` collation) and only returns **active** medicines.

### How search works

1. The search form submits a `GET` request to `/medicines/search?q=<keyword>`.
2. `medicineController.searchMedicines` reads the `q` query parameter and trims it.
3. `Medicine.search(keyword)` builds a parameterized `LIKE` query:
   - The keyword is escaped so `%`, `_`, and `\` are treated literally (not as wildcards).
   - It is wrapped in `%...%` to match anywhere within a field.
   - The query matches against `name`, `generic_name`, category `name`, `dosage_form`, and `strength`.
   - Only rows with `status = 'active'` are returned.
4. Results render on the `medicine/search` view, each linking to the medicine detail page. If no results, a friendly **no-results** state is shown.

Example: searching `para` returns `Panadol`, `Paracetamol (Generic)`, `Paracetamol Extra (Generic)`, and `Paracetamol Syrup (Generic)`.

### SQL injection prevention

All queries use **parameterized statements** (placeholders `?`) via the `mysql2` pool. User input is never concatenated into SQL; it is passed as a bound value. Additionally, `LIKE` wildcards are escaped (see `escapeLike` in `app/models/Medicine.js`) so a user cannot inject `%`, `_`, or `\` into the pattern.

### Indexes used

- `idx_medicines_name (name)` — supports leading-prefix `LIKE 'name%'` lookups on medicine name.
- `idx_medicines_generic_name (generic_name)` — supports lookups on generic name.
- `idx_medicines_category (category_id)` — supports category filtering and joins.
- `ft_medicines_search (name, generic_name)` — a FULLTEXT index available as a complementary optimization for full-text relevance scoring (the current search uses `LIKE` partial matching).

### Category browsing

- `GET /categories` — public list of all categories with active-medicine counts (`categoryController.browseCategories` / `Category.findActiveWithCounts`).
- `GET /categories/:id` — active medicines within a category (`medicineController.listByCategory` / `Medicine.findActiveByCategory`). Invalid or missing categories return a 404.

### Request flow (browser → route → controller → model → database → EJS)

1. **Browser** submits `GET /medicines/search?q=para`.
2. **Route** (`app/routes/medicine.js`) matches `/medicines/search` (declared before `/medicines/:id`) and calls `medicineController.searchMedicines`.
3. **Controller** extracts and trims `q`, then calls `Medicine.search("para")`.
4. **Model** (`app/models/Medicine.js`) executes the parameterized `LIKE` query against the `medicines`/`categories` tables via the `mysql2` pool.
5. **Database** returns matching active medicine rows.
6. **Controller** passes the results to `res.render("medicine/search", { medicines, query })`.
7. **EJS** (`app/views/medicine/search.ejs`) renders the results (or no-results state), each linking to `/medicines/:id`.

### Price & availability comparison (Phase 7)

The medicine **detail page** now implements the full **"Availability & Price Comparison"** feature:

- Lists every **active** pharmacy carrying the medicine, with live stock quantity, availability, and selling price.
- Highlights the **cheapest available** pharmacy (restricted to pharmacies that are active, in stock, and have physical stock > 0 — an out-of-stock pharmacy is never treated as cheapest).
- Shows a **savings callout** when switching to the cheapest option saves money versus the next-cheapest available pharmacy.
- Displays **generic alternatives**, each with its own per-pharmacy price/availability table and a "Cheaper than brand" badge where applicable.
- Provides a **wishlist** so logged-in users can save medicines for quick comparison later.

Pharmacy owners manage their own stock and prices via the pharmacy dashboard; the platform admin manages users, pharmacies, medicines, and categories.
