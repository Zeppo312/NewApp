import { supabase } from './supabase';

/**
 * Verbesserte Funktion zum Einlösen von Einladungscodes
 * Diese Version verwendet direkten Datenbankzugriff statt RPC-Funktionen
 */
export const redeemInvitationCodeFixed = async (userId: string, invitationCode: string) => {
  try {
    if (!userId) {
      console.error('redeemInvitationCodeFixed called with empty userId');
      return {
        success: false,
        error: { message: 'Benutzer-ID fehlt. Bitte melden Sie sich erneut an.' }
      };
    }

    if (!invitationCode) {
      console.error('redeemInvitationCodeFixed called with empty invitationCode');
      return {
        success: false,
        error: { message: 'Bitte geben Sie einen Einladungscode ein.' }
      };
    }

    // Bereinigen des Einladungscodes (Leerzeichen entfernen und in Großbuchstaben umwandeln)
    console.log(`Original invitation code: '${invitationCode}' (length: ${invitationCode.length})`);

    // Entfernen aller Leerzeichen
    let cleanedCode = invitationCode.replace(/\s+/g, '');
    console.log(`After removing whitespace: '${cleanedCode}' (length: ${cleanedCode.length})`);

    // Umwandlung in Großbuchstaben
    cleanedCode = cleanedCode.toUpperCase();
    console.log(`After converting to uppercase: '${cleanedCode}' (length: ${cleanedCode.length})`);

    // SCHRITT 1: Suche nach dem Einladungscode in der Datenbank (case-insensitive)
    console.log('Searching for invitation code in database...');
    const { data: invitationData, error: searchError } = await supabase
      .from('account_links')
      .select('*')
      .ilike('invitation_code', cleanedCode)
      .is('invited_id', null)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (searchError) {
      console.error('Error searching for invitation code:', searchError);
      return {
        success: false,
        error: { message: 'Fehler beim Suchen des Einladungscodes.' }
      };
    }

    if (!invitationData || invitationData.length === 0) {
      console.log(`No pending invitation found with code: ${cleanedCode}`);
      
      // Versuche alle Einladungen zu finden (ohne Status-Filter)
      const { data: allInvitations } = await supabase
        .from('account_links')
        .select('id, invitation_code, status, expires_at, creator_id')
        .ilike('invitation_code', cleanedCode);
      
      if (allInvitations && allInvitations.length > 0) {
        const matchingInvitation = allInvitations[0];
        
        // Prüfe den Status und Grund
        if (matchingInvitation.status !== 'pending') {
          return {
            success: false,
            error: { message: 'Diese Einladung wurde bereits verwendet.' }
          };
        }
        
        if (matchingInvitation.expires_at && new Date(matchingInvitation.expires_at) <= new Date()) {
          return {
            success: false,
            error: { message: 'Dieser Einladungscode ist abgelaufen.' }
          };
        }
        
        if (matchingInvitation.creator_id === userId) {
          return {
            success: false,
            error: { message: 'Sie können Ihre eigene Einladung nicht einlösen.' }
          };
        }
      }
      
      return {
        success: false,
        error: { message: 'Einladungscode nicht gefunden oder bereits verwendet.' }
      };
    }

    const invitation = invitationData[0];
    
    // Prüfe, ob der Benutzer versucht, seine eigene Einladung einzulösen
    if (invitation.creator_id === userId) {
      return {
        success: false,
        error: { message: 'Sie können Ihre eigene Einladung nicht einlösen.' }
      };
    }
    
    // Prüfe, ob die Einladung abgelaufen ist
    if (invitation.expires_at && new Date(invitation.expires_at) <= new Date()) {
      return {
        success: false,
        error: { message: 'Dieser Einladungscode ist abgelaufen.' }
      };
    }

    // SCHRITT 2: Aktualisiere den Status der Einladung
    console.log(`Updating invitation status for ID: ${invitation.id}`);
    const { data: updateData, error: updateError } = await supabase
      .from('account_links')
      .update({
        invited_id: userId,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitation.id)
      .select();

    if (updateError) {
      console.error('Error updating invitation status:', updateError);
      return {
        success: false,
        error: { message: 'Fehler beim Aktualisieren des Einladungsstatus.' }
      };
    }

    if (!updateData || updateData.length === 0) {
      return {
        success: false,
        error: { message: 'Die Einladung konnte nicht aktualisiert werden.' }
      };
    }

    // SCHRITT 3: Abrufen der Benutzerinformationen des Erstellers
    const { data: creatorData, error: creatorError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, user_role')
      .eq('id', invitation.creator_id)
      .single();

    if (creatorError) {
      console.error('Error fetching creator info:', creatorError);
      // Wir geben trotzdem success zurück, da die Einladung akzeptiert wurde
    }

    // SCHRITT 4: Synchronisieren des Entbindungstermins (optional)
    let syncedDueDate = null;
    try {
      const { data: creatorSettings } = await supabase
        .from('user_settings')
        .select('due_date, is_baby_born')
        .eq('user_id', invitation.creator_id)
        .single();

      if (creatorSettings && creatorSettings.due_date) {
        // Prüfen, ob der eingeladene Benutzer bereits Einstellungen hat
        const { data: userSettingsExists } = await supabase
          .from('user_settings')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (userSettingsExists) {
          // Aktualisieren der bestehenden Einstellungen
          await supabase
            .from('user_settings')
            .update({
              due_date: creatorSettings.due_date,
              is_baby_born: creatorSettings.is_baby_born,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
        } else {
          // Erstellen neuer Einstellungen
          await supabase
            .from('user_settings')
            .insert({
              user_id: userId,
              due_date: creatorSettings.due_date,
              is_baby_born: creatorSettings.is_baby_born,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        }

        syncedDueDate = {
          dueDate: creatorSettings.due_date,
          isBabyBorn: creatorSettings.is_baby_born
        };
      }
    } catch (syncError) {
      console.error('Error syncing due date:', syncError);
      // Ignorieren des Fehlers, da die Einladung trotzdem akzeptiert wurde
    }

    // Erfolg zurückgeben
    return {
      success: true,
      linkData: updateData[0],
      creatorInfo: creatorData || null,
      syncedData: syncedDueDate
    };
  } catch (error: any) {
    console.error('Unexpected error in redeemInvitationCodeFixed:', error);
    return {
      success: false,
      error: { 
        message: `Ein unerwarteter Fehler ist aufgetreten: ${error?.message || 'Unbekannter Fehler'}. Bitte versuche es später erneut.` 
      }
    };
  }
};
