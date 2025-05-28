import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Share2, Eye } from 'lucide-react';
import { useCollageStore } from '../store/collageStore';
import { defaultSettings } from '../store/sceneStore';
import Layout from '../components/layout/Layout';
import PhotoUploader from '../components/collage/PhotoUploader';
import SceneSettings from '../components/collage/SceneSettings';
import CollageScene from '../components/three/CollageScene';

const CollageEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCollage, photos, fetchCollageById, loading, updateCollageSettings } = useCollageStore();

  const handleSettingsChange = async (newSettings: Partial<typeof defaultSettings>) => {
    if (currentCollage) {
      const updatedSettings = { ...currentCollage.settings, ...newSettings };
      await updateCollageSettings(currentCollage.id, updatedSettings);
    }
  };

  const handleSettingsReset = async () => {
    if (currentCollage) {
      await updateCollageSettings(currentCollage.id, defaultSettings);
    }
  };

  useEffect(() => {
    if (id) {
      fetchCollageById(id);
    }
  }, [id, fetchCollageById]);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-160px)] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-2 text-gray-400">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!currentCollage) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-white mb-4">Collage Not Found</h2>
            <p className="text-gray-400 mb-6">
              The collage you're looking for doesn't exist or you don't have permission to view it.
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-sm text-gray-400 hover:text-white mb-4"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Dashboard
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {currentCollage.name}
              </h1>
              <p className="mt-1 text-sm text-gray-400">
                Created: {new Date(currentCollage.created_at).toLocaleDateString()}
              </p>
            </div>
            
            <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
              <div className="flex items-center bg-gray-800 px-3 py-1 rounded text-sm">
                <span className="text-gray-400 mr-1">Code:</span>
                <span className="text-purple-400 font-medium">{currentCollage.code}</span>
              </div>
              
              <Link
                to={`/collage/${currentCollage.code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
              >
                <Eye className="mr-1 h-4 w-4" />
                View
              </Link>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/collage/${currentCollage.code}`);
                  alert('Link copied to clipboard!');
                }}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Share2 className="mr-1 h-4 w-4" />
                Share
              </button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 h-[calc(100vh-12rem)] overflow-y-auto pb-8">
            <PhotoUploader collageId={currentCollage.id} />
            <div className="mt-6">
              <SceneSettings
                settings={currentCollage.settings || defaultSettings}
                onSettingsChange={handleSettingsChange}
                onReset={handleSettingsReset}
              />
            </div>
          </div>
          
          <div className="lg:col-span-9 lg:sticky lg:top-24">
            <div className="bg-black/30 rounded-lg overflow-hidden w-full" style={{ aspectRatio: '16/9' }}>
              <CollageScene
                photos={photos || []}
                settings={currentCollage.settings || defaultSettings}
                onSettingsChange={handleSettingsChange}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CollageEditorPage;