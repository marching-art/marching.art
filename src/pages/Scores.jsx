import React from 'react';
import Card from '../components/ui/Card';

const Scores = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Scores</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Scores & Recaps</h2>
        <p className="text-text-secondary">
          Browse all live and off-season scores.
        </p>
      </div>
    </Card>
  </div>
);

export default Scores;