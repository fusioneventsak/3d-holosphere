import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import HeroScene from '../components/three/HeroScene';
import { ArrowRight, CameraIcon, CloudCog, Share2, ShieldCheck } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <Layout>
      {/* Hero Section with WebGL Background */}
      <div className="relative overflow-hidden min-h-[100vh] flex items-center">
        {/* WebGL Scene Background */}
        <div className="absolute inset-0 w-full h-full">
          <HeroScene />
        </div>
        
        {/* Gradient Overlay for Better Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent lg:from-black/90 lg:via-black/50 lg:to-black/20"></div>
        
        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-32">
          <div className="text-center lg:text-left lg:w-1/2">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 drop-shadow-lg">
                Share Your Memories
              </span>
              <span className="block drop-shadow-lg">In Beautiful 3D</span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-200 mb-8 drop-shadow-lg">
              Create stunning 3D photo collages and share them with friends and family.
              No technical skills required.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
              <Link
                to="/dashboard"
                className="px-8 py-3 text-base font-medium rounded-md text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 transition-colors flex items-center justify-center shadow-lg hover:shadow-purple-500/25"
              >
                Create Collage
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                to="/join"
                className="px-8 py-3 text-base font-medium rounded-md text-white bg-black/50 backdrop-blur-sm border border-white/30 hover:bg-white/20 transition-colors flex items-center justify-center shadow-lg"
              >
                Join Existing
              </Link>
            </div>
          </div>
        </div>
        
        {/* Floating UI Elements */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center z-10">
          <div className="text-white/60 text-sm mb-2">Scroll to explore features</div>
          <div className="animate-bounce">
            <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
              <div className="w-1 h-3 bg-white/60 rounded-full mt-2 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="py-16 bg-black/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">How It Works</h2>
            <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
              Create stunning 3D photo collages in just a few simple steps
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105">
              <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-full p-3 inline-block mb-4">
                <CameraIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Upload Photos</h3>
              <p className="text-gray-400">
                Upload your favorite photos to create a collection. We support all common image formats.
              </p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105">
              <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-full p-3 inline-block mb-4">
                <CloudCog className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Auto Arrangement</h3>
              <p className="text-gray-400">
                Our system automatically arranges your photos in a beautiful 3D space. No design skills needed.
              </p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105">
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
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 md:p-12 hover:bg-white/10 transition-all duration-300">
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
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 transition-colors shadow-lg hover:shadow-purple-500/25"
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