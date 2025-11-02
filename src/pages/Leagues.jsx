import React from 'react';
import Card from '../components/ui/Card';

const Leagues = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Leagues</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Your Leagues</h2>
        <p className="text-text-secondary">
          League management, chat, and leaderboards will be here.
        </p>
      </div>
    </Card>
  </div>
);

export default Leagues;