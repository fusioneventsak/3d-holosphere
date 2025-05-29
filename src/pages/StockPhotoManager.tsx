import React, { useState, useEffect } from 'react';
import { uploadStockPhotos } from '../stockPhotos';
import { supabase } from '../lib/supabase';
import Layout from '../components/layout/Layout';

type StockPhoto = {
  id: string;
  url: string;
  category: string;
};

const StockPhotoManager: React.FC = () => {
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchStockPhotos();
  }, []);

  const fetchStockPhotos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('stock_photos')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setPhotos(data || []);
    } catch (err: any) {
      console.error('Error fetching stock photos:', err);
      setError(err.message || 'Failed to load stock photos');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadStockPhotos = async () => {
    setUploading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await uploadStockPhotos();
      setSuccess('Stock photos uploaded successfully!');
      await fetchStockPhotos(); // Refresh the list
    } catch (err: any) {
      console.error('Error in stock photo upload process:', err);
      setError(err.message || 'Failed to upload stock photos');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Stock Photo Manager</h1>
        
        <div className="mb-6">
          <button
            onClick={handleUploadStockPhotos}
            disabled={uploading}
            className={`px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors ${
              uploading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? 'Uploading...' : 'Upload Stock Photos'}
          </button>
          
          <p className="mt-2 text-sm text-gray-400">
            This will fetch and upload 20 diverse portrait photos to your Supabase Storage.
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-md">
            <p className="text-red-200">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500 rounded-md">
            <p className="text-green-200">{success}</p>
          </div>
        )}
        
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
          <h2 className="text-xl font-medium text-white mb-4">Current Stock Photos</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <p className="mt-2 text-gray-400">Loading photos...</p>
            </div>
          ) : photos.length === 0 ? (
            <p className="text-gray-400 py-4">No stock photos found in the database.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {photos.map(photo => (
                <div key={photo.id} className="rounded-lg overflow-hidden bg-black/30 border border-white/10">
                  <img
                    src={photo.url}
                    alt="Stock photo"
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-2">
                    <p className="text-xs text-gray-400 truncate">{photo.category}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default StockPhotoManager;