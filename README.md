# 🎯 marching.art

> The ultimate fantasy drum corps game - where legends are made and championships are won.

[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

## 🏆 Game Overview

**marching.art** is the premier fantasy drum corps gaming platform that brings the excitement of DCI competition to your fingertips. Build your dream corps, hire legendary staff, compete in seasons, and climb the leaderboards to become a champion.

### ✨ Key Features

- **🎭 Fantasy Corps Management**: Create and customize your own drum corps
- **👨‍🏫 Legendary Staff System**: Hire DCI Hall of Fame members to boost performance
- **💰 Staff Marketplace**: Trade valuable staff with other directors
- **🏅 Competitive Seasons**: Participate in realistic 10-week seasons
- **🏆 Class Progression**: Unlock SoundSport → A Class → Open Class → World Class
- **💎 CorpsCoin Economy**: Earn and spend virtual currency
- **📊 Advanced Analytics**: Deep dive into performance data
- **👥 League System**: Compete with friends in private leagues

## 🚀 Quick Start

### Prerequisites

- **Node.js**: Version 20.x or higher
- **npm**: Version 9.x or higher
- **Firebase CLI**: `npm install -g firebase-tools`

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/marching-art/marching-art.git
   cd marching-art
   ```

2. **Install dependencies**
   ```bash
   ./deploy.sh deps
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase configuration
   ```

4. **Initialize Firebase**
   ```bash
   firebase login
   firebase use --add
   ```

5. **Deploy application**
   ```bash
   ./deploy.sh all
   ```

## 🏗️ Architecture

### Frontend (React)
- **Framework**: React 18.x with Hooks
- **Routing**: React Router v6
- **State Management**: Zustand for global state
- **Styling**: Tailwind CSS with custom theme
- **UI Components**: Custom component library with Lucide icons
- **Authentication**: Firebase Auth integration

### Backend (Firebase)
- **Database**: Cloud Firestore with optimized collections
- **Functions**: Node.js 20 serverless functions
- **Authentication**: Firebase Auth with custom claims
- **Hosting**: Firebase Hosting with CDN
- **Storage**: Firebase Storage for assets

### Database Schema

```
artifacts/
├── marching-art/
│   └── users/
│       └── {userId}/
│           ├── profile/data          # Public profile data
│           ├── private/data          # Private user data
│           ├── staff/{staffId}       # Owned staff members
│           └── notifications/        # User notifications

staff/                                # DCI Hall of Fame database
├── {staffId}                        # Staff member documents

staff_marketplace/                    # Staff trading marketplace
├── {listingId}                      # Marketplace listings

corps_coin_transactions/              # CorpsCoin transaction logs
├── {userId}/transactions/

xp_transactions/                      # XP earning logs
├── {userId}/transactions/
```

## 🎮 Gameplay Mechanics

### Season Structure
- **Duration**: 10 weeks (June - August)
- **Off-Seasons**: 6x 7-week periods between live seasons
- **Competition Schedule**: Regional championships and finals
- **Scoring**: Based on historical DCI data with algorithmic enhancements

### Class System & Progression
- **SoundSport**: Entry level, always available
- **A Class**: Unlocked at 500 XP
- **Open Class**: Unlocked at 2,000 XP  
- **World Class**: Unlocked at 5,000 XP

### Caption Selection
Each corps selects 8 captions with point limits:
- **SoundSport**: 90 points
- **A Class**: 60 points
- **Open Class**: 120 points
- **World Class**: 150 points

### Staff Management
- **Hall of Fame Database**: 20+ legendary DCI staff members
- **Pricing**: Based on induction year and experience
- **Experience System**: Staff gain value through successful seasons
- **Marketplace**: Player-to-player trading system

## 🛠️ Development

### Project Structure
```
marching-art/
├── public/                   # Static assets
├── src/
│   ├── components/          # React components
│   │   ├── auth/           # Authentication components
│   │   ├── dashboard/      # Dashboard modules
│   │   └── layout/         # Layout components
│   ├── context/            # React context providers
│   ├── pages/              # Page components
│   ├── store/              # Zustand stores
│   └── utils/              # Utility functions
├── functions/              # Firebase Functions
│   ├── data/              # Static data files
│   └── src/
│       ├── callable/      # Callable functions
│       ├── triggers/      # Event triggers
│       ├── scheduled/     # Cron jobs
│       └── admin/         # Admin functions
└── firestore.rules        # Security rules
```

### Available Scripts

```bash
# Development
npm start                 # Start development server
npm run build            # Build for production
npm test                 # Run tests

# Deployment
./deploy.sh all          # Full deployment
./deploy.sh functions    # Deploy functions only
./deploy.sh hosting      # Deploy frontend only
./deploy.sh firestore    # Deploy rules only

# Database
./deploy.sh init-staff   # Initialize staff database

# Utilities
npm run lint             # Lint code
npm run analyze          # Analyze bundle size
```

### Environment Variables

Create a `.env` file with:
```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_DATA_NAMESPACE=marching-art
```

## 🔒 Security

### Firestore Security Rules
- **Public Data**: Profiles, leaderboards, scores
- **Private Data**: Personal settings, transaction history
- **User Data**: Staff collections, notifications
- **Marketplace**: Trading system with escrow protection

### Authentication
- **Email/Password**: Primary authentication method
- **Admin Claims**: Special privileges for admin users
- **Session Management**: Secure token handling

## 📈 Performance & Scalability

### Optimization Features
- **Code Splitting**: Route-based lazy loading
- **Image Optimization**: WebP format with fallbacks
- **CDN**: Firebase Hosting global distribution
- **Caching**: Aggressive caching strategies
- **Bundle Analysis**: Regular size monitoring

### Cost Efficiency
- **Firestore**: Optimized queries and indexes
- **Functions**: Efficient resource allocation
- **Hosting**: Static asset optimization
- **Monitoring**: Usage tracking and alerts

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## 📊 Monitoring & Analytics

### Firebase Console
- Function execution metrics
- Database usage statistics
- Authentication analytics
- Performance monitoring

### Custom Metrics
- User engagement tracking
- Season participation rates
- Marketplace transaction volume
- Staff popularity analytics

## 🚀 Deployment

### Production Deployment
1. **Build optimized bundle**: `npm run build`
2. **Deploy functions**: `firebase deploy --only functions`
3. **Deploy hosting**: `firebase deploy --only hosting`
4. **Deploy rules**: `firebase deploy --only firestore`

### Staging Environment
```bash
firebase use staging
./deploy.sh all
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Code Standards
- **ESLint**: Enforced code formatting
- **Prettier**: Automatic code formatting
- **Conventional Commits**: Standardized commit messages
- **Component Documentation**: PropTypes and JSDoc comments

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Roadmap

### Phase 1: Core Platform ✅
- [x] User authentication & profiles
- [x] Corps creation & lineup management
- [x] Staff hiring system
- [x] Basic marketplace functionality

### Phase 2: Enhanced Features 🚧
- [ ] League system & competitions
- [ ] Advanced analytics dashboard
- [ ] Uniform designer
- [ ] Mobile app (React Native)

### Phase 3: Community Features 📋
- [ ] Social features & messaging
- [ ] Tournament brackets
- [ ] Achievement system
- [ ] Streaming integration

### Phase 4: Advanced Gaming 🔮
- [ ] AI-powered opponents
- [ ] Real-time competitions
- [ ] Virtual reality integration
- [ ] Esports tournaments

## 🏆 Hall of Fame

Special thanks to the DCI Hall of Fame members whose legacy inspires this game:

- George Zingali, Frank Arsenault, Ralph Hardimon
- Michael Cesario, Scott Chandler
- John Bilby, Jeff Fiedler
- Wayne Downey, Thom Hannum
- George Oliviero, Shirley Dorritie, Michael Shapiro
- Jim Ott, Jerry Seawright, Gail Royer
- Don Angelica, Tom Keck
- Fred Sanford, Paul Rennick, Colin McNutt

## 📞 Support

- **Documentation**: [docs.marching.art](https://docs.marching.art)
- **Community**: [Discord Server](https://discord.gg/marching-art)
- **Issues**: [GitHub Issues](https://github.com/marching-art/marching-art/issues)
- **Email**: support@marching.art

---

<p align="center">
  <strong>Built with ❤️ for the drum corps community</strong>
  <br>
  <em>Where every performance matters and every season tells a story</em>
</p>