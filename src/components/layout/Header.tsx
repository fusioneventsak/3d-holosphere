import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CameraIcon, Calendar } from 'lucide-react';
import DemoRequestModal from '../modals/DemoRequestModal';

const Header: React.FC = () => {
  const [isDemoModalOpen, setIsDemoModalOpen] = React.useState(false);
  const location = useLocation();
  
  // Don't show the demo button on the landing page to avoid duplication
  const showDemoButton = location.pathname !== '/';

  return (
    <>
      <header className="sticky top-0 z-10 backdrop-blur-md bg-black/30 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <CameraIcon className="h-8 w-8 text-purple-500" />
                <span className="ml-2 text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 text-transparent bg-clip-text">
                  PhotoSphere
                </span>
              </Link>
            </div>
            
            <nav className="flex items-center space-x-1">
              <Link
                to="/join"
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-200 hover:bg-purple-500/20 hover:text-white transition-colors"
              >
                Join Collage
              </Link>
              
              <Link
                to="/dashboard"
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-200 hover:bg-purple-500/20 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              
              {showDemoButton && (
                <button
                  onClick={() => setIsDemoModalOpen(true)}
                  className="ml-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-500 rounded-md hover:from-green-700 hover:to-emerald-600 transition-colors flex items-center"
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Request Demo
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>
      
      {/* Demo Request Modal */}
      <DemoRequestModal 
        isOpen={isDemoModalOpen} 
        onClose={() => setIsDemoModalOpen(false)} 
      />
    </>
  );
};

export default Header;