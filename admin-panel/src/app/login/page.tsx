'use client'

import { useState, useEffect } from 'react' // Added useEffect
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getApiUrl } from '@/utils/apiConfig' // Import getApiUrl

const ADMIN_AUTH_TOKEN_KEY = 'adminAuthToken'; // Key for localStorage

export default function LoginPage() {
  const router = useRouter()
  const [credentials, setCredentials] = useState({
    username: '', // Changed from email to username
    password: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Construct the full API URL using getApiUrl which reads BACKEND_URL from .env
      const loginApiUrl = getApiUrl('admin/login');
      
      const response = await fetch(loginApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.username, // Ensure this matches backend expectation
          password: credentials.password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.token) {
        localStorage.setItem(ADMIN_AUTH_TOKEN_KEY, data.token);
        router.push('/dashboard'); // Redirect to dashboard
      } else {
        setError(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login request error:', err);
      setError('An error occurred while trying to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Redirect to dashboard if already logged in (e.g., token in localStorage)
  useEffect(() => {
    const token = localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);
    if (token) {
      // Optionally: verify token with backend here before redirecting for added security
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">MatchingApp Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">
                  Username
                </label>
                <input
                  id="username"
                  name="username" // Changed from email
                  type="text" // Changed from email
                  autoComplete="username"
                  required
                  value={credentials.username} // Changed from email
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username" // Updated placeholder
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={credentials.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
              
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2 px-4 rounded-md bg-blue-600 text-white font-medium ${
                    loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
                  }`}
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
              
              {/* Removed demo credentials hint as it's now from backend .env */}
              {/* <div className="text-center text-sm text-gray-500">
                <p>For demo purposes, use:</p>
                <p className="font-mono">admin@matchingapp.com / admin123</p>
              </div> */}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
