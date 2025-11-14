# marching.art 🎺🏆

## Overview

marching.art is a modern, award-winning fantasy drum corps game that brings the excitement of DCI (Drum Corps International) to the digital world. Build your dream corps, select legendary captions from historical performances, and compete with directors worldwide in this immersive fantasy sports experience.

## 🎯 Features

### Core Gameplay
- **Two-Season Model**: Alternating between Off-Season (Director Sim) and Live Season (Classic Fantasy)
- **Corps Management**: Create and manage your fantasy drum corps with unique names, locations, and show concepts
- **Caption Selection**: Choose 8 captions from 25 available historical corps performances
- **Real-Time Scoring**: Track live scores during the DCI season
- **Progressive Unlocking**: Start with SoundSport and unlock higher classes through XP

### Modern Design
- **Responsive UI**: Fully optimized for mobile and desktop devices
- **Dark Theme**: Premium cream, black, and gold color scheme
- **Smooth Animations**: Framer Motion powered transitions and effects
- **Real-time Updates**: Firebase-powered live data synchronization
- **PWA Support**: Install as a native app on any device

### Social Features
- **League System**: Create or join private/public leagues
- **Leaderboards**: Compete across different classes (World, Open, A, SoundSport)
- **Director Profiles**: Track achievements, stats, and season history
- **Hall of Champions**: Celebrate past winners and achievements

## 🚀 Tech Stack

### Frontend
- **React 18**: Modern React with hooks and Suspense
- **React Router v6**: Client-side routing with protected routes
- **Tailwind CSS**: Utility-first CSS with custom theme
- **Framer Motion**: Professional animations and transitions
- **Lucide Icons**: Beautiful, consistent icon system
- **React Hot Toast**: Elegant notification system

### Backend (Firebase)
- **Authentication**: Email/password, anonymous, and custom token auth
- **Firestore**: Real-time NoSQL database
- **Cloud Functions**: Serverless backend logic
- **Storage**: File storage for uniforms and media
- **Analytics**: User tracking and engagement metrics

### Deployment
- **Vercel**: Production hosting with automatic deployments
- **GitHub**: Version control and CI/CD
- **Node 20**: Runtime environment

## 📦 Installation

### Prerequisites
- Node.js 20+
- npm or yarn
- Firebase project setup

### Setup Steps

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/marching-art.git
cd marching-art
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env.local
# Edit .env.local with your Firebase credentials
```

4. **Start development server**
```bash
npm start
```

5. **Build for production**
```bash
npm run build
```

## 🎮 Game Rules

### Season Structure
- **Live Season**: 10 weeks (ending second Saturday of August)
- **Off-Season**: 42 weeks (6 periods of 7 weeks each)
- **Automatic Reset**: Seasons reset at 3 AM after finals

### Caption Selection
- Select 8 captions: GE1, GE2, VP, VA, CG, B, MA, P
- Each caption from different historical corps
- No duplicate lineups allowed (first submitted keeps it)
- Dynamic cost system based on historical performance

### Caption Changes
- Unlimited changes until 5 weeks remaining
- 3 changes per week until 1 week remaining
- Final week: 2 between quarters/semis, 2 between semis/finals

### Progression System
- **SoundSport**: Available to all users
- **A Class**: Unlocked at Level 3
- **Open Class**: Unlocked at Level 5
- **World Class**: Unlocked at Level 10

## 📁 Project Structure

```
marching-art/
├── public/
│   ├── index.html          # Main HTML template
│   └── manifest.json       # PWA manifest
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Navigation.jsx  # Desktop navigation
│   │   ├── MobileNav.jsx   # Mobile navigation
│   │   └── LoadingScreen.jsx
│   ├── pages/              # Page components
│   │   ├── Dashboard.jsx   # Main dashboard
│   │   ├── Landing.jsx     # Landing page
│   │   ├── Login.jsx       # Authentication
│   │   ├── Register.jsx    
│   │   ├── Leaderboard.jsx 
│   │   └── ...
│   ├── firebase.js         # Firebase configuration
│   ├── App.jsx             # Main app component
│   ├── index.js            # App entry point
│   └── index.css           # Global styles
├── tailwind.config.js      # Tailwind configuration
├── package.json            # Dependencies
└── README.md               # Documentation
```

## 🔐 Security

### Firebase Rules
- Authenticated users can read public data
- Users can only modify their own data
- Admin-only access for system operations
- Rate limiting on API calls

### Best Practices
- Environment variables for sensitive data
- Secure authentication flow
- Input validation and sanitization
- XSS and CSRF protection

## 🎨 Design System

### Colors
- **Primary**: Gold (#FFD44D)
- **Secondary**: Cream (#E5D396)
- **Background**: Charcoal (#1A1A1A)

### Typography
- **Display**: Montserrat (headings)
- **Body**: Inter (content)
- **Mono**: Fira Code (code)

### Components
- Glass morphism effects
- Gradient accents
- Shadow elevation system
- Responsive grid layouts

## 📈 Performance

### Optimizations
- Code splitting with React.lazy()
- Image lazy loading
- Bundle size optimization
- PWA caching strategies
- Firebase offline persistence

### Metrics
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Lighthouse Score: 90+
- Bundle Size: < 500KB (gzipped)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

- **Documentation**: [docs.marching.art](https://docs.marching.art)
- **Support**: [support@marching.art](mailto:support@marching.art)
- **Discord**: [Join our community](https://discord.gg/marchingart)

## 🙏 Acknowledgments

- DCI (Drum Corps International) for inspiration
- The drum corps community
- All our beta testers and contributors

---

**Built with ❤️ for the drum corps community**

*marching.art - Where legends are made*
