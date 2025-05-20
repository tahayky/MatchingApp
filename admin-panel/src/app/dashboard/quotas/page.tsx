'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiUrl } from '@/utils/apiConfig';
import { getAdminToken, clearAdminToken } from '@/utils/adminAuthStore'; // Import token store functions

// const ADMIN_AUTH_TOKEN_KEY = 'adminAuthToken'; // No longer used

interface UserQuotaData {
  _id: string;
  name: string;
  email: string;
  subscriptionTier: string;
  dailyLikeQuota: number;
  remainingLikes: number;
  likesResetTime?: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalUsers: number;
  limit: number;
}

export default function QuotasPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserQuotaData[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);

  useEffect(() => {
    const fetchUserQuotas = async () => {
      setLoading(true);
      setError(null);
      const token = getAdminToken(); // Use token from store

      if (!token) {
        console.log('[QuotasPage] No admin token found, redirecting to login.');
        router.push('/login');
        return;
      }
      console.log('[QuotasPage] Token found, fetching user quotas.');
      try {
        const queryParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: limit.toString(),
        });
        if (searchTerm) {
          queryParams.append('search', searchTerm);
        }

        const response = await fetch(getApiUrl(`admin/user-quotas?${queryParams.toString()}`), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            clearAdminToken(); // Clear token from store
            router.push('/login');
            return;
          }
          const errorData = await response.json().catch(() => ({ message: 'Failed to fetch user quotas.' }));
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
          setUsers(result.data);
          setPagination(result.pagination);
        } else {
          throw new Error(result.message || 'Failed to process user quota data.');
        }
      } catch (err: unknown) {
        console.error('Error fetching user quotas:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching user quotas.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserQuotas();
  }, [router, currentPage, searchTerm, limit]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); 
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Fetching is triggered by useEffect due to searchTerm change
  };
  
  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && (!pagination || newPage <= pagination.totalPages)) {
      setCurrentPage(newPage);
    }
  };

  if (loading && users.length === 0) {
    return <div className="p-6 text-center">Loading user quotas...</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">User Like Quota Management</h1>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      )}

      <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="border p-2 rounded-md flex-grow dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Search
        </button>
      </form>
      
      {users.length === 0 && !loading ? (
         <p className="text-center py-10 text-gray-500 dark:text-gray-400">No users found.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>User Like Quotas</CardTitle>
            {pagination && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {users.length} of {pagination.totalUsers} users. Page {pagination.currentPage} of {pagination.totalPages}.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Subscription</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Daily Quota</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Remaining</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Next Reset</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user: UserQuotaData) => (
                    <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{user.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          user.subscriptionTier === 'PREMIUM' 
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            : user.subscriptionTier === 'PLUS'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {user.subscriptionTier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-300">{user.dailyLikeQuota}</td>
                      <td className="px-4 py-3 text-center text-sm">
                        <span className={
                          user.remainingLikes === 0 
                            ? 'text-red-600 font-medium' 
                            : user.remainingLikes < user.dailyLikeQuota * 0.25 
                            ? 'text-orange-600 font-medium'
                            : 'text-gray-500 dark:text-gray-300'
                        }>
                          {user.remainingLikes}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-300">
                        {user.likesResetTime ? new Date(user.likesResetTime).toLocaleTimeString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-6">
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1 || loading}
            className="px-4 py-2 border rounded-md disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.totalPages || loading}
            className="px-4 py-2 border rounded-md disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
