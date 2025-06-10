import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Settings, Share2, MoreVertical } from 'lucide-react';
import { useCollageStore } from '../store/collageStore';
import { useCollageRealtime } from '../hooks/useCollageRealtime';
import Layout from '../components/layout/Layout';
import CollageScene from '../components/CollageScene';

const CollageViewerPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentCollage, fetchCollageByCode, loading, error } = useCollageStore();
  
  // CRITICAL: This hook ensures realtime subscription is active for photobooth uploads
  const { photos, refreshPhotos } = useCollageRealtime(currentCollage?.id);

  useEffect(() => {
    if (code) {
      console.log('🔄 CollageViewerPage: Fetching collage by code:', code);
      fetchCollageByCode(code);
    }
  }, [code, fetchCollageByCode]);

  // Cleanup realtime subscription when component unmounts
  useEffect(() => {
    return () => {
      console.log('🧹 CollageViewerPage unmounting, cleanup handled by useCollageRealtime');
    };
  }, []);

  const handleShareClick = () => {
    if (currentCollage) {
      const photoboothUrl = `${window.location.origin}/photobooth/${currentCollage.code}`;
      const collageUrl = `${window.location.origin}/collage/${currentCollage.code}`;
      
      if (navigator.share) {
        navigator.share({
          title: currentCollage.name,
          text: `Check out this live photo collage: ${currentCollage.name}`,
          url: collageUrl,
        });
      } else {
        // Fallback to copying to clipboard
        navigator.clipboard.writeText(photoboothUrl);
        alert('Photobooth link copied to clipboard!');
      }
    }
  };

  const handlePhotoboothClick = () => {
    if (currentCollage) {
      navigate(`/photobooth/${currentCollage.code}`);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-400 text-lg">Loading collage...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">😞</div>
            <h2 className="text-2xl font-bold text-white mb-2">Oops!</h2>
            <p className="text-red-400 mb-6">{error}</p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!currentCollage) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-white mb-2">Collage Not Found</h2>
            <p className="text-gray-400 mb-6">
              The collage you're looking for doesn't exist or may have been removed.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold"
            >
              Go Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen relative">
        {/* Header with collage info and actions */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{currentCollage.name}</h1>
              <p className="text-gray-300 text-sm">
                {photos.length} photo{photos.length !== 1 ? 's' : ''} • Code: {currentCollage.code}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Photo count badge */}
              <div className="px-3 py-1 bg-purple-600/80 rounded-full text-white text-sm font-medium">
                {photos.length} photos
              </div>
              
              {/* Action buttons */}
              <button
                onClick={handlePhotoboothClick}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-semibold"
                title="Take a photo"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Take Photo</span>
              </button>
              
              <button
                onClick={handleShareClick}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                title="Share collage"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
              
              {/* Settings/More options */}
              <button
                onClick={() => navigate(`/admin/${currentCollage.code}`)}
                className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 right-4 bg-black/70 text-white p-3 rounded-lg text-xs z-50 max-w-xs">
            <div className="font-bold mb-1">Debug Info</div>
            <div>Collage: {currentCollage.name}</div>
            <div>ID: {currentCollage.id}</div>
            <div>Photos: {photos.length}</div>
            <div>Code: {currentCollage.code}</div>
            <div className="text-green-400">Realtime: Active ✓</div>
            <button
              onClick={refreshPhotos}
              className="mt-2 px-2 py-1 bg-purple-600 rounded text-xs hover:bg-purple-700 transition-colors"
            >
              Manual Refresh
            </button>
          </div>
        )}
        
        {/* Main collage scene */}
        <CollageScene 
          collageId={currentCollage.id}
          photos={photos}
          settings={currentCollage.settings}
        />

        {/* Empty state overlay when no photos */}
        {photos.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="text-center text-white max-w-md mx-4">
              <div className="text-8xl mb-6">📸</div>
              <h2 className="text-3xl font-bold mb-4">No Photos Yet</h2>
              <p className="text-xl text-gray-300 mb-8">
                Be the first to add a memory to this collage!
              </p>
              <button
                onClick={handlePhotoboothClick}
                className="inline-flex items-center gap-3 px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors font-semibold text-lg"
              >
                <Camera className="w-6 h-6" />
                Take First Photo
              </button>
              <div className="mt-6 text-gray-400">
                <p>Or share this link:</p>
                <code className="text-purple-300">{window.location.origin}/photobooth/{currentCollage.code}</code>
              </div>
            </div>
          </div>
        )}

        {/* Loading overlay for when photos are being added */}
        {photos.length > 0 && (
          <div className="absolute bottom-4 left-4 text-white text-sm bg-black/50 px-3 py-2 rounded-lg">
            Live updates enabled • Photos appear instantly
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CollageViewerPage;