// src/pages/CollageViewerPage.tsx - ENHANCED WITH REAL-TIME PHOTO REMOVAL
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Share2, Upload, Edit, Maximize2, ChevronLeft } from 'lucide-react';
import { useCollageStore } from '../store/collageStore';
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
    isRealtimeConnected,
    refreshPhotos,
    cleanupRealtimeSubscription
  } = useCollageStore();
  
  // SAFETY: Ensure photos is always an array
  const safePhotos = Array.isArray(photos) ? photos : [];
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const navigate = useNavigate();

  // CRITICAL: Debug logging for photo changes with more detail
  useEffect(() => {
    console.log('🔥 COLLAGE VIEWER: Photos array changed!');
    console.log('🔥 Photo count:', safePhotos.length);
    console.log('🔥 Photo IDs:', safePhotos.map(p => `${p.id.slice(-4)}(${new Date(p.created_at).toLocaleTimeString()})`));
    console.log('🔥 Full photos array:', safePhotos);
  }, [safePhotos]);

  // Debug: Log store state changes
  useEffect(() => {
    console.log('🔥 STORE STATE CHANGE:');
    console.log('🔥 Current collage:', currentCollage?.name);
    console.log('🔥 Loading:', loading);
    console.log('🔥 Error:', error);
    console.log('🔥 Realtime connected:', isRealtimeConnected);
  }, [currentCollage, loading, error, isRealtimeConnected]);

  // Handle fullscreen toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
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

  // Simple subscription setup
  useEffect(() => {
    if (code) {
      console.log('🔥 VIEWER: Fetching collage:', code);
      fetchCollageByCode(code);
    }
    
    return () => {
      console.log('🔥 VIEWER: Cleaning up subscription');
      cleanupRealtimeSubscription();
    };
  }, [code, fetchCollageByCode, cleanupRealtimeSubscription]);

  // Manual refresh for debugging
  const handleManualRefresh = useCallback(async () => {
    if (currentCollage?.id) {
      console.log('🔄 Manual refresh triggered');
      await refreshPhotos(currentCollage.id);
    }
  }, [currentCollage?.id, refreshPhotos]);

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
              to="/join" 
              className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Try Another Code
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Live Debug Panel - Direct Store Connection */}
      <div className="fixed top-4 right-4 z-50 bg-red-900/80 text-white p-3 rounded-lg text-xs max-w-sm">
        <h3 className="font-bold mb-1">LIVE STORE DEBUG:</h3>
        <p>Store Photos: {useCollageStore.getState().photos?.length || 0}</p>
        <p>Prop Photos: {safePhotos.length}</p>
        <p>Realtime: {isRealtimeConnected ? '✅ Connected' : '⚠️ Polling'}</p>
        <p>Last Update: {new Date(useCollageStore.getState().lastRefreshTime).toLocaleTimeString()}</p>
        <p>Photo IDs: {(useCollageStore.getState().photos || []).map(p => p.id.slice(-4)).join(', ')}</p>
        <button 
          onClick={handleManualRefresh}
          className="mt-1 px-2 py-1 bg-blue-600 rounded text-xs"
        >
          Refresh
        </button>
        <button 
          onClick={() => console.log('LIVE STORE PHOTOS:', useCollageStore.getState().photos)}
          className="mt-1 ml-1 px-2 py-1 bg-green-600 rounded text-xs"
        >
          Log Store
        </button>
      </div>

      {/* Main Scene - FIXED: CollageScene now gets photos directly from store */}
      <div className="relative w-full h-screen">
        <ErrorBoundary 
          FallbackComponent={SceneErrorFallback}
          resetKeys={[currentCollage.id, safePhotos.length]} // Keep for error boundary
        >
          <CollageScene 
            photos={safePhotos}
            settings={currentCollage.settings}
            onSettingsChange={(newSettings) => {
              // Optional: Handle settings changes from the viewer
              console.log('🎛️ Settings changed from viewer:', newSettings);
            }}
          />
        </ErrorBoundary>

        {/* Floating Controls */}
        {controlsVisible && (
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="bg-black/80 backdrop-blur-sm rounded-lg border border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Link 
                    to="/join" 
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Link>
                  <div>
                    <h1 className="text-xl font-bold text-white">{currentCollage.name}</h1>
                    <div className="flex items-center space-x-2 text-gray-400 text-sm">
                      <span>Code: {currentCollage.code}</span>
                      <span>•</span>
                      <span>{safePhotos.length} photos</span>
                      <span>•</span>
                      <div className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                        <span>{isRealtimeConnected ? 'Live' : 'Polling'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowUploader(!showUploader)}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors text-sm flex items-center space-x-1"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Add Photos</span>
                  </button>
                  
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm flex items-center space-x-1"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{copied ? 'Copied!' : 'Share'}</span>
                  </button>
                  
                  <button
                    onClick={toggleFullscreen}
                    className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors text-sm"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Photo Uploader Modal */}
        {showUploader && (
          <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-lg p-6 max-w-lg w-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Add Photos</h2>
                <button
                  onClick={() => setShowUploader(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <PhotoUploader
                collageId={currentCollage.id}
                onUploadComplete={() => {
                  console.log('📸 Upload completed in viewer - photos will appear automatically via realtime');
                  // Don't close modal automatically, let user upload multiple
                }}
              />
            </div>
          </div>
        )}

        {/* Fullscreen hint */}
        {isFullscreen && controlsVisible && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
            <div className="bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
              Controls will hide automatically. Move mouse to show again.
            </div>
          </div>
        )}
      </div>

      {/* Mouse movement handler for fullscreen */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-0"
          onMouseMove={() => {
            setControlsVisible(true);
            const timer = setTimeout(() => setControlsVisible(false), 3000);
            return () => clearTimeout(timer);
          }}
        />
      )}
    </div>
  );
};

export default CollageViewerPage;