import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { authService } from '@/services';

type Step = 'email' | 'name' | 'dateOfBirth' | 'gender' | 'interestedIn';

export default function RegisterWizardScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  
  // Form data
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [interestedIn, setInterestedIn] = useState<('male' | 'female' | 'other')[]>(['female']);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleNext = async () => {
    switch (currentStep) {
      case 'email':
        if (!email) {
          Alert.alert('Error', 'Please enter your email');
          return;
        }
        if (!validateEmail(email)) {
          Alert.alert('Error', 'Please enter a valid email');
          return;
        }
        // Check if email already exists
        try {
          setLoading(true);
          const response = await authService.checkEmail(email);
          if (response.exists) {
            Alert.alert('Error', 'This email is already registered');
            return;
          }
          setCurrentStep('name');
        } catch (error) {
          // If checkEmail endpoint doesn't exist, just proceed
          setCurrentStep('name');
        } finally {
          setLoading(false);
        }
        break;
        
      case 'name':
        if (!name.trim()) {
          Alert.alert('Error', 'Please enter your name');
          return;
        }
        setCurrentStep('dateOfBirth');
        break;
        
      case 'dateOfBirth':
        // Calculate age
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
        setCurrentStep('gender');
        break;
        
      case 'gender':
        setCurrentStep('interestedIn');
        break;
        
      case 'interestedIn':
        if (interestedIn.length === 0) {
          Alert.alert('Error', 'Please select at least one preference');
          return;
        }
        // Complete registration
        await handleRegister();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'name':
        setCurrentStep('email');
        break;
      case 'dateOfBirth':
        setCurrentStep('name');
        break;
      case 'gender':
        setCurrentStep('dateOfBirth');
        break;
      case 'interestedIn':
        setCurrentStep('gender');
        break;
    }
  };

  const handleRegister = async () => {
    try {
      setLoading(true);
      const response = await authService.registerWithoutPassword({
        name,
        email,
        dateOfBirth: dateOfBirth.toISOString().split('T')[0],
        gender,
        interestedIn,
      });

      if (response.success) {
        Alert.alert('Success', 'Account created successfully', [
          { text: 'OK', onPress: () => router.replace('/(tabs)') }
        ]);
      } else {
        Alert.alert('Error', response.message || 'Registration failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterestedInOption = (option: 'male' | 'female' | 'other') => {
    if (interestedIn.includes(option)) {
      setInterestedIn(interestedIn.filter(item => item !== option));
    } else {
      setInterestedIn([...interestedIn, option]);
    }
  };

  const getStepNumber = () => {
    const steps: Step[] = ['email', 'name', 'dateOfBirth', 'gender', 'interestedIn'];
    return steps.indexOf(currentStep) + 1;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'email':
        return (
          <ThemedView style={styles.stepContainer}>
            <ThemedText type="title" style={styles.stepTitle}>What's your email?</ThemedText>
            <ThemedText style={styles.stepDescription}>
              We'll use this to create your account
            </ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
            />
          </ThemedView>
        );
        
      case 'name':
        return (
          <ThemedView style={styles.stepContainer}>
            <ThemedText type="title" style={styles.stepTitle}>What's your name?</ThemedText>
            <ThemedText style={styles.stepDescription}>
              This is how you'll appear to others
            </ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </ThemedView>
        );
        
      case 'dateOfBirth':
        return (
          <ThemedView style={styles.stepContainer}>
            <ThemedText type="title" style={styles.stepTitle}>When's your birthday?</ThemedText>
            <ThemedText style={styles.stepDescription}>
              You must be 18 or older to use this app
            </ThemedText>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <ThemedText style={styles.dateText}>{dateOfBirth.toDateString()}</ThemedText>
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
        );
        
      case 'gender':
        return (
          <ThemedView style={styles.stepContainer}>
            <ThemedText type="title" style={styles.stepTitle}>What's your gender?</ThemedText>
            <ThemedText style={styles.stepDescription}>
              Select your gender identity
            </ThemedText>
            <ThemedView style={styles.optionsContainer}>
              {(['male', 'female', 'other'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    gender === option && styles.optionButtonSelected
                  ]}
                  onPress={() => setGender(option)}
                >
                  <ThemedText style={[
                    styles.optionText,
                    gender === option && styles.optionTextSelected
                  ]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ThemedView>
          </ThemedView>
        );
        
      case 'interestedIn':
        return (
          <ThemedView style={styles.stepContainer}>
            <ThemedText type="title" style={styles.stepTitle}>Who are you interested in?</ThemedText>
            <ThemedText style={styles.stepDescription}>
              Select all that apply
            </ThemedText>
            <ThemedView style={styles.optionsContainer}>
              {(['male', 'female', 'other'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    interestedIn.includes(option) && styles.optionButtonSelected
                  ]}
                  onPress={() => toggleInterestedInOption(option)}
                >
                  <ThemedText style={[
                    styles.optionText,
                    interestedIn.includes(option) && styles.optionTextSelected
                  ]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ThemedView>
          </ThemedView>
        );
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {/* Progress indicator */}
        <ThemedView style={styles.progressContainer}>
          <ThemedView style={styles.progressBar}>
            <ThemedView 
              style={[
                styles.progressFill, 
                { width: `${(getStepNumber() / 5) * 100}%` }
              ]} 
            />
          </ThemedView>
          <ThemedText style={styles.progressText}>
            Step {getStepNumber()} of 5
          </ThemedText>
        </ThemedView>

        {/* Step content */}
        {renderStep()}

        {/* Navigation buttons */}
        <ThemedView style={styles.navigationContainer}>
          {currentStep !== 'email' && (
            <TouchableOpacity 
              style={[styles.button, styles.backButton]} 
              onPress={handleBack}
              disabled={loading}
            >
              <ThemedText style={styles.backButtonText}>Back</ThemedText>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[
              styles.button, 
              styles.nextButton,
              currentStep === 'email' && styles.fullWidthButton
            ]} 
            onPress={handleNext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.nextButtonText}>
                {currentStep === 'interestedIn' ? 'Complete' : 'Next'}
              </ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>

        <TouchableOpacity onPress={() => router.push('./')}>
          <ThemedText style={styles.link}>
            Already have an account? Sign In
          </ThemedText>
        </TouchableOpacity>
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
    padding: 20,
  },
  progressContainer: {
    marginTop: 40,
    marginBottom: 40,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
  },
  progressText: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
    opacity: 0.6,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 28,
    marginBottom: 10,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.7,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 18,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  optionText: {
    fontSize: 18,
  },
  optionTextSelected: {
    color: 'white',
  },
  navigationContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 40,
    marginBottom: 20,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    backgroundColor: '#e0e0e0',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  nextButton: {
    backgroundColor: '#2196F3',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fullWidthButton: {
    flex: 1,
  },
  link: {
    marginTop: 20,
    textAlign: 'center',
    color: '#2196F3',
  },
});