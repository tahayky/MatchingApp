import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import subscriptionService, { QuotaInfo, SubscriptionStatus, SubscriptionTier } from '@/services/subscriptionService';

type SubscriptionInfoProps = {
  onUpgradePress?: (tierId: string) => void;
};

const SubscriptionInfo: React.FC<SubscriptionInfoProps> = ({ onUpgradePress }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [availableTiers, setAvailableTiers] = useState<SubscriptionTier[]>([]);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get subscription status
      console.log('[SubscriptionInfo] Fetching subscription status...');
      const statusResponse = await subscriptionService.getSubscriptionStatus();
      console.log('[SubscriptionInfo] Status Response:', JSON.stringify(statusResponse, null, 2));
      if (statusResponse.success && statusResponse.subscription) {
        setSubscriptionStatus(statusResponse.subscription);
        setQuotaInfo(statusResponse.subscription.quotaInfo);
        console.log('[SubscriptionInfo] Subscription Status Set:', JSON.stringify(statusResponse.subscription, null, 2));
      } else {
        console.warn('[SubscriptionInfo] Failed to get subscription status or no subscription data.');
      }
      
      // Get available tiers
      console.log('[SubscriptionInfo] Fetching available tiers...');
      const tiersResponse = await subscriptionService.getSubscriptionTiers();
      console.log('[SubscriptionInfo] Tiers Response:', JSON.stringify(tiersResponse, null, 2));
      if (tiersResponse.success && tiersResponse.tiers) {
        setAvailableTiers(tiersResponse.tiers);
        console.log('[SubscriptionInfo] Available Tiers Set:', JSON.stringify(tiersResponse.tiers, null, 2));
      } else {
        console.warn('[SubscriptionInfo] Failed to get available tiers or no tiers data.');
      }
      
      // Get the most up-to-date quota info
      console.log('[SubscriptionInfo] Fetching like quota...');
      const quotaResponse = await subscriptionService.getLikeQuota();
      console.log('[SubscriptionInfo] Quota Response:', JSON.stringify(quotaResponse, null, 2));
      if (quotaResponse.success && quotaResponse.quotaInfo) {
        setQuotaInfo(quotaResponse.quotaInfo);
        console.log('[SubscriptionInfo] Quota Info Set:', JSON.stringify(quotaResponse.quotaInfo, null, 2));
      } else {
        console.warn('[SubscriptionInfo] Failed to get like quota or no quota info.');
      }
    } catch (err: any) {
      console.error('Subscription data fetch error:', err);
      setError('Could not fetch subscription information. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradePress = (tierId: string) => {
    if (onUpgradePress) {
      onUpgradePress(tierId);
    } else {
      Alert.alert(
        'Upgrade Subscription',
        'Would you like to upgrade to access premium features?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade',
            onPress: () => {
              // Default implementation - just show a mock payment flow alert
              Alert.alert('Payment', 'Initiating payment process...', [
                { text: 'OK' }
              ]);
            }
          }
        ]
      );
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <ThemedText style={styles.loadingText}>Loading subscription information...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.errorContainer}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={fetchSubscriptionData}>
          <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  // Function to get background color based on remaining likes
  const getProgressBarColor = () => {
    if (!quotaInfo) return '#ccc';
    
    const percentage = (quotaInfo.remaining / quotaInfo.total) * 100;
    if (percentage > 50) return '#4CAF50'; // Green
    if (percentage > 20) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  };

  return (
    <ThemedView style={styles.container}>
      {/* Subscription Status */}
      {subscriptionStatus && (
        <ThemedView style={styles.subscriptionCard}>
          <ThemedText style={styles.tierName}>
            {subscriptionStatus.name || subscriptionStatus.tier}
          </ThemedText>
          
          {subscriptionStatus.expiresAt && (
            <ThemedText style={styles.expiryDate}>
              Expires: {new Date(subscriptionStatus.expiresAt).toLocaleDateString()}
            </ThemedText>
          )}
          
          {/* Like Quota Information */}
          {quotaInfo && (
            <ThemedView style={styles.quotaContainer}>
              <ThemedView style={styles.quotaHeader}>
                <ThemedText style={styles.quotaTitle}>Likes</ThemedText>
                <ThemedText style={styles.quotaNumbers}>
                  {quotaInfo.remaining} / {quotaInfo.total}
                </ThemedText>
              </ThemedView>
              
              <ThemedView style={styles.progressBarContainer}>
                <ThemedView
                  style={[
                    styles.progressBar,
                    {
                      width: `${(quotaInfo.remaining / quotaInfo.total) * 100}%`,
                      backgroundColor: getProgressBarColor()
                    }
                  ]}
                />
              </ThemedView>
              
              <ThemedText style={styles.resetTime}>
                Resets in: {subscriptionService.formatTimeUntilReset(quotaInfo)}
              </ThemedText>
            </ThemedView>
          )}
          
          {/* Features */}
          <ThemedView style={styles.featuresContainer}>
            <ThemedText style={styles.featuresTitle}>Features</ThemedText>
            {subscriptionStatus.features.map((feature, index) => (
              <ThemedView key={index} style={styles.featureItem}>
                <ThemedText style={styles.featureText}>✓ {feature}</ThemedText>
              </ThemedView>
            ))}
          </ThemedView>
          
          {/* Upgrade Button - only show for FREE tier */}
          {subscriptionStatus.tier.toUpperCase() === 'FREE' && ( // Compare with uppercase FREE
            <TouchableOpacity
              style={styles.upgradeButton}
              // Decide which tier to default upgrade to, or make it dynamic
              onPress={() => {
                const plusTier = availableTiers.find(t => t.id.toUpperCase() === 'PLUS');
                if (plusTier) {
                  handleUpgradePress(plusTier.id);
                } else {
                  Alert.alert("Upgrade Error", "Plus tier not available for upgrade.");
                }
              }}
            >
              <ThemedText style={styles.upgradeButtonText}>
                Upgrade to Premium
              </ThemedText>
            </TouchableOpacity>
          )}
        </ThemedView>
      )}
      
      {/* Available Tiers - only show if user has FREE tier */}
      {subscriptionStatus?.tier.toUpperCase() === 'FREE' && availableTiers.length > 0 && ( // Compare with uppercase FREE
        <ThemedView style={styles.availableTiersContainer}>
          <ThemedText style={styles.availableTiersTitle}>
            Subscription Plans
          </ThemedText>
          
          {availableTiers
            .filter(tier => tier.id.toUpperCase() !== 'FREE') // Compare with uppercase FREE
            .map(tier => (
              <ThemedView key={tier.id} style={styles.tierCard}>
                <ThemedView style={styles.tierHeader}>
                  <ThemedText style={styles.tierCardName}>{tier.name}</ThemedText>
                  {tier.price && tier.price.monthly !== undefined && ( // Check if monthly price exists
                    <ThemedText style={styles.tierPrice}>
                      ${tier.price.monthly}/month
                    </ThemedText>
                  )}
                </ThemedView>
                
                <ThemedText style={styles.tierDescription}>
                  {tier.description}
                </ThemedText>
                
                <ThemedView style={styles.tierFeaturesContainer}>
                  {tier.features.map((feature, index) => (
                    <ThemedText key={index} style={styles.tierFeature}>
                      ✓ {feature}
                    </ThemedText>
                  ))}
                </ThemedView>
                
                <TouchableOpacity
                  style={styles.tierUpgradeButton}
                  onPress={() => handleUpgradePress(tier.id)}
                >
                  <ThemedText style={styles.tierUpgradeText}>
                    Upgrade Now
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            ))}
        </ThemedView>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subscriptionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tierName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  expiryDate: {
    fontSize: 14,
    marginBottom: 16,
  },
  quotaContainer: {
    marginVertical: 12,
  },
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quotaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  quotaNumbers: {
    fontSize: 16,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  resetTime: {
    fontSize: 14,
    textAlign: 'right',
  },
  featuresContainer: {
    marginTop: 16,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  featureItem: {
    marginVertical: 4,
  },
  featureText: {
    fontSize: 14,
  },
  upgradeButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  availableTiersContainer: {
    marginTop: 16,
  },
  availableTiersTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  tierCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierCardName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tierPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tierDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  tierFeaturesContainer: {
    marginBottom: 16,
  },
  tierFeature: {
    fontSize: 14,
    marginVertical: 4,
  },
  tierUpgradeButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tierUpgradeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SubscriptionInfo;
