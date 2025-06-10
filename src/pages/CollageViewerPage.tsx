// src/pages/CollageViewerPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Share2, Upload, Edit, Maximize2, ChevronLeft } from 'lucide-react';
import { useCollageStore } from '../store/collageStore';
import { defaultSettings } from '../store/sceneStore';
import { ErrorBoundary } from 'react-error-boundary';
import CollageScene from '../components/three/CollageScene';
import PhotoUploader from '../components/collage/PhotoUploader';

// Error fallback component for 3D scene errors
function SceneErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="bg-red-900/30 backdrop-blur-sm rounded-lg border border-red-500/50 p-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
      <h3 className="text-xl font-bold text-white mb-2">Something went wrong rendering the scene</h3>
      <p className="text-red-200 mb-4 text-center max-w-md">
        There was an error loading the 3D scene. This could be due to WebGL issues or resource limitations.
      </p>
      <pre className="bg-black/50 p-3 rounded text-red-300 text-xs max-w-full overflow-auto mb-4 max-h-32">
        {error.message}
      </pre>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

const CollageViewerPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const { 
    currentCollage, 
    photos, 
    fetchCollageByCode, 
    loading, 
    error, 
    setupRealtimeSubscription, 
    cleanupRealtimeSubscription 
  } = useCollageStore();
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const navigate = useNavigate();

  // Handle fullscreen toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        // Hide controls after a delay when entering fullscreen
        setTimeout(() => setControlsVisible(false), 2000);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        setControlsVisible(true);
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Toggle fullscreen with 'f' key
      if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
      // Show controls temporarily when moving mouse in fullscreen
      if (isFullscreen) {
        setControlsVisible(true);
        // Hide controls after delay
        setTimeout(() => setControlsVisible(false), 2000);
      }
    };

    const handleMouseMove = () => {
      if (isFullscreen) {
        setControlsVisible(true);
        // Hide controls after delay
        setTimeout(() => setControlsVisible(false), 2000);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isFullscreen]);

  // Fetch collage - this will automatically setup realtime subscription
  useEffect(() => {
    if (code) {
      console.log('🔄 Fetching collage by code:', code);
      fetchCollageByCode(code);
    }
    
    // Cleanup subscription when component unmounts
    return () => {
      console.log('🧹 Cleaning up realtime subscription on unmount');
      cleanupRealtimeSubscription();
    };
  }, [code, fetchCollageByCode, cleanupRealtimeSubscription]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !currentCollage) {
    return (
      <div className="min-h-screen bg-black">
        <div className="min-h-[calc(100vh-160px)] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-2 text-gray-400">Loading collage...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !currentCollage) {
    return (
      <div className="min-h-screen bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-white mb-4">Collage Not Found</h2>
            <p className="text-gray-400 mb-6">
              The collage you're looking for doesn't exist or might have been removed.
            </p>
            <Link 
              to="/" 
              className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header Controls - Only show when not in fullscreen or when controls are visible */}
      {(!isFullscreen || controlsVisible) && (
        <div className="relative z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link 
                  to="/" 
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white">{currentCollage.name}</h1>
                  <p className="text-gray-400 text-sm">Code: {currentCollage.code} • {photos.length} photos</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowUploader(true)}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-sm flex items-center space-x-1"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                </button>
                
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm flex items-center space-x-1"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{copied ? 'Copied!' : 'Share'}</span>
                </button>
                
                <button
                  onClick={() => navigate(`/collage/${currentCollage.id}/editor`)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors text-sm flex items-center space-x-1"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                
                <button
                  onClick={toggleFullscreen}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-sm flex items-center space-x-1"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>Fullscreen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main 3D Scene */}
      <div className={`relative ${isFullscreen ? 'h-screen' : 'h-[calc(100vh-80px)]'}`}>
        <ErrorBoundary FallbackComponent={SceneErrorFallback}>
          <CollageScene 
            photos={photos}
            settings={currentCollage.settings || defaultSettings}
            onSettingsChange={(newSettings) => {
              // This is view-only, so no settings changes allowed
              console.log('Settings change attempted in viewer mode');
            }}
          />
        </ErrorBoundary>
      </div>

      {/* Photo Uploader Modal */}
      {showUploader && currentCollage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Upload Photos</h3>
              <button
                onClick={() => setShowUploader(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <PhotoUploader collageId={currentCollage.id} />
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowUploader(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Instructions */}
      {isFullscreen && controlsVisible && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm z-50">
          Press 'F' to toggle fullscreen • Move mouse to show controls
        </div>
      )}
    </div>
  );
};

export default CollageViewerPage;