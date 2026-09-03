import { Redirect } from 'expo-router';

// Die Statistiken leben jetzt im Karussell auf der Countdown-Seite.
export default function PregnancyStatsScreen() {
  return <Redirect href="/(tabs)/countdown" />;
}
