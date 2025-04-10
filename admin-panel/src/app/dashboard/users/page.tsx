'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function UsersPage() {
  // Mock user data - in a real implementation, this would come from API
  const [users, setUsers] = useState([
    {
      id: 1,
      name: 'Emma Johnson',
      email: 'emma.johnson@example.com',
      gender: 'female',
      dateJoined: '2024-12-10T12:34:56.000Z',
      isActive: true,
      isProfileComplete: true,
      subscriptionTier: 'FREE'
    },
    {
      id: 2,
      name: 'Michael Smith',
      email: 'michael.smith@example.com',
      gender: 'male',
      dateJoined: '2025-01-15T09:22:18.000Z',
      isActive: true,
      isProfileComplete: true,
      subscriptionTier: 'PLUS'
    },
    {
      id: 3,
      name: 'Olivia Williams',
      email: 'olivia.williams@example.com',
      gender: 'female',
      dateJoined: '2025-02-07T14:45:30.000Z',
      isActive: false,
      isProfileComplete: true,
      subscriptionTier: 'PREMIUM'
    },
    {
      id: 4,
      name: 'James Brown',
      email: 'james.brown@example.com',
      gender: 'male',
      dateJoined: '2025-03-22T11:12:45.000Z',
      isActive: true,
      isProfileComplete: false,
      subscriptionTier: 'FREE'
    },
    {
      id: 5,
      name: 'Sophia Martinez',
      email: 'sophia.martinez@example.com',
      gender: 'female',
      dateJoined: '2025-04-01T16:50:22.000Z',
      isActive: true,
      isProfileComplete: true,
      subscriptionTier: 'PLUS'
    }
  ])

  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState({
    status: 'all', // all, active, inactive
    subscription: 'all' // all, free, plus, premium
  })

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  const handleFilterChange = (type: 'status' | 'subscription', value: string) => {
    setFilter({
      ...filter,
      [type]: value
    })
  }

  const filteredUsers = users.filter(user => {
    // Text search filtering
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Status filtering
    const matchesStatus = 
      filter.status === 'all' || 
      (filter.status === 'active' && user.isActive) ||
      (filter.status === 'inactive' && !user.isActive)
    
    // Subscription filtering
    const matchesSubscription = 
      filter.subscription === 'all' || 
      filter.subscription.toUpperCase() === user.subscriptionTier
    
    return matchesSearch && matchesStatus && matchesSubscription
  })

  const handleToggleStatus = (userId: number) => {
    // In a real app, this would call an API to update the user's status
    const updatedUsers = users.map(user => {
      if (user.id === userId) {
        return {
          ...user,
          isActive: !user.isActive
        }
      }
      return user
    })
    
    setUsers(updatedUsers)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">User Management</h1>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
          Add New User
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <CardTitle>Users</CardTitle>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-8 pr-4 py-2 border rounded-lg w-full md:w-64"
                />
                <svg className="w-4 h-4 absolute left-2.5 top-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              
              <select 
                value={filter.status} 
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="py-2 px-3 border rounded-lg"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              
              <select 
                value={filter.subscription} 
                onChange={(e) => handleFilterChange('subscription', e.target.value)}
                className="py-2 px-3 border rounded-lg"
              >
                <option value="all">All Subscriptions</option>
                <option value="free">Free</option>
                <option value="plus">Plus</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Gender</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Profile</th>
                  <th className="px-4 py-3 text-center">Subscription</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(user => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">{user.name}</td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3 capitalize">{user.gender}</td>
                      <td className="px-4 py-3">{new Date(user.dateJoined).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          user.isProfileComplete
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {user.isProfileComplete ? 'Complete' : 'Incomplete'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
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
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => handleToggleStatus(user.id)}
                            className={`p-1 ${user.isActive ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                            title={user.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Edit User"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-3 text-center text-gray-500">
                      No users found matching your search criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
