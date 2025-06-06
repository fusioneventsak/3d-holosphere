import React, { useEffect, useState } from 'react';
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
  const { currentCollage, photos, fetchCollageByCode, loading, error, subscribeToPhotos } = useCollageStore();
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

  useEffect(() => {
    if (code) {
      fetchCollageByCode(code);
    }
  }, [code, fetchCollageByCode]);

  // Set up real-time subscription for photos
  useEffect(() => {
    if (currentCollage?.id) {
      const unsubscribe = subscribeToPhotos(currentCollage.id);
      return () => {
        unsubscribe();
      };
    }
  }, [currentCollage?.id, subscribeToPhotos]);

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
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              <ChevronLeft className="mr-2 h-5 w-5" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
      <div className={`absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${isFullscreen && !controlsVisible ? 'opacity-0' : 'opacity-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {currentCollage.name}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Code: <span className="font-mono">{currentCollage.code}</span>
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <button
              onClick={toggleFullscreen}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600/80 hover:bg-gray-700 transition-colors"
            >
              <Maximize2 className="h-4 w-4 mr-1" />
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            <button
              onClick={() => setShowUploader(!showUploader)}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 transition-colors"
            >
              <Upload className="mr-1 h-4 w-4" />
              {showUploader ? 'Hide Uploader' : 'Add Photos'}
            </button>
            
            <button
              onClick={() => navigate(`/dashboard/collage/${currentCollage.id}`)}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              <Edit className="mr-1 h-4 w-4" />
              Edit Settings
            </button>
            
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Share2 className="mr-1 h-4 w-4" />
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>
        
        {showUploader && (
          <div className="mb-6">
            <PhotoUploader collageId={currentCollage.id} />
          </div>
        )}
      </div>
      
      {photos.length === 0 && !showUploader ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-gray-400 mb-6">
              This collage doesn't have any photos yet.
            </p>
            <button
              onClick={() => setShowUploader(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              <Upload className="mr-2 h-5 w-5" />
              Add the First Photo
            </button>
          </div>
        </div>
      ) : (
        <div className="h-screen w-full">
          <ErrorBoundary 
            FallbackComponent={SceneErrorFallback}
            onReset={() => fetchCollageByCode(code || '')}
          >
            <CollageScene
              photos={photos}
              settings={currentCollage.settings || defaultSettings}
            />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
};

export default CollageViewerPage;