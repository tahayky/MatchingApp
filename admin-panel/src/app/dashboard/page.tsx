'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiUrl } from '@/utils/apiConfig';

const ADMIN_AUTH_TOKEN_KEY = 'adminAuthToken';

interface StatData {
  name: string;
  value: string | number; // Allow number for real data
  change?: string; // Optional for real data
  status?: 'positive' | 'negative' | 'neutral'; // Optional
}

interface ActivityData {
  id: string;
  user: string;
  action: string;
  time: string;
}

interface DashboardData {
  stats?: {
    totalUsers?: number;
    activeSubscriptions?: number;
    // Add more stats as provided by the backend
  };
  // recentActivity?: ActivityData[]; // Add if backend provides this
  // topSubscriptions?: { name: string; value: number }[]; // Add if backend provides this
}

export default function DashboardPage() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleString());

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);

      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch(getApiUrl('admin/stats'), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            // Unauthorized or Forbidden
            localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY); // Clear bad token
            router.push('/login');
            return;
          }
          const errorData = await response.json().catch(() => ({ message: 'Failed to fetch dashboard data. Server returned an error.' }));
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.success && result.data) {
          setDashboardData({ stats: result.data }); // Assuming result.data matches { totalUsers, activeSubscriptions }
          setLastUpdated(new Date().toLocaleString());
        } else {
          throw new Error(result.message || 'Failed to process dashboard data.');
        }
      } catch (err: unknown) { // Changed from any to unknown
        console.error('Failed to fetch dashboard data:', err);
        if (err instanceof Error) {
          setError(err.message);
          // Optionally clear token and redirect if it's an auth-related fetch error not caught by 401/403
          // if (err.message.toLowerCase().includes('token') || err.message.toLowerCase().includes('auth')) {
          //   localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);
          //   router.push('/login');
          // }
        } else {
          setError('An unexpected error occurred.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  // Prepare stats for display from fetched data or show loading/error
  const displayStats: StatData[] = dashboardData?.stats
    ? [
        { name: 'Active Users', value: dashboardData.stats.totalUsers ?? 'N/A', status: 'neutral' },
        { name: 'Subscribers', value: dashboardData.stats.activeSubscriptions ?? 'N/A', status: 'neutral' },
        // Add more stats here as they become available from the backend
        { name: 'Daily Likes', value: 'Loading...', status: 'neutral' },
        { name: 'Matches', value: 'Loading...', status: 'neutral' },
      ]
    : [ // Default structure while loading or if error
        { name: 'Active Users', value: 'Loading...', status: 'neutral' },
        { name: 'Subscribers', value: 'Loading...', status: 'neutral' },
        { name: 'Daily Likes', value: 'Loading...', status: 'neutral' },
        { name: 'Matches', value: 'Loading...', status: 'neutral' },
      ];

  // Mock recent activity for now, as backend endpoint doesn't exist yet
  const recentActivity: ActivityData[] = [
    { id: '1', user: 'Emma Johnson', action: 'Upgraded to Premium', time: '10 minutes ago' },
    { id: '2', user: 'Michael Smith', action: 'New registration', time: '25 minutes ago' },
  ];


  if (loading) {
    return <div className="p-6">Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error loading dashboard: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Last updated: {lastUpdated}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        {displayStats.map((stat) => (
          <Card key={stat.name} className="max-w-xs">
            <CardContent className="px-4 py-3">
              <p className="text-xl font-medium">{stat.name}</p>
              <div className="flex mt-2 items-baseline">
                <p className="text-3xl font-bold">{stat.value}</p>
                {stat.change && (
                  <p className={`ml-2 ${stat.status === 'positive' ? 'text-green-500' : stat.status === 'negative' ? 'text-red-500' : 'text-gray-500'}`}>
                    {stat.change}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 mt-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Distribution</CardTitle>
            <CardDescription>
              (Data from backend needed)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>Subscription BarList placeholder - Backend endpoint required.</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              (Data from backend needed)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {recentActivity.map((activity) => ( // Still using mock data here
                <li key={activity.id} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    {activity.user.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{activity.user}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{activity.action}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{activity.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <a href="/dashboard/activity" className="text-sm text-blue-600 hover:underline">
              View all activity →
            </a>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
