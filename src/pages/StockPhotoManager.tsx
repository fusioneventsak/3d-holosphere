import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
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
      
      if (error) {
        // Handle specific error for the "relation already exists" issue
        if (error.message && error.message.includes('already exists')) {
          console.warn('Database schema issue detected:', error.message);
          setError('There is a database schema issue. Please contact the administrator.');
          setPhotos([]);
        } else {
          throw error;
        }
      } else {
        setPhotos(data || []);
      }
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
        </div>
        
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 text-yellow-400 mr-3 mt-0.5" />
            <div>
              <h3 className="text-lg font-medium text-yellow-300 mb-2">Stock Photo Functionality Disabled</h3>
              <p className="text-yellow-200">
                The stock photo functionality has been disabled due to database schema issues. 
                This feature will be restored in a future update.
              </p>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-md">
            <p className="text-red-200">{error}</p>
          </div>
        )}
        
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
          <div className="text-center py-12">
            <p className="text-gray-400 mb-2">Stock photo functionality is currently unavailable.</p>
            <p className="text-sm text-gray-500">Please use the photo uploader in the collage editor to add your own photos.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default StockPhotoManager;