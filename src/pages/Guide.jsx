import React from 'react';
import Card from '../components/ui/Card';  

const Guide = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Guide</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">How to Play</h2>
        <p className="text-text-secondary">
          The official rulebook and guide to marching.art.
        </p>
      </div>
    </Card>
  </div>
);

export default Guide;   