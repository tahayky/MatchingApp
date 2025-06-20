import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { subscriptionService } from '@/services';

interface QuotaInfo {
  remaining: number;
  total: number;
}

export function LikeQuotaDisplay() {
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuotaInfo = async () => {
    try {
      console.log('🔄 Fetching quota info...');
      const response = await subscriptionService.getLikeQuota();
      
      if (response.success && response.quotaInfo) {
        const newQuotaInfo = {
          remaining: response.quotaInfo.remaining || 0,
          total: response.quotaInfo.total || 0
        };
        console.log('✅ Quota updated:', newQuotaInfo);
        setQuotaInfo(newQuotaInfo);
      }
    } catch (error) {
      console.error('Error fetching quota info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotaInfo();
    // Refresh quota info every 30 seconds
    const interval = setInterval(fetchQuotaInfo, 30000);
    return () => clearInterval(interval);
  }, []);

  // Also refresh when a like is used
  useEffect(() => {
    const handleLikeUsed = () => {
      console.log('📍 Like event received, refreshing quota...');
      fetchQuotaInfo();
    };

    // Listen for custom event when like is used
    const DeviceEventEmitter = require('react-native').DeviceEventEmitter;
    const subscription = DeviceEventEmitter.addListener('likeUsed', handleLikeUsed);
    
    return () => {
      subscription.remove();
    };
  }, []);

  if (loading || !quotaInfo) {
    return null;
  }

  const usedLikes = quotaInfo.total - quotaInfo.remaining;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.heartsContainer}>
        {Array.from({ length: quotaInfo.total }).map((_, index) => (
          <ThemedText key={index} style={styles.heart}>
            {index < quotaInfo.remaining ? '❤️' : '🩶'}
          </ThemedText>
        ))}
      </View>
      <ThemedText style={styles.quotaText}>
        {quotaInfo.remaining} / {quotaInfo.total} likes remaining
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', // Çok hafif beyaz transparan
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 10,
  },
  heartsContainer: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  heart: {
    fontSize: 20,
    marginHorizontal: 2,
  },
  quotaText: {
    fontSize: 12,
    opacity: 0.7,
  },
});