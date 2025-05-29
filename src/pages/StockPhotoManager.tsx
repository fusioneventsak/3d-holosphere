import React, { useState, useEffect } from 'react';
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
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Stock Photo Manager</h1>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-md">
            <p className="text-red-200">{error}</p>
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