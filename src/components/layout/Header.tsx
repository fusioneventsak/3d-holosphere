import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, CameraIcon, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const Header: React.FC = () => {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
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
            {user ? (
              <>
                <Link 
                  to="/dashboard" 
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-200 hover:bg-purple-500/20 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                
                <div className="relative ml-3 flex items-center">
                  <div className="flex items-center">
                    <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-1 rounded-full">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <span className="ml-2 text-sm text-gray-300 hidden sm:inline">
                      {user.email?.split('@')[0]}
                    </span>
                  </div>
                  
                  <button
                    onClick={handleSignOut}
                    className="ml-4 p-1 rounded-full text-gray-400 hover:text-white transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-white bg-transparent hover:bg-purple-500/20 rounded-md transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="ml-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-500 rounded-md hover:from-purple-700 hover:to-blue-600 transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;