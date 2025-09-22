// components/dashboard/QuickActions.js
// Quick action buttons for common user tasks

import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';

const QuickActions = ({ userCorps }) => {
  const navigate = useNavigate();
  const hasCorps = Object.keys(userCorps).length > 0;

  const actions = [
    {
      title: 'Update Lineup',
      description: 'Modify your corps lineups',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      action: () => navigate('/dashboard'),
      disabled: !hasCorps,
      color: 'text-blue-500'
    },
    {
      title: 'Staff Trading',
      description: 'Browse and trade staff members',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z',
      action: () => navigate('/staff-trading'),
      disabled: false,
      color: 'text-green-500'
    },
    {
      title: 'Join League',
      description: 'Compete with friends',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z',
      action: () => navigate('/leagues'),
      disabled: false,
      color: 'text-purple-500'
    },
    {
      title: 'View Scores',
      description: 'Check competition results',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      action: () => navigate('/scores'),
      disabled: false,
      color: 'text-orange-500'
    }
  ];

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
      <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.action}
            disabled={action.disabled}
            className={`p-4 rounded-theme text-left transition-all ${
              action.disabled
                ? 'bg-background dark:bg-background-dark text-text-secondary dark:text-text-secondary-dark cursor-not-allowed opacity-50'
                : 'bg-background dark:bg-background-dark hover:bg-accent/10 text-text-primary dark:text-text-primary-dark border border-accent dark:border-accent-dark hover:border-primary'
            }`}
          >
            <Icon path={action.icon} className={`w-5 h-5 mb-2 ${action.color}`} />
            <div className="font-semibold text-sm">{action.title}</div>
            <div className="text-xs opacity-75">{action.description}</div>
          </button>
        ))}
      </div>
      
      {!hasCorps && (
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-theme">
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            Create your first corps to unlock all actions
          </p>
        </div>
      )}
    </div>
  );
};

export default QuickActions;