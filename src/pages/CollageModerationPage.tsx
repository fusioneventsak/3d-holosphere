// src/pages/CollageModerationPage.tsx - ENHANCED VERSION WITH BETTER DELETION
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Shield, RefreshCw, Trash2, Eye, AlertCircle } from 'lucide-react';
import { useCollageStore } from '../store/collageStore';
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
    refreshPhotos,
    isRealtimeConnected,
    setupRealtimeSubscription,
    cleanupRealtimeSubscription
  } = useCollageStore();
  
  // SAFETY: Ensure photos is always an array
  const safePhotos = Array.isArray(photos) ? photos : [];
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingPhotos, setDeletingPhotos] = useState<Set<string>>(new Set());
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);

  // DEBUG: Log photos changes in moderation
  useEffect(() => {
    console.log('🛡️ MODERATION: Photos array changed!');
    console.log('🛡️ Moderation photo count:', safePhotos.length);
    console.log('🛡️ Moderation photo IDs:', safePhotos.map(p => p.id.slice(-4)));
  }, [safePhotos]);

  // Simple subscription setup
  useEffect(() => {
    if (id) {
      console.log('🛡️ MODERATION: Fetching collage:', id);
      fetchCollageById(id);
    }
    
    return () => {
      console.log('🛡️ MODERATION: Cleaning up subscription');
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
    if (deletingPhotos.has(photoId)) return;
    
    const confirmed = window.confirm('Delete this photo? It will be removed from all views immediately.');
    if (!confirmed) return;

    setDeletingPhotos(prev => new Set(prev).add(photoId));
    
    try {
      console.log('🗑️ MODERATION: Deleting photo:', photoId);
      await deletePhoto(photoId);
      console.log('✅ MODERATION: Photo deleted successfully');
      
      // Close modal if deleted photo was selected
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto(null);
      }
      
    } catch (error: any) {
      console.error('❌ MODERATION: Delete failed:', error);
      if (!error.message.includes('0 rows')) {
        alert(`Failed to delete photo: ${error.message}`);
      }
    } finally {
      setDeletingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photoId);
        return newSet;
      });
    }
  };

  const openPhotoPreview = (photo: any) => {
    setSelectedPhoto(photo);
  };

  const closePhotoPreview = () => {
    setSelectedPhoto(null);
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
              <h1 className="text-2xl font-bold text-white flex items-center">
                <Shield className="w-6 h-6 mr-2 text-blue-400" />
                Moderate Photos
              </h1>
              <div className="flex items-center space-x-2 text-gray-400 text-sm mt-1">
                <span>{currentCollage.name}</span>
                <span>•</span>
                <span>Code: {currentCollage.code}</span>
                <span>•</span>
                <span>{safePhotos.length} photos</span>
                <span>•</span>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                  <span>{isRealtimeConnected ? 'Live Updates' : 'Polling'}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-md transition-colors text-sm flex items-center space-x-1"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            
            <Link
              to={`/collage/${currentCollage.code}`}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors text-sm"
            >
              View Live
            </Link>
          </div>
        </div>

        {/* Error Display */}
        {fetchError && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center text-red-200">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Error: {fetchError}</span>
          </div>
        )}

        {/* Real-time Status */}
        <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${isRealtimeConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
              <span className="text-white font-medium">
                {isRealtimeConnected ? 'Real-time Updates Active' : 'Using Polling Mode'}
              </span>
              <span className="text-gray-400 text-sm">
                {isRealtimeConnected 
                  ? 'Changes will appear instantly' 
                  : 'Updates every 2 seconds'
                }
              </span>
            </div>
            <span className="text-gray-400 text-sm">
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Photo Grid */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6">
          {safePhotos.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📸</div>
              <h3 className="text-xl font-bold text-white mb-2">No Photos Yet</h3>
              <p className="text-gray-400 mb-4">
                Photos uploaded to this collage will appear here for moderation.
              </p>
              <Link
                to={`/collage/${currentCollage.code}`}
                className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
              >
                Share Collage Code
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {safePhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="bg-gray-800 rounded-lg overflow-hidden border border-gray-600 hover:border-gray-500 transition-colors group"
                >
                  <div className="aspect-square relative">
                    <img
                      src={photo.url}
                      alt="Uploaded photo"
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => openPhotoPreview(photo)}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://via.placeholder.com/400x400?text=Error+Loading';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                      <button
                        onClick={() => openPhotoPreview(photo)}
                        className="p-2 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
                        title="View full size"
                      >
                        <Eye className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        disabled={deletingPhotos.has(photo.id)}
                        className="p-2 bg-red-600 rounded-full hover:bg-red-700 transition-colors disabled:opacity-50"
                        title="Delete photo"
                      >
                        {deletingPhotos.has(photo.id) ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-400">
                      Uploaded: {new Date(photo.created_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      ID: {photo.id.slice(-8)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Photo Preview Modal */}
        {selectedPhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
            <div className="relative max-w-4xl max-h-[90vh] bg-gray-900 rounded-lg overflow-hidden">
              <img
                src={selectedPhoto.url}
                alt="Full size preview"
                className="max-w-full max-h-[80vh] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/800x600?text=Error+Loading';
                }}
              />
              
              {/* Modal Controls */}
              <div className="absolute top-4 right-4 flex space-x-2">
                <button
                  onClick={() => handleDeletePhoto(selectedPhoto.id)}
                  disabled={deletingPhotos.has(selectedPhoto.id)}
                  className="p-2 bg-red-600 rounded-full hover:bg-red-700 transition-colors disabled:opacity-50"
                  title="Delete photo"
                >
                  {deletingPhotos.has(selectedPhoto.id) ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5 text-white" />
                  )}
                </button>
                <button
                  onClick={closePhotoPreview}
                  className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
                  title="Close preview"
                >
                  ✕
                </button>
              </div>
              
              {/* Photo Info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="text-white">
                  <p className="text-sm">
                    Uploaded: {new Date(selectedPhoto.created_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    ID: {selectedPhoto.id}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CollageModerationPage;