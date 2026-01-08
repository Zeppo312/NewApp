import { supabase } from './supabase';

/**
 * Verbesserte Funktion zum Einlösen von Einladungscodes
 * Diese Version nutzt eine SECURITY DEFINER RPC, um RLS zu umgehen.
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

    console.log('Redeeming invitation code via RPC...');
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'redeem_invitation_code_and_sync_due_date',
      {
        p_invitation_code: cleanedCode,
        p_user_id: userId,
      },
    );

    if (rpcError) {
      console.error('Error redeeming invitation code via RPC:', rpcError);
      const detailParts = [
        rpcError.message,
        rpcError.details,
        rpcError.hint,
      ].filter(Boolean);
      return {
        success: false,
        error: {
          message: detailParts.length
            ? `Der Einladungscode konnte nicht eingelöst werden: ${detailParts.join(' | ')}`
            : 'Der Einladungscode konnte nicht eingelöst werden.',
        },
      };
    }

    if (!rpcData || !rpcData.success) {
      return {
        success: false,
        error: { message: rpcData?.error || 'Einladungscode nicht gefunden oder bereits verwendet.' },
      };
    }

    const linkData = rpcData.linkData ?? rpcData.data ?? null;
    const creatorId = linkData?.creator_id;

    if (creatorId) {
      try {
        const { data: syncResult, error: syncError } = await supabase.rpc(
          'sync_sleep_entries_for_partner',
          { p_inviter: creatorId, p_partner: userId },
        );

        if (syncError) {
          console.error('Error syncing existing sleep entries to new partner:', syncError);
        } else {
          console.log('Synced existing sleep entries to new partner:', syncResult);
        }
      } catch (syncErr) {
        console.error('Unhandled error while syncing sleep entries to new partner:', syncErr);
      }
    }

    return {
      success: true,
      linkData,
      creatorInfo: rpcData.creatorInfo ?? null,
      syncedData: rpcData.syncedData ?? null,
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
