import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { followUser, unfollowUser, isFollowingUser } from '@/lib/follows';

interface FollowButtonProps {
  userId: string;
  onFollowStatusChange?: (isFollowing: boolean) => void;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  showIcon?: boolean;
  style?: any;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  userId,
  onFollowStatusChange,
  size = 'medium',
  showText = true,
  showIcon = true,
  style
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lade den initialen Folge-Status
  useEffect(() => {
    const checkFollowStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { isFollowing: following, error } = await isFollowingUser(userId);
        
        if (error) {
          setError(error as string);
          return;
        }
        
        setIsFollowing(following);
      } catch (err) {
        console.error('Fehler beim Prüfen des Folge-Status:', err);
        setError('Fehler beim Laden des Status');
      } finally {
        setLoading(false);
      }
    };
    
    checkFollowStatus();
  }, [userId]);

  // Toggle-Funktion zum Folgen/Entfolgen
  const handleToggleFollow = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (isFollowing) {
        // Entfolgen
        console.log(`Attempting to unfollow user: ${userId}`);
        const { success, error } = await unfollowUser(userId);
        
        if (!success) {
          console.error(`Error unfollowing user ${userId}:`, error);
          setError(error as string);
          return;
        }
        
        console.log(`Successfully unfollowed user: ${userId}`);
        setIsFollowing(false);
        if (onFollowStatusChange) onFollowStatusChange(false);
      } else {
        // Folgen
        console.log(`Attempting to follow user: ${userId}`);
        const { success, error } = await followUser(userId);
        
        if (!success) {
          console.error(`Error following user ${userId}:`, error);
          setError(error as string);
          return;
        }
        
        console.log(`Successfully followed user: ${userId}`);
        setIsFollowing(true);
        if (onFollowStatusChange) onFollowStatusChange(true);
      }
    } catch (err) {
      console.error('Fehler beim Ändern des Folge-Status:', err);
      setError('Fehler bei der Verarbeitung');
    } finally {
      setLoading(false);
    }
  };

  // Größe basierend auf der size-Prop bestimmen
  let buttonSize, iconSize, fontSize, paddingHorizontal;
  
  switch (size) {
    case 'small':
      buttonSize = 30;
      iconSize = 14;
      fontSize = 12;
      paddingHorizontal = 6;
      break;
    case 'large':
      buttonSize = 44;
      iconSize = 20;
      fontSize = 16;
      paddingHorizontal = 16;
      break;
    default: // medium
      buttonSize = 36;
      iconSize = 16;
      fontSize = 14;
      paddingHorizontal = 12;
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isFollowing 
            ? colorScheme === 'dark' ? '#333333' : '#F5F5F5'
            : theme.accent,
          height: buttonSize,
          paddingHorizontal: showText ? paddingHorizontal : 0,
          // When only icon is shown, keep it circular
          width: showText ? undefined : buttonSize,
          borderRadius: showText ? buttonSize / 2 : buttonSize / 2
        },
        style
      ]}
      onPress={handleToggleFollow}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isFollowing ? theme.text : '#FFFFFF'} />
      ) : (
        <>
          {showIcon && (
            <IconSymbol
              name={isFollowing ? 'checkmark' : 'plus'}
              size={iconSize}
              color={isFollowing ? theme.accent : '#FFFFFF'}
            />
          )}
          
          {showText && (
            <ThemedText
              style={[
                styles.text,
                {
                  fontSize,
                  color: isFollowing ? theme.tabIconDefault : '#FFFFFF',
                  marginLeft: showIcon ? 4 : 0,
                }
              ]}
            >
              {isFollowing ? 'Folge ich' : 'Folgen'}
            </ThemedText>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '500',
    marginLeft: 4,
  }
}); 
