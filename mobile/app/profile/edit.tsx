import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View
} from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import PhotoUploader from '@/components/PhotoUploader';
import { profileService, authService } from '@/services';
import { ProfileData } from '@/services/profileService';

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [formData, setFormData] = useState<ProfileData>({
    bio: '',
    city: '',
    country: '',
    interests: [],
    occupation: '',
    education: '',
    coordinates: [0, 0],
    height: undefined,
    ageRangeMin: 18,
    ageRangeMax: 100,
    maxDistance: 50,
    gender: 'male', // Default to male
    interestedIn: ['female'] // Default to interested in female
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      try {
        const response = await profileService.getMyProfile();
        if (response.success && response.profile) {
          setProfile(response.profile);
          setPhotos(response.profile.photos || []);
          // Populate form with existing data
          setFormData({
            bio: response.profile.bio || '',
            coordinates: response.profile.location?.coordinates || [0, 0],
            city: response.profile.location?.city || '',
            country: response.profile.location?.country || '',
            interests: response.profile.interests || [],
            occupation: response.profile.occupation || '',
            education: response.profile.education || '',
            height: response.profile.height,
            ageRangeMin: response.profile.preferences?.ageRange?.min || 18,
            ageRangeMax: response.profile.preferences?.ageRange?.max || 100,
            maxDistance: response.profile.preferences?.distance || 50
          });
        }
      } catch (error) {
        // Profile doesn't exist yet, that's ok
        console.log('Profile not found, creating new one');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Convert interests array to string for API
      const apiData = {
        ...formData,
        interests: Array.isArray(formData.interests) 
          ? formData.interests.join(',') 
          : formData.interests
      };
      
      // Ensure coordinates are properly formatted as an array of numbers
      if (!apiData.coordinates || !Array.isArray(apiData.coordinates) || apiData.coordinates.length !== 2) {
        apiData.coordinates = [0, 0]; // Default to [0,0] if invalid
      }
      
      // Make sure all numeric fields are actually numbers, not strings
      if (typeof apiData.height === 'string') apiData.height = Number(apiData.height);
      if (typeof apiData.ageRangeMin === 'string') apiData.ageRangeMin = Number(apiData.ageRangeMin);
      if (typeof apiData.ageRangeMax === 'string') apiData.ageRangeMax = Number(apiData.ageRangeMax);
      if (typeof apiData.maxDistance === 'string') apiData.maxDistance = Number(apiData.maxDistance);
      
      console.log('Sending profile data:', JSON.stringify(apiData, null, 2)); // Debug log
      
      const response = await profileService.createOrUpdateProfile(apiData);
      
      if (response.success) {
        Alert.alert('Success', 'Profile saved successfully');
        router.back();
      } else {
        Alert.alert('Error', 'Failed to save profile');
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      
      // Check if it's an API error with response data
      if (error.response && error.response.data) {
        console.error('API error details:', error.response.data);
        Alert.alert('Error', error.response.data.message || 'Server error. Please try again.');
      } else {
        // Generic error
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save profile');
      }
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof ProfileData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle interests specifically (comma-separated string or array)
  const handleInterestsChange = (text: string) => {
    const interestsArray = text.split(',').map(i => i.trim()).filter(i => i !== '');
    updateField('interests', interestsArray);
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedView style={styles.header}>
            <ThemedText type="title" style={styles.headerTitle}>
              {profile ? 'Edit Profile' : 'Create Profile'}
            </ThemedText>
          </ThemedView>
          
          <ThemedView style={styles.form}>
            <PhotoUploader
              photos={photos}
              onPhotosUpdate={setPhotos}
              maxPhotos={6}
            />
            
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Bio</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell us about yourself"
                value={formData.bio}
                onChangeText={(text) => updateField('bio', text)}
                multiline
                numberOfLines={4}
              />
            </ThemedView>
            
            <ThemedView style={styles.row}>
              <ThemedView style={[styles.inputContainer, styles.halfWidth]}>
                <ThemedText>City</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Your city"
                  value={formData.city}
                  onChangeText={(text) => updateField('city', text)}
                />
              </ThemedView>
              
              <ThemedView style={[styles.inputContainer, styles.halfWidth]}>
                <ThemedText>Country</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Your country"
                  value={formData.country}
                  onChangeText={(text) => updateField('country', text)}
                />
              </ThemedView>
            </ThemedView>
            
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Interests (comma separated)</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="e.g. travel, music, hiking, cooking"
                value={Array.isArray(formData.interests) ? formData.interests.join(', ') : formData.interests}
                onChangeText={handleInterestsChange}
              />
            </ThemedView>
            
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Occupation</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Your job or profession"
                value={formData.occupation}
                onChangeText={(text) => updateField('occupation', text)}
              />
            </ThemedView>
            
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Education</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Your educational background"
                value={formData.education}
                onChangeText={(text) => updateField('education', text)}
              />
            </ThemedView>
            
            <ThemedView style={styles.row}>
              <ThemedView style={[styles.inputContainer, styles.halfWidth]}>
                <ThemedText>Height (cm)</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Your height in cm"
                  value={formData.height?.toString() || ''}
                  onChangeText={(text) => {
                    const height = parseInt(text);
                    if (!isNaN(height) || text === '') {
                      updateField('height', text === '' ? undefined : height);
                    }
                  }}
                  keyboardType="number-pad"
                />
              </ThemedView>
              
              <ThemedView style={[styles.inputContainer, styles.halfWidth]}>
                <ThemedText>Max Distance (km)</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Search radius"
                  value={formData.maxDistance?.toString() || '50'}
                  onChangeText={(text) => {
                    const distance = parseInt(text);
                    if (!isNaN(distance) || text === '') {
                      updateField('maxDistance', text === '' ? 50 : distance);
                    }
                  }}
                  keyboardType="number-pad"
                />
              </ThemedView>
            </ThemedView>
            
            <ThemedView style={styles.row}>
              <ThemedView style={[styles.inputContainer, styles.halfWidth]}>
                <ThemedText>Min Age</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Minimum age"
                  value={formData.ageRangeMin?.toString() || '18'}
                  onChangeText={(text) => {
                    const age = parseInt(text);
                    if (!isNaN(age) || text === '') {
                      updateField('ageRangeMin', text === '' ? 18 : age);
                    }
                  }}
                  keyboardType="number-pad"
                />
              </ThemedView>
              
              <ThemedView style={[styles.inputContainer, styles.halfWidth]}>
                <ThemedText>Max Age</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Maximum age"
                  value={formData.ageRangeMax?.toString() || '100'}
                  onChangeText={(text) => {
                    const age = parseInt(text);
                    if (!isNaN(age) || text === '') {
                      updateField('ageRangeMax', text === '' ? 100 : age);
                    }
                  }}
                  keyboardType="number-pad"
                />
              </ThemedView>
            </ThemedView>
            
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Gender</ThemedText>
              <ThemedView style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    formData.gender === 'male' && styles.checkboxSelected
                  ]}
                  onPress={() => updateField('gender', 'male')}
                >
                  <ThemedText style={formData.gender === 'male' ? styles.checkboxTextSelected : {}}>
                    Male
                  </ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    formData.gender === 'female' && styles.checkboxSelected
                  ]}
                  onPress={() => updateField('gender', 'female')}
                >
                  <ThemedText style={formData.gender === 'female' ? styles.checkboxTextSelected : {}}>
                    Female
                  </ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    formData.gender === 'other' && styles.checkboxSelected
                  ]}
                  onPress={() => updateField('gender', 'other')}
                >
                  <ThemedText style={formData.gender === 'other' ? styles.checkboxTextSelected : {}}>
                    Other
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
            
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Interested In (select one or more)</ThemedText>
              <ThemedView style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    formData.interestedIn?.includes('male') && styles.checkboxSelected
                  ]}
                  onPress={() => {
                    const current = formData.interestedIn || [];
                    if (current.includes('male')) {
                      updateField('interestedIn', current.filter(item => item !== 'male'));
                    } else {
                      updateField('interestedIn', [...current, 'male']);
                    }
                  }}
                >
                  <ThemedText style={formData.interestedIn?.includes('male') ? styles.checkboxTextSelected : {}}>
                    Male
                  </ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    formData.interestedIn?.includes('female') && styles.checkboxSelected
                  ]}
                  onPress={() => {
                    const current = formData.interestedIn || [];
                    if (current.includes('female')) {
                      updateField('interestedIn', current.filter(item => item !== 'female'));
                    } else {
                      updateField('interestedIn', [...current, 'female']);
                    }
                  }}
                >
                  <ThemedText style={formData.interestedIn?.includes('female') ? styles.checkboxTextSelected : {}}>
                    Female
                  </ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    formData.interestedIn?.includes('other') && styles.checkboxSelected
                  ]}
                  onPress={() => {
                    const current = formData.interestedIn || [];
                    if (current.includes('other')) {
                      updateField('interestedIn', current.filter(item => item !== 'other'));
                    } else {
                      updateField('interestedIn', [...current, 'other']);
                    }
                  }}
                >
                  <ThemedText style={formData.interestedIn?.includes('other') ? styles.checkboxTextSelected : {}}>
                    Other
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
            
            <ThemedView style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.button} 
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.buttonText}>Save Profile</ThemedText>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => router.back()}
                disabled={saving}
              >
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    marginBottom: 10,
  },
  form: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Added for checkbox functionality
  checkboxContainer: {
    flexDirection: 'row',
    marginTop: 8,
    justifyContent: 'space-between',
  },
  checkbox: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkboxTextSelected: {
    color: 'white',
  },
});
