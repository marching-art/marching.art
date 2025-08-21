import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';

const LoginForm = ({ onLoginSuccess, switchToSignUp }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            onLoginSuccess();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <form onSubmit={handleLogin}>
            {error && <p className="bg-red-100 dark:bg-red-900 border border-red-500 text-red-700 dark:text-red-300 p-2 mb-4 rounded text-sm">{error}</p>}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-4 text-gray-800 dark:text-yellow-300 placeholder-gray-500 dark:placeholder-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-4 text-gray-800 dark:text-yellow-300 placeholder-gray-500 dark:placeholder-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            <button type="submit" className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded border-b-4 border-yellow-800 hover:border-yellow-700 transition-all"> Log In </button>
            <p className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400"> Don't have an account?{' '} <button type="button" onClick={switchToSignUp} className="text-yellow-600 dark:text-yellow-400 hover:underline">Sign Up</button> </p>
        </form>
    );
};
export default LoginForm;