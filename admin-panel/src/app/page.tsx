'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page when component mounts
    router.push('/login');
  }, [router]);

  // This component doesn't render anything meaningful
  // as it immediately redirects to /login
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-gray-500">Redirecting...</div>
    </div>
  );
}
