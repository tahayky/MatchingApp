import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { profileService } from '@/services';

const { width } = Dimensions.get('window');
const photoSize = (width - 60) / 3; // 3 photos per row with margins

interface Photo {
  _id?: string;
  url: string;
  isMain: boolean;
}

interface PhotoUploaderProps {
  photos: Photo[];
  onPhotosUpdate: (photos: Photo[]) => void;
  maxPhotos?: number;
}

export default function PhotoUploader({ 
  photos, 
  onPhotosUpdate, 
  maxPhotos = 6 
}: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [loadingPhotoId, setLoadingPhotoId] = useState<string | null>(null);

  // Permission request functions removed from useEffect
  // Now they will be called only when user tries to use the functionality

  const pickImage = async () => {
    try {
      if (photos.length >= maxPhotos) {
        Alert.alert('Maximum Photos', `You can only upload up to ${maxPhotos} photos.`);
        return;
      }

      // Request permission only when user tries to access photo library
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need access to your photo library to upload photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const takePhoto = async () => {
    try {
      if (photos.length >= maxPhotos) {
        Alert.alert('Maximum Photos', `You can only upload up to ${maxPhotos} photos.`);
        return;
      }

      // Request camera permission only when user tries to use camera
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need access to your camera to take photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploading(true);

      // Asset'ten mime type'ı al, yoksa default kullan
      const mimeType = asset.mimeType || 'image/jpeg';
      
      // File extension'ı mime type'dan çıkar
      let extension = 'jpg';
      if (mimeType.includes('png')) extension = 'png';
      else if (mimeType.includes('webp')) extension = 'webp';
      
      console.log('📸 Reading photo as base64...');
      
      // Dosyayı base64 string olarak oku
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('✅ Base64 read successfully, size:', base64.length);
      
      // JSON payload oluştur
      const photoData = {
        data: base64,
        mimeType: mimeType,
        name: `photo_${Date.now()}.${extension}`,
        size: asset.fileSize
      };

      const response = await profileService.uploadProfilePhoto(photoData);

      if (response.success && response.photo) {
        const newPhotos = [...photos, response.photo];
        onPhotosUpdate(newPhotos);
        Alert.alert('Success', 'Photo uploaded successfully!');
      } else {
        Alert.alert('Error', response.message || 'Failed to upload photo');
      }
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', error.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingPhotoId(photoId);
              const response = await profileService.deletePhoto(photoId);

              if (response.success) {
                const updatedPhotos = photos.filter(photo => photo._id !== photoId);
                onPhotosUpdate(updatedPhotos);
                Alert.alert('Success', 'Photo deleted successfully');
              } else {
                Alert.alert('Error', response.message || 'Failed to delete photo');
              }
            } catch (error: any) {
              console.error('Error deleting photo:', error);
              Alert.alert('Error', error.message || 'Failed to delete photo');
            } finally {
              setLoadingPhotoId(null);
            }
          }
        }
      ]
    );
  };

  const setMainPhoto = async (photoId: string) => {
    try {
      setLoadingPhotoId(photoId);
      const response = await profileService.setMainPhoto(photoId);

      if (response.success) {
        // Update local state to reflect main photo change
        const updatedPhotos = photos.map(photo => ({
          ...photo,
          isMain: photo._id === photoId
        }));
        onPhotosUpdate(updatedPhotos);
        Alert.alert('Success', 'Main photo updated successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to set main photo');
      }
    } catch (error: any) {
      console.error('Error setting main photo:', error);
      Alert.alert('Error', error.message || 'Failed to set main photo');
    } finally {
      setLoadingPhotoId(null);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const showPhotoMenu = (photo: Photo) => {
    const options: any[] = [
      { text: 'Cancel', style: 'cancel' }
    ];

    if (!photo.isMain) {
      options.unshift({
        text: 'Set as Main Photo',
        onPress: () => photo._id && setMainPhoto(photo._id)
      });
    }

    options.unshift({
      text: 'Delete Photo',
      style: 'destructive',
      onPress: () => photo._id && deletePhoto(photo._id)
    });

    Alert.alert('Photo Options', '', options);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Photos ({photos.length}/{maxPhotos})</ThemedText>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
        <View style={styles.photosContainer}>
          {photos.map((photo, index) => (
            <TouchableOpacity
              key={photo._id || index}
              style={[styles.photoContainer, photo.isMain && styles.mainPhotoContainer]}
              onPress={() => showPhotoMenu(photo)}
              disabled={loadingPhotoId === photo._id}
            >
              <Image source={{ uri: photo.url }} style={styles.photo} />
              {photo.isMain && (
                <View style={styles.mainBadge}>
                  <ThemedText style={styles.mainBadgeText}>MAIN</ThemedText>
                </View>
              )}
              {loadingPhotoId === photo._id && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
          
          {photos.length < maxPhotos && (
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={showPhotoOptions}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#007AFF" />
              ) : (
                <>
                  <ThemedText style={styles.addPhotoText}>+</ThemedText>
                  <ThemedText style={styles.addPhotoLabel}>Add Photo</ThemedText>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {photos.length === 0 && (
        <ThemedView style={styles.emptyState}>
          <ThemedText style={styles.emptyText}>
            Add photos to make your profile more attractive!
          </ThemedText>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={showPhotoOptions}
            disabled={uploading}
          >
            <ThemedText style={styles.emptyButtonText}>
              {uploading ? 'Uploading...' : 'Add Your First Photo'}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  photoScroll: {
    marginBottom: 10,
  },
  photosContainer: {
    flexDirection: 'row',
    paddingRight: 10,
  },
  photoContainer: {
    width: photoSize,
    height: photoSize,
    marginRight: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mainPhotoContainer: {
    borderColor: '#007AFF',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  mainBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#007AFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mainBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoButton: {
    width: photoSize,
    height: photoSize,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  addPhotoText: {
    fontSize: 32,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  addPhotoLabel: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginTop: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6c757d',
    marginBottom: 16,
    fontSize: 14,
  },
  emptyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});