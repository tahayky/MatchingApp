import React from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import SubscriptionInfo from '@/components/SubscriptionInfo';
import { subscriptionService } from '@/services';

export default function SubscriptionScreen() {
  const navigation = useNavigation();
  
  const handleUpgradePress = async (tierId: string) => {
    try {
      // In a real app, this would navigate to a payment screen
      // For now, let's simulate an immediate upgrade
      Alert.alert(
        'Upgrade Subscription',
        `Do you want to upgrade to ${tierId.toUpperCase()}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade',
            onPress: async () => {
              try {
                // Show loading
                Alert.alert('Processing', 'Upgrading subscription...');
                
                // Call the upgrade endpoint (1 month duration)
                const response = await subscriptionService.upgradeSubscription(tierId, 1);
                
                if (response.success) {
                  Alert.alert(
                    'Success',
                    'Subscription upgraded successfully!',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                  );
                } else {
                  Alert.alert('Error', response.message || 'Subscription upgrade failed.');
                }
              } catch (error: any) {
                Alert.alert('Error', error.message || 'An error occurred. Please try again later.');
              }
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred. Please try again later.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.header}>Subscription</ThemedText>
        <ThemedText style={styles.description}>
          Get more likes and special features with a premium subscription.
        </ThemedText>
        
        <SubscriptionInfo onUpgradePress={handleUpgradePress} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
    opacity: 0.8,
  },
});
