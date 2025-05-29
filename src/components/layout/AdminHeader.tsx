import React from 'react';
import { Link } from 'react-router-dom';
import { CameraIcon, Settings } from 'lucide-react';

const AdminHeader: React.FC = () => {
  return (
    <header className="sticky top-0 z-10 backdrop-blur-md bg-black/30 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <CameraIcon className="h-8 w-8 text-purple-500" />
              <span className="ml-2 text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 text-transparent bg-clip-text">
                PhotoSphere Admin
              </span>
            </Link>
          </div>
          
          <nav className="flex items-center space-x-3">
            <Link
              to="/dashboard"
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-200 hover:bg-purple-500/20 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            
            <Link
              to="/admin/settings"
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-200 hover:bg-purple-500/20 hover:text-white transition-colors flex items-center"
            >
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;