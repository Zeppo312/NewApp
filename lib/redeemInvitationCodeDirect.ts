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

    // Debugging: Direkte Suche in der Tabelle, ohne RPC, um Fehlerquellen auszuschließen
    console.log('Direct table query to find invitation_code...');
    const { data: directQueryData, error: directQueryError } = await supabase
      .from('account_links')
      .select('id, invitation_code, status, creator_id, invited_id, expires_at')
      .order('created_at', { ascending: false });
      
    if (directQueryError) {
      console.error('Error in direct table query:', directQueryError);
    } else {
      console.log(`Direct query found ${directQueryData?.length || 0} total invitations`);
      
      // Manuelles Filtern, um Probleme mit der Groß-/Kleinschreibung zu identifizieren
      const exactMatches = directQueryData?.filter(inv => inv.invitation_code === cleanedCode) || [];
      const caseInsensitiveMatches = directQueryData?.filter(inv => 
        inv.invitation_code.toUpperCase() === cleanedCode.toUpperCase()) || [];
      
      console.log(`Exact matches found: ${exactMatches.length}`);
      exactMatches.forEach((inv, i) => {
        console.log(`Exact match ${i+1}: ID: ${inv.id}, Code: '${inv.invitation_code}', Status: ${inv.status}`);
      });
      
      console.log(`Case-insensitive matches found: ${caseInsensitiveMatches.length}`);
      caseInsensitiveMatches.forEach((inv, i) => {
        console.log(`Case-insensitive match ${i+1}: ID: ${inv.id}, Code: '${inv.invitation_code}', Status: ${inv.status}`);
      });
      
      // Prüfen auf fast-Übereinstimmungen (Levenshtein-Ähnlichkeit simulieren)
      const almostMatches = directQueryData?.filter(inv => {
        if (inv.invitation_code.length !== cleanedCode.length) return false;
        let differentChars = 0;
        for (let i = 0; i < inv.invitation_code.length; i++) {
          if (inv.invitation_code[i].toUpperCase() !== cleanedCode[i].toUpperCase()) {
            differentChars++;
          }
        }
        return differentChars <= 2; // Höchstens 2 unterschiedliche Zeichen
      }) || [];
      
      if (almostMatches.length > 0 && exactMatches.length === 0 && caseInsensitiveMatches.length === 0) {
        console.log(`Found ${almostMatches.length} almost matching codes:`);
        almostMatches.forEach((inv, i) => {
          console.log(`Almost match ${i+1}: ID: ${inv.id}, Code: '${inv.invitation_code}', Status: ${inv.status}`);
        });
      }
    }
    
    // Debugging: Suche nach dem Einladungscode mit der RPC-Funktion
    console.log('Debugging with RPC: Searching for invitation code...');
    const { data: debugData, error: debugError } = await supabase.rpc('debug_find_invitation_code', {
      p_code: cleanedCode
    });

    if (debugError) {
      console.error('Error debugging invitation code with RPC:', debugError);
    } else {
      console.log('Debug RPC results:', debugData);

      if (debugData && debugData.length > 0) {
        console.log(`Found ${debugData.length} matching invitation(s) with RPC:`);
        debugData.forEach((inv, i) => {
          console.log(`${i + 1}. ID: ${inv.id}, Code: '${inv.invitation_code}', Status: ${inv.status}, Exact match: ${inv.exact_match}, Case-insensitive match: ${inv.case_insensitive_match}`);
        });
      } else {
        console.log('No matching invitations found in RPC debug search');
      }
    }

    // Überprüfen, ob wir versuchen sollten, die originale Version des Codes zu verwenden,
    // falls wir ihn in der direkten Suche gefunden haben, aber nicht exakt übereinstimmend
    let codeToUse = cleanedCode;
    const directQueryMatches = directQueryData?.filter(inv => 
      inv.invitation_code.toUpperCase() === cleanedCode.toUpperCase()) || [];
      
    if (directQueryMatches.length > 0 && !(directQueryMatches[0].invitation_code === cleanedCode)) {
      // Wir haben einen Treffer gefunden, aber die Groß-/Kleinschreibung stimmt nicht überein
      // Verwenden der exakten Schreibweise aus der Datenbank
      codeToUse = directQueryMatches[0].invitation_code;
      console.log(`Using exact code from database: '${codeToUse}' instead of '${cleanedCode}'`);
    }
    
    // Direkt die RPC-Funktion aufrufen, um den Einladungscode einzulösen
    // Verwenden der neuen Funktion, die auch Benutzerinformationen zurückgibt und den ET synchronisiert
    console.log(`Calling redeem_invitation_code_and_sync_due_date RPC function with code: '${codeToUse}'...`);
    const { data: rpcData, error: rpcError } = await supabase.rpc('redeem_invitation_code_and_sync_due_date', {
      p_invitation_code: codeToUse,
      p_user_id: userId
    });

    if (rpcError) {
      console.error('Error redeeming invitation code with RPC:', rpcError);

      // Versuchen, eine detailliertere Fehlermeldung zu extrahieren
      let errorMessage = 'Fehler beim Einlösen des Einladungscodes.';

      if (rpcError.message) {
        console.log('RPC error message:', rpcError.message);
        
        if (rpcError.message.includes('not found')) {
          errorMessage = 'Einladungscode nicht gefunden.';
          
          // Versuchen, einen ähnlichen Code zu finden
          const almostMatches = directQueryData?.filter(inv => {
            if (inv.invitation_code.length !== cleanedCode.length) return false;
            let differentChars = 0;
            for (let i = 0; i < inv.invitation_code.length; i++) {
              if (inv.invitation_code[i].toUpperCase() !== cleanedCode[i].toUpperCase()) {
                differentChars++;
              }
            }
            return differentChars <= 2; // Höchstens 2 unterschiedliche Zeichen
          }) || [];
          
          if (almostMatches.length > 0) {
            const suggestions = almostMatches.map(m => m.invitation_code).join(', ');
            errorMessage = `Ungültiger Einladungscode. Vielleicht meintest du: ${suggestions}?`;
          }
        } else if (rpcError.message.includes('expired')) {
          errorMessage = 'Dieser Einladungscode ist abgelaufen.';
        } else if (rpcError.message.includes('own invitation')) {
          errorMessage = 'Sie können Ihre eigene Einladung nicht einlösen.';
        } else if (rpcError.message.includes('already used') || rpcError.message.includes('already accepted')) {
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
