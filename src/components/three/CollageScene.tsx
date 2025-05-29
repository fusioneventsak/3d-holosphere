// Update the loadTexture function
const loadTexture = (url: string, emptySlotColor: string = '#1A1A1A'): THREE.Texture => {
  if (!url) {
    return createEmptySlotTexture(emptySlotColor);
  }
  
  const cleanUrl = stripCacheBustingParams(url);
  
  if (textureCache.has(cleanUrl)) {
    const entry = textureCache.get(cleanUrl)!;
    entry.lastUsed = Date.now();
    return entry.texture;
  }
  
  const fallbackTexture = createFallbackTexture();
  const placeholderTexture = createEmptySlotTexture('#333333');
  
  let loadUrl = cleanUrl;
  if (cleanUrl.includes('supabase.co/storage/v1/object/public')) {
    loadUrl = addCacheBustToUrl(cleanUrl);
    
    // Add CORS headers for Supabase storage URLs
    textureLoader.setCrossOrigin('anonymous');
  }
  
  // Create a retry function
  const loadWithRetry = (attempts = 3) => {
    textureLoader.load(
      loadUrl,
      (loadedTexture) => {
        console.log(`Successfully loaded texture: ${cleanUrl}`);
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.generateMipmaps = false;
        loadedTexture.anisotropy = 1;
        loadedTexture.needsUpdate = true;
        
        placeholderTexture.image = loadedTexture.image;
        placeholderTexture.needsUpdate = true;
      },
      undefined,
      (error) => {
        console.error(`Error loading texture (attempt ${4 - attempts}): ${cleanUrl}`, error);
        
        if (attempts > 1) {
          console.log(`Retrying texture load for: ${cleanUrl}`);
          setTimeout(() => loadWithRetry(attempts - 1), 1000);
        } else {
          console.error(`Failed to load texture after retries: ${cleanUrl}`);
          placeholderTexture.image = fallbackTexture.image;
          placeholderTexture.needsUpdate = true;
        }
      }
    );
  };
  
  // Start loading with retries
  loadWithRetry();
  
  placeholderTexture.minFilter = THREE.LinearFilter;
  placeholderTexture.magFilter = THREE.LinearFilter;
  placeholderTexture.generateMipmaps = false;
  placeholderTexture.anisotropy = 1;
  
  textureCache.set(cleanUrl, {
    texture: placeholderTexture,
    lastUsed: Date.now()
  });
  
  return placeholderTexture;
};

export default loadTexture