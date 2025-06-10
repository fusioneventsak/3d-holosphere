// src/pages/CollageModerationPage.tsx - FIXED FOR UPDATED STORE
import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Shield, RefreshCw, Trash2 } from 'lucide-react';
import { useCollageStore, Photo } from '../store/collageStore';
import Layout from '../components/layout/Layout';

const CollageModerationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { 
    currentCollage, 
    photos, 
    fetchCollageById, 
    deletePhoto, 
    loading, 
    error, 
    setupRealtimeSubscription, 
    cleanupRealtimeSubscription, 
    refreshPhotos,
    isRealtimeConnected 
  } = useCollageStore();
  
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [deletingPhotos, setDeletingPhotos] = React.useState<Set<string>>(new Set());

  // DEBUG: Log photos changes in moderation
  useEffect(() => {
    console.log('🛡️ MODERATION: Photos array changed!');
    console.log('🛡️ Moderation photo count:', photos.length);
    console.log('🛡️ Moderation photo IDs:', photos.map(p => p.id.slice(-4)));
  }, [photos]);

  // Fetch collage by ID - this will automatically setup realtime subscription
  useEffect(() => {
    if (id) {
      console.log('🛡️ MODERATION: Fetching collage by ID:', id);
      fetchCollageById(id);
    }
    
    // Cleanup subscription when component unmounts
    return () => {
      console.log('🛡️ MODERATION: Cleaning up realtime subscription on unmount');
      cleanupRealtimeSubscription();
    };
  }, [id, fetchCollageById, cleanupRealtimeSubscription]);

  const handleRefresh = async () => {
    if (!currentCollage?.id) return;
    
    setIsRefreshing(true);
    setFetchError(null);
    
    try {
      await refreshPhotos(currentCollage.id);
      console.log('🛡️ MODERATION: Photos refreshed successfully');
    } catch (error: any) {
      console.error('🛡️ MODERATION: Error refreshing photos:', error);
      setFetchError(error.message);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (deletingPhotos.has(photoId)) return; // Prevent double-clicking
    
    const confirmed = window.confirm('Are you sure you want to delete this photo? This action cannot be undone.');
    if (!confirmed) return;

    setDeletingPhotos(prev => new Set(prev).add(photoId));
    
    try {
      await deletePhoto(photoId);
      console.log('🛡️ MODERATION: Photo deleted successfully:', photoId);
      // Realtime subscription will handle the UI update automatically
    } catch (error: any) {
      console.error('🛡️ MODERATION: Failed to delete photo:', error);
      alert(`Failed to delete photo: ${error.message}`);
    } finally {
      setDeletingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photoId);
        return newSet;
      });
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link 
              to="/dashboard" 
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                <Shield className="w-6 h-6 text-yellow-500" />
                <span>Moderate Photos</span>
              </h1>
              <div className="flex items-center space-x-2 text-gray-400">
                <span>{currentCollage.name}</span>
                <span>•</span>
                <span>Code: {currentCollage.code}</span>
                <span>•</span>
                <span>{photos.length} photos</span>
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
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-md transition-colors flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            
            <Link
              to={`/collage/${currentCollage.code}`}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
            >
              View Collage
            </Link>
          </div>
        </div>

        {/* Error Display */}
        {fetchError && (
          <div className="bg-red-900/30 backdrop-blur-sm rounded-lg border border-red-500/50 p-4 mb-6">
            <p className="text-red-200">Error: {fetchError}</p>
          </div>
        )}

        {/* DEBUG INFO */}
        <div className="bg-yellow-900/30 backdrop-blur-sm rounded-lg border border-yellow-500/50 p-4 mb-6">
          <h3 className="text-yellow-300 font-bold mb-2">DEBUG INFO:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-yellow-200">Photos:</span>
              <span className="text-white ml-2">{photos.length}</span>
            </div>
            <div>
              <span className="text-yellow-200">Realtime:</span>
              <span className={`ml-2 ${isRealtimeConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                {isRealtimeConnected ? 'Connected' : 'Polling'}
              </span>
            </div>
            <div>
              <span className="text-yellow-200">Collage ID:</span>
              <span className="text-white ml-2">{currentCollage.id.slice(-8)}</span>
            </div>
            <div>
              <button 
                onClick={() => console.log('🛡️ MODERATION PHOTOS:', photos)}
                className="bg-yellow-700 hover:bg-yellow-600 px-2 py-1 rounded text-xs text-white"
              >
                Log Photos
              </button>
            </div>
          </div>
        </div>

        {/* Photos Grid */}
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No photos to moderate</h3>
            <p className="text-gray-400">
              Photos uploaded to this collage will appear here for moderation.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative">
                <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden">
                  <img
                    src={photo.url}
                    alt="Uploaded photo"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  
                  {/* Overlay with delete button */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      disabled={deletingPhotos.has(photo.id)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-md transition-colors flex items-center space-x-1 text-sm"
                    >
                      {deletingPhotos.has(photo.id) ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Photo info */}
                <div className="mt-2 text-xs text-gray-400">
                  <p>ID: {photo.id.slice(-8)}</p>
                  <p>Uploaded: {new Date(photo.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Moderation Instructions</h3>
          <ul className="text-gray-300 space-y-1 text-sm">
            <li>• Photos appear here in real-time as they are uploaded to the collage</li>
            <li>• Hover over any photo to see the delete option</li>
            <li>• Deleted photos are removed from both the moderation panel and the live collage immediately</li>
            <li>• Use the refresh button if you need to manually sync the photo list</li>
            <li>• The collage display updates automatically when photos are added or removed</li>
            <li>• Real-time status indicator shows connection health</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default CollageModerationPage;