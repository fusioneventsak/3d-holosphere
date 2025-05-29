import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { ArrowRight, CameraIcon, CloudCog, Share2, ShieldCheck } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-32">
          <div className="text-center lg:text-left lg:w-1/2">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
                Share Your Memories
              </span>
              <span className="block">In Beautiful 3D</span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-300 mb-8">
              Create stunning 3D photo collages and share them with friends and family.
              No technical skills required.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
              <Link
                to="/dashboard"
                className="px-8 py-3 text-base font-medium rounded-md text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 transition-colors flex items-center justify-center"
              >
                Create Collage
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                to="/join"
                className="px-8 py-3 text-base font-medium rounded-md text-white bg-black/30 border border-white/20 hover:bg-white/10 transition-colors flex items-center justify-center"
              >
                Join Existing
              </Link>
            </div>
          </div>
        </div>
        
        {/* Abstract shape decorations */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 opacity-50 lg:opacity-100 pointer-events-none">
          <div className="w-96 h-96 bg-gradient-to-br from-purple-500/30 to-blue-500/30 rounded-full blur-3xl"></div>
        </div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 opacity-50 lg:opacity-100 pointer-events-none">
          <div className="w-72 h-72 bg-gradient-to-tr from-pink-500/30 to-purple-500/30 rounded-full blur-3xl"></div>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="py-16 bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">How It Works</h2>
            <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
              Create stunning 3D photo collages in just a few simple steps
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
              <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-full p-3 inline-block mb-4">
                <CameraIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Upload Photos</h3>
              <p className="text-gray-400">
                Upload your favorite photos to create a collection. We support all common image formats.
              </p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
              <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-full p-3 inline-block mb-4">
                <CloudCog className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Auto Arrangement</h3>
              <p className="text-gray-400">
                Our system automatically arranges your photos in a beautiful 3D space. No design skills needed.
              </p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
              <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-full p-3 inline-block mb-4">
                <Share2 className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Share & Explore</h3>
              <p className="text-gray-400">
                Share your 3D collage with a unique link. Anyone can view and interact with your creation.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* CTA Section */}
      <div className="py-16 bg-gradient-to-b from-black/10 to-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 md:p-12">
            <div className="md:flex md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">Ready to create your first 3D collage?</h2>
                <p className="mt-3 text-gray-400 max-w-3xl">
                  Start now and transform your photos into interactive 3D experiences. It's completely free!
                </p>
              </div>
              <div className="mt-8 md:mt-0">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 transition-colors"
                >
                  Create Your Collage
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Trust Section */}
      <div className="py-16 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-full p-3 inline-block mb-4">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-xl font-medium text-white mb-2">Your Photos Are Safe</h3>
          <p className="text-gray-400 max-w-2xl mx-auto">
            We use industry-standard encryption to protect your photos and personal information. Your memories are always safe with us.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default LandingPage;