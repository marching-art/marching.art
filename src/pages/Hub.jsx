import React from 'react';
import Card from '../components/ui/Card';

const Hub = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Hub</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Central Feed</h2>
        <p className="text-text-secondary">
          AI-generated recaps, community news, and updates will appear here.
        </p>
      </div>
    </Card>
  </div>
);

export default Hub;