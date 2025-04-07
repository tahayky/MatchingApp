import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect immediately to the auth route
  return <Redirect href="/auth" />;
}
