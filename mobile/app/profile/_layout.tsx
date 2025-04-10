import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="edit" 
        options={{ 
          title: 'Edit Profile',
          headerShown: false
        }} 
      />
      <Stack.Screen 
        name="settings" 
        options={{ 
          title: 'Settings',
          headerShown: false
        }} 
      />
      <Stack.Screen 
        name="subscription" 
        options={{ 
          title: 'Subscription',
          headerShown: false
        }} 
      />
    </Stack>
  );
}
