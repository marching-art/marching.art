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
    
    if (corpsName.length > 50) {
      toast.error("Corps name must be 50 characters or less.");
      return;
    }
    
    if (alias.length > 20) {
      toast.error("Alias must be 20 characters or less.");
      return;
    }
    
    setIsSaving(true);
    
    try {
      // This is the correct way to call a Firebase callable function
      const updateCorpsInfo = httpsCallable(functions, 'users-updateCorpsInfo');
      const result = await updateCorpsInfo({ 
        corpsName: corpsName.trim(), 
        alias: alias.trim() 
      });
      
      console.log('Function result:', result.data);
      
      if (result.data.success) {
        toast.success("Welcome to marching.art!");
        onComplete(); // This will trigger the dashboard to re-fetch the profile
      } else {
        toast.error(result.data.message || "Failed to update corps info");
      }
    } catch (error) {
      console.error('Function call error:', error);
      
      // Handle specific Firebase function errors
      if (error.code === 'functions/unauthenticated') {
        toast.error("Please log in to continue.");
      } else if (error.code === 'functions/invalid-argument') {
        toast.error(error.message || "Invalid input provided.");
      } else if (error.code === 'functions/not-found') {
        toast.error("User profile not found. Please try logging out and back in.");
      } else {
        toast.error("Failed to save corps info. Please try again.");
      }
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
          <label className="block text-sm font-medium text-text-secondary-dark mb-1">
            Corps Name
          </label>
          <input
            type="text"
            value={corpsName}
            onChange={(e) => setCorpsName(e.target.value)}
            placeholder="e.g., The Phantom Regiment"
            className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark text-text-primary-dark"
            maxLength="50"
            required
            disabled={isSaving}
          />
          <p className="text-xs text-text-secondary-dark mt-1">
            {corpsName.length}/50 characters
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-text-secondary-dark mb-1">
            Your Title/Alias
          </label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="e.g., Director"
            className="w-full p-3 bg-background-dark border border-accent-dark rounded-theme focus:outline-none focus:ring-2 focus:ring-primary-dark text-text-primary-dark"
            maxLength="20"
            required
            disabled={isSaving}
          />
          <p className="text-xs text-text-secondary-dark mt-1">
            {alias.length}/20 characters
          </p>
        </div>
        
        <button 
          type="submit" 
          disabled={isSaving || !corpsName.trim() || !alias.trim()}
          className="w-full bg-primary hover:bg-primary-dark text-on-primary font-bold py-3 px-4 rounded-theme transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save and Continue"}
        </button>
      </form>
      
      {isSaving && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 text-text-secondary-dark">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-dark"></div>
            <span>Setting up your corps...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewUserSetup;