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
        'Abonelik Yükseltme',
        `${tierId.toUpperCase()} aboneliğe yükseltmek istiyor musunuz?`,
        [
          { text: 'İptal', style: 'cancel' },
          { 
            text: 'Yükselt', 
            onPress: async () => {
              try {
                // Show loading
                Alert.alert('İşleniyor', 'Abonelik yükseltiliyor...');
                
                // Call the upgrade endpoint (1 month duration)
                const response = await subscriptionService.upgradeSubscription(tierId, 1);
                
                if (response.success) {
                  Alert.alert(
                    'Başarılı', 
                    'Abonelik başarıyla yükseltildi!',
                    [{ text: 'Tamam', onPress: () => navigation.goBack() }]
                  );
                } else {
                  Alert.alert('Hata', response.message || 'Abonelik yükseltme başarısız oldu.');
                }
              } catch (error: any) {
                Alert.alert('Hata', error.message || 'Bir sorun oluştu, lütfen daha sonra tekrar deneyin.');
              }
            } 
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Bir sorun oluştu, lütfen daha sonra tekrar deneyin.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.header}>Abonelik</ThemedText>
        <ThemedText style={styles.description}>
          Premium abonelikle daha fazla beğeni hakkı ve özel özellikler kazanın.
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
