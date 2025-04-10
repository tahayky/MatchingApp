'use client'

import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-16 lg:ml-64 p-8 w-full min-h-screen bg-gray-50 dark:bg-gray-900">
        {children}
      </main>
    </div>
  )
}
