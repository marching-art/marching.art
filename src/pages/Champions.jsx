import React from 'react';
import Card from '../components/ui/Card';

const Champions = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Hall of Champions</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Past Winners</h2>
        <p className="text-text-secondary">
          A showcase of all previous season champions.
        </p>
      </div>
    </Card>
  </div>
);

export default Champions;