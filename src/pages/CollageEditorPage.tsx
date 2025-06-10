// src/pages/CollageEditorPage.tsx - WITH REAL-TIME UPDATES
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings, Image, Shield } from 'lucide-react';
import { useCollageStore } from '../store/collageStore';
import { useSceneStore } from '../store/sceneStore';
import { ErrorBoundary } from 'react-error-boundary';
import Layout from '../components/layout/Layout';
import SceneSettings from '../components/collage/SceneSettings';
import CollageScene from '../components/three/CollageScene';
import PhotoUploader from '../components/collage/PhotoUploader';
import CollagePhotos from '../components/collage/CollagePhotos';

type Tab = 'settings' | 'photos';

// Error fallback component for 3D scene errors
function SceneErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="bg-red-900/30 backdrop-blur-sm rounded-lg border border-gray-500/50 p-6 flex flex-col items-center justify-center h-[calc(100vh-240px)]">
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
      <p className="mt-4 text-gray-400 text-sm">
        Tip: Try reducing the photo count in settings if the issue persists.
      </p>
    </div>
  );
}

const CollageEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    currentCollage, 
    photos, 
    fetchCollageById, 
    updateCollageSettings, 
    loading, 
    error, 
    setupRealtimeSubscription, 
    cleanupRealtimeSubscription,
    isRealtimeConnected,
    refreshPhotos
  } = useCollageStore();
  const { settings, updateSettings } = useSceneStore();
  
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // SAFETY: Ensure photos is always an array
  const safePhotos = Array.isArray(photos) ? photos : [];

  // DEBUG: Log photos changes in editor
  useEffect(() => {
    console.log('🎨 EDITOR: Photos array changed!');
    console.log('🎨 Editor photo count:', photos.length);
    console.log('🎨 Editor photo IDs:', photos.map(p => p.id.slice(-4)));
  }, [photos]);

  // DEBUG: Log realtime connection status
  useEffect(() => {
    console.log('🎨 EDITOR: Realtime connected:', isRealtimeConnected);
  }, [isRealtimeConnected]);

  // Fetch collage by ID - this will automatically setup realtime subscription
  useEffect(() => {
    if (id) {
      console.log('🎨 EDITOR: Fetching collage by ID:', id);
      fetchCollageById(id);
    }
    
    // Cleanup subscription when component unmounts
    return () => {
      console.log('🎨 EDITOR: Cleaning up realtime subscription on unmount');
      cleanupRealtimeSubscription();
    };
  }, [id, fetchCollageById, cleanupRealtimeSubscription]);

  // Update scene store when collage settings change
  useEffect(() => {
    if (currentCollage?.settings) {
      console.log('🎨 EDITOR: Updating scene store with collage settings');
      updateSettings(currentCollage.settings, false);
    }
  }, [currentCollage?.settings, updateSettings]);

  // Auto-save settings changes with debouncing
  const handleSettingsChange = async (newSettings: any) => {
    if (!currentCollage) return;

    // Update local scene store immediately for responsive UI
    updateSettings(newSettings, false);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaving(true);

    // Debounce the save operation
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateCollageSettings(currentCollage.id, newSettings);
        console.log('✅ Settings auto-saved successfully');
      } catch (error) {
        console.error('❌ Failed to save settings:', error);
      } finally {
        setSaving(false);
      }
    }, 1000); // 1 second debounce
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Manual refresh function for when realtime fails
  const handleManualRefresh = async () => {
    if (currentCollage?.id) {
      console.log('🔄 EDITOR: Manual refresh triggered');
      await refreshPhotos(currentCollage.id);
    }
  };

  if (loading && !currentCollage) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-160px)] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-2 text-gray-400">Loading collage...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !currentCollage) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-white mb-4">Collage Not Found</h2>
            <p className="text-gray-400 mb-6">
              The collage you're looking for doesn't exist or might have been removed.
            </p>
            <Link 
              to="/dashboard" 
              className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-[1920px] mx-auto h-[calc(100vh-80px)] flex">
        {/* Main 3D Scene */}
        <div className="flex-1 relative">
          <ErrorBoundary 
            FallbackComponent={SceneErrorFallback}
            resetKeys={[currentCollage.id, settings, photos.length]}
          >
            <CollageScene 
              photos={safePhotos}
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          </ErrorBoundary>

          {/* Floating Header */}
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="bg-black/80 backdrop-blur-sm rounded-lg border border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Link 
                    to="/dashboard" 
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
                      {saving && (
                        <>
                          <span>•</span>
                          <span className="text-yellow-400">Saving...</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {!isRealtimeConnected && (
                    <button
                      onClick={handleManualRefresh}
                      className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors text-sm"
                    >
                      Refresh
                    </button>
                  )}
                  
                  <Link
                    to={`/collage/${currentCollage.code}`}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-sm"
                  >
                    View Live
                  </Link>
                  
                  <Link
                    to={`/collage/${currentCollage.id}/moderation`}
                    className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors text-sm flex items-center space-x-1"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Moderate</span>
                  </Link>
                  
                  <Link
                    to={`/collage/${currentCollage.code}/photobooth`}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors text-sm"
                  >
                    📸 Photobooth
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* DEBUG INFO - Floating bottom-left */}
          <div className="absolute bottom-4 left-4 bg-red-900/80 text-white p-3 rounded-lg text-xs max-w-sm z-10">
            <h3 className="font-bold mb-1">EDITOR DEBUG:</h3>
            <p>Photos: {safePhotos.length}</p>
            <p>Realtime: {isRealtimeConnected ? '✅ Connected' : '⚠️ Polling'}</p>
            <p>IDs: {safePhotos.map(p => p.id.slice(-4)).join(', ')}</p>
            <button 
              onClick={() => console.log('🎨 EDITOR PHOTOS:', photos)}
              className="bg-red-700 px-2 py-1 mt-1 rounded text-xs"
            >
              Log Photos
            </button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                activeTab === 'settings'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
            <button
              onClick={() => setActiveTab('photos')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                activeTab === 'photos'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Image className="w-4 h-4" />
              <span>Photos ({safePhotos.length})</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'settings' ? (
              <div className="h-full overflow-y-auto">
                <SceneSettings
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                />
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {/* Photo Uploader */}
                <div className="p-4 border-b border-gray-700">
                  <PhotoUploader 
                    collageId={currentCollage.id}
                    onUploadComplete={() => {
                      console.log('🎨 EDITOR: Photo upload completed');
                      // If realtime is not connected, manually refresh
                      if (!isRealtimeConnected) {
                        handleManualRefresh();
                      }
                    }}
                  />
                </div>
                
                {/* Photos List */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Photos</h3>
                      <button
                        onClick={handleManualRefresh}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
                      >
                        Refresh
                      </button>
                    </div>
                    
                    {safePhotos.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No photos yet</p>
                        <p className="text-xs">Upload photos to see them here</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {safePhotos.map((photo) => (
                          <div key={photo.id} className="aspect-square rounded overflow-hidden bg-gray-800">
                            <img 
                              src={photo.url} 
                              alt="Photo"
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CollageEditorPage;