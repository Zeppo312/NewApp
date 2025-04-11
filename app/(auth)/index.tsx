import { Redirect } from 'expo-router';

export default function AuthIndex() {
  // Redirect to the login screen
  return <Redirect href="/(auth)/login" />;
}
