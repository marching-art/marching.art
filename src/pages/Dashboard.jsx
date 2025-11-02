import React from 'react';
import { Plus } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const Dashboard = () => (
  <div className="p-4 lg:p-8">
    <h1 className="text-3xl font-bold mb-6">My Corps Dashboard</h1>
    <Card className="max-w-md">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Welcome, Director!</h2>
        <p className="text-text-secondary mb-4">
          This is where you will manage your corps, staff, and show.
        </p>
        <Button variant="primary" icon={Plus}>
          Register a New Corps
        </Button>
      </div>
    </Card>
  </div>
);

export default Dashboard;