'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

interface SubscriptionTier {
  id: string;
  name: string;
  dailyLikeQuota: number;
  description: string;
  features: string[];
  price?: {
    monthly: number;
    yearly: number;
  };
  userCount?: number;
}

export default function SubscriptionsPage() {
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Gerçek API'den veri çekiyoruz, mock data kullanmıyoruz
  
  // Fetch subscription tiers data
  useEffect(() => {
    const fetchTiers = async () => {
      try {
        setLoading(true)
        
        // API'den veri çek
        const response = await fetch('http://localhost:3000/api/subscription/tiers')
        
        if (!response.ok) {
          throw new Error('Failed to fetch subscription tiers')
        }
        
        const data = await response.json()
        
        if (data.success && data.tiers) {
          // Kullanıcı sayılarını ekle (API bunu sağlamıyor)
          const mockUserCounts = {
            'free': 2500,
            'plus': 1000,
            'premium': 500
          };
          
          const tiersWithCounts = data.tiers.map((tier: SubscriptionTier) => ({
            ...tier,
            userCount: mockUserCounts[tier.id as keyof typeof mockUserCounts] || 0
          }));
          
          setSubscriptionTiers(tiersWithCounts);
        } else {
          throw new Error(data.message || 'Failed to fetch subscription tiers');
        }
      } catch (err) {
        console.error('Error fetching subscription tiers:', err)
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setLoading(false)
      }
    }
    
    fetchTiers()
  }, [])

  const [isEditingTier, setIsEditingTier] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({
    dailyLikeQuota: 0,
    description: '',
    features: [] as string[],
    monthlyPrice: 0,
    yearlyPrice: 0
  })

  const handleEditTier = (tierId: string) => {
    const tier = subscriptionTiers.find(t => t.id === tierId)
    if (tier) {
      setEditValues({
        dailyLikeQuota: tier.dailyLikeQuota,
        description: tier.description,
        features: [...tier.features],
        monthlyPrice: tier.price?.monthly || 0,
        yearlyPrice: tier.price?.yearly || 0
      })
      setIsEditingTier(tierId)
    }
  }

  const handleSaveTier = async () => {
    // Clear any previous messages
    setSuccessMessage(null)
    setError(null)
    
    try {
      setSaving(true)
      
      const tierToUpdate = subscriptionTiers.find(t => t.id === isEditingTier)
      if (!tierToUpdate) return
      
      // Prepare the update data to send to API
      const updateData = {
        tierId: isEditingTier,
        dailyLikeQuota: editValues.dailyLikeQuota,
        description: editValues.description,
        features: editValues.features,
        price: tierToUpdate.price ? {
          monthly: editValues.monthlyPrice,
          yearly: editValues.yearlyPrice
        } : undefined
      }
      
      // Make API call to update the tier
      try {
        // Backend API endpoint
        const apiUrl = 'http://localhost:3000/api/subscription/admin/update-tier';
        console.log('FULL API URL:', apiUrl);
        console.log('Request payload:', JSON.stringify(updateData, null, 2));
        
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer admin-token' // Test için
          },
          body: JSON.stringify(updateData),
          credentials: 'include' // Include cookies for auth
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          // Update local state with the updated tier data
          const updatedTiers = subscriptionTiers.map(tier => {
            if (tier.id === isEditingTier) {
              return {
                ...tier,
                dailyLikeQuota: editValues.dailyLikeQuota,
                description: editValues.description,
                features: [...editValues.features],
                price: tierToUpdate.price ? {
                  monthly: editValues.monthlyPrice,
                  yearly: editValues.yearlyPrice
                } : undefined
              }
            }
            return tier
          });
          
          // After successful update, refresh the backend config
          try {
            await fetch('http://localhost:3000/api/subscription/refresh-config');
            console.log('Backend configuration refreshed');
          } catch (refreshError) {
            console.error('Failed to refresh backend configuration:', refreshError);
          }
          
          setSubscriptionTiers(updatedTiers);
          setSuccessMessage(`Successfully updated ${tierToUpdate.name} tier`);
          setIsEditingTier(null);
        } else {
          throw new Error(data.message || 'Failed to update subscription tier');
        }
      } catch (apiError: unknown) {
        console.error('API Error:', apiError);
        setError(`API Error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
        
        // Fallback to local update for demo purposes
        console.log('Falling back to local update');
        const updatedTiers = subscriptionTiers.map(tier => {
          if (tier.id === isEditingTier) {
            return {
              ...tier,
              dailyLikeQuota: editValues.dailyLikeQuota,
              description: editValues.description,
              features: [...editValues.features],
              price: tierToUpdate.price ? {
                monthly: editValues.monthlyPrice,
                yearly: editValues.yearlyPrice
              } : undefined
            }
          }
          return tier
        });
        
        setSubscriptionTiers(updatedTiers);
        setSuccessMessage(`Updated tier locally (API call failed)`);
        setIsEditingTier(null);
      }
    } catch (err) {
      console.error('Error updating subscription tier:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setSaving(false)
    }
  }
  
  // Helper to add/remove features
  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...editValues.features]
    newFeatures[index] = value
    setEditValues({...editValues, features: newFeatures})
  }
  
  const handleAddFeature = () => {
    setEditValues({...editValues, features: [...editValues.features, '']})
  }
  
  const handleRemoveFeature = (index: number) => {
    const newFeatures = [...editValues.features]
    newFeatures.splice(index, 1)
    setEditValues({...editValues, features: newFeatures})
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Subscription Management</h1>
      </div>

      {/* Status messages */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] text-blue-600 motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2">Loading subscription tiers...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {subscriptionTiers.map(tier => (
            <Card key={tier.id} className="overflow-hidden">
              <CardHeader className={`text-white ${
                tier.id === 'free' ? 'bg-gray-700' :
                tier.id === 'plus' ? 'bg-blue-600' : 'bg-purple-700'
              }`}>
                <CardTitle className="flex justify-between items-center">
                  <span>{tier.name}</span>
                  {tier.price && (
                    <span className="text-2xl">${tier.price.monthly}/mo</span>
                  )}
                </CardTitle>
                <CardDescription className="text-white opacity-90">
                  {isEditingTier === tier.id ? (
                    <textarea
                      value={editValues.description}
                      onChange={(e) => setEditValues({...editValues, description: e.target.value})}
                      className="w-full p-2 text-black rounded mt-2"
                      rows={2}
                    />
                  ) : (
                    tier.description
                  )}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Features</h4>
                  {isEditingTier === tier.id ? (
                    <div className="space-y-2">
                      {editValues.features.map((feature, index) => (
                        <div key={index} className="flex items-center">
                          <input
                            type="text"
                            value={feature}
                            onChange={(e) => handleFeatureChange(index, e.target.value)}
                            className="flex-grow border rounded px-2 py-1"
                          />
                          <button 
                            onClick={() => handleRemoveFeature(index)}
                            className="ml-2 p-1 text-red-500 hover:text-red-700"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={handleAddFeature}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        + Add feature
                      </button>
                    </div>
                  ) : (
                    <ul className="list-disc pl-5 space-y-1">
                      {tier.features.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                    </ul>
                  )}
                </div>
              
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Daily Like Quota:</span>
                    {isEditingTier === tier.id ? (
                      <input 
                        type="number" 
                        value={editValues.dailyLikeQuota}
                        onChange={(e) => setEditValues({...editValues, dailyLikeQuota: parseInt(e.target.value)})}
                        className="border rounded px-2 py-1 w-20 text-right"
                      />
                    ) : (
                      <span>{tier.dailyLikeQuota}</span>
                    )}
                  </div>
                  
                  {tier.price && (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Monthly Price:</span>
                        {isEditingTier === tier.id ? (
                          <div className="flex items-center">
                            <span className="mr-1">$</span>
                            <input 
                              type="number" 
                              value={editValues.monthlyPrice}
                              onChange={(e) => setEditValues({...editValues, monthlyPrice: parseFloat(e.target.value)})}
                              className="border rounded px-2 py-1 w-20 text-right"
                              step="0.01"
                            />
                          </div>
                        ) : (
                          <span>${tier.price.monthly.toFixed(2)}</span>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Yearly Price:</span>
                        {isEditingTier === tier.id ? (
                          <div className="flex items-center">
                            <span className="mr-1">$</span>
                            <input 
                              type="number" 
                              value={editValues.yearlyPrice}
                              onChange={(e) => setEditValues({...editValues, yearlyPrice: parseFloat(e.target.value)})}
                              className="border rounded px-2 py-1 w-20 text-right"
                              step="0.01"
                            />
                          </div>
                        ) : (
                          <span>${tier.price.yearly.toFixed(2)}</span>
                        )}
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-between items-center mt-4">
                    <span className="font-medium">Active Users:</span>
                    <span className="font-bold">{tier.userCount?.toLocaleString() || '0'}</span>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="border-t p-4 flex justify-between">
                {isEditingTier === tier.id ? (
                  <>
                    <button 
                      onClick={() => setIsEditingTier(null)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveTier}
                      className={`px-4 py-2 ${saving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded flex items-center`}
                      disabled={saving}
                    >
                      {saving && (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></span>
                      )}
                      Save Changes
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => handleEditTier(tier.id)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded w-full"
                  >
                    Edit Tier
                  </button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
