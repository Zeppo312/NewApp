import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, ImageBackground, SafeAreaView, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type UserProfile = {
  username: string;
  email: string;
  due_date?: string;
  baby_name?: string;
  baby_gender?: string;
  is_baby_born?: boolean;
};

export default function ProfilScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      
      // Benutzerdaten aus der Auth-Tabelle
      const email = user?.email || '';
      
      // Benutzerdaten aus der user_settings-Tabelle
      const { data: userData, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user profile:', error);
        Alert.alert('Fehler', 'Profildaten konnten nicht geladen werden.');
      } else {
        setProfile({
          username: userData?.username || 'Benutzer',
          email,
          due_date: userData?.due_date,
          baby_name: userData?.baby_name,
          baby_gender: userData?.baby_gender,
          is_baby_born: userData?.is_baby_born
        });
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
      Alert.alert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nicht angegeben';
    
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ImageBackground
        source={require('@/assets/images/Background_Hell.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={theme.text} />
            <ThemedText style={styles.backButtonText}>Zurück</ThemedText>
          </TouchableOpacity>

          <ThemedText type="title" style={styles.title}>
            Mein Profil
          </ThemedText>
        </View>

        <ScrollView style={styles.scrollView}>
          {isLoading ? (
            <ThemedView style={styles.loadingContainer} lightColor={theme.card} darkColor={theme.card}>
              <ActivityIndicator size="large" color={theme.accent} />
              <ThemedText style={styles.loadingText}>Profil wird geladen...</ThemedText>
            </ThemedView>
          ) : profile ? (
            <ThemedView style={styles.profileContainer} lightColor={theme.card} darkColor={theme.card}>
              <View style={styles.profileHeader}>
                <View style={styles.profileIconContainer}>
                  <IconSymbol name="person.crop.circle.fill" size={80} color={theme.accent} />
                </View>
                <ThemedText style={styles.username}>{profile.username}</ThemedText>
                <ThemedText style={styles.email}>{profile.email}</ThemedText>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoSection}>
                <ThemedText style={styles.sectionTitle}>Schwangerschaftsinformationen</ThemedText>
                
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Geburtstermin:</ThemedText>
                  <ThemedText style={styles.infoValue}>{formatDate(profile.due_date)}</ThemedText>
                </View>

                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Status:</ThemedText>
                  <ThemedText style={styles.infoValue}>
                    {profile.is_baby_born ? 'Baby ist geboren' : 'Schwangerschaft'}
                  </ThemedText>
                </View>

                {profile.is_baby_born && (
                  <>
                    <View style={styles.divider} />
                    <ThemedText style={styles.sectionTitle}>Babyinformationen</ThemedText>
                    
                    <View style={styles.infoRow}>
                      <ThemedText style={styles.infoLabel}>Name:</ThemedText>
                      <ThemedText style={styles.infoValue}>
                        {profile.baby_name || 'Nicht angegeben'}
                      </ThemedText>
                    </View>

                    <View style={styles.infoRow}>
                      <ThemedText style={styles.infoLabel}>Geschlecht:</ThemedText>
                      <ThemedText style={styles.infoValue}>
                        {profile.baby_gender === 'male' ? 'Junge' : 
                         profile.baby_gender === 'female' ? 'Mädchen' : 
                         'Nicht angegeben'}
                      </ThemedText>
                    </View>
                  </>
                )}
              </View>

              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => Alert.alert('Info', 'Profilbearbeitung wird in einer zukünftigen Version verfügbar sein.')}
              >
                <IconSymbol name="pencil" size={18} color="#FFFFFF" />
                <ThemedText style={styles.editButtonText}>Profil bearbeiten</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : (
            <ThemedView style={styles.errorContainer} lightColor={theme.card} darkColor={theme.card}>
              <IconSymbol name="exclamationmark.triangle.fill" size={40} color={theme.warning} />
              <ThemedText style={styles.errorText}>
                Profildaten konnten nicht geladen werden.
              </ThemedText>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={loadUserProfile}
              >
                <ThemedText style={styles.retryButtonText}>Erneut versuchen</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // Ausgleich für den Zurück-Button
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  profileContainer: {
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileIconContainer: {
    marginBottom: 12,
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    opacity: 0.7,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 16,
  },
  infoSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  infoLabel: {
    fontSize: 16,
    opacity: 0.8,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  editButton: {
    backgroundColor: Colors.light.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  errorContainer: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.light.accent,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
