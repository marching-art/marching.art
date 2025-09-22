// components/dashboard/SeasonSignup.js
// Season signup component for Enhanced Fantasy Drum Corps Game

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CORPS_CLASSES, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';
import Icon from '../ui/Icon';

const SeasonSignup = ({ seasonSettings, corpsData }) => {
  const navigate = useNavigate();
  const [selectedClass, setSelectedClass] = useState('worldClass');

  const handleCreateCorps = (corpsClass) => {
    // Navigate to enhanced lineup builder
    navigate(`/enhanced-lineup/${corpsClass}`);
  };

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-8 border border-accent dark:border-accent-dark shadow-theme">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🎺</div>
        <h2 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
          Welcome to {seasonSettings?.name || 'Fantasy Drum Corps'}!
        </h2>
        <p className="text-text-secondary dark:text-text-secondary-dark text-lg">
          Create your first fantasy corps and start competing. Choose a class that fits your strategy and budget.
        </p>
      </div>

      {/* Season Info */}
      {seasonSettings && (
        <div className="mb-8 p-4 bg-primary/10 rounded-theme border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Icon path="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 005.25 9h13.5a2.25 2.25 0 002.25 2.25v7.5" className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-primary">Current Season</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-text-secondary dark:text-text-secondary-dark">Status:</span>
              <span className="ml-2 font-medium text-text-primary dark:text-text-primary-dark capitalize">
                {seasonSettings.status?.replace('-', ' ') || 'Active'}
              </span>
            </div>
            <div>
              <span className="text-text-secondary dark:text-text-secondary-dark">Available Corps:</span>
              <span className="ml-2 font-medium text-text-primary dark:text-text-primary-dark">
                {corpsData?.length || 0}
              </span>
            </div>
            <div>
              <span className="text-text-secondary dark:text-text-secondary-dark">Staff Available:</span>
              <span className="ml-2 font-medium text-text-primary dark:text-text-primary-dark">
                40+ Hall of Fame
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Corps Class Selection */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark text-center">
          Choose Your Corps Class
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CORPS_CLASS_ORDER.map(classKey => {
            const classInfo = CORPS_CLASSES[classKey];
            const isRecommended = classKey === 'worldClass';
            
            return (
              <div
                key={classKey}
                className={`relative p-6 rounded-theme border-2 cursor-pointer transition-all ${
                  selectedClass === classKey
                    ? 'border-primary bg-primary/10'
                    : 'border-accent dark:border-accent-dark hover:border-primary/50'
                } ${isRecommended ? 'ring-2 ring-yellow-400 ring-opacity-50' : ''}`}
                onClick={() => setSelectedClass(classKey)}
              >
                {isRecommended && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
                      RECOMMENDED
                    </span>
                  </div>
                )}
                
                <div className="text-center">
                  <div className={`w-4 h-4 ${classInfo.color} rounded-full mx-auto mb-3`}></div>
                  <h4 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-2">
                    {classInfo.name}
                  </h4>
                  <div className="text-2xl font-bold text-primary dark:text-primary-dark mb-2">
                    {classInfo.pointCap} pts
                  </div>
                  <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-4">
                    {classInfo.description}
                  </p>
                  
                  {/* Class Features */}
                  <div className="space-y-2 text-xs text-text-secondary dark:text-text-secondary-dark">
                    <div className="flex justify-between">
                      <span>Point Budget:</span>
                      <span className="font-medium">{classInfo.pointCap}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Competition Level:</span>
                      <span className="font-medium capitalize">{classInfo.name.replace('Class', '').trim()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Staff Bonuses:</span>
                      <span className="font-medium text-green-500">Available</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => handleCreateCorps(selectedClass)}
            className="bg-primary text-on-primary px-8 py-3 rounded-theme font-bold hover:bg-primary/90 transition-colors text-lg"
          >
            Create {CORPS_CLASSES[selectedClass]?.name} Corps
          </button>
          
          <button
            onClick={() => navigate('/howtoplay')}
            className="border border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark px-8 py-3 rounded-theme font-semibold hover:bg-accent/10 transition-colors"
          >
            Learn How to Play
          </button>
        </div>

        {/* Quick Tips */}
        <div className="bg-background dark:bg-background-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
          <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">Quick Tips:</h4>
          <ul className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-1">
            <li>• Start with World Class for the full experience</li>
            <li>• You can create multiple corps in different classes</li>
            <li>• Staff members boost your performance</li>
            <li>• Join leagues to compete with friends</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SeasonSignup;