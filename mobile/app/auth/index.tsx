import { Redirect } from 'expo-router';

export default function AuthIndexScreen() {
  // Auth index'e gelindiğinde direkt welcome sayfasına yönlendir
  return <Redirect href="/auth/welcome" />;
}
