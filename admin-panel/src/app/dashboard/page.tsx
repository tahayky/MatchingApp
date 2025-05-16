'use client'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
// import { Metric, Text, Title, BarList, Flex, Grid } from '@tremor/react' // Commented out Tremor imports

export default function DashboardPage() {
  // Logout button and logic moved to Sidebar.tsx

  // Mock data - in production this would come from API
  const stats = [
    { name: 'Active Users', value: '4,834', change: '+12.3%', status: 'positive' },
    { name: 'Subscribers', value: '1,429', change: '+5.7%', status: 'positive' },
    { name: 'Daily Likes', value: '23,856', change: '+8.2%', status: 'positive' },
    { name: 'Matches', value: '2,974', change: '-2.1%', status: 'negative' },
  ]

  // const topSubscriptions = [
  //   { name: 'Premium', value: 456 },
  //   { name: 'Plus', value: 351 },
  //   { name: 'Free', value: 271 },
  // ]

  const recentActivity = [
    {
      id: '1', 
      user: 'Emma Johnson',
      action: 'Upgraded to Premium',
      time: '10 minutes ago' 
    },
    { 
      id: '2', 
      user: 'Michael Smith',
      action: 'New registration',
      time: '25 minutes ago' 
    },
    { 
      id: '3', 
      user: 'Olivia Williams',
      action: 'Quota reached',
      time: '42 minutes ago' 
    },
    { 
      id: '4', 
      user: 'James Brown',
      action: 'Subscription expired',
      time: '1 hour ago' 
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* <Grid numItemsMd={2} numItemsLg={4} className="gap-6 mt-6"> */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6"> {/* Fallback to simple grid */}
        {stats.map((stat) => (
          <Card key={stat.name} className="max-w-xs">
            <CardContent className="px-4 py-3">
              {/* <Title className="text-xl font-medium">{stat.name}</Title> */}
              <p className="text-xl font-medium">{stat.name}</p> {/* Fallback for Title */}
              {/* <Flex className="mt-2"> */}
              <div className="flex mt-2 items-baseline"> {/* Fallback for Flex */}
                {/* <Metric className="text-3xl font-bold">{stat.value}</Metric> */}
                <p className="text-3xl font-bold">{stat.value}</p> {/* Fallback for Metric */}
                {/* <Text className={`ml-2 ${stat.status === 'positive' ? 'text-green-500' : 'text-red-500'}`}> */}
                <p className={`ml-2 ${stat.status === 'positive' ? 'text-green-500' : 'text-red-500'}`}> {/* Fallback for Text */}
                  {stat.change}
                </p>
                {/* </Text> */}
              </div>
              {/* </Flex> */}
            </CardContent>
          </Card>
        ))}
      {/* </Grid> */}
      </div>

      <div className="grid grid-cols-1 gap-6 mt-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Distribution</CardTitle>
            <CardDescription>
              Active subscriptions in the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* <BarList
              data={topSubscriptions}
              valueFormatter={(number: number) => Intl.NumberFormat('us').format(number)}
              className="mt-2"
            /> */}
            <div>Subscription BarList placeholder</div> {/* Placeholder for BarList */}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              User actions in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {recentActivity.map((activity) => (
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
