import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Github, Twitter } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto py-6 bg-black/20 backdrop-blur-md border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-gray-400 text-sm">
              &copy; {new Date().getFullYear()} PhotoSphere. All rights reserved.
            </p>
          </div>
          
          <div className="flex space-x-4 text-gray-400">
            <Link to="/" className="text-sm hover:text-purple-400 transition-colors">
              Home
            </Link>
            <Link to="/about" className="text-sm hover:text-purple-400 transition-colors">
              About
            </Link>
            <Link to="/privacy" className="text-sm hover:text-purple-400 transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="text-sm hover:text-purple-400 transition-colors">
              Terms
            </Link>
          </div>
          
          <div className="flex space-x-4 mt-4 md:mt-0">
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Github className="h-5 w-5" />
            </a>
            <a 
              href="https://twitter.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <span className="text-gray-400 flex items-center">
              <span className="text-xs mr-1">Made with</span> 
              <Heart className="h-3 w-3 text-red-500" fill="currentColor" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;