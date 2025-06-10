import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { Photo } from '../../store/collageStore';
import { addCacheBustToUrl } from '../../lib/supabase';
import { useCollageStore } from '../../store/collageStore';

type PhotoModerationModalProps = {
  photos: Photo[];
  onClose: () => void;
};

const PhotoModerationModal: React.FC<PhotoModerationModalProps> = ({ photos, onClose }) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { deletePhoto, fetchPhotosByCollageId } = useCollageStore();
  
  const collageId = photos.length > 0 ? photos[0].collage_id : null;


  const handleDeletePhoto = async (photo: Photo) => {
    setDeletingPhotoId(photo.id);
    setError(null);
    
    try {
      console.log('🗑️ Attempting to delete photo:', photo.id);
      // Use the store's delete method
      await deletePhoto(photo.id);
      
      if (selectedPhoto?.id === photo.id) {
        setSelectedPhoto(null);
      }
      console.log('✅ Photo deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete photo:', error);
      setError(`Failed to delete photo: ${error.message}`);
    } finally {
      setDeletingPhotoId(null);
    }
  };
  
  const handleRefresh = async () => {
    if (!collageId) return;
    
    setRefreshing(true);
    setError(null);
    
    try {
      // Use the store's fetch method
      await fetchPhotosByCollageId(collageId);
    } catch (err: any) {
      console.error('Failed to refresh photos:', err);
      setError(`Failed to refresh photos: ${err.message}`);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-gray-900 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Photo Moderation</h2>
          <div className="flex items-center">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 mr-2 hover:bg-gray-800 rounded-full transition-colors"
              title="Refresh photos"
            >
              <RefreshCw className={`h-5 w-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-800 rounded-full transition-colors"
            >
              <X className="h-6 w-6 text-gray-400" />
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {photos.length > 0 ? (
            photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group aspect-[2/3] rounded-lg overflow-hidden cursor-pointer"
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={addCacheBustToUrl(photo.url)}
                  alt="Collage photo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://via.placeholder.com/300x450?text=Image+Error';
                  }}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePhoto(photo);
                    }}
                    className="p-2 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                    disabled={deletingPhotoId === photo.id}
                  >
                    {deletingPhotoId === photo.id ? (
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="h-5 w-5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p className="text-lg">No photos to moderate</p>
            </div>
          )}
        </div>

        {selectedPhoto && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90">
            <div className="relative max-w-4xl max-h-[90vh]">
              <img
                src={addCacheBustToUrl(selectedPhoto.url)}
                alt="Full size"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/800x1200?text=Image+Error';
                }}
              />
              <div className="absolute top-4 right-4 flex space-x-2">
                <button
                  onClick={() => handleDeletePhoto(selectedPhoto)}
                  className="p-2 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                  disabled={deletingPhotoId === selectedPhoto.id}
                >
                  {deletingPhotoId === selectedPhoto.id ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="h-5 w-5 text-white" />
                  )}
                </button>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoModerationModal;