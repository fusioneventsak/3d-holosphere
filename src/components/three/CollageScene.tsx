import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, Grid, Plane, Html, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { type SceneSettings } from '../../store/sceneStore';
import { getStockPhotos } from '../../lib/stockPhotos';

// Create a shared texture loader with memory management
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textureCache = new Map<string, { texture: THREE.Texture; lastUsed: number }>();

// Update the loadTexture function with improved error handling and retries
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

export default CollageScene;