import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Poll, PollOption, getPoll, voteForOption } from '@/lib/polls';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';

interface PollComponentProps {
  pollId: string;
  onVoteChange?: () => void;
}

export const PollComponent: React.FC<PollComponentProps> = ({ pollId, onVoteChange }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Umfrage laden
  const loadPoll = async () => {
    try {
      setLoading(true);
      const { data, error } = await getPoll(pollId);

      if (error) throw error;
      setPoll(data);
    } catch (err) {
      console.error('Error loading poll:', err);
      setError('Die Umfrage konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  // Für eine Option abstimmen
  const handleVote = async (optionId: string) => {
    try {
      setVoting(true);
      const { error } = await voteForOption(optionId);

      if (error) throw error;

      // Umfrage neu laden, um die aktuellen Ergebnisse anzuzeigen
      await loadPoll();

      // Callback aufrufen, falls vorhanden
      if (onVoteChange) {
        onVoteChange();
      }
    } catch (err) {
      console.error('Error voting:', err);
      Alert.alert('Fehler', 'Deine Stimme konnte nicht gespeichert werden.');
    } finally {
      setVoting(false);
    }
  };

  // Umfrage beim ersten Rendern laden
  useEffect(() => {
    loadPoll();
  }, [pollId]);

  // Prüfen, ob der Benutzer bereits abgestimmt hat
  const hasVoted = poll?.user_votes && poll.user_votes.length > 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.accent} />
        <ThemedText style={styles.loadingText}>Umfrage wird geladen...</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.errorContainer} lightColor={theme.card} darkColor={theme.card}>
        <IconSymbol name="exclamationmark.triangle" size={24} color="#FF6B6B" />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (!poll) {
    return null;
  }

  return (
    <ThemedView style={styles.container} lightColor={theme.card} darkColor={theme.card}>
      <ThemedText style={styles.question}>{poll.question}</ThemedText>

      <View style={styles.optionsContainer}>
        {poll.options?.map((option: any) => (
          <TouchableOpacity
            key={option.option_id}
            style={[
              styles.optionButton,
              option.has_voted && styles.votedOption,
              { opacity: voting ? 0.7 : 1 }
            ]}
            onPress={() => handleVote(option.option_id)}
            disabled={voting}
          >
            <View style={styles.optionContent}>
              <ThemedText style={styles.optionText}>{option.option_text}</ThemedText>

              {hasVoted && (
                <ThemedText style={styles.voteCount}>
                  {option.votes_count} {option.votes_count === 1 ? 'Stimme' : 'Stimmen'}
                </ThemedText>
              )}
            </View>

            {option.has_voted && (
              <View style={styles.checkmarkContainer}>
                <IconSymbol name="checkmark.circle.fill" size={20} color={theme.accent} />
              </View>
            )}

            {/* Prozentanzeige immer anzeigen, wenn abgestimmt wurde */}
            {hasVoted && (
              <View style={styles.percentageBarContainer}>
                <View
                  style={[
                    styles.percentageBar,
                    {
                      width: `${option.percentage}%`,
                      backgroundColor: option.has_voted ? theme.accent : '#E0E0E0'
                    }
                  ]}
                />
                <ThemedText style={styles.percentageText}>{option.percentage}%</ThemedText>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <ThemedText style={styles.footerText}>
            {poll.allow_multiple_choices
              ? 'Mehrfachauswahl möglich'
              : 'Nur eine Auswahl möglich'}
          </ThemedText>

          {hasVoted && (
            <ThemedText style={styles.toggleHint}>
              Tippe erneut, um deine Auswahl aufzuheben
            </ThemedText>
          )}
        </View>

        {hasVoted && (
          <ThemedText style={styles.totalVotes}>
            Insgesamt: {poll.options?.reduce((sum, option) => sum + (option.votes_count || 0), 0)} Stimmen
          </ThemedText>
        )}
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  question: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  optionsContainer: {
    marginBottom: 12,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  votedOption: {
    borderColor: '#E57373',
    borderWidth: 2,
    backgroundColor: 'rgba(229, 115, 115, 0.05)',
  },
  optionContent: {
    flex: 1,
    zIndex: 2,
  },
  optionText: {
    fontSize: 14,
  },
  voteCount: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  checkmarkContainer: {
    marginLeft: 8,
    zIndex: 2,
  },
  percentageBarContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    zIndex: 1,
  },
  percentageBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#E0E0E0',
    opacity: 0.5,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: 'bold',
    position: 'absolute',
    right: 12,
    color: '#555',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerLeft: {
    flex: 1,
    marginRight: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  toggleHint: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
  },
  totalVotes: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#888',
  },
  errorContainer: {
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF6B6B',
  },
});
