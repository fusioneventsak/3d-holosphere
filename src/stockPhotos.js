import { supabase } from './lib/supabase';

// This script uploads stock photos to Supabase Storage and updates the stock_photos table
// Run this script once to set up the stock photos

// Array of diverse portrait stock photos of smiling people
const stockPhotos = [
  // Asian
  "https://images.pexels.com/photos/1839564/pexels-photo-1839564.jpeg", // Asian woman smiling
  "https://images.pexels.com/photos/2896853/pexels-photo-2896853.jpeg", // Asian man smiling
  
  // Black/African
  "https://images.pexels.com/photos/3876394/pexels-photo-3876394.jpeg", // Black woman smiling
  "https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg", // Black man smiling
  "https://images.pexels.com/photos/3812207/pexels-photo-3812207.jpeg", // Black woman professional
  
  // Middle Eastern
  "https://images.pexels.com/photos/6321143/pexels-photo-6321143.jpeg", // Middle Eastern woman smiling (replaced broken URL)
  "https://images.pexels.com/photos/7108133/pexels-photo-7108133.jpeg", // Middle Eastern man
  
  // Latin/Hispanic
  "https://images.pexels.com/photos/789822/pexels-photo-789822.jpeg", // Latin woman smiling
  "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg", // Latin man smiling
  
  // White/Caucasian
  "https://images.pexels.com/photos/1987301/pexels-photo-1987301.jpeg", // White woman smiling
  "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg", // White man smiling
  
  // South Asian
  "https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg", // South Asian woman smiling
  "https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg", // South Asian man smiling
  
  // Multi-ethnic
  "https://images.pexels.com/photos/5198239/pexels-photo-5198239.jpeg", // Group of diverse people
  "https://images.pexels.com/photos/3184423/pexels-photo-3184423.jpeg", // Diverse office group
  
  // Different ages
  "https://images.pexels.com/photos/2050994/pexels-photo-2050994.jpeg", // Older woman smiling
  "https://images.pexels.com/photos/834863/pexels-photo-834863.jpeg", // Older man smiling
  "https://images.pexels.com/photos/3662900/pexels-photo-3662900.jpeg", // Young woman smiling
  "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg", // Young man smiling
  "https://images.pexels.com/photos/3785424/pexels-photo-3785424.jpeg"  // Teen smiling
];

// Function to fetch and upload stock photos
async function uploadStockPhotos() {
  try {
    console.log('Starting stock photo upload process...');
    
    // First, create a stock-photos bucket if it doesn't exist
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('Error checking buckets:', bucketError);
      return;
    }
    
    const stockBucketExists = buckets.some(bucket => bucket.name === 'stock-photos');
    
    if (!stockBucketExists) {
      console.log('Creating stock-photos bucket...');
      const { error } = await supabase.storage.createBucket('stock-photos', {
        public: true
      });
      
      if (error) {
        console.error('Error creating bucket:', error);
        return;
      }
      console.log('Created stock-photos bucket successfully');
    }
    
    // Process each photo URL
    for (let i = 0; i < stockPhotos.length; i++) {
      const photoUrl = stockPhotos[i];
      const filename = `person-${i + 1}.jpg`;
      
      console.log(`Processing photo ${i + 1}/${stockPhotos.length}: ${filename}`);
      
      try {
        // Download the image
        console.log(`Fetching image from ${photoUrl}`);
        const response = await fetch(photoUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        
        // Upload to Supabase Storage
        console.log(`Uploading ${filename} to Supabase Storage...`);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('stock-photos')
          .upload(filename, blob, {
            contentType: 'image/jpeg',
            upsert: true
          });
          
        if (uploadError) {
          console.error(`Error uploading ${filename}:`, uploadError);
          continue;
        }
        
        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('stock-photos')
          .getPublicUrl(filename);
          
        console.log(`Public URL for ${filename}: ${publicUrl}`);
        
        // Insert into stock_photos table
        const { data: insertData, error: insertError } = await supabase
          .from('stock_photos')
          .upsert({
            url: publicUrl,
            category: 'people'
          }, {
            onConflict: 'url'
          });
          
        if (insertError) {
          console.error(`Error inserting ${filename} into database:`, insertError);
          continue;
        }
        
        console.log(`Successfully processed ${filename}`);
      } catch (error) {
        console.error(`Error processing photo ${i + 1}:`, error);
      }
    }
    
    console.log('Stock photo upload process completed!');
  } catch (error) {
    console.error('Error in upload process:', error);
  }
}

export { uploadStockPhotos };