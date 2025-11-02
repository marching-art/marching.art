import React from 'react';
import Card from '../components/ui/Card';

const Schedule = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Schedule</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Season Schedule</h2>
        <p className="text-text-secondary">
          View all upcoming events for both seasons.
        </p>
      </div>
    </Card>
  </div>
);

export default Schedule;