import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import HeroScene from '../components/three/HeroScene';
import DemoRequestModal from '../components/DemoRequestModal';
import { ArrowRight, CameraIcon, CloudCog, Share2, ShieldCheck } from 'lucide-react';

const LandingPage: React.FC = () => {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <Layout>
      {/* Hero Section with WebGL Background */}
      <div className="relative overflow-hidden min-h-[100vh] flex items-center">
        {/* WebGL Scene Background */}
        <div className="absolute inset-0 w-full h-full">
          <HeroScene />
        </div>
        
        {/* Gradient Overlay for Better Text Readability - allow pointer events to pass through */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent lg:from-black/90 lg:via-black/50 lg:to-black/20 pointer-events-none"></div>
        
        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-32 pointer-events-none">
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
            
            <div className="flex flex-col sm:flex-row justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4 pointer-events-auto">
              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="px-8 py-3 text-base font-medium rounded-md text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 transition-colors flex items-center justify-center shadow-lg hover:shadow-purple-500/25"
              >
                Request Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
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
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center z-10 pointer-events-none">
          <div className="text-white/60 text-sm mb-2">Drag to explore • Auto-rotating showcase</div>
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

      {/* Event Solutions Section */}
      <div className="py-20 bg-gradient-to-b from-black/20 to-black/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Perfect for Events & Professional Photography</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Transform your events with our revolutionary 3D Selfie Holosphere technology. Create immersive experiences that wow your guests.
            </p>
          </div>

          {/* Video and Image Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            {/* Video Section */}
            <div className="space-y-6">
              <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl">
                <iframe
                  src="https://www.youtube.com/embed/96PSJYnYzhI"
                  title="3D Selfie Holosphere Demo"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-white mb-2">See It In Action</h3>
                <p className="text-gray-400">Watch how our 3D technology brings photos to life at events</p>
              </div>
            </div>

            {/* Image Section */}
            <div className="space-y-6">
              <div className="relative rounded-xl overflow-hidden shadow-2xl">
                <img
                  src="https://www.fusion-events.ca/wp-content/uploads/2025/06/3d-Selfies.png"
                  alt="3D Selfie Holosphere Setup"
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-white mb-2">Professional Setup</h3>
                <p className="text-gray-400">State-of-the-art equipment for premium event experiences</p>
              </div>
            </div>
          </div>

          {/* Event Use Cases */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-gradient-to-br from-purple-900/30 to-black/50 backdrop-blur-sm p-6 rounded-lg border border-purple-500/20">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Large Screen Display</h3>
              <p className="text-gray-400 text-sm">Display 3D collages on big screens at events for maximum impact and guest engagement.</p>
            </div>

            <div className="bg-gradient-to-br from-blue-900/30 to-black/50 backdrop-blur-sm p-6 rounded-lg border border-blue-500/20">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-500 rounded-lg flex items-center justify-center mb-4">
                <CameraIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Professional Photo Booth</h3>
              <p className="text-gray-400 text-sm">Work with professional photographers to create stunning 3D memories for your guests.</p>
            </div>

            <div className="bg-gradient-to-br from-green-900/30 to-black/50 backdrop-blur-sm p-6 rounded-lg border border-green-500/20">
              <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-blue-500 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Real-time Updates</h3>
              <p className="text-gray-400 text-sm">Photos appear instantly in the 3D space as they're uploaded during your event.</p>
            </div>

            <div className="bg-gradient-to-br from-pink-900/30 to-black/50 backdrop-blur-sm p-6 rounded-lg border border-pink-500/20">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-600 to-purple-500 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">User Generated Content</h3>
              <p className="text-gray-400 text-sm">Let guests contribute their own photos with simple codes for authentic, crowd-sourced memories.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact & CTA Section */}
      <div className="py-16 bg-gradient-to-b from-black/10 to-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Contact Information */}
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-4">Ready to Transform Your Event?</h2>
                <p className="text-xl text-gray-300 mb-6">
                  Contact our team to learn how the 3D Selfie Holosphere can create unforgettable experiences at your next event.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">Email</p>
                    <a href="mailto:info@fusion-events.ca" className="text-purple-400 hover:text-purple-300 transition-colors">
                      info@fusion-events.ca
                    </a>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">Phone</p>
                    <a href="tel:416-825-4938" className="text-purple-400 hover:text-purple-300 transition-colors">
                      416-825-4938
                    </a>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <p className="text-gray-400 text-sm">
                  Professional event technology by Fusion Events. Available for corporate events, weddings, parties, and special occasions across the Greater Toronto Area.
                </p>
              </div>
            </div>

            {/* CTA Card */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 md:p-12 hover:bg-white/10 transition-all duration-300">
              <div className="text-center space-y-6">
                <h3 className="text-2xl md:text-3xl font-bold text-white">Start Creating Today</h3>
                <p className="text-gray-300">
                  Try our platform for free and see why event planners choose PhotoSphere for their 3D photo experiences.
                </p>
                <div className="space-y-4">
                  <Link
                    to="/dashboard"
                    className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 transition-colors shadow-lg hover:shadow-purple-500/25"
                  >
                    Create Your First Collage
                  </Link>
                  <p className="text-sm text-gray-500">No credit card required • Free to start</p>
                </div>
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

      {/* Demo Request Modal */}
      <DemoRequestModal 
        isOpen={isDemoModalOpen} 
        onClose={() => setIsDemoModalOpen(false)} 
      />
    </Layout>
  );
};

export default LandingPage;