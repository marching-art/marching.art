import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, appId } from '../../firebase';

const SignUpForm = ({ onSignUpSuccess, switchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        if (!username.trim()) {
            setError("Please enter a username.");
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
            await setDoc(userDocRef, {
                username: username,
                email: user.email,
                createdAt: new Date(),
                lastActive: new Date(),
                bio: `Welcome to my marching.art profile!`,
                uniform: { jacketStyle: "classic", jacketColor1: "#000000", jacketColor2: "#ffffff", plumeStyle: "standard", plumeColor: "#ffffff", hatStyle: "shako", hatColor: "#000000" },
                trophies: { championships: [], regionals: [] },
                seasons: [],
                lineup: {}
            });
            
            onSignUpSuccess();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <form onSubmit={handleSignUp}>
            {error && <p className="bg-red-100 dark:bg-red-900 border border-red-500 text-red-700 dark:text-red-300 p-2 mb-4 rounded text-sm">{error}</p>}
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-4 text-gray-800 dark:text-yellow-300 placeholder-gray-500 dark:placeholder-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-4 text-gray-800 dark:text-yellow-300 placeholder-gray-500 dark:placeholder-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-400 dark:border-yellow-500 rounded p-2 mb-4 text-gray-800 dark:text-yellow-300 placeholder-gray-500 dark:placeholder-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            <button type="submit" className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded border-b-4 border-yellow-800 hover:border-yellow-700 transition-all"> Sign Up </button>
            <p className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400"> Already have an account?{' '} <button type="button" onClick={switchToLogin} className="text-yellow-600 dark:text-yellow-400 hover:underline">Log In</button> </p>
        </form>
    );
};
export default SignUpForm;