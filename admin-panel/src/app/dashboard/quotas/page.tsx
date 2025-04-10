'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// No longer using getApiUrl since we've hardcoded the URLs
// import { getApiUrl } from '@/utils/apiConfig'

interface User {
  _id: string;
  name: string;
  email: string;
  subscriptionTier: string;
  dailyLikeQuota: number;
  remainingLikes: number;
  likesResetTime?: Date;
}

export default function QuotasPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Global like quota state
  const [showGlobalQuotaModal, setShowGlobalQuotaModal] = useState(false)
  const [globalQuota, setGlobalQuota] = useState(10)
  const [selectedTiers, setSelectedTiers] = useState<string[]>([])
  const [applyToAllTiers, setApplyToAllTiers] = useState(true)
  const [savingGlobalQuota, setSavingGlobalQuota] = useState(false)
  
  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)
        // In a real implementation, this would fetch from a proper admin users endpoint
        // For the purpose of this example, we're using a mock endpoint
        // Direct URL to backend for users endpoint
        const response = await fetch('http://localhost:3000/api/users', {
          credentials: 'include'  // Include cookies for auth
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch users')
        }
        
        const data = await response.json()
        if (data.success) {
          setUsers(data.users)
        } else {
          throw new Error(data.message || 'Failed to fetch users')
        }
      } catch (err) {
        console.error('Error fetching users:', err)
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setLoading(false)
      }
    }
    
    fetchUsers()
  }, [])

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [editQuota, setEditQuota] = useState({
    dailyLikeQuota: 0,
    remainingLikes: 0
  })

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleEditUser = (userId: string) => {
    const user = users.find(u => u._id === userId)
    if (user) {
      setEditQuota({
        dailyLikeQuota: user.dailyLikeQuota,
        remainingLikes: user.remainingLikes
      })
      setSelectedUser(userId)
    }
  }

  const handleSaveQuota = async () => {
    if (!selectedUser) return
    
    // Clear any previous messages
    setSuccess(null)
    setError(null)
    
    try {
      setSaving(true)
      
      // Make API call to update the user's quota
      try {
        console.log(`Sending request to update quota for user ${selectedUser}`);
        
        // Direct hard-coded URL to backend server at port 3000 instead of relying on getApiUrl
        const apiUrl = `http://localhost:3000/api/subscription/admin/update-like-quota/${selectedUser}`;
        
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer admin-token' // Add this for testing if your backend requires auth
          },
          body: JSON.stringify({ 
            dailyLikeQuota: editQuota.dailyLikeQuota 
          }),
          credentials: 'include' // Include cookies for auth
        })
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json()
        
        if (data.success) {
          // Update user in local state
          const updatedUsers = users.map(user => {
            if (user._id === selectedUser) {
              return {
                ...user,
                dailyLikeQuota: data.user.quotaInfo.total,
                remainingLikes: data.user.quotaInfo.remaining
              }
            }
            return user
          })
          
          // Refresh backend configuration after successful update
          try {
            await fetch('http://localhost:3000/api/subscription/refresh-config');
            console.log('Backend configuration refreshed after quota update');
          } catch (refreshError) {
            console.error('Failed to refresh backend configuration:', refreshError);
          }
          
          setUsers(updatedUsers)
          setSuccess(`Successfully updated quota for ${data.user.name}`)
          setSelectedUser(null)
        } else {
          throw new Error(data.message || 'Failed to update like quota')
        }
      } catch (apiError: unknown) {
        console.error('API Error:', apiError);
        setError(`API Error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
        
        // Fallback to local update for demo purposes
        console.log('Falling back to local update');
        const updatedUsers = users.map(user => {
          if (user._id === selectedUser) {
            return {
              ...user,
              dailyLikeQuota: editQuota.dailyLikeQuota,
              remainingLikes: Math.max(user.remainingLikes, editQuota.dailyLikeQuota)
            }
          }
          return user
        });
        
        setUsers(updatedUsers);
        setSuccess(`Updated quota locally (API call failed)`);
        setSelectedUser(null);
      }
    } catch (err) {
      console.error('Error updating like quota:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setSaving(false)
    }
  }
  
  const handleUpdateGlobalQuota = async () => {
    // Clear any previous messages
    setSuccess(null)
    setError(null)
    
    try {
      setSavingGlobalQuota(true)
      
      // Prepare request body
      const requestBody: { dailyLikeQuota: number; tierIds?: string[] } = {
        dailyLikeQuota: globalQuota
      }
      
      // Only include tierIds if not applying to all tiers
      if (!applyToAllTiers && selectedTiers.length > 0) {
        requestBody.tierIds = selectedTiers
      }
      
      // Make API call to update global like quota
      try {
        console.log('Sending request to update global quota:', requestBody);
        
        // Direct hard-coded URL to backend server at port 3000 instead of relying on getApiUrl
        const apiUrl = 'http://localhost:3000/api/subscription/admin/update-global-like-quota';
        
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer admin-token' // Add this for testing if your backend requires auth
          },
          body: JSON.stringify(requestBody),
          credentials: 'include' // Include cookies for auth
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          // Refetch the users to get updated quota information
          try {
            const usersResponse = await fetch('http://localhost:3000/api/users', {
              credentials: 'include'
            });
            
            const usersData = await usersResponse.json();
            if (usersData.success) {
              setUsers(usersData.users);
            }
          } catch {
            console.warn("Failed to refresh user data, but quota was updated successfully");
          }
          
          // Refresh backend configuration after global quota update
          try {
            await fetch('http://localhost:3000/api/subscription/refresh-config');
            console.log('Backend configuration refreshed after global quota update');
          } catch (refreshError) {
            console.error('Failed to refresh backend configuration:', refreshError);
          }
          
          setSuccess(`Successfully updated global like quota to ${globalQuota}${!applyToAllTiers ? ' for selected tiers' : ''}`);
          setShowGlobalQuotaModal(false);
        } else {
          throw new Error(data.message || 'Failed to update global like quota');
        }
      } catch (apiError: unknown) {
        console.error('API Error:', apiError);
        setError(`API Error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
        
        // Fallback to local update for demo purposes
        console.log('Falling back to local update');
        
        // Update users matching selected tiers (or all users if applyToAllTiers is true)
        const updatedUsers = users.map(user => {
          if (applyToAllTiers || selectedTiers.includes(user.subscriptionTier)) {
            return {
              ...user,
              dailyLikeQuota: globalQuota,
              remainingLikes: Math.max(user.remainingLikes, globalQuota)
            };
          }
          return user;
        });
        
        setUsers(updatedUsers);
        setSuccess(`Updated global quota locally (API call failed)`);
        setShowGlobalQuotaModal(false);
      }
    } catch (err) {
      console.error('Error updating global like quota:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setSavingGlobalQuota(false)
    }
  }

  const handleResetQuotas = async () => {
    // Clear any previous messages
    setSuccess(null)
    setError(null)
    
    try {
      setSaving(true)
      
      // Define default quotas for each tier
      const defaultQuotas = {
        'FREE': 5,
        'PLUS': 25,
        'PREMIUM': 100
      };
      
      // Update quotas for each tier based on defaults
      for (const [tierId, quota] of Object.entries(defaultQuotas)) {
        // Direct hard-coded URL to backend server at port 3000 instead of relying on getApiUrl
        const apiUrl = 'http://localhost:3000/api/subscription/admin/update-global-like-quota';
        
        await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer admin-token' // Add this for testing if your backend requires auth
          },
          body: JSON.stringify({
            dailyLikeQuota: quota,
            tierIds: [tierId]
          }),
          credentials: 'include'
        });
        
        // Add small delay between requests to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Refetch the users to get updated quota information
      const usersResponse = await fetch('http://localhost:3000/api/users', {
        credentials: 'include'
      })
      
      const usersData = await usersResponse.json()
      
      if (usersData.success) {
        setUsers(usersData.users)
        
        // Refresh backend configuration after reset
        try {
          await fetch('http://localhost:3000/api/subscription/refresh-config');
          console.log('Backend configuration refreshed after quota reset');
        } catch (refreshError) {
          console.error('Failed to refresh backend configuration:', refreshError);
        }
        
        setSuccess('Successfully reset all quotas to tier defaults')
      }
    } catch (err) {
      console.error('Error resetting quotas:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Like Quota Management</h1>
          <div className="flex space-x-2">
            <button 
              onClick={() => setShowGlobalQuotaModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
            >
              Update Global Quota
            </button>
            <button 
              onClick={handleResetQuotas}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center"
              disabled={saving}
            >
              {saving && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></span>
              )}
              Reset All Quotas
            </button>
          </div>
        </div>
        
        {/* Global Quota Modal */}
        {showGlobalQuotaModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Update Global Like Quota</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Daily Like Quota</label>
                <input 
                  type="number" 
                  value={globalQuota}
                  onChange={(e) => setGlobalQuota(parseInt(e.target.value))}
                  className="w-full border rounded px-3 py-2"
                  min="0"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Apply to Subscription Tiers</label>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="all-tiers" 
                      checked={applyToAllTiers}
                      onChange={() => setApplyToAllTiers(!applyToAllTiers)}
                      className="mr-2"
                    />
                    <label htmlFor="all-tiers">All tiers</label>
                  </div>
                  
                  {!applyToAllTiers && (
                    <div className="pl-4 space-y-2">
                      {['FREE', 'PLUS', 'PREMIUM'].map(tier => (
                        <div key={tier} className="flex items-center">
                          <input 
                            type="checkbox" 
                            id={`tier-${tier}`} 
                            checked={selectedTiers.includes(tier)}
                            onChange={() => {
                              if (selectedTiers.includes(tier)) {
                                setSelectedTiers(selectedTiers.filter(t => t !== tier));
                              } else {
                                setSelectedTiers([...selectedTiers, tier]);
                              }
                            }}
                            className="mr-2"
                          />
                          <label htmlFor={`tier-${tier}`}>{tier}</label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button 
                  onClick={() => setShowGlobalQuotaModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                  disabled={savingGlobalQuota}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateGlobalQuota}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center"
                  disabled={savingGlobalQuota}
                >
                  {savingGlobalQuota && (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></span>
                  )}
                  Update
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status messages */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>User Like Quotas</CardTitle>
            <div className="relative">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-8 pr-4 py-2 border rounded-lg w-64"
              />
              <svg className="w-4 h-4 absolute left-2.5 top-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] text-blue-600 motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
              <p className="mt-2">Loading users...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Subscription</th>
                    <th className="px-4 py-3 text-center">Daily Quota</th>
                    <th className="px-4 py-3 text-center">Remaining</th>
                    <th className="px-4 py-3 text-center">Next Reset</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map(user => (
                      <tr key={user._id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">{user.name}</td>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                            user.subscriptionTier === 'PREMIUM' 
                              ? 'bg-purple-100 text-purple-800'
                              : user.subscriptionTier === 'PLUS'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.subscriptionTier}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {selectedUser === user._id ? (
                            <input
                              type="number"
                              value={editQuota.dailyLikeQuota}
                              onChange={(e) => setEditQuota({...editQuota, dailyLikeQuota: parseInt(e.target.value)})}
                              className="w-16 text-center border rounded"
                              min="0"
                            />
                          ) : (
                            user.dailyLikeQuota
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={
                            user.remainingLikes === 0 
                              ? 'text-red-600 font-medium' 
                              : user.remainingLikes < user.dailyLikeQuota * 0.25 
                              ? 'text-orange-600 font-medium'
                              : ''
                          }>
                            {user.remainingLikes}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {user.likesResetTime ? new Date(user.likesResetTime).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {selectedUser === user._id ? (
                            <div className="flex justify-center space-x-2">
                              <button
                                onClick={() => setSelectedUser(null)}
                                className="p-1 text-gray-500 hover:text-gray-700"
                                disabled={saving}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveQuota}
                                className="p-1 text-blue-600 hover:text-blue-800 flex items-center"
                                disabled={saving}
                              >
                                {saving && (
                                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-1"></span>
                                )}
                                Save
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditUser(user._id)}
                              className="p-1 text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-center text-gray-500">
                        No users found matching your search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* API Endpoint Note */}
      <div className="text-sm text-gray-500 mt-4 p-4 bg-gray-50 rounded-lg">
        <p className="font-medium mb-2">API Usage Notes:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <code className="bg-gray-100 px-1 py-0.5 rounded">PUT /api/subscription/admin/update-global-like-quota</code> - Update the daily like quota for all users
          </li>
          <li>
            <code className="bg-gray-100 px-1 py-0.5 rounded">PUT /api/subscription/admin/update-like-quota/:userId</code> - Update a specific user&apos;s daily like quota
          </li>
          <li>
            <code className="bg-gray-100 px-1 py-0.5 rounded">PUT /api/subscription/admin/update-tier</code> - Update a subscription tier&apos;s properties
          </li>
        </ul>
      </div>
    </div>
  )
}
