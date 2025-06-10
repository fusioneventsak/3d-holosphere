import React, { useState } from 'react';
import { X, Check, Trash2, Eye, AlertCircle } from 'lucide-react';
import { useCollageStore } from '../../store/collageStore';

interface Photo {
  id: string;
  url: string;
  collage_id: string;
  created_at: string;
}

interface PhotoModerationModalProps {
  photos: Photo[];
  onClose: () => void;
}

const PhotoModerationModal: React.FC<PhotoModerationModalProps> = ({
  photos,
  onClose,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { deletePhoto } = useCollageStore();

  const handleApprove = (photo: Photo) => {
    // Photos are approved by default when uploaded
    // This could trigger a status update if you add approval status to the schema
    console.log('Photo approved:', photo.id);
    setError(null);
  };

  const handleReject = async (photo: Photo) => {
    if (!confirm('Are you sure you want to delete this photo? This action cannot be undone.')) {
      return;
    }

    setLoading(photo.id);
    setError(null);
    
    try {
      await deletePhoto(photo.id);
    } catch (error) {
      console.error('Failed to delete photo:', error);
      setError('Failed to delete photo. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const openPhotoPreview = (photo: Photo) => {
    setSelectedPhoto(photo);
    setError(null);
  };

  const closePhotoPreview = () => {
    setSelectedPhoto(null);
  };

  return (
    <>
      {/* Main Modal */}
      <div className="bg-black/30 backdrop-blur-sm rounded-lg border border-white/10 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            Photo Moderation ({photos.length} photos)
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center text-red-200">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {/* Photo Grid */}
        <div className="max-h-[70vh] overflow-auto">
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <div className="text-6xl mb-4">📸</div>
              <p className="text-lg mb-2">No photos to moderate</p>
              <p className="text-sm text-center">
                Photos will appear here when users upload them.<br />
                Text added in the photobooth will be visible on the images.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative bg-white/5 rounded-lg overflow-hidden aspect-[3/4] border border-white/10 hover:border-white/30 transition-all duration-200 hover:scale-105"
                >
                  {/* Photo with smart cropping for desktop images */}
                  <img
                    src={photo.url}
                    alt="Uploaded photo"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    style={{
                      objectPosition: 'center top' // Crop from top to show text in lower third
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjNjY2NjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TG9hZCBFcnJvcjwvdGV4dD48L3N2Zz4=';
                    }}
                  />

                  {/* Overlay - positioned at top to avoid covering text */}
                  <div className="absolute top-0 left-0 right-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                    <div className="flex space-x-2">
                      {/* Preview */}
                      <button
                        onClick={() => openPhotoPreview(photo)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors shadow-lg"
                        title="Preview Photo"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {/* Approve */}
                      <button
                        onClick={() => handleApprove(photo)}
                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors shadow-lg"
                        title="Approve Photo"
                      >
                        <Check className="h-4 w-4" />
                      </button>

                      {/* Reject */}
                      <button
                        onClick={() => handleReject(photo)}
                        disabled={loading === photo.id}
                        className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors disabled:opacity-50 shadow-lg"
                        title="Delete Photo"
                      >
                        {loading === photo.id ? (
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Photo timestamp - smaller and positioned to not cover text */}
                  <div className="absolute top-0 right-0 bg-black/60 text-white text-xs px-2 py-1 rounded-bl-lg">
                    {new Date(photo.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
          <p className="text-gray-300 text-sm">
            <strong>Instructions:</strong> Review each photo before it appears in the collage. 
            Use the preview button to see the full image with any text that was added in the photobooth. 
            Approve photos to keep them, or delete to remove them permanently from the collage.
          </p>
        </div>
      </div>

      {/* Photo Preview Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full flex flex-col">
            {/* Close Button */}
            <button
              onClick={closePhotoPreview}
              className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors z-10"
            >
              <X className="h-6 w-6" />
            </button>
            
            {/* Photo preview modal image */}
            <div className="relative flex-1 flex items-center justify-center">
              <img
                src={selectedPhoto.url}
                alt="Photo preview"
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                style={{
                  // For landscape images, crop to show portrait view to preserve text visibility
                  objectFit: 'cover',
                  aspectRatio: '9/16'
                }}
              />
            </div>
            
            {/* Controls */}
            <div className="bg-black/80 text-white p-4 rounded-b-lg mt-4">
              <p className="text-sm mb-3">
                <strong>Uploaded:</strong> {new Date(selectedPhoto.created_at).toLocaleString()}
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    handleApprove(selectedPhoto);
                    closePhotoPreview();
                  }}
                  className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve Photo
                </button>
                <button
                  onClick={() => {
                    handleReject(selectedPhoto);
                    closePhotoPreview();
                  }}
                  disabled={loading === selectedPhoto.id}
                  className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading === selectedPhoto.id ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete Photo
                </button>
                <button
                  onClick={closePhotoPreview}
                  className="flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PhotoModerationModal;