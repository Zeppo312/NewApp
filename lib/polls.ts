import { supabase } from './supabase';

// Typdefinitionen
export interface Poll {
  id: string;
  post_id: string;
  question: string;
  allow_multiple_choices: boolean;
  created_at: string;
  updated_at: string;
  options?: PollOption[];
  user_votes?: string[]; // IDs der Optionen, für die der aktuelle Benutzer gestimmt hat
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  created_at: string;
  updated_at: string;
  votes_count?: number;
  percentage?: number;
  has_voted?: boolean;
}

export interface CreatePollData {
  question: string;
  options: string[];
  allow_multiple_choices?: boolean;
}

// Umfrage für einen Post erstellen
export const createPoll = async (postId: string, pollData: CreatePollData) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Umfrage erstellen
    const { data: poll, error: pollError } = await supabase
      .from('community_polls')
      .insert({
        post_id: postId,
        question: pollData.question,
        allow_multiple_choices: pollData.allow_multiple_choices || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (pollError) {
      console.error('Error creating poll:', pollError);
      return { data: null, error: pollError };
    }

    // Optionen für die Umfrage erstellen
    const optionsToInsert = pollData.options.map(option => ({
      poll_id: poll.id,
      option_text: option,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data: options, error: optionsError } = await supabase
      .from('community_poll_options')
      .insert(optionsToInsert)
      .select();

    if (optionsError) {
      console.error('Error creating poll options:', optionsError);
      return { data: { poll, options: [] }, error: optionsError };
    }

    return { data: { poll, options }, error: null };
  } catch (err) {
    console.error('Failed to create poll:', err);
    return { data: null, error: err };
  }
};

// Umfrage mit Optionen abrufen
export const getPoll = async (pollId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Umfrage abrufen
    const { data: poll, error: pollError } = await supabase
      .from('community_polls')
      .select()
      .eq('id', pollId)
      .single();

    if (pollError) {
      console.error('Error fetching poll:', pollError);
      return { data: null, error: pollError };
    }

    // Optionen mit Ergebnissen abrufen
    const { data: results, error: resultsError } = await supabase
      .rpc('get_poll_results', { poll_id_param: pollId });

    if (resultsError) {
      console.error('Error fetching poll results:', resultsError);
      return { data: { ...poll, options: [] }, error: resultsError };
    }

    // Benutzerabstimmungen abrufen
    const { data: userVotes, error: votesError } = await supabase
      .from('community_poll_votes')
      .select('option_id')
      .eq('user_id', userData.user.id);

    if (votesError) {
      console.error('Error fetching user votes:', votesError);
    }

    // Optionen mit Benutzerabstimmungen kombinieren
    const optionsWithVotes = results.map(option => ({
      ...option,
      has_voted: userVotes ? userVotes.some(vote => vote.option_id === option.option_id) : false
    }));

    return {
      data: {
        ...poll,
        options: optionsWithVotes,
        user_votes: userVotes ? userVotes.map(vote => vote.option_id) : []
      },
      error: null
    };
  } catch (err) {
    console.error('Failed to get poll:', err);
    return { data: null, error: err };
  }
};

// Umfragen für einen Post abrufen
export const getPollsByPostId = async (postId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Umfragen für den Post abrufen
    const { data: polls, error: pollsError } = await supabase
      .from('community_polls')
      .select()
      .eq('post_id', postId);

    if (pollsError) {
      console.error('Error fetching polls for post:', pollsError);
      return { data: null, error: pollsError };
    }

    // Für jede Umfrage die Optionen und Ergebnisse abrufen
    const pollsWithOptions = await Promise.all(polls.map(async (poll) => {
      const { data: pollData } = await getPoll(poll.id);
      return pollData;
    }));

    return { data: pollsWithOptions, error: null };
  } catch (err) {
    console.error('Failed to get polls for post:', err);
    return { data: null, error: err };
  }
};

// Für eine Option abstimmen oder Stimme zurückziehen
export const voteForOption = async (optionId: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { data: null, error: new Error('Nicht angemeldet') };

    // Prüfen, zu welcher Umfrage die Option gehört
    const { data: option, error: optionError } = await supabase
      .from('community_poll_options')
      .select('poll_id')
      .eq('id', optionId)
      .single();

    if (optionError) {
      console.error('Error fetching option:', optionError);
      return { data: null, error: optionError };
    }

    // Prüfen, ob der Benutzer bereits für diese Option gestimmt hat
    const { data: existingVote, error: existingVoteError } = await supabase
      .from('community_poll_votes')
      .select('id')
      .eq('option_id', optionId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    // Wenn der Benutzer bereits für diese Option gestimmt hat, entferne die Stimme (Toggle)
    if (existingVote) {
      console.log('User already voted for this option, removing vote');
      const { data: deleteData, error: deleteError } = await supabase
        .from('community_poll_votes')
        .delete()
        .eq('id', existingVote.id);

      if (deleteError) {
        console.error('Error removing vote:', deleteError);
        return { data: null, error: deleteError };
      }

      return { data: { voted: false }, error: null };
    }

    // Prüfen, ob die Umfrage mehrere Auswahlmöglichkeiten erlaubt
    const { data: poll, error: pollError } = await supabase
      .from('community_polls')
      .select('allow_multiple_choices')
      .eq('id', option.poll_id)
      .single();

    if (pollError) {
      console.error('Error fetching poll:', pollError);
      return { data: null, error: pollError };
    }

    // Wenn keine Mehrfachauswahl erlaubt ist, vorherige Stimmen des Benutzers für diese Umfrage löschen
    if (!poll.allow_multiple_choices) {
      const { data: existingVotes, error: votesError } = await supabase
        .from('community_poll_votes')
        .select('id, option_id')
        .eq('user_id', userData.user.id);

      if (votesError) {
        console.error('Error fetching existing votes:', votesError);
      } else if (existingVotes && existingVotes.length > 0) {
        // Prüfen, ob die existierenden Stimmen zu dieser Umfrage gehören
        const existingVoteIds = [];

        for (const vote of existingVotes) {
          const { data: voteOption } = await supabase
            .from('community_poll_options')
            .select('poll_id')
            .eq('id', vote.option_id)
            .single();

          if (voteOption && voteOption.poll_id === option.poll_id) {
            existingVoteIds.push(vote.id);
          }
        }

        if (existingVoteIds.length > 0) {
          console.log('Removing existing votes for this poll:', existingVoteIds);
          const { error: deleteError } = await supabase
            .from('community_poll_votes')
            .delete()
            .in('id', existingVoteIds);

          if (deleteError) {
            console.error('Error deleting existing votes:', deleteError);
          }
        }
      }
    }

    // Neue Stimme hinzufügen
    console.log('Adding new vote for option:', optionId);
    const { data, error } = await supabase
      .from('community_poll_votes')
      .insert({
        option_id: optionId,
        user_id: userData.user.id,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error voting for option:', error);
      return { data: null, error };
    }

    return { data: { voted: true }, error: null };
  } catch (err) {
    console.error('Failed to vote for option:', err);
    return { data: null, error: err };
  }
};
