import { Alert } from 'react-native';
import { supabase } from './supabase';

export interface ErrorDetail {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  context?: any;
}

export class SupabaseErrorHandler {
  
  // Check Supabase connection status
  static async checkConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      console.log('🔌 Checking Supabase connection...');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      if (error) {
        console.error('❌ Connection check failed:', error);
        return { 
          connected: false, 
          error: `Connection failed: ${error.message}` 
        };
      }
      
      console.log('✅ Supabase connection successful');
      return { connected: true };
      
    } catch (err) {
      console.error('💥 Connection check error:', err);
      return { 
        connected: false, 
        error: `Network error: ${err instanceof Error ? err.message : 'Unknown error'}` 
      };
    }
  }

  // Retry function with exponential backoff
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
          console.log(`🔄 Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        return await operation();
      } catch (error) {
        lastError = error;
        console.error(`❌ Attempt ${attempt + 1} failed:`, error);
        
        // Don't retry on certain errors
        if (!this.isRetryableError(error)) {
          break;
        }
        
        if (attempt === maxRetries) {
          console.error('💥 All retry attempts failed');
          break;
        }
      }
    }
    
    throw lastError;
  }

  // Determine if error is retryable
  static isRetryableError(error: any): boolean {
    // Network errors
    if (error?.code === 'NETWORK_ERROR') return true;
    if (error?.message?.includes('network') || error?.message?.includes('timeout')) return true;
    
    // Supabase specific retryable errors
    if (error?.code === 'PGRST301') return true; // Too many connections
    if (error?.status >= 500 && error?.status < 600) return true; // Server errors
    if (error?.status === 520) return true; // Cloudflare errors
    
    // Auth token issues
    if (error?.message?.includes('JWT')) return true;
    
    return false;
  }

  // Parse and categorize Supabase errors
  static parseError(error: any, context?: string): ErrorDetail {
    console.log('🔍 Parsing error:', error, 'Context:', context);
    console.log('🔍 Error type:', typeof error);
    console.log('🔍 Error keys:', Object.keys(error || {}));
    
    // Network/Connection errors
    if (!error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error occurred',
        userMessage: 'Ein unbekannter Fehler ist aufgetreten. Bitte versuche es erneut.',
        retryable: true,
        context
      };
    }

    // Supabase Auth Error Codes (from https://supabase.com/docs/guides/auth/debugging/error-codes)
    if (error.code && typeof error.code === 'string') {
      const authErrorMap: Record<string, { userMessage: string; retryable: boolean }> = {
        // Auth API Errors
        'invalid_credentials': {
          userMessage: 'Ungültige Anmeldedaten. Bitte überprüfe deine Eingaben.',
          retryable: false
        },
        'email_not_confirmed': {
          userMessage: 'E-Mail-Adresse nicht bestätigt. Bitte bestätige deine E-Mail.',
          retryable: false
        },
        'user_not_found': {
          userMessage: 'Benutzer nicht gefunden. Bitte melde dich erneut an.',
          retryable: false
        },
        'user_already_exists': {
          userMessage: 'Benutzer existiert bereits.',
          retryable: false
        },
        'weak_password': {
          userMessage: 'Passwort zu schwach. Bitte wähle ein stärkeres Passwort.',
          retryable: false
        },
        'email_exists': {
          userMessage: 'E-Mail-Adresse wird bereits verwendet.',
          retryable: false
        },
        'phone_exists': {
          userMessage: 'Telefonnummer wird bereits verwendet.',
          retryable: false
        },
        'signup_disabled': {
          userMessage: 'Registrierung ist deaktiviert.',
          retryable: false
        },
        'email_provider_disabled': {
          userMessage: 'E-Mail-Anmeldung ist deaktiviert.',
          retryable: false
        },
        'phone_provider_disabled': {
          userMessage: 'Telefon-Anmeldung ist deaktiviert.',
          retryable: false
        },
        'provider_disabled': {
          userMessage: 'OAuth-Provider ist deaktiviert.',
          retryable: false
        },
        'session_expired': {
          userMessage: 'Sitzung abgelaufen. Bitte melde dich erneut an.',
          retryable: true
        },
        'session_not_found': {
          userMessage: 'Sitzung nicht gefunden. Bitte melde dich erneut an.',
          retryable: true
        },
        'refresh_token_not_found': {
          userMessage: 'Token nicht gefunden. Bitte melde dich erneut an.',
          retryable: true
        },
        'refresh_token_already_used': {
          userMessage: 'Token bereits verwendet. Bitte melde dich erneut an.',
          retryable: true
        },
        'over_request_rate_limit': {
          userMessage: 'Zu viele Anfragen. Bitte warte einen Moment.',
          retryable: true
        },
        'over_email_send_rate_limit': {
          userMessage: 'Zu viele E-Mails gesendet. Bitte warte einen Moment.',
          retryable: true
        },
        'over_sms_send_rate_limit': {
          userMessage: 'Zu viele SMS gesendet. Bitte warte einen Moment.',
          retryable: true
        },
        'request_timeout': {
          userMessage: 'Anfrage-Timeout. Bitte versuche es erneut.',
          retryable: true
        },
        'validation_failed': {
          userMessage: 'Validierung fehlgeschlagen. Bitte überprüfe deine Eingaben.',
          retryable: false
        },
        'unexpected_failure': {
          userMessage: 'Unerwarteter Fehler aufgetreten. Bitte versuche es erneut.',
          retryable: true
        },
        'user_banned': {
          userMessage: 'Benutzer ist gesperrt.',
          retryable: false
        },
        'insufficient_aal': {
          userMessage: 'Multi-Faktor-Authentifizierung erforderlich.',
          retryable: false
        },
        'mfa_challenge_expired': {
          userMessage: 'MFA-Challenge abgelaufen. Bitte versuche es erneut.',
          retryable: true
        },
        'mfa_factor_not_found': {
          userMessage: 'MFA-Faktor nicht gefunden.',
          retryable: false
        },
        'reauthentication_needed': {
          userMessage: 'Erneute Authentifizierung erforderlich.',
          retryable: false
        },
        'reauthentication_not_valid': {
          userMessage: 'Erneute Authentifizierung fehlgeschlagen.',
          retryable: false
        },
        'flow_state_expired': {
          userMessage: 'Anmelde-Flow abgelaufen. Bitte versuche es erneut.',
          retryable: true
        },
        'flow_state_not_found': {
          userMessage: 'Anmelde-Flow nicht gefunden. Bitte versuche es erneut.',
          retryable: true
        },
        'bad_oauth_callback': {
          userMessage: 'OAuth-Callback-Fehler. Bitte versuche es erneut.',
          retryable: true
        },
        'bad_oauth_state': {
          userMessage: 'OAuth-State-Fehler. Bitte versuche es erneut.',
          retryable: true
        },
        'bad_code_verifier': {
          userMessage: 'Code-Verifier-Fehler. Bitte versuche es erneut.',
          retryable: true
        },
        'bad_jwt': {
          userMessage: 'JWT-Token ungültig. Bitte melde dich erneut an.',
          retryable: true
        },
        'bad_json': {
          userMessage: 'Ungültige JSON-Daten. Bitte überprüfe deine Eingaben.',
          retryable: false
        },
        'conflict': {
          userMessage: 'Datenbank-Konflikt. Bitte versuche es erneut.',
          retryable: true
        },
        'email_address_invalid': {
          userMessage: 'Ungültige E-Mail-Adresse.',
          retryable: false
        },
        'email_address_not_authorized': {
          userMessage: 'E-Mail-Adresse nicht autorisiert.',
          retryable: false
        },
        'email_conflict_identity_not_deletable': {
          userMessage: 'E-Mail-Konflikt. Bitte kontaktiere den Support.',
          retryable: false
        },
        'identity_already_exists': {
          userMessage: 'Identität existiert bereits.',
          retryable: false
        },
        'identity_not_found': {
          userMessage: 'Identität nicht gefunden.',
          retryable: false
        },
        'invite_not_found': {
          userMessage: 'Einladung nicht gefunden oder abgelaufen.',
          retryable: false
        },
        'manual_linking_disabled': {
          userMessage: 'Manuelles Verknüpfen ist deaktiviert.',
          retryable: false
        },
        'mfa_factor_name_conflict': {
          userMessage: 'MFA-Faktor-Name-Konflikt.',
          retryable: false
        },
        'mfa_ip_address_mismatch': {
          userMessage: 'IP-Adresse stimmt nicht überein.',
          retryable: false
        },
        'mfa_phone_enroll_not_enabled': {
          userMessage: 'MFA-Telefon-Anmeldung deaktiviert.',
          retryable: false
        },
        'mfa_phone_verify_not_enabled': {
          userMessage: 'MFA-Telefon-Verifizierung deaktiviert.',
          retryable: false
        },
        'mfa_totp_enroll_not_enabled': {
          userMessage: 'MFA-TOTP-Anmeldung deaktiviert.',
          retryable: false
        },
        'mfa_totp_verify_not_enabled': {
          userMessage: 'MFA-TOTP-Verifizierung deaktiviert.',
          retryable: false
        },
        'no_authorization': {
          userMessage: 'Keine Autorisierung. Bitte melde dich an.',
          retryable: false
        },
        'not_admin': {
          userMessage: 'Keine Admin-Berechtigung.',
          retryable: false
        },
        'oauth_provider_not_supported': {
          userMessage: 'OAuth-Provider nicht unterstützt.',
          retryable: false
        },
        'otp_disabled': {
          userMessage: 'OTP ist deaktiviert.',
          retryable: false
        },
        'otp_expired': {
          userMessage: 'OTP abgelaufen. Bitte versuche es erneut.',
          retryable: true
        },
        'phone_not_confirmed': {
          userMessage: 'Telefonnummer nicht bestätigt.',
          retryable: false
        },
        'provider_email_needs_verification': {
          userMessage: 'E-Mail-Verifizierung erforderlich.',
          retryable: false
        },
        'same_password': {
          userMessage: 'Neues Passwort muss sich vom alten unterscheiden.',
          retryable: false
        },
        'single_identity_not_deletable': {
          userMessage: 'Letzte Identität kann nicht gelöscht werden.',
          retryable: false
        },
        'sms_send_failed': {
          userMessage: 'SMS-Versand fehlgeschlagen.',
          retryable: true
        },
        'too_many_enrolled_mfa_factors': {
          userMessage: 'Zu viele MFA-Faktoren angemeldet.',
          retryable: false
        },
        'user_sso_managed': {
          userMessage: 'Benutzer wird von SSO verwaltet.',
          retryable: false
        },
        'anonymous_provider_disabled': {
          userMessage: 'Anonyme Anmeldung deaktiviert.',
          retryable: false
        },
        'captcha_failed': {
          userMessage: 'CAPTCHA-Fehler. Bitte versuche es erneut.',
          retryable: true
        },
        'hook_payload_invalid_content_type': {
          userMessage: 'Hook-Payload-Fehler.',
          retryable: false
        },
        'hook_payload_over_size_limit': {
          userMessage: 'Hook-Payload zu groß.',
          retryable: false
        },
        'hook_timeout': {
          userMessage: 'Hook-Timeout.',
          retryable: true
        },
        'hook_timeout_after_retry': {
          userMessage: 'Hook-Timeout nach Wiederholung.',
          retryable: true
        },
        'saml_assertion_no_email': {
          userMessage: 'SAML-Assertion ohne E-Mail.',
          retryable: false
        },
        'saml_assertion_no_user_id': {
          userMessage: 'SAML-Assertion ohne Benutzer-ID.',
          retryable: false
        },
        'saml_entity_id_mismatch': {
          userMessage: 'SAML-Entity-ID stimmt nicht überein.',
          retryable: false
        },
        'saml_idp_already_exists': {
          userMessage: 'SAML-IdP existiert bereits.',
          retryable: false
        },
        'saml_idp_not_found': {
          userMessage: 'SAML-IdP nicht gefunden.',
          retryable: false
        },
        'saml_metadata_fetch_failed': {
          userMessage: 'SAML-Metadaten-Abruf fehlgeschlagen.',
          retryable: true
        },
        'saml_provider_disabled': {
          userMessage: 'SAML-Provider deaktiviert.',
          retryable: false
        },
        'saml_relay_state_expired': {
          userMessage: 'SAML-Relay-State abgelaufen.',
          retryable: true
        },
        'saml_relay_state_not_found': {
          userMessage: 'SAML-Relay-State nicht gefunden.',
          retryable: true
        },
        'sso_domain_already_exists': {
          userMessage: 'SSO-Domain existiert bereits.',
          retryable: false
        },
        'sso_provider_not_found': {
          userMessage: 'SSO-Provider nicht gefunden.',
          retryable: false
        }
      };

      const authError = authErrorMap[error.code];
      if (authError) {
        return {
          code: error.code,
          message: error.message || `Auth error: ${error.code}`,
          userMessage: authError.userMessage,
          retryable: authError.retryable,
          context
        };
      }
    }

    // PostgreSQL/Database errors
    if (error.code) {
      switch (error.code) {
        case '23505': // Unique violation
          return {
            code: 'DUPLICATE_ENTRY',
            message: error.message,
            userMessage: 'Dieser Eintrag existiert bereits.',
            retryable: false,
            context
          };
        
        case '23503': // Foreign key violation
          return {
            code: 'INVALID_REFERENCE',
            message: error.message,
            userMessage: 'Ungültige Datenreferenz. Bitte überprüfe deine Eingaben.',
            retryable: false,
            context
          };
        
        case '23514': // Check constraint violation
          return {
            code: 'INVALID_DATA',
            message: error.message,
            userMessage: 'Die eingegebenen Daten sind ungültig.',
            retryable: false,
            context
          };
        
        case 'PGRST116': // No rows found
          return {
            code: 'NOT_FOUND',
            message: error.message,
            userMessage: 'Kein Eintrag gefunden.',
            retryable: false,
            context
          };
      }
    }

    // Auth errors
    if (error.message?.includes('JWT') || error.message?.includes('auth')) {
      return {
        code: 'AUTH_ERROR',
        message: error.message,
        userMessage: 'Authentifizierungsfehler. Bitte melde dich erneut an.',
        retryable: true,
        context
      };
    }

    // Network errors
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      return {
        code: 'NETWORK_ERROR',
        message: error.message,
        userMessage: 'Netzwerkfehler. Bitte überprüfe deine Internetverbindung.',
        retryable: true,
        context
      };
    }

    // Permission errors
    if (error.message?.includes('permission') || error.message?.includes('policy')) {
      return {
        code: 'PERMISSION_ERROR',
        message: error.message,
        userMessage: 'Keine Berechtigung für diese Aktion.',
        retryable: false,
        context
      };
    }

    // Generic Supabase errors
    if (error.status) {
      const statusCode = parseInt(error.status);
      
      if (statusCode >= 400 && statusCode < 500) {
        return {
          code: 'CLIENT_ERROR',
          message: error.message,
          userMessage: 'Fehlerhafte Anfrage. Bitte überprüfe deine Eingaben.',
          retryable: false,
          context
        };
      }
      
      if (statusCode >= 500) {
        return {
          code: 'SERVER_ERROR',
          message: error.message,
          userMessage: 'Serverfehler. Bitte versuche es später erneut.',
          retryable: true,
          context
        };
      }
    }

    // Default error
    return {
      code: 'GENERIC_ERROR',
      message: error.message || String(error),
      userMessage: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.',
      retryable: true,
      context
    };
  }

  // Show user-friendly error dialog
  static showError(errorDetail: ErrorDetail, onRetry?: () => void) {
    const buttons: any[] = [
      { text: 'OK', style: 'default' }
    ];

    if (errorDetail.retryable && onRetry) {
      buttons.unshift({
        text: 'Erneut versuchen',
        style: 'default',
        onPress: onRetry
      });
    }

    // Build detailed error message
    let errorMessage = errorDetail.userMessage;
    
    if (__DEV__) {
      errorMessage += '\n\n';
      errorMessage += `🔍 Debug Info:\n`;
      errorMessage += `Code: ${errorDetail.code}\n`;
      errorMessage += `Message: ${errorDetail.message}\n`;
      errorMessage += `Context: ${errorDetail.context || 'N/A'}\n`;
      errorMessage += `Retryable: ${errorDetail.retryable ? 'Ja' : 'Nein'}`;
    }

    Alert.alert(
      'Fehler aufgetreten',
      errorMessage,
      buttons
    );
  }

  // Enhanced logging for debugging
  static logError(errorDetail: ErrorDetail, operation: string) {
    console.group(`💥 ERROR in ${operation}`);
    console.error('🔍 Error Code:', errorDetail.code);
    console.error('📝 Error Message:', errorDetail.message);
    console.error('👤 User Message:', errorDetail.userMessage);
    console.error('🔄 Retryable:', errorDetail.retryable);
    console.error('📍 Context:', errorDetail.context);
    console.error('⏰ Timestamp:', new Date().toISOString());
    console.groupEnd();

    // Add to debug panel if available
    if (__DEV__ && (global as any).addDebugLog) {
      (global as any).addDebugLog({
        timestamp: new Date().toISOString(),
        operation,
        errorCode: errorDetail.code,
        errorMessage: errorDetail.message,
        userMessage: errorDetail.userMessage,
        context: errorDetail.context,
        retryable: errorDetail.retryable
      });
    }
  }

  // Execute operation with full error handling
  static async executeWithHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    showUserError: boolean = true,
    retries: number = 3
  ): Promise<{ success: boolean; data?: T; error?: ErrorDetail }> {
    try {
      console.log(`🚀 Starting operation: ${operationName}`);
      console.log(`⏰ Start time: ${new Date().toISOString()}`);
      
      // Check connection first
      const connectionStatus = await this.checkConnection();
      if (!connectionStatus.connected) {
        const errorDetail: ErrorDetail = {
          code: 'CONNECTION_FAILED',
          message: connectionStatus.error || 'Connection failed',
          userMessage: 'Keine Verbindung zur Datenbank. Bitte überprüfe deine Internetverbindung.',
          retryable: true,
          context: operationName
        };
        
        this.logError(errorDetail, operationName);
        if (showUserError) {
          this.showError(errorDetail, () => 
            this.executeWithHandling(operation, operationName, showUserError, retries)
          );
        }
        
        return { success: false, error: errorDetail };
      }

      // Execute with retry
      const result = await this.withRetry(operation, retries);
      console.log(`✅ Operation ${operationName} completed successfully`);
      console.log(`⏰ End time: ${new Date().toISOString()}`);
      
      return { success: true, data: result };
      
    } catch (error) {
      console.log(`💥 Caught error in ${operationName}:`, error);
      console.log(`💥 Error type:`, typeof error);
      console.log(`💥 Error constructor:`, error?.constructor?.name);
      
      const errorDetail = this.parseError(error, operationName);
      this.logError(errorDetail, operationName);
      
      if (showUserError) {
        this.showError(errorDetail, errorDetail.retryable ? () => 
          this.executeWithHandling(operation, operationName, showUserError, retries)
        : undefined);
      }
      
      return { success: false, error: errorDetail };
    }
  }
} 