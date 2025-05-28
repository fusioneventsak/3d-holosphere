import React, { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Settings, Image, Shield } from 'lucide-react';
import { useCollageStore } from '../store/collageStore';
import { useSceneStore } from '../store/sceneStore';
import Layout from '../components/layout/Layout';
import SceneSettings from '../components/collage/SceneSettings';
import CollageScene from '../components/three/CollageScene';
import PhotoUploader from '../components/collage/PhotoUploader';
import CollagePhotos from '../components/collage/CollagePhotos';

type Tab = 'settings' | 'photos';

const CollageEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentCollage, photos, fetchCollageById, loading, error } = useCollageStore();
  const { settings, updateSettings, resetSettings } = useSceneStore();
  const [activeTab, setActiveTab] = React.useState<Tab>('settings');
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetchCollageById(id);
    }
  }, [id, fetchCollageById]);

  // Sync collage settings with scene store when collage is loaded
  useEffect(() => {
    if (currentCollage?.settings) {
      updateSettings(currentCollage.settings);
    }
  }, [currentCollage?.settings, updateSettings]);

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
                  onSettingsChange={updateSettings}
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
                <CollageScene
                  photos={photos}
                  settings={settings}
                  onSettingsChange={updateSettings}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CollageEditorPage;