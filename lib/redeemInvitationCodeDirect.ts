import { supabase } from './supabase';

/**
 * Löst einen Einladungscode direkt über die RPC-Funktion ein
 * Diese Funktion umgeht die RLS-Richtlinien und sollte zuverlässiger funktionieren
 */
export const redeemInvitationCodeDirect = async (userId: string, invitationCode: string) => {
  try {
    if (!userId) {
      console.error('redeemInvitationCodeDirect called with empty userId');
      return {
        success: false,
        error: { message: 'Benutzer-ID fehlt. Bitte melden Sie sich erneut an.' }
      };
    }

    if (!invitationCode) {
      console.error('redeemInvitationCodeDirect called with empty invitationCode');
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

    console.log(`Attempting to redeem invitation code directly: '${cleanedCode}' for user: ${userId}`);

    // Debugging: Suche nach dem Einladungscode
    console.log('Debugging: Searching for invitation code...');
    const { data: debugData, error: debugError } = await supabase.rpc('debug_find_invitation_code', {
      p_code: cleanedCode
    });

    if (debugError) {
      console.error('Error debugging invitation code:', debugError);
    } else {
      console.log('Debug results:', debugData);
      
      if (debugData && debugData.length > 0) {
        console.log(`Found ${debugData.length} matching invitation(s):`);
        debugData.forEach((inv, i) => {
          console.log(`${i + 1}. ID: ${inv.id}, Code: ${inv.invitation_code}, Status: ${inv.status}, Exact match: ${inv.exact_match}, Case-insensitive match: ${inv.case_insensitive_match}`);
        });
      } else {
        console.log('No matching invitations found in debug search');
      }
    }

    // Direkt die RPC-Funktion aufrufen, um den Einladungscode einzulösen
    console.log('Calling redeem_invitation_by_code RPC function...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('redeem_invitation_by_code', {
      p_invitation_code: cleanedCode,
      p_user_id: userId
    });

    if (rpcError) {
      console.error('Error redeeming invitation code with RPC:', rpcError);
      
      // Versuchen, eine detailliertere Fehlermeldung zu extrahieren
      let errorMessage = 'Fehler beim Einlösen des Einladungscodes.';
      
      if (rpcError.message) {
        if (rpcError.message.includes('not found')) {
          errorMessage = 'Einladungscode nicht gefunden.';
        } else if (rpcError.message.includes('expired')) {
          errorMessage = 'Dieser Einladungscode ist abgelaufen.';
        } else if (rpcError.message.includes('own invitation')) {
          errorMessage = 'Sie können Ihre eigene Einladung nicht einlösen.';
        } else if (rpcError.message.includes('already used')) {
          errorMessage = 'Diese Einladung wurde bereits verwendet.';
        }
      }
      
      return {
        success: false,
        error: { message: errorMessage, details: rpcError.message }
      };
    }

    console.log('RPC function result:', rpcData);
    
    if (!rpcData || !rpcData.success) {
      const errorMessage = rpcData?.error || 'Unbekannter Fehler beim Einlösen des Einladungscodes.';
      return {
        success: false,
        error: { message: errorMessage }
      };
    }

    return {
      success: true,
      linkData: rpcData.data
    };
  } catch (error) {
    console.error('Unexpected error in redeemInvitationCodeDirect:', error);
    return {
      success: false,
      error: { message: `Ein unerwarteter Fehler ist aufgetreten: ${error.message || 'Unbekannter Fehler'}. Bitte versuche es später erneut.` }
    };
  }
};
