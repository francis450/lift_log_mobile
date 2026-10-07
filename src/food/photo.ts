// Photos (meals, progress): take or pick one, then resize to at most 1568 px on the long edge, JPEG quality 0.8.

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export const MAX_EDGE = 1568;

export interface Photo {
  uri: string;
  base64: string;
  mime: 'image/jpeg';
}

/** The resize that brings the long edge down to MAX_EDGE, or null if it already fits. */
export function resizeTarget(width: number, height: number): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= MAX_EDGE) return null;
  return width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE };
}

export class PhotoPermissionError extends Error {
  constructor() {
    super("Camera access is off. Allow it for Expo Go or Lift Log in your phone's settings.");
  }
}

export async function takePhoto(source: 'camera' | 'library'): Promise<Photo | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PhotoPermissionError();
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  const target = resizeTarget(asset.width, asset.height);
  if (target) context.resize(target);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) throw new Error("That photo couldn't be read. Take it again.");
  return { uri: saved.uri, base64: saved.base64, mime: 'image/jpeg' };
}
