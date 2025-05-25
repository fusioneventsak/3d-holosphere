import React from 'react';
import Layout from '../components/layout/Layout';
import CollageForm from '../components/collage/CollageForm';
import CollageList from '../components/collage/CollageList';

const DashboardPage: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">
              My Collages
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Create and manage your 3D photo collages
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div>
            <CollageForm />
          </div>
          
          <div className="lg:col-span-3">
            <CollageList />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;