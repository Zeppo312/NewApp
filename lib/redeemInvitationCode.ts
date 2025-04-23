import { supabase } from './supabase';

// Funktion zum Einlösen eines Einladungscodes
export const redeemInvitationCode = async (userId: string, invitationCode: string) => {
  try {
    if (!userId) {
      console.error('redeemInvitationCode called with empty userId');
      return {
        success: false,
        error: { message: 'Benutzer-ID fehlt. Bitte melden Sie sich erneut an.' }
      };
    }

    if (!invitationCode) {
      console.error('redeemInvitationCode called with empty invitationCode');
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

    console.log(`Attempting to redeem invitation code: '${cleanedCode}' for user: ${userId}`);

    // Alle Einladungscodes abrufen, um zu debuggen
    const { data: allInvitations, error: listError } = await supabase
      .from('account_links')
      .select('id, invitation_code, status, expires_at, creator_id')
      .order('created_at', { ascending: false });

    if (listError) {
      console.error('Error listing all invitations:', listError);
      return {
        success: false,
        error: { message: 'Fehler beim Abrufen der Einladungen.' }
      };
    }

    console.log(`Found ${allInvitations.length} total invitations in database:`);
    allInvitations.forEach((inv, index) => {
      console.log(`${index + 1}. Code: '${inv.invitation_code}', Status: ${inv.status}, Expires: ${inv.expires_at}`);
    });

    // Direkte Suche nach dem Code in allen Einladungen
    const exactMatch = allInvitations.find(inv => inv.invitation_code === cleanedCode);
    
    if (exactMatch) {
      console.log('Found exact match in all invitations:', exactMatch);
      
      // Prüfen, ob der Code abgelaufen ist
      if (new Date(exactMatch.expires_at) <= new Date()) {
        console.log(`Code expired: ${exactMatch.expires_at}`);
        return {
          success: false,
          error: { message: `Dieser Einladungscode ist abgelaufen. Ablaufdatum: ${new Date(exactMatch.expires_at).toLocaleString()}` }
        };
      }
      
      // Prüfen, ob der Code bereits verwendet wurde
      if (exactMatch.status !== 'pending') {
        console.log(`Code already used: status=${exactMatch.status}`);
        return {
          success: false,
          error: { message: `Dieser Einladungscode wurde bereits verwendet. Status: ${exactMatch.status}` }
        };
      }
      
      // Prüfen, ob der Benutzer versucht, seinen eigenen Code einzulösen
      if (exactMatch.creator_id === userId) {
        console.log(`User trying to redeem own code: creator_id=${exactMatch.creator_id}, userId=${userId}`);
        return {
          success: false,
          error: { message: 'Sie können Ihre eigene Einladung nicht einlösen.' }
        };
      }
      
      // Aktualisieren des Einladungsstatus
      console.log(`Updating invitation status for ID: ${exactMatch.id}, setting invited_id to: ${userId}`);
      
      // Mehrere Methoden zur Aktualisierung versuchen
      try {
        // Methode 1: Direkte Aktualisierung
        console.log('Method 1: Direct update');
        const { data: updateData, error: updateError } = await supabase
          .from('account_links')
          .update({
            invited_id: userId,
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('id', exactMatch.id)
          .select();
          
        if (updateError) {
          console.error('Method 1 failed:', updateError);
          
          // Methode 2: Versuchen, die RPC-Funktion zu verwenden
          console.log('Method 2: Using RPC function');
          try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('direct_update_invitation', {
              p_invitation_id: exactMatch.id,
              p_user_id: userId
            });
            
            if (rpcError) {
              console.error('Method 2 failed:', rpcError);
              return {
                success: false,
                error: { message: 'Fehler beim Aktualisieren des Einladungsstatus. Bitte kontaktieren Sie den Support.' }
              };
            } else {
              console.log('Method 2 succeeded:', rpcData);
              return { success: true, linkData: rpcData };
            }
          } catch (rpcException) {
            console.error('Method 2 exception:', rpcException);
            return {
              success: false,
              error: { message: 'Fehler beim Aktualisieren des Einladungsstatus. Bitte kontaktieren Sie den Support.' }
            };
          }
        }
        
        // Wenn die erste Methode erfolgreich war
        if (!updateData || updateData.length === 0) {
          console.error('Update returned no data');
          return {
            success: false,
            error: { message: 'Die Einladung konnte nicht aktualisiert werden.' }
          };
        }
        
        console.log('Invitation successfully accepted:', updateData[0]);
        return { success: true, linkData: updateData[0] };
      } catch (updateError) {
        console.error('Exception during invitation update:', updateError);
        return {
          success: false,
          error: { message: 'Ein unerwarteter Fehler ist beim Aktualisieren der Einladung aufgetreten.' }
        };
      }
    } else {
      // Suche nach ähnlichen Codes (Groß-/Kleinschreibung ignorieren)
      const similarCodes = allInvitations.filter(inv =>
        inv.invitation_code.toLowerCase() === cleanedCode.toLowerCase());

      if (similarCodes.length > 0) {
        console.log('Found similar codes with different casing:', similarCodes);
        return {
          success: false,
          error: { message: `Ähnlicher Code gefunden: ${similarCodes[0].invitation_code}. Bitte geben Sie den Code exakt ein.` }
        };
      }
      
      // Suche nach ähnlichen Codes (Levenshtein-Distanz)
      const possibleMatches = allInvitations
        .filter(inv => inv.status === 'pending')
        .map(inv => ({
          id: inv.id,
          code: inv.invitation_code,
          // Einfache Ähnlichkeitsberechnung: Anzahl der übereinstimmenden Zeichen
          similarity: Array.from(inv.invitation_code).filter((c, i) => i < cleanedCode.length && c === cleanedCode[i]).length
        }))
        .filter(match => match.similarity >= Math.min(4, cleanedCode.length - 1)) // Mindestens 4 übereinstimmende Zeichen oder fast alle
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3); // Top 3 Ähnlichkeiten

      if (possibleMatches.length > 0) {
        console.log('Possible similar codes:', possibleMatches);
        const suggestions = possibleMatches.map(m => m.code).join(', ');
        return {
          success: false,
          error: { message: `Ungültiger Einladungscode. Möglicherweise meinten Sie: ${suggestions}` }
        };
      }
      
      // Generischer Fehler, wenn kein spezifischer Grund gefunden wurde
      return {
        success: false,
        error: { message: `Ungültiger Einladungscode: '${cleanedCode}'. Bitte prüfe, ob du den Code korrekt eingegeben hast.` }
      };
    }
  } catch (error) {
    console.error('Unexpected error in redeemInvitationCode:', error);
    return {
      success: false,
      error: { message: `Ein unerwarteter Fehler ist aufgetreten: ${error.message || 'Unbekannter Fehler'}. Bitte versuche es später erneut.` }
    };
  }
};
