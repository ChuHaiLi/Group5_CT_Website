# WonderAI - AI-Powered Travel Planning Platform

> An intelligent full-stack web application that helps users create optimized travel itineraries for Vietnam using AI-powered recommendations, image recognition, and smart route optimization.

[![React](https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react)](https://reactjs.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.0-000000?logo=flask)](https://flask.palletsprojects.com/)
[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python)](https://www.python.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)](https://www.sqlite.org/)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Future Improvements](#future-improvements)
- [Author](#author)

---

## 🎯 Overview

**WonderAI** is a comprehensive travel planning platform designed specifically for exploring Vietnam. The application leverages artificial intelligence to generate personalized, optimized itineraries based on user preferences, duration, and destination images. It solves the time-consuming problem of manually planning trips by providing intelligent route optimization, geographic clustering, and real-time AI assistance.

### Target Users

- Travelers planning trips to Vietnam
- Students and backpackers seeking budget-friendly itineraries
- Tourists looking for personalized travel experiences
- Travel enthusiasts who want AI-powered recommendations

### Main Problem It Solves

Manually planning travel itineraries is time-consuming, often inefficient, and requires extensive research. WonderAI automates this process by:

- Generating day-by-day itineraries optimized for geographic proximity
- Recognizing destinations from uploaded images
- Providing real-time AI chat assistance
- Optimizing routes to minimize travel time and maximize sightseeing

---

## ✨ Features

### 🤖 AI-Powered Itinerary Generation

- **Smart Route Optimization**: Automatically groups nearby destinations to minimize travel time using Haversine distance calculations
- **Time Management**: Realistic scheduling with automatic meal breaks, rest periods, and travel time allocation
- **Geographic Clustering**: Places within 5km are grouped together for efficient day planning
- **Duration-Based Planning**: Generates itineraries based on trip duration (1-30+ days)

### 🖼️ Image-Based Destination Recognition

- Upload photos of places you want to visit
- AI recognizes destinations using Google Gemini Vision API
- Automatically adds recognized locations to your itinerary
- Seamless integration with the planning workflow

### 💬 AI Travel Assistant (WonderAI BOT)

- 24/7 conversational AI assistant for travel advice
- Context-aware recommendations based on your trip plans
- Multi-turn conversations with session management
- Image attachments support for visual queries

### 🗺️ Intelligent Destination Search

- Search by name, province, or region
- Filter by tags (beach, mountain, cultural, etc.)
- Unaccented search support for Vietnamese text
- Hierarchical location browsing (Region → Province → Destination)

### 📅 Trip Management

- Create, edit, and delete trips
- Extend trips by adding new days
- Regenerate itineraries with different preferences
- Track trip status (UPCOMING, ONGOING, COMPLETED)
- Save and manage multiple trips

### ⭐ Destination Features

- Comprehensive destination database with 1000+ locations across Vietnam
- Ratings, reviews, and detailed descriptions
- Multiple images per destination
- GPS coordinates for route optimization
- Opening hours and entry fees
- Weather information by region

### 🔐 User Authentication & Profile

- Email/password authentication with JWT tokens
- Google OAuth integration
- Email verification system
- Password reset functionality
- User profile management
- Saved destinations collection

### 🎨 Modern User Interface

- Responsive React-based frontend
- Drag-and-drop itinerary editing
- Interactive maps integration
- Real-time updates and notifications
- Toast notifications for user feedback

---

## 🛠️ Tech Stack

### Frontend

- **React 19.2.0** - Modern UI library with hooks and context API
- **React Router DOM 7.10.1** - Client-side routing
- **Axios 1.13.2** - HTTP client for API communication
- **Firebase 12.6.0** - Authentication and real-time features
- **React OAuth Google** - Google Sign-In integration
- **React DnD** - Drag-and-drop functionality for itinerary editing
- **React Toastify** - User notification system
- **Recharts** - Data visualization for trip analytics

### Backend

- **Flask 3.0.0** - Lightweight Python web framework
- **Flask-SQLAlchemy** - ORM for database operations
- **Flask-JWT-Extended** - Secure token-based authentication
- **Flask-CORS** - Cross-origin resource sharing
- **Flask-Migrate** - Database migration management
- **SQLAlchemy** - SQL toolkit and ORM

### Database

- **SQLite** - Lightweight relational database (development)
- **Flask-Migrate** - Database schema versioning

### AI & External Services

- **OpenAI API** - GPT models for itinerary generation and chat assistance
- **Google Gemini Vision API** - Image recognition and analysis
- **Gmail SMTP** - Email verification and notifications
- **Google OAuth 2.0** - Social authentication

### Development Tools

- **Python 3.8+** - Backend runtime
- **Node.js & npm** - Frontend package management
- **pytest** - Backend testing framework
- **Jest & React Testing Library** - Frontend testing

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   Home   │  │ Explore  │  │ My Trips │  │  Profile │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Chat Widget (WonderAI BOT)                   │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP/REST API
                        │ (JWT Authentication)
┌───────────────────────┴─────────────────────────────────────┐
│                    Backend (Flask API)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Auth API   │  │  Chat API    │  │ Itinerary API│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Search API  │  │  Profile API │  │  Saved API   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         AI Services Layer                            │   │
│  │  • OpenAI Client (Itinerary Generation)              │   │
│  │  • Gemini Vision (Image Recognition)                 │   │
│  │  • Rate Limiting & Error Handling                    │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────────┐
│                    Database (SQLite)                        │
│  ┌─────────┐  ┌───────────┐  ┌────────────┐  ┌──────────┐   │
│  │  Users  │  │Trips/     │  │Destinations│  │  Chat    │   │
│  │         │  │Itineraries│  │            │  │ Sessions │   │
│  └─────────┘  └───────────┘  └────────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Request** → Frontend sends authenticated request with JWT token
2. **API Processing** → Flask routes handle business logic and validation
3. **AI Integration** → OpenAI/Gemini APIs called for intelligent features
4. **Database Operations** → SQLAlchemy ORM queries and updates data
5. **Response** → JSON response sent back to frontend
6. **UI Update** → React components re-render with new data

### Key Design Patterns

- **RESTful API Design**: Clean separation between frontend and backend
- **Blueprint Architecture**: Modular route organization in Flask
- **JWT Authentication**: Stateless authentication for scalability
- **Context API**: Global state management in React
- **Service Layer**: AI utilities abstracted from business logic

---

## 🚀 Setup & Installation

### Prerequisites

- **Node.js** 16+ and npm (for frontend)
- **Python** 3.8+ (for backend)
- **pip** and **virtualenv** (for Python package management)
- **Git** (for version control)

---

### ⚡ Quick Start (Recommended - Windows)

**The fastest way to get started!** Use the automated setup script:

#### Option 1: Double-click (Easiest)

1. Navigate to the project root folder
2. Double-click `StartApp.bat`
3. Wait for the setup to complete (~2-5 minutes on first run)
4. Two terminal windows will open automatically:
   - **BACKEND Server** (Flask on port 5000)
   - **FRONTEND Server** (React on port 3000)
5. The setup window will close automatically after 10 seconds
6. Your browser will open to `http://localhost:3000`

#### Option 2: Command Line

```bash
# Navigate to project root
cd Group5_CT_Website

# Run the startup script
StartApp.bat
```

#### What StartApp.bat Does:

The script automates the entire setup process:

1. **Backend Setup** (`[1/4]`)

   - Creates Python virtual environment (if not exists)
   - Activates virtual environment
   - Installs all Python dependencies from `requirements.txt`
   - Seeds database with Vietnam location data (provinces, destinations)

2. **Frontend Setup** (`[2/4]`)

   - Installs all Node.js dependencies via `npm install`
   - Sets up React development environment

3. **Start Servers** (`[3/4]`)

   - Launches backend server in a new terminal window
   - Waits 3 seconds for backend to initialize
   - Launches frontend server in a new terminal window
   - Waits 10 seconds for both servers to be ready

4. **Open Browser** (`[4/4]`)
   - Automatically opens `http://localhost:3000` in your default browser

#### Notes:

- ✅ **First Run**: Takes longer as it installs all dependencies
- ✅ **Subsequent Runs**: Faster as dependencies are already installed
- ✅ **Auto-Close**: The setup window closes after 10 seconds (servers keep running)
- ✅ **Error Handling**: Script stops and shows error if any step fails
- ⚠️ **Database Seeding**: Runs automatically on each startup (can be disabled by commenting lines 43-52 in `StartApp.bat`)

#### Troubleshooting:

If the script fails:

- Ensure Python and Node.js are installed and in your PATH
- Check that ports 3000 and 5000 are not in use
- Review error messages in the terminal window
- See [Manual Setup](#manual-setup) below for step-by-step troubleshooting

---

### 📝 Manual Setup

> **💡 Tip for Windows Users**: If you're on Windows, use `StartApp.bat` instead (see [Quick Start](#-quick-start-recommended---windows) above). Manual setup is recommended for macOS/Linux users or for troubleshooting.

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd Group5_CT_Website
```

#### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Initialize database migrations (first time only)
flask db init

# Create initial migration
flask db migrate -m "initial migration"

# Apply migrations
flask db upgrade

# Seed database with Vietnam location data
python seed.py
```

#### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# If you encounter peer dependency issues:
npm install --legacy-peer-deps
```

#### 4. Run the Application

**Terminal 1 - Backend:**

```bash
cd backend
venv\Scripts\activate  # Windows
# or: source venv/bin/activate  # macOS/Linux
python app.py
```

Backend runs at: `http://localhost:5000`

**Terminal 2 - Frontend:**

```bash
cd frontend
npm start
```

Frontend runs at: `http://localhost:3000`

The React app will automatically proxy API requests to the Flask backend.

#### 5. Stop the Application

To stop the servers:

- **Windows**: Close the two terminal windows (BACKEND Server and FRONTEND Server)
- **macOS/Linux**: Press `Ctrl+C` in each terminal window

---

## 🔐 Environment Variables

Create a `.env` file in the project root with the following variables:

### Backend Environment Variables

```env
# Flask Configuration
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=your-super-secret-key-change-in-production
DATABASE_URL=sqlite:///db.sqlite3

# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# Google Gemini API (for image recognition)
GOOGLE_API_KEY=your-google-api-key

# Email Configuration (Gmail SMTP)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# JWT Configuration
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ACCESS_TOKEN_EXPIRES=7  # days
JWT_REFRESH_TOKEN_EXPIRES=30  # days
```

### Frontend Environment Variables

The frontend automatically loads environment variables from the root `.env` file. Required variables:

```env
# Firebase Configuration
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id

# Google OAuth
GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

**Note**: The frontend script `scripts/env_loader.js` automatically copies these values to `frontend/.env.local` with the `REACT_APP_*` prefix during build/start.

---

## 📡 API Documentation

### Authentication Endpoints

| Method | Endpoint                    | Description               | Auth Required |
| ------ | --------------------------- | ------------------------- | ------------- |
| POST   | `/api/auth/register`        | Register new user         | No            |
| POST   | `/api/auth/login`           | User login                | No            |
| POST   | `/api/auth/logout`          | User logout               | Yes           |
| POST   | `/api/auth/refresh`         | Refresh JWT token         | Yes           |
| POST   | `/api/auth/forgot-password` | Request password reset    | No            |
| POST   | `/api/auth/reset-password`  | Reset password with token | No            |
| POST   | `/api/auth/verify-email`    | Verify email address      | No            |
| POST   | `/api/auth/google`          | Google OAuth login        | No            |

### Trip Management Endpoints

| Method | Endpoint                     | Description           | Auth Required |
| ------ | ---------------------------- | --------------------- | ------------- |
| POST   | `/api/trips`                 | Create new trip       | Yes           |
| GET    | `/api/trips`                 | Get user's trips      | Yes           |
| GET    | `/api/trips/<id>`            | Get trip details      | Yes           |
| PUT    | `/api/trips/<id>`            | Update trip metadata  | Yes           |
| PUT    | `/api/trips/<id>/itinerary`  | Update trip itinerary | Yes           |
| POST   | `/api/trips/<id>/regenerate` | Regenerate itinerary  | Yes           |
| POST   | `/api/trips/<id>/extend`     | Extend trip duration  | Yes           |
| POST   | `/api/trips/<id>/add-place`  | Add place to trip     | Yes           |
| DELETE | `/api/trips/<id>`            | Delete trip           | Yes           |

### Destination Endpoints

| Method | Endpoint                             | Description                  | Auth Required |
| ------ | ------------------------------------ | ---------------------------- | ------------- |
| GET    | `/api/destinations`                  | Search destinations          | No            |
| GET    | `/api/destinations/<id>`             | Get destination details      | Yes           |
| GET    | `/api/destinations/by-province/<id>` | Get destinations by province | Yes           |
| GET    | `/api/locations/vietnam`             | Get hierarchical locations   | No            |

### AI Endpoints

| Method | Endpoint                           | Description                | Auth Required |
| ------ | ---------------------------------- | -------------------------- | ------------- |
| POST   | `/api/ai/evaluate_itinerary`       | Evaluate itinerary quality | No            |
| POST   | `/api/ai/reorder_itinerary`        | Optimize itinerary order   | No            |
| POST   | `/api/chat/sessions`               | Create chat session        | Yes           |
| POST   | `/api/chat/sessions/<id>/messages` | Send chat message          | Yes           |
| GET    | `/api/chat/sessions`               | Get user's chat sessions   | Yes           |

### Search Endpoints

| Method | Endpoint                        | Description                      | Auth Required |
| ------ | ------------------------------- | -------------------------------- | ------------- |
| POST   | `/api/search/image-recognition` | Recognize destination from image | Yes           |
| GET    | `/api/search`                   | Search destinations with filters | No            |

### Profile Endpoints

| Method | Endpoint                       | Description          | Auth Required |
| ------ | ------------------------------ | -------------------- | ------------- |
| GET    | `/api/profile`                 | Get user profile     | Yes           |
| PUT    | `/api/profile`                 | Update user profile  | Yes           |
| POST   | `/api/profile/change-email`    | Request email change | Yes           |
| POST   | `/api/profile/change-password` | Change password      | Yes           |

### Saved Destinations Endpoints

| Method | Endpoint          | Description            | Auth Required |
| ------ | ----------------- | ---------------------- | ------------- |
| GET    | `/api/saved`      | Get saved destinations | Yes           |
| POST   | `/api/saved`      | Save destination       | Yes           |
| DELETE | `/api/saved/<id>` | Unsave destination     | Yes           |

---

## 📁 Project Structure

```
Group5_CT_Website/
├── backend/
│   ├── app.py                 # Flask application entry point
│   ├── models.py              # SQLAlchemy database models
│   ├── requirements.txt        # Python dependencies
│   ├── seed.py                # Database seeding script
│   ├── routes/                # API route blueprints
│   │   ├── auth.py           # Authentication routes
│   │   ├── chat.py           # Chat/AI assistant routes
│   │   ├── itinerary.py      # Itinerary routes
│   │   ├── oauth.py          # OAuth routes
│   │   ├── profile.py        # User profile routes
│   │   ├── saved.py          # Saved destinations routes
│   │   ├── search.py         # Search and image recognition
│   │   └── weather.py        # Weather information
│   ├── utils/                 # Utility modules
│   │   ├── email_utils.py   # Email sending utilities
│   │   ├── env_loader.py    # Environment variable loader
│   │   ├── gemini.py        # Google Gemini API client
│   │   ├── image_recognition.py  # Image processing
│   │   ├── openai_client.py     # OpenAI API client
│   │   └── openai_rate_limiter.py  # Rate limiting
│   ├── data/                  # JSON data files
│   │   ├── HotelVN.json
│   │   ├── Restaurant.json
│   │   ├── mienbac.json
│   │   ├── miennam.json
│   │   └── mientrung.json
│   ├── migrations/            # Database migrations
│   ├── instance/              # Database files
│   └── venv/                 # Virtual environment
│
├── frontend/
│   ├── public/                # Static files
│   ├── src/
│   │   ├── components/        # Reusable React components
│   │   │   ├── ChatWidget/   # AI chat widget
│   │   │   ├── Footer/       # Footer component
│   │   │   ├── HowItWorks/   # How it works panel
│   │   │   └── Navbar/       # Navigation bar
│   │   ├── pages/            # Page components
│   │   │   ├── Home/        # Homepage
│   │   │   ├── Explore/     # Destination exploration
│   │   │   ├── MyTrips/     # Trip management
│   │   │   ├── Saved/       # Saved destinations
│   │   │   └── ProfilePage.js
│   │   ├── context/         # React Context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── config/          # Configuration files
│   │   ├── firebase/        # Firebase configuration
│   │   ├── untils/          # Utility functions
│   │   ├── App.js           # Main App component
│   │   └── index.js         # Entry point
│   ├── scripts/             # Build scripts
│   │   └── env_loader.js    # Environment loader
│   ├── package.json         # Node.js dependencies
│   └── tsconfig.json        # TypeScript configuration
│
├── tests/                    # Test files
│   ├── backend/             # Backend tests (pytest)
│   │   ├── test_routes/    # Route tests
│   │   ├── test_models/    # Model tests
│   │   └── test_utils/     # Utility tests
│   └── frontend/            # Frontend tests (Jest)
│       └── __tests__/       # Component tests
│
├── StartApp.bat             # Windows startup script
├── README.md                # This file
└── .env                      # Environment variables (create this)
```

---

## 🧪 Testing

### Backend Tests

```bash
cd backend
pip install pytest pytest-cov

# Run all tests with coverage
pytest -v --cov=backend --cov-report=term-missing --cov-report=html tests/backend

# View HTML coverage report
start ..\htmlcov\index.html
```

### Frontend Tests

```bash
cd frontend

# Run tests with coverage
npm test -- --coverage --watchAll=false

# Run tests in watch mode
npm test

# View HTML coverage report
start .\coverage\lcov-report\index.html
```

### Test Coverage

- **Backend**: Comprehensive route, model, and utility tests
- **Frontend**: Component and integration tests
- **Mocking**: External services (OpenAI, Gemini, Email) are mocked in tests

---

## 🔮 Future Improvements

### Short-term Enhancements

- [ ] **Real-time Collaboration**: Share trips with friends and collaborate in real-time
- [ ] **Mobile App**: React Native mobile application for iOS and Android
- [ ] [ ] **Offline Mode**: Cache itineraries and destinations for offline access
- [ ] **Export Functionality**: Export itineraries to PDF, Google Calendar, or iCal
- [ ] **Multi-language Support**: Support for English, Vietnamese, and other languages

### Medium-term Features

- [ ] **Advanced Route Optimization**: Integration with Google Maps API for real-time traffic
- [ ] **Budget Tracking**: Track expenses and compare against budget estimates
- [ ] **Social Features**: Share trips publicly, follow other travelers, discover popular routes
- [ ] **Review System**: User-generated reviews and ratings for destinations
- [ ] **Hotel Integration**: Book hotels directly through the platform

### Long-term Vision

- [ ] **Machine Learning**: Personalized recommendations based on user travel history
- [ ] **AR Features**: Augmented reality destination previews
- [ ] **Blockchain Integration**: Decentralized trip verification and reviews
- [ ] **Global Expansion**: Support for destinations beyond Vietnam
- [ ] **Enterprise Features**: Travel agency dashboard and bulk trip management

### Technical Improvements

- [ ] **Database Migration**: Upgrade from SQLite to PostgreSQL for production
- [ ] **Caching Layer**: Redis integration for improved performance
- [ ] **Microservices Architecture**: Split backend into specialized services
- [ ] **GraphQL API**: More flexible data fetching for complex queries
- [ ] **WebSocket Support**: Real-time updates for collaborative features

---

## 👤 Author

**Group 5 - CT Website Project**

- **Email**: hellowonderai@gmail.com
- **Support**: support@wonderai.travel
- **Facebook**: [WonderAI Travel](https://facebook.com/wonderai.travel)
- **Telegram**: [@wonderai_travel](https://t.me/wonderai_travel)

---

## 📄 License

This project is part of an academic course project. All rights reserved.

---

## 🙏 Acknowledgments

- **OpenAI** for GPT API services
- **Google** for Gemini Vision API and OAuth
- **Firebase** for authentication infrastructure
- **Vietnam Tourism Data** contributors for destination information

---

## 📞 Support

For issues, questions, or contributions, please contact:

- **Email**: hellowonderai@gmail.com
- **GitHub Issues**: [Create an issue](https://github.com/your-repo/issues)

---

**Built with ❤️ for travelers exploring Vietnam**
