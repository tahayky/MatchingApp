// Define subscription tiers with their corresponding like quotas

// Types
export interface SubscriptionTier {
  id: string;
  name: string;
  dailyLikeQuota: number;
  description: string;
  features: string[];
  price?: {
    monthly: number;
    yearly: number;
  };
}

// Define the available subscription tiers
export const subscriptionTiers: Record<string, SubscriptionTier> = {
  "FREE": {
    "id": "free",
    "name": "Free",
    "dailyLikeQuota": 5,
    "description": "Basic features for casual users",
    "features": [
      "Limited profile views",
      "Basic matching",
      "50 likes per day"
    ]
  },
  "PLUS": {
    "id": "plus",
    "name": "Plus",
    "dailyLikeQuota": 30,
    "description": "Enhanced experience with more daily likes",
    "features": [
      "30 likes per day",
      "See who liked you",
      "Advanced profile customization",
      "Enhanced discovery"
    ],
    "price": {
      "monthly": 9.99,
      "yearly": 99.99
    }
  },
  "PREMIUM": {
    "id": "premium",
    "name": "Premium",
    "dailyLikeQuota": 125000,
    "description": "All features unlocked for serious daters",
    "features": [
      "All Plus features",
      "Incognito mode",
      "100 likes per day",
      "Message read receipts",
      "Profile boosting"
    ],
    "price": {
      "monthly": 19.99,
      "yearly": 199.99
    }
  }
};

// Get subscription tier by ID
export const getSubscriptionTier = (tierId: string): SubscriptionTier | undefined => {
  return subscriptionTiers[tierId.toUpperCase()];
};

// Get default subscription tier
export const getDefaultTier = (): SubscriptionTier => {
  return subscriptionTiers.FREE;
};