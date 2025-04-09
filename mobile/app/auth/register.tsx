import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { authService } from '@/services';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('male');
  const [interestedIn, setInterestedIn] = useState(['female']);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // Validate inputs
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    // Calculate age and check if user is at least 18
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 18) {
      Alert.alert('Error', 'You must be at least 18 years old to register');
      return;
    }

    try {
      setLoading(true);
      const response = await authService.register({
        name,
        email,
        password,
        dateOfBirth: dateOfBirth.toISOString().split('T')[0], // Format: YYYY-MM-DD
        gender: gender as 'male' | 'female' | 'other',
        interestedIn: interestedIn as ('male' | 'female' | 'other')[],
      });

      if (response.success) {
        Alert.alert('Success', 'Account created successfully');
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Registration failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterestedInOption = (option: string) => {
    if (interestedIn.includes(option)) {
      setInterestedIn(interestedIn.filter(item => item !== option));
    } else {
      setInterestedIn([...interestedIn, option]);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>Create Account</ThemedText>
          
          <ThemedView style={styles.form}>
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Name</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
              />
            </ThemedView>
            
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Email</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </ThemedView>
            
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Password</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="off"
                textContentType="none"
              />
            </ThemedView>
            
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Confirm Password</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="off"
                textContentType="none"
              />
            </ThemedView>
            
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Date of Birth</ThemedText>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <ThemedText>{dateOfBirth.toDateString()}</ThemedText>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={dateOfBirth}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setDateOfBirth(selectedDate);
                    }
                  }}
                />
              )}
            </ThemedView>
            
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Gender</ThemedText>
              <ThemedView style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    gender === 'male' && styles.checkboxSelected
                  ]}
                  onPress={() => setGender('male')}
                >
                  <ThemedText style={gender === 'male' ? styles.checkboxTextSelected : {}}>
                    Male
                  </ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    gender === 'female' && styles.checkboxSelected
                  ]}
                  onPress={() => setGender('female')}
                >
                  <ThemedText style={gender === 'female' ? styles.checkboxTextSelected : {}}>
                    Female
                  </ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    gender === 'other' && styles.checkboxSelected
                  ]}
                  onPress={() => setGender('other')}
                >
                  <ThemedText style={gender === 'other' ? styles.checkboxTextSelected : {}}>
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
                    interestedIn.includes('male') && styles.checkboxSelected
                  ]}
                  onPress={() => toggleInterestedInOption('male')}
                >
                  <ThemedText style={interestedIn.includes('male') ? styles.checkboxTextSelected : {}}>
                    Male
                  </ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    interestedIn.includes('female') && styles.checkboxSelected
                  ]}
                  onPress={() => toggleInterestedInOption('female')}
                >
                  <ThemedText style={interestedIn.includes('female') ? styles.checkboxTextSelected : {}}>
                    Female
                  </ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    interestedIn.includes('other') && styles.checkboxSelected
                  ]}
                  onPress={() => toggleInterestedInOption('other')}
                >
                  <ThemedText style={interestedIn.includes('other') ? styles.checkboxTextSelected : {}}>
                    Other
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Create Account</ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('./')}>
              <ThemedText style={styles.link}>
                Already have an account? Sign In
              </ThemedText>
            </TouchableOpacity>
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
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    marginBottom: 40,
    textAlign: 'center',
  },
  form: {
    width: '100%',
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
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginTop: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
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
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 20,
    textAlign: 'center',
    color: '#2196F3',
  },
});
