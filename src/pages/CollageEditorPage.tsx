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
    <div className="bg-red-900/30 backdrop-blur-sm rounded-lg border border-red-500/50 p-6 flex flex-col items-center justify-center h-[calc(100vh-240px)]">
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
  const { currentCollage, photos, fetchCollageById, loading, error, subscribeToPhotos } = useCollageStore();
  const { settings, updateSettings: updateSceneSettings, resetSettings } = useSceneStore();
  const [activeTab, setActiveTab] = React.useState<Tab>('settings');
  const [updateError, setUpdateError] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const settingsUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [pendingSettingsUpdate, setPendingSettingsUpdate] = useState<typeof settings | null>(null);

  useEffect(() => {
    if (id) {
      fetchCollageById(id);
    }
  }, [id, fetchCollageById]);

  // Set up real-time subscription for photos
  useEffect(() => {
    if (currentCollage?.id) {
      const unsubscribe = subscribeToPhotos(currentCollage.id);
      return () => {
        unsubscribe();
      };
    }
  }, [currentCollage?.id, subscribeToPhotos]);

  // Sync collage settings with scene store when collage is loaded
  useEffect(() => {
    if (currentCollage?.settings) {
      updateSceneSettings(currentCollage.settings);
    }
  }, [currentCollage?.settings, updateSceneSettings]);

  // Effect for debounced database updates
  useEffect(() => {
    // Only proceed if there are pending settings to update
    if (pendingSettingsUpdate && id) {
      // Clear any existing timeout
      if (settingsUpdateTimeoutRef.current) {
        clearTimeout(settingsUpdateTimeoutRef.current);
      }
      
      // Set a new timeout for the database update
      settingsUpdateTimeoutRef.current = setTimeout(async () => {
        try {
          setUpdateError(null);
          await useCollageStore.getState().updateCollageSettings(id, pendingSettingsUpdate);
          // Clear pending update after successful save
          setPendingSettingsUpdate(null);
        } catch (err: any) {
          console.error('Debounced settings update error:', err);
          setUpdateError(err.message || 'Failed to save settings to database');
        }
      }, 500); // 500ms debounce time
    }
    
    // Cleanup on unmount
    return () => {
      if (settingsUpdateTimeoutRef.current) {
        clearTimeout(settingsUpdateTimeoutRef.current);
      }
    };
  }, [pendingSettingsUpdate, id]);

  // Handle settings updates
  const handleSettingsChange = (newSettings: Partial<typeof settings>, debounce: boolean = false) => {
    // Update local scene state immediately
    updateSceneSettings(newSettings, debounce);
    
    // Clear previous errors
    setUpdateError(null);
    
    // Update pending settings for database sync
    if (currentCollage && id) {
      // Create a merged version of all settings
      const mergedSettings = { ...settings, ...newSettings };
      
      // Store the merged settings for the debounced update
      setPendingSettingsUpdate(mergedSettings);
      
      // If not debouncing, update database immediately
      if (!debounce) {
        try {
          // Clear any existing timeout to prevent duplicate updates
          if (settingsUpdateTimeoutRef.current) {
            clearTimeout(settingsUpdateTimeoutRef.current);
            settingsUpdateTimeoutRef.current = null;
          }
          
          // Immediate update
          useCollageStore.getState().updateCollageSettings(id, mergedSettings)
            .catch((err) => {
              console.error('Immediate settings update error:', err);
              setUpdateError(err.message || 'Failed to save settings to database');
            });
          
          // Clear pending update since we've handled it
          setPendingSettingsUpdate(null);
        } catch (err: any) {
          console.error('Settings update error:', err);
          setUpdateError(err.message || 'Failed to update settings');
        }
      }
    }
  };

  // Handle ErrorBoundary reset
  const handleErrorReset = () => {
    // Reset to safer settings first
    const saferSettings = {
      photoCount: Math.min(settings.photoCount, 20),
      animationEnabled: false
    };
    
    updateSceneSettings(saferSettings);
    
    // Re-fetch the collage data
    if (id) {
      fetchCollageById(id);
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
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              <ChevronLeft className="mr-2 h-5 w-5" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              to="/dashboard"
              className="inline-flex items-center text-sm text-gray-400 hover:text-white mb-2"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white">
              {currentCollage.name}
            </h1>
          </div>
        </div>

        {updateError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-200">
            Error updating settings: {updateError}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'settings'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Settings className="h-4 w-4 mr-2" />
            Scene Settings
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'photos'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Image className="h-4 w-4 mr-2" />
            Photos
          </button>
          <button
            onClick={() => navigate(`/moderation/${currentCollage.id}`)}
            className="flex items-center px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 hover:text-purple-200 transition-colors"
          >
            <Shield className="h-4 w-4 mr-2" />
            Moderate Photos
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Panel */}
          <div className="w-full lg:w-80 overflow-y-auto max-h-[calc(100vh-240px)]">
            <div className="sticky top-0">
              {activeTab === 'settings' ? (
                <SceneSettings
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                  onReset={resetSettings}
                />
              ) : (
                <div className="space-y-6">
                  <PhotoUploader collageId={currentCollage.id} />
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-black/30 backdrop-blur-sm rounded-lg border border-white/10">
              <div className="h-[calc(100vh-240px)]">
                <ErrorBoundary 
                  FallbackComponent={SceneErrorFallback}
                  onReset={handleErrorReset}
                  resetKeys={[settings.photoCount]}
                >
                  <CollageScene
                    photos={photos}
                    settings={settings}
                    onSettingsChange={handleSettingsChange}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CollageEditorPage;