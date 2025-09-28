import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from 'firebaseConfig';
import toast from 'react-hot-toast';

const NewUserSetup = ({ profile, onComplete }) => {
  const [corpsName, setCorpsName] = useState('');
  const [alias, setAlias] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!corpsName || !alias) {
      toast.error("Please fill out both fields.");
      return;
    }
    setIsSaving(true);
    const updateCorpsInfo = httpsCallable(functions, 'updateCorpsInfo');
    try {
      await updateCorpsInfo({ corpsName, alias });
      toast.success("Welcome to marching.art!");
      onComplete(); // This will trigger the dashboard to re-fetch the profile
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-surface-dark p-8 rounded-theme shadow-theme-dark max-w-lg mx-auto">
      <h2 className="text-3xl font-bold text-center mb-2 text-primary-dark">Welcome!</h2>
      <p className="text-center text-text-secondary-dark mb-6">Let's set up your first corps. You can change this later.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary-dark mb-1">Corps Name</label>
          <input
            type="text"
            value={corpsName}
            onChange={(e) => setCorpsName(e.target.value)}
            placeholder="e.g., The Phantom Regiment"
            className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark"
            maxLength="50"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary-dark mb-1">Your Title/Alias</label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="e.g., Director"
            className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark"
            maxLength="20"
            required
          />
        </div>
        <button type="submit" disabled={isSaving} className="w-full bg-primary hover:bg-primary-dark text-on-primary font-bold py-3 px-4 rounded-theme transition-colors disabled:bg-gray-600">
          {isSaving ? "Saving..." : "Save and Continue"}
        </button>
      </form>
    </div>
  );
};

export default NewUserSetup;