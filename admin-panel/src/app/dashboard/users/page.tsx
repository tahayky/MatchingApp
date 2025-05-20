'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/utils/apiConfig'; // Assuming this is correctly configured
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; // Assuming these are ShadCN/ui components
import { getAdminToken, clearAdminToken } from '@/utils/adminAuthStore'; // Import token store functions

// const ADMIN_AUTH_TOKEN_KEY = 'adminAuthToken'; // No longer used

interface UserForAdminView {
  _id: string;
  name: string;
  email: string;
  createdAt: string; // Or Date, adjust as per backend response
  isProfileComplete?: boolean;
  lastActive?: string; // Or Date
  // Add other fields you expect from the backend, e.g., subscription info
  profile?: {
    photos?: { url: string, isMain: boolean }[];
    bio?: string;
  };
  // Example: subscriptionTier?: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalUsers: number;
  limit: number;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserForAdminView[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10); // Or make this configurable

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      const token = getAdminToken(); // Use token from store

      if (!token) {
        console.log('[UsersPage] No admin token found, redirecting to login.');
        router.push('/login');
        return;
      }
      console.log('[UsersPage] Token found, fetching users.');
      try {
        const queryParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: limit.toString(),
        });
        if (searchTerm) {
          queryParams.append('search', searchTerm);
        }
        // Add sortBy and order params if implementing sorting UI

        const response = await fetch(getApiUrl(`admin/users?${queryParams.toString()}`), {
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
          const errorData = await response.json().catch(() => ({ message: 'Failed to fetch users.' }));
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
          setUsers(result.data);
          setPagination(result.pagination);
        } else {
          throw new Error(result.message || 'Failed to process user data.');
        }
      } catch (err: unknown) {
        console.error('Failed to fetch users:', err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [router, currentPage, searchTerm, limit]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); // Reset to first page on new search
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Fetching is triggered by useEffect dependency on searchTerm
  };
  
  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && (!pagination || newPage <= pagination.totalPages)) {
      setCurrentPage(newPage);
    }
  };

  if (loading && users.length === 0) { // Show loading only on initial load or when users array is empty
    return <div className="p-6">Loading users...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error loading users: {error}</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-3xl font-bold">User Management</h1>

      <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="border p-2 rounded-md flex-grow"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Search
        </button>
      </form>

      {users.length === 0 && !loading ? (
        <p>No users found.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>User List</CardTitle>
            {pagination && (
              <CardDescription>
                Showing {users.length} of {pagination.totalUsers} users. Page {pagination.currentPage} of {pagination.totalPages}.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profile Complete</th>
                    {/* Add more columns as needed */}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => (
                    <tr key={user._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.lastActive ? new Date(user.lastActive).toLocaleString() : 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.isProfileComplete ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-4">
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1 || loading}
            className="px-4 py-2 border rounded-md disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {pagination.currentPage} of {pagination.totalPages}</span>
          <button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.totalPages || loading}
            className="px-4 py-2 border rounded-md disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
