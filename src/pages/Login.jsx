import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth'; 
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import TextInput from '../components/ui/TextInput';
import { Logo } from '../components/Layout';
import { Loader2 } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Failed to sign in. Check your email and password.');
      console.error(err);
      setLoading(false);
    }
  };
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-sm">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          <h2 className="text-xl font-semibold text-center mb-4">Admin & Dev Login</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@marching.art"
            />
            <TextInput
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default Login;