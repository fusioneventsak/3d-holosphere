import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import DemoRequestModal from '../modals/DemoRequestModal';

const Header: React.FC = () => {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-10 backdrop-blur-md bg-black/30 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <img 
                  src="https://www.fusion-events.ca/wp-content/uploads/2025/06/Untitled-design-15.png" 
                  alt="Fusion Events Logo" 
                  className="h-12 w-auto"
                />
              </Link>
            </div>
            
            <nav className="flex items-center space-x-1">
              <Link
                to="/join"
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-200 hover:bg-purple-500/20 hover:text-white transition-colors flex items-center"
              >
                <Users className="h-4 w-4 mr-1" />
                Join Collage
              </Link>
              
              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="ml-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-500 rounded-md hover:from-purple-700 hover:to-blue-600 transition-colors"
              >
                Request Demo
              </button>
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