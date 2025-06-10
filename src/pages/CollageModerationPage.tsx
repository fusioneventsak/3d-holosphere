import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Shield, RefreshCw } from 'lucide-react';
import { useCollageStore, Photo } from '../store/collageStore';
import Layout from '../components/layout/Layout';
import PhotoModerationModal from '../components/collage/PhotoModerationModal';
import { supabase } from '../lib/supabase';

const CollageModerationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentCollage, fetchCollageById, loading, error, setupRealtimeSubscription, cleanupRealtimeSubscription } = useCollageStore();
  const [localPhotos, setLocalPhotos] = React.useState<Photo[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchCollageById(id);
    }
  }, [id, fetchCollageById]);

  // Fetch photos when collage is loaded
  useEffect(() => {
    if (!currentCollage?.id) return;
    
    handleRefresh();
  }, [currentCollage?.id]);

  // Setup realtime subscription when collage is loaded
  useEffect(() => {
    if (currentCollage?.id) {
      console.log('🔄 Setting up realtime subscription in moderation for collage:', currentCollage.id);
      setupRealtimeSubscription(currentCollage.id);
      
      // Also set up a listener for realtime updates to update our local state
      const channel = supabase
        .channel(`moderation-${currentCollage.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'photos',
          filter: `collage_id=eq.${currentCollage.id}`
        }, (payload) => {
          console.log('🔔 Moderation: New photo inserted:', payload.new);
          setLocalPhotos(prev => [payload.new as Photo, ...prev]);
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'photos',
          filter: `collage_id=eq.${currentCollage.id}`
        }, (payload) => {
          console.log('🔔 Moderation: Photo deleted:', payload.old);
          setLocalPhotos(prev => prev.filter(photo => photo.id !== payload.old.id));
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
        cleanupRealtimeSubscription();
      };
    }
  }, [currentCollage?.id, setupRealtimeSubscription, cleanupRealtimeSubscription]);

  const handleRefresh = () => {
    if (id) {
      setIsRefreshing(true);
      setFetchError(null);
      
      // Fetch photos directly from Supabase
      supabase
        .from('photos')
        .select('*')
        .eq('collage_id', id)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching photos:', error);
            setFetchError(error.message);
          } else {
            setLocalPhotos(data as Photo[]);
          }
        })
        .finally(() => {
          setTimeout(() => setIsRefreshing(false), 500);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-6">
          <Link
            to={`/dashboard/collage/${currentCollage.id}`}
            className="inline-flex items-center text-sm text-gray-400 hover:text-white mb-2"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Editor
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Moderating: {currentCollage.name}
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Review and manage photos uploaded to this collage
              </p>
              {fetchError && (
                <p className="text-red-400 text-sm mt-1">
                  Error: {fetchError}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                disabled={loading || isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <div className="flex items-center text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full">
                <Shield className="h-4 w-4 mr-2" />
                <span className="text-sm">Moderation Mode</span>
              </div>
            </div>
          </div>
        </div>

        <PhotoModerationModal
          photos={localPhotos}
          onClose={() => {
            // Since this is a dedicated page, closing should return to the editor
            window.location.href = `/dashboard/collage/${currentCollage.id}`;
          }}
        />
      </div>
    </Layout>
  );
};

export default CollageModerationPage;