'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { getApiUrl } from '@/utils/apiConfig';
import { toast } from 'sonner';
import { getAdminToken } from '@/utils/adminAuthStore';

interface RateLimitSettings {
  windowMs: number;
  max: number;
  message: string;
}

// Removed unused ProfilesPerPageSetting interface

const DEFAULT_WINDOW_SEC = 10;
const DEFAULT_MAX_REQUESTS = 5;
const DEFAULT_MESSAGE = 'Too many discovery requests, please try again later.';
const DEFAULT_PROFILES_PER_PAGE = 5;

export default function SettingsPage() { // Renamed component for clarity
  // Rate Limit States
  const [windowSec, setWindowSec] = useState<number>(DEFAULT_WINDOW_SEC);
  const [maxRequests, setMaxRequests] = useState<number>(DEFAULT_MAX_REQUESTS);
  const [messageText, setMessageText] = useState<string>(DEFAULT_MESSAGE);
  const [isLoadingRateLimit, setIsLoadingRateLimit] = useState<boolean>(true);
  const [isSavingRateLimit, setIsSavingRateLimit] = useState<boolean>(false);

  // Profiles Per Page States
  const [profilesPerPage, setProfilesPerPage] = useState<number>(DEFAULT_PROFILES_PER_PAGE);
  const [isLoadingProfilesPerPage, setIsLoadingProfilesPerPage] = useState<boolean>(true);
  const [isSavingProfilesPerPage, setIsSavingProfilesPerPage] = useState<boolean>(false);

  useEffect(() => {
    fetchRateLimitSettings();
    fetchProfilesPerPageSettings();
  }, []);

  const fetchRateLimitSettings = async () => {
    setIsLoadingRateLimit(true);
    const token = getAdminToken();
    if (!token) {
      toast.error('Admin authentication token not found.');
      setIsLoadingRateLimit(false);
      return;
    }
    try {
      const apiUrl = getApiUrl('/admin/settings/discover-rate-limit');
      const response = await axios.get(apiUrl, { headers: { 'Authorization': `Bearer ${token}` }, timeout: 30000 });
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
        toast.error(response.data.message || 'Failed to load rate limit settings, using defaults.');
      }
    } catch (error: unknown) {
      console.error('Error fetching rate limit settings:', error);
      handleAxiosError(error, 'fetching rate limit settings');
      setWindowSec(DEFAULT_WINDOW_SEC);
      setMaxRequests(DEFAULT_MAX_REQUESTS);
      setMessageText(DEFAULT_MESSAGE);
    } finally {
      setIsLoadingRateLimit(false);
    }
  };

  const fetchProfilesPerPageSettings = async () => {
    setIsLoadingProfilesPerPage(true);
    const token = getAdminToken();
    if (!token) {
      toast.error('Admin authentication token not found.');
      setIsLoadingProfilesPerPage(false);
      return;
    }
    try {
      const apiUrl = getApiUrl('/admin/settings/profiles-per-page');
      const response = await axios.get(apiUrl, { headers: { 'Authorization': `Bearer ${token}` }, timeout: 30000 });
      if (response.data.success && response.data.data) {
        setProfilesPerPage(response.data.data.count || DEFAULT_PROFILES_PER_PAGE);
        toast.success('Current profiles per page setting loaded.');
      } else {
        setProfilesPerPage(DEFAULT_PROFILES_PER_PAGE);
        toast.error(response.data.message || 'Failed to load profiles per page setting, using default.');
      }
    } catch (error: unknown) {
      console.error('Error fetching profiles per page setting:', error);
      handleAxiosError(error, 'fetching profiles per page setting');
      setProfilesPerPage(DEFAULT_PROFILES_PER_PAGE);
    } finally {
      setIsLoadingProfilesPerPage(false);
    }
  };
  
  const handleAxiosError = (error: unknown, action: string) => {
    let errorMessage = `An error occurred while ${action}.`;
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    toast.error(errorMessage);
  };

  const handleRateLimitSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingRateLimit(true);
    toast.info('Saving rate limit settings...');
    const token = getAdminToken();
    if (!token) {
      toast.error('Admin authentication token not found.');
      setIsSavingRateLimit(false);
      return;
    }
    const settingsToSave = {
      windowMs: windowSec * 1000,
      max: Number(maxRequests),
      message: messageText,
    };
    try {
      const apiUrl = getApiUrl('/admin/settings/discover-rate-limit');
      const response = await axios.put(apiUrl, settingsToSave, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, timeout: 30000 });
      if (response.data.success) {
        toast.success(response.data.message || 'Rate limit settings updated successfully!');
        if (response.data.data) {
            const newSettings = response.data.data as RateLimitSettings;
            setWindowSec(newSettings.windowMs / 1000);
            setMaxRequests(newSettings.max);
            setMessageText(newSettings.message || DEFAULT_MESSAGE);
        }
        await triggerServerRefresh();
      } else {
        toast.error(response.data.message || 'Failed to update rate limit settings.');
      }
    } catch (error: unknown) {
      console.error('Error updating rate limit settings:', error);
      handleAxiosError(error, 'saving rate limit settings');
    } finally {
      setIsSavingRateLimit(false);
    }
  };

  const handleProfilesPerPageSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingProfilesPerPage(true);
    toast.info('Saving profiles per page setting...');
    const token = getAdminToken();
    if (!token) {
      toast.error('Admin authentication token not found.');
      setIsSavingProfilesPerPage(false);
      return;
    }
    const settingToSave = { count: Number(profilesPerPage) };
    try {
      const apiUrl = getApiUrl('/admin/settings/profiles-per-page');
      const response = await axios.put(apiUrl, settingToSave, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, timeout: 30000 });
      if (response.data.success) {
        toast.success(response.data.message || 'Profiles per page setting updated successfully!');
        if (response.data.data) {
            setProfilesPerPage(response.data.data.count || DEFAULT_PROFILES_PER_PAGE);
        }
        await triggerServerRefresh();
      } else {
        toast.error(response.data.message || 'Failed to update profiles per page setting.');
      }
    } catch (error: unknown) {
      console.error('Error updating profiles per page setting:', error);
      handleAxiosError(error, 'saving profiles per page setting');
    } finally {
      setIsSavingProfilesPerPage(false);
    }
  };

  const triggerServerRefresh = async () => {
    const token = getAdminToken();
    if (!token) return; // Should not happen if previous checks passed
    try {
      // This endpoint now refreshes both rate limit and profiles per page settings
      const refreshApiUrl = getApiUrl('/admin/settings/refresh-discover-settings'); 
      await axios.post(refreshApiUrl, {}, { headers: { 'Authorization': `Bearer ${token}` }, timeout: 30000 });
      toast.success('Discovery settings refresh triggered on the server.');
    } catch (refreshError: unknown) {
      console.error('Error triggering settings refresh:', refreshError);
      let refreshErrorMessage = 'Settings saved, but failed to trigger immediate refresh on server.';
      if (axios.isAxiosError(refreshError) && refreshError.response?.data?.message) {
        refreshErrorMessage += ` Server said: ${refreshError.response.data.message}`;
      }
      toast.warning(refreshErrorMessage);
    }
  };

  if (isLoadingRateLimit || isLoadingProfilesPerPage) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Discover Endpoint Rate Limit</CardTitle>
          <CardDescription>
            Configure the rate limits for the user profile discovery endpoint.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleRateLimitSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="windowSec">Window (seconds)</Label>
              <Input id="windowSec" type="number" value={windowSec} onChange={(e) => setWindowSec(Number(e.target.value))} min="1" required disabled={isSavingRateLimit} />
              <p className="text-sm text-muted-foreground">Duration of the time window in seconds.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxRequests">Max Requests per Window</Label>
              <Input id="maxRequests" type="number" value={maxRequests} onChange={(e) => setMaxRequests(Number(e.target.value))} min="1" required disabled={isSavingRateLimit} />
              <p className="text-sm text-muted-foreground">Maximum number of requests allowed per user within the window.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="messageText">Rate Limit Exceeded Message</Label>
              <Input id="messageText" type="text" value={messageText} onChange={(e) => setMessageText(e.target.value)} required disabled={isSavingRateLimit} />
              <p className="text-sm text-muted-foreground">Message shown to users when they exceed the rate limit.</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSavingRateLimit}>
              {isSavingRateLimit ? 'Saving Rate Limit...' : 'Save Rate Limit Settings'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discovery Profiles Per Page</CardTitle>
          <CardDescription>
            Set how many profiles are returned per API call to the discover endpoint.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleProfilesPerPageSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="profilesPerPage">Profiles Per Page</Label>
              <Input id="profilesPerPage" type="number" value={profilesPerPage} onChange={(e) => setProfilesPerPage(Number(e.target.value))} min="1" max="50" required disabled={isSavingProfilesPerPage} />
              <p className="text-sm text-muted-foreground">Number of profiles returned in one go (e.g., 5 to 20).</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSavingProfilesPerPage}>
              {isSavingProfilesPerPage ? 'Saving Profiles Per Page...' : 'Save Profiles Per Page'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}