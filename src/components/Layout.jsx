import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  BarChart,
  Users,
  Calendar,
  Award,
  BookOpen,
  LogOut,
  Menu,
  Shield,
  Library
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import Button from './ui/Button';

export const Logo = () => (
  <Link to="/" className="flex items-center space-x-3 cursor-pointer group">
    <div className="relative">
      <img
        src="/logo192.png"
        alt="marching.art logo"
        className="h-10 w-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12"
      />
      <div className="absolute inset-0 blur-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
    <span className="text-2xl font-bold tracking-tight">
      <span className="text-text-primary transition-colors">marching</span>
      <span className="gradient-text">.art</span>
    </span>
  </Link>
);

const MyCorpsIcon = ({ isActive }) => <Shield className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const HubIcon = ({ isActive }) => <Home className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const LeaguesIcon = ({ isActive }) => <Users className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const ScoresIcon = ({ isActive }) => <BarChart className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const ScheduleIcon = ({ isActive }) => <Calendar className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const ChampionsIcon = ({ isActive }) => <Award className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const GuideIcon = ({ isActive }) => <BookOpen className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;
const AdminIcon = ({ isActive }) => <Library className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-text-secondary'}`} />;

const NavLink = ({ to, text, IconComponent }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`
        flex items-center space-x-3 px-3 py-2.5 rounded-lg
        transition-all duration-200 ease-smooth
        ${isActive
          ? 'bg-surface text-text-primary shadow-sm'
          : 'text-text-secondary hover:bg-surface/50 hover:text-text-primary'
        }
      `}
    >
      <IconComponent isActive={isActive} />
      <span className="font-semibold">{text}</span>
    </Link>
  );
};

const Sidebar = () => {
  const { isAdmin } = useAuth();
  return (
    <div className="hidden lg:flex lg:flex-col w-64 h-screen p-4 bg-background border-r border-primary/10">
      <div className="mb-8">
        <Logo />
      </div>
      <nav className="flex-1 flex flex-col space-y-2">
        <NavLink to="/" text="Hub" IconComponent={HubIcon} />
        <NavLink to="/dashboard" text="My Corps" IconComponent={MyCorpsIcon} />
        <NavLink to="/leagues" text="Leagues" IconComponent={LeaguesIcon} />
        <NavLink to="/scores" text="Scores" IconComponent={ScoresIcon} />
        <NavLink to="/schedule" text="Schedule" IconComponent={ScheduleIcon} />
        <NavLink to="/champions" text="Champions" IconComponent={ChampionsIcon} />
        <NavLink to="/guide" text="Guide" IconComponent={GuideIcon} />
        {isAdmin && (
          <NavLink to="/admin" text="Admin" IconComponent={AdminIcon} />
        )}
      </nav>
      <div className="mt-auto">
        <Button
          variant="secondary"
          icon={LogOut}
          className="w-full"
          onClick={() => signOut(auth)}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
};

const MobileNav = () => {
  const location = useLocation();
  const getIconClass = (path) =>
    location.pathname === path ? "text-primary" : "text-text-secondary group-hover:text-primary";
  
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-primary/10 shadow-lg flex items-center justify-around z-40">
      <Link to="/" className="flex flex-col items-center group">
        <Home className={getIconClass("/")} />
        <span className="text-xs">Hub</span>
      </Link>
      <Link to="/dashboard" className="flex flex-col items-center group">
        <Shield className={getIconClass("/dashboard")} />
        <span className="text-xs">My Corps</span>
      </Link>
      <Link to="/leagues" className="flex flex-col items-center group">
        <Users className={getIconClass("/leagues")} />
        <span className="text-xs">Leagues</span>
      </Link>
      <Link to="/scores" className="flex flex-col items-center group">
        <BarChart className={getIconClass("/scores")} />
        <span className="text-xs">Scores</span>
      </Link>
      <button className="flex flex-col items-center group">
        <Menu className="text-text-secondary group-hover:text-primary" />
        <span className="text-xs">More</span>
      </button>
    </div>
  );
};

const MainLayout = () => {
  return (
    <div className="flex h-screen bg-background text-text-primary">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={useLocation().pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <MobileNav />
    </div>
  );
};

export default MainLayout;