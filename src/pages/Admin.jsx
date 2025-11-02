import React from 'react';
import Card from '../components/ui/Card';

const Admin = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Site Management</h2>
        <p className="text-text-secondary">
          Admin-only tools for managing the game.
        </p>
      </div>
    </Card>
  </div>
);

export default Admin;