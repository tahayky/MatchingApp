'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label'; // Assuming these paths are correct for your project
import { Input } from '@/components/ui/input'; // Assuming these paths are correct for your project
import { Button } from '@/components/ui/button'; // Assuming these paths are correct for your project
import axios from 'axios';
import { getApiUrl } from '@/utils/apiConfig';
import { toast } from 'sonner';
import { getAdminToken } from '@/utils/adminAuthStore'; // Import token store functions

interface RateLimitSettings {
  windowMs: number;
  max: number;
  message: string;
}

const DEFAULT_WINDOW_SEC = 10;
const DEFAULT_MAX_REQUESTS = 5;
const DEFAULT_MESSAGE = 'Too many discovery requests, please try again later.';

export default function RateLimitSettingsPage() {
  const [windowSec, setWindowSec] = useState<number>(DEFAULT_WINDOW_SEC);
  const [maxRequests, setMaxRequests] = useState<number>(DEFAULT_MAX_REQUESTS);
  const [messageText, setMessageText] = useState<string>(DEFAULT_MESSAGE);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    const token = getAdminToken();

    if (!token) {
      toast.error('Admin authentication token not found. Please log in.');
      setIsLoading(false);
      // Optionally redirect to login: router.push('/login');
      return;
    }

    try {
      const apiUrl = getApiUrl('/admin/settings/discover-rate-limit');
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        timeout: 30000,
      });

      if (response.data.success && response.data.data) {
        const settings = response.data.data as RateLimitSettings;
        setWindowSec(settings.windowMs / 1000);
        setMaxRequests(settings.max);
        setMessageText(settings.message || DEFAULT_MESSAGE);
        toast.success('Current rate limit settings loaded.');
      } else {
        setWindowSec(DEFAULT_WINDOW_SEC);
        setMaxRequests(DEFAULT_MAX_REQUESTS);
        setMessageText(DEFAULT_MESSAGE);
        if (response.data.message && response.data.message.includes('Using default settings')) {
          toast.info(response.data.message);
        } else {
          toast.error(response.data.message || 'Failed to load settings, using defaults.');
        }
      }
    } catch (error: unknown) { // Changed from any to unknown
      console.error('Error fetching rate limit settings:', error);
      let errorMessage = 'An error occurred while fetching settings.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
      setWindowSec(DEFAULT_WINDOW_SEC);
      setMaxRequests(DEFAULT_MAX_REQUESTS);
      setMessageText(DEFAULT_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    toast.info('Saving rate limit settings...');
    const token = getAdminToken();

    if (!token) {
      toast.error('Admin authentication token not found. Please log in.');
      setIsSaving(false);
      // Optionally redirect to login: router.push('/login');
      return;
    }

    const settingsToSave = {
      windowMs: windowSec * 1000,
      max: Number(maxRequests),
      message: messageText,
    };

    try {
      const apiUrl = getApiUrl('/admin/settings/discover-rate-limit');
      const response = await axios.put(apiUrl, settingsToSave, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 30000,
      });

      if (response.data.success) {
        toast.success(response.data.message || 'Rate limit settings updated successfully! Triggering refresh...');
        if (response.data.data) {
            const newSettings = response.data.data as RateLimitSettings;
            setWindowSec(newSettings.windowMs / 1000);
            setMaxRequests(newSettings.max);
            setMessageText(newSettings.message || DEFAULT_MESSAGE);
        }
        // Call the refresh endpoint
        try {
          const refreshApiUrl = getApiUrl('/admin/settings/refresh-discover-rate-limit');
          await axios.post(refreshApiUrl, {}, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            timeout: 30000,
          });
          toast.success('Rate limiter configuration refresh triggered on the server.');
        } catch (refreshError: unknown) {
          console.error('Error triggering rate limit refresh:', refreshError);
          let refreshErrorMessage = 'Settings saved, but failed to trigger immediate refresh on server.';
          if (axios.isAxiosError(refreshError) && refreshError.response?.data?.message) {
            refreshErrorMessage += ` Server said: ${refreshError.response.data.message}`;
          }
          toast.warning(refreshErrorMessage);
        }
      } else {
        toast.error(response.data.message || 'Failed to update settings.');
      }
    } catch (error: unknown) {
      console.error('Error updating rate limit settings:', error);
      let errorMessage = 'An error occurred while saving settings.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        {/* Consider using a ShadCN Spinner or Skeleton component if available */}
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Discover Endpoint Rate Limit</CardTitle>
          <CardDescription>
            Configure the rate limits for the user profile discovery endpoint.
            Changes may require a server restart to take full effect on the rate limiter.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="windowSec">Window (seconds)</Label>
              <Input
                id="windowSec"
                type="number"
                value={windowSec}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWindowSec(Number(e.target.value))}
                min="1"
                required
                disabled={isSaving}
              />
              <p className="text-sm text-muted-foreground">
                Duration of the time window in seconds.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxRequests">Max Requests per Window</Label>
              <Input
                id="maxRequests"
                type="number"
                value={maxRequests}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxRequests(Number(e.target.value))}
                min="1"
                required
                disabled={isSaving}
              />
              <p className="text-sm text-muted-foreground">
                Maximum number of requests allowed per user within the window.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="messageText">Rate Limit Exceeded Message</Label>
              <Input
                id="messageText"
                type="text"
                value={messageText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessageText(e.target.value)}
                required
                disabled={isSaving}
              />
              <p className="text-sm text-muted-foreground">
                Message shown to users when they exceed the rate limit.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}