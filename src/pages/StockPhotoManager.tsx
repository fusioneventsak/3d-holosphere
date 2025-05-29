import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';

type StockPhoto = {
  id: string;
  url: string;
  category: string;
  created_at?: string;
};

const StockPhotoManager: React.FC = () => {
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    fetchStockPhotos();
  }, [category]);

  const fetchStockPhotos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('stock_photos')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (category !== 'all') {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
        
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              to="/dashboard"
              className="inline-flex items-center text-sm text-gray-400 hover:text-white mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white">Stock Photo Manager</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-black/30 border border-gray-700 rounded-md py-2 px-3 text-white text-sm"
            >
              <option value="all">All Categories</option>
              <option value="people">People</option>
              <option value="landscape">Landscape</option>
              <option value="abstract">Abstract</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-md">
            <p className="text-red-200">{error}</p>
          </div>
        )}
        
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium text-white">Current Stock Photos</h2>
            <p className="text-sm text-gray-400">
              Found {photos.length} photos {category !== 'all' ? `in ${category}` : 'total'}
            </p>
          </div>
          
          <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500 rounded-md">
            <p className="text-blue-200">
              <strong>Note:</strong> To add new stock photos, upload them directly through the Supabase dashboard:
            </p>
            <ol className="list-decimal list-inside mt-2 text-blue-200 text-sm">
              <li>Go to your Supabase project dashboard</li>
              <li>Navigate to Storage → Buckets</li>
              <li>Select or create a "stock-photos" bucket</li>
              <li>Upload your photos</li>
              <li>Add entries to the stock_photos table with the public URLs</li>
            </ol>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <p className="mt-2 text-gray-400">Loading photos...</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-700 rounded-lg">
              <p className="text-gray-400 mb-2">No stock photos found in the database.</p>
              {category !== 'all' && (
                <p className="text-sm text-gray-500">Try selecting a different category.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {photos.map(photo => (
                <div key={photo.id} className="rounded-lg overflow-hidden bg-black/30 border border-white/10">
                  <div className="aspect-[3/4] relative">
                    <img
                      src={photo.url}
                      alt="Stock photo"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://via.placeholder.com/300x400?text=Image+Error';
                      }}
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-gray-400 truncate">{photo.category}</p>
                    <p className="text-xs text-gray-500 truncate mt-1">{photo.id.substring(0, 8)}...</p>
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