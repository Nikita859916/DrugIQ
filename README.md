# 💊 DrugIQ Backend

> **Drug Side Effect & Review Intelligence** — Production-grade healthcare REST API powered by Node.js, Express, and MongoDB.

[![Node.js](https://img.shields.io/badge/Node.js-≥18-green.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-brightgreen.svg)](https://mongodb.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Endpoints](#api-endpoints)
- [Architecture](#architecture)
- [Dataset](#dataset)

---

## Overview

DrugIQ aggregates **215,000+ patient drug reviews** across **900+ drugs** to deliver:

- 🔍 Drug search and information lookup
- 📊 Side effect aggregation and frequency analysis
- 💬 Sentiment analysis on patient reviews
- 🏥 Condition-to-drug recommendation
- 📈 Analytics dashboards

> ⚠️ This API is for **informational purposes only** and does not constitute medical advice.

---

## Tech Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| Runtime        | Node.js ≥ 18                        |
| Framework      | Express.js 4.x                      |
| Database       | MongoDB 7.x + Mongoose 8.x          |
| Documentation  | Swagger UI (OpenAPI 3.0)            |
| Logging        | Winston + daily-rotate-file         |
| Security       | Helmet, CORS, express-rate-limit    |

---

## Project Structure

```
DrugIQ-Backend/
├── src/
│   ├── config/
│   │   ├── cors.js            # CORS origin validation
│   │   ├── database.js        # MongoDB connection + events
│   │   ├── rateLimiter.js     # Global / strict / upload limiters
│   │   └── swagger.js         # OpenAPI 3.0 spec configuration
│   ├── controllers/
│   │   └── healthController.js
│   ├── docs/
│   │   └── swaggerSchemas.js  # JSDoc Swagger annotations
│   ├── middlewares/
│   │   ├── errorHandler.js    # Centralised error handler
│   │   ├── notFound.js        # 404 catch-all
│   │   ├── requestLogger.js   # Morgan → Winston
│   │   └── validate.js        # Request validation factory
│   ├── models/                # (Mongoose models — next phase)
│   ├── routes/
│   │   ├── healthRoutes.js
│   │   └── index.js           # Central route registry
│   ├── seed/
│   │   └── index.js           # Dataset import script
│   ├── services/              # (Business logic — next phase)
│   ├── uploads/               # Uploaded files (gitignored)
│   ├── utils/
│   │   ├── AppError.js        # Custom error class
│   │   ├── apiResponse.js     # Standardised response helpers
│   │   ├── asyncHandler.js    # Async route wrapper
│   │   ├── logger.js          # Winston singleton
│   │   └── pagination.js      # Pagination query helpers
│   ├── app.js                 # Express factory
│   ├── constants.js           # Shared constants & enums
│   └── index.js               # Server entry point
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **MongoDB** (local or Atlas)
- **npm** ≥ 9.x

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/drugiq-backend.git
cd drugiq-backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your MongoDB URI and other settings

# 4. Start development server
npm run dev
```

The server starts at **http://localhost:5000**.  
API docs are available at **http://localhost:5000/api/docs**.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable                | Default                              | Description                          |
|-------------------------|--------------------------------------|--------------------------------------|
| `NODE_ENV`              | `development`                        | Environment name                     |
| `PORT`                  | `5000`                               | HTTP server port                     |
| `HOST`                  | `localhost`                          | HTTP server host                     |
| `MONGO_URI`             | `mongodb://localhost:27017/drugiq`   | Primary MongoDB connection string    |
| `MONGO_TEST_URI`        | `mongodb://localhost:27017/drugiq_test` | Test DB connection string         |
| `ALLOWED_ORIGINS`       | `http://localhost:3000`              | Comma-separated CORS origins         |
| `RATE_LIMIT_WINDOW_MS`  | `900000`                             | Rate limit window (ms)               |
| `RATE_LIMIT_MAX`        | `100`                                | Max requests per window              |
| `LOG_LEVEL`             | `debug`                              | Winston log level                    |
| `LOG_DIR`               | `logs`                               | Directory for log files              |
| `SWAGGER_ENABLED`       | `true`                               | Enable/disable Swagger UI            |
| `API_BASE_URL`          | `http://localhost:5000`              | Used in Swagger server definition    |

---

## Available Scripts

| Script                | Description                                     |
|-----------------------|-------------------------------------------------|
| `npm start`           | Start production server                         |
| `npm run dev`         | Start development server with nodemon           |
| `npm run dev:debug`   | Start with Node inspector                       |
| `npm run seed`        | Import Kaggle dataset into MongoDB              |
| `npm run seed:clear`  | Clear all seeded collections                    |
| `npm run lint`        | Run ESLint                                      |
| `npm run lint:fix`    | Auto-fix ESLint issues                          |
| `npm run format`      | Format code with Prettier                       |
| `npm test`            | Run Jest tests                                  |
| `npm run test:watch`  | Run tests in watch mode                         |
| `npm run test:coverage` | Run tests with coverage report              |

---

## API Endpoints

### Currently Active

| Method | Path               | Description          |
|--------|--------------------|----------------------|
| `GET`  | `/`                | API info             |
| `GET`  | `/api/v1/health`   | Server health check  |
| `GET`  | `/api/docs`        | Swagger UI           |
| `GET`  | `/api/docs.json`   | OpenAPI JSON spec    |

### Planned (Next Phases)

| Method   | Path                           | Description                        |
|----------|--------------------------------|------------------------------------|
| `GET`    | `/api/v1/drugs`                | List all drugs (paginated)         |
| `GET`    | `/api/v1/drugs/:id`            | Get drug by ID                     |
| `GET`    | `/api/v1/drugs/search`         | Search drugs by name               |
| `GET`    | `/api/v1/reviews`              | List reviews (paginated, filtered) |
| `GET`    | `/api/v1/reviews/:drugName`    | Reviews for a specific drug        |
| `GET`    | `/api/v1/side-effects/:drug`   | Side effects for a drug            |
| `GET`    | `/api/v1/conditions`           | List all conditions                |
| `GET`    | `/api/v1/conditions/:name/drugs` | Drugs for a condition            |
| `GET`    | `/api/v1/analytics/top-drugs`  | Top-rated drugs                    |
| `POST`   | `/api/v1/uploads/dataset`      | Upload CSV dataset                 |

---

## Architecture

```
Request → [Rate Limiter] → [Helmet] → [CORS] → [Body Parser]
       → [Morgan Logger] → [Routes] → [Controller] → [Service]
       → [Model / MongoDB] → [apiResponse] → Client

Error path → [errorHandler] → [AppError] → Client
```

### Key Design Decisions

- **`app.js` vs `index.js`**: App configuration is separated from server binding, making the app fully testable without opening a port.
- **`AppError` class**: All errors funnel through a typed, serialisable error class, ensuring consistent API responses.
- **Async handlers**: `asyncHandler` wraps every async route, eliminating try/catch boilerplate.
- **Three-tier rate limiting**: Global → Strict (write ops) → Upload limiters applied per route group.

---

## Dataset

**Drug Reviews Dataset** from [Kaggle](https://www.kaggle.com/datasets/jessicali9530/kuc-hackathon-winter-2018)

| Property        | Value                     |
|-----------------|---------------------------|
| Total Reviews   | 215,063                   |
| Drugs Covered   | 3,436 unique drugs        |
| Conditions      | 885 unique conditions     |
| Rating Range    | 1–10 (patient self-report)|
| Source          | UCI ML Repository         |

### Seed Instructions

1. Download `drugsComTrain_raw.csv` and `drugsComTest_raw.csv` from Kaggle
2. Place them in `src/seed/data/`
3. Run `npm run seed`

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push and open a Pull Request

---

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.
