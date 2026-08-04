import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import {
  GLASS_OVERLAY,
  GLASS_OVERLAY_DARK,
  LAYOUT_PAD,
  LiquidGlassCard,
} from '@/constants/DesignGuide';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getCachedUserProfile, invalidateUserProfileCache } from '@/lib/appCache';
import {
  convertStartupMessageToDraft,
  DEFAULT_STARTUP_MESSAGE_DRAFT,
  deleteStartupMessage,
  listStartupMessagesForAdmin,
  saveStartupMessage,
  type StartupMessage,
  type StartupMessageContentType,
  type StartupMessageDraft,
} from '@/lib/startupMessages';

const formatAdminDate = (value: string, localeTag: string, unknown: string) => {
  if (!value) return unknown;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return unknown;
  }

  return date.toLocaleString(localeTag);
};

export default function StartupMessageAdminScreen() {
  const { locale, localeTag } = useLocale();
  const c = locale === 'en' ? {
    unknown: 'Unknown', text: 'Text', textDesc: 'Plain text shown directly in the popup.', html: 'HTML', htmlDesc: 'HTML content in the embedded viewer.', web: 'Website', webDesc: 'External HTTPS page in the popup.', hintText: 'Short release notes or notices as text.', hintHtml: 'HTML is rendered in the popup with JavaScript disabled.', hintWeb: 'The HTTPS page is loaded directly in the popup.', loadFailed: 'Startup messages could not be loaded.', saved: 'Saved', updated: 'The startup message was updated.', created: 'The new startup message was created.', saveFailed: 'The startup message could not be saved.', deleteTitle: 'Delete message', deleteQuestion: 'Do you really want to delete this startup message? Existing confirmations remain removed historically.', cancel: 'Cancel', delete: 'Delete', deleteFailed: 'The startup message could not be deleted.', title: 'Startup messages', subtitle: 'Manage popup messages shown when the app starts', loading: 'Loading startup messages …', adminsOnly: 'This section is only for admins with profiles.is_admin = true.', editor: 'Editor', editorText: 'Create a new message or edit an existing one.', new: 'New', info: 'To show a message to everyone again, create a new one. Messages already confirmed with “Okay” stay hidden for that user.', fieldTitle: 'Title', titlePlaceholder: 'e.g. New update available', intro: 'Short introduction', introPlaceholder: 'Optional teaser below the title', displayType: 'Display type', url: 'HTTPS URL', content: 'Message', contentPlaceholder: 'Add release notes or a notice here.', button: 'Button text', active: 'Active immediately', activeHint: 'Only active messages are shown when the app starts.', saveChanges: 'Save changes', createMessage: 'Create message', existing: 'Existing messages', existingHint: 'Each user sees the newest active message they have not confirmed.', empty: 'No startup messages yet.', activeStatus: 'Active', inactiveStatus: 'Inactive', type: 'Type', lastUpdated: 'Updated',
  } : locale === 'es' ? {
    unknown: 'Desconocido', text: 'Texto', textDesc: 'Texto sencillo directamente en la ventana.', html: 'HTML', htmlDesc: 'Contenido HTML en el visor integrado.', web: 'Sitio web', webDesc: 'Página HTTPS externa dentro de la ventana.', hintText: 'Notas de versión o avisos breves en texto.', hintHtml: 'El HTML se muestra con JavaScript desactivado.', hintWeb: 'La página HTTPS se carga directamente en la ventana.', loadFailed: 'No se pudieron cargar los mensajes de inicio.', saved: 'Guardado', updated: 'El mensaje de inicio se ha actualizado.', created: 'El nuevo mensaje se ha creado.', saveFailed: 'No se pudo guardar el mensaje.', deleteTitle: 'Eliminar mensaje', deleteQuestion: '¿Quieres eliminar este mensaje de inicio? Las confirmaciones existentes seguirán eliminadas del historial.', cancel: 'Cancelar', delete: 'Eliminar', deleteFailed: 'No se pudo eliminar el mensaje.', title: 'Mensajes de inicio', subtitle: 'Gestiona las ventanas que aparecen al iniciar la app', loading: 'Cargando mensajes de inicio …', adminsOnly: 'Esta sección solo está disponible para administradores con profiles.is_admin = true.', editor: 'Editor', editorText: 'Crea un mensaje o modifica uno existente.', new: 'Nuevo', info: 'Para volver a mostrar un mensaje a todos, crea uno nuevo. Los mensajes ya confirmados seguirán ocultos para ese usuario.', fieldTitle: 'Título', titlePlaceholder: 'p. ej., nueva actualización disponible', intro: 'Introducción breve', introPlaceholder: 'Texto opcional bajo el título', displayType: 'Tipo de visualización', url: 'URL HTTPS', content: 'Mensaje', contentPlaceholder: 'Añade aquí notas de versión o avisos.', button: 'Texto del botón', active: 'Activo de inmediato', activeHint: 'Solo los mensajes activos aparecen al iniciar la app.', saveChanges: 'Guardar cambios', createMessage: 'Crear mensaje', existing: 'Mensajes existentes', existingHint: 'Cada usuario ve el mensaje activo más reciente que no haya confirmado.', empty: 'Aún no hay mensajes de inicio.', activeStatus: 'Activo', inactiveStatus: 'Inactivo', type: 'Tipo', lastUpdated: 'Actualizado',
  } : {
    unknown: 'Unbekannt', text: 'Text', textDesc: 'Einfacher Text direkt im Popup.', html: 'HTML', htmlDesc: 'HTML-Inhalt im eingebetteten Viewer.', web: 'Webseite', webDesc: 'Externe HTTPS-Seite direkt im Popup.', hintText: 'Kurze Release Notes oder Hinweise als Text.', hintHtml: 'HTML wird im Popup mit deaktiviertem JavaScript gerendert.', hintWeb: 'Die HTTPS-Seite wird direkt im Popup geladen.', loadFailed: 'Die Startmeldungen konnten nicht geladen werden.', saved: 'Gespeichert', updated: 'Die Startmeldung wurde aktualisiert.', created: 'Die neue Startmeldung wurde angelegt.', saveFailed: 'Die Startmeldung konnte nicht gespeichert werden.', deleteTitle: 'Nachricht löschen', deleteQuestion: 'Willst du diese Startmeldung wirklich löschen? Bereits bestätigte Einträge bleiben historisch entfernt.', cancel: 'Abbrechen', delete: 'Löschen', deleteFailed: 'Die Startmeldung konnte nicht gelöscht werden.', title: 'Startmeldungen', subtitle: 'Popup-Nachrichten für den App-Start verwalten', loading: 'Startmeldungen werden geladen …', adminsOnly: 'Dieser Bereich ist nur für Admins mit profiles.is_admin = true.', editor: 'Editor', editorText: 'Neue Nachricht anlegen oder bestehende Nachricht anpassen.', new: 'Neu', info: 'Für eine erneute Ausspielung an alle Nutzer am besten eine neue Nachricht anlegen. Bereits mit „Okay“ bestätigte Nachrichten bleiben pro Nutzer ausgeblendet.', fieldTitle: 'Titel', titlePlaceholder: 'z. B. Neues Update verfügbar', intro: 'Kurze Einleitung', introPlaceholder: 'Optionaler Teaser unter dem Titel', displayType: 'Anzeigetyp', url: 'HTTPS-URL', content: 'Nachricht', contentPlaceholder: 'Hier stehen deine Release Notes oder Hinweise.', button: 'Button-Text', active: 'Sofort aktiv', activeHint: 'Nur aktive Nachrichten werden beim App-Start angezeigt.', saveChanges: 'Änderungen speichern', createMessage: 'Nachricht anlegen', existing: 'Bestehende Nachrichten', existingHint: 'Die neueste aktive und noch nicht bestätigte Nachricht wird pro Nutzer beim Start gezeigt.', empty: 'Noch keine Startmeldungen angelegt.', activeStatus: 'Aktiv', inactiveStatus: 'Inaktiv', type: 'Typ', lastUpdated: 'Aktualisiert',
  };
  const contentTypeOptions: { value: StartupMessageContentType; label: string; description: string }[] = [
    { value: 'text', label: c.text, description: c.textDesc }, { value: 'html', label: c.html, description: c.htmlDesc }, { value: 'remote_url', label: c.web, description: c.webDesc },
  ];
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const adaptiveColors = useAdaptiveColors();
  const router = useRouter();
  const { session, user } = useAuth();

  const [isAuthorizing, setIsAuthorizing] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<StartupMessage[]>([]);
  const [draft, setDraft] = useState<StartupMessageDraft>({
    ...DEFAULT_STARTUP_MESSAGE_DRAFT,
  });
  const modeHint = draft.contentType === 'html' ? c.hintHtml : draft.contentType === 'remote_url' ? c.hintWeb : c.hintText;

  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const glassOverlay = isDark ? GLASS_OVERLAY_DARK : GLASS_OVERLAY;
  const trailingIconColor = isDark ? 'rgba(255,255,255,0.9)' : theme.tabIconDefault;

  useEffect(() => {
    let mounted = true;

    const loadScreen = async () => {
      try {
        await invalidateUserProfileCache();
        const profile = await getCachedUserProfile();
        if (!mounted) return;

        const nextIsAdmin = profile?.is_admin === true;
        setIsAdmin(nextIsAdmin);

        if (!nextIsAdmin) {
          setMessages([]);
          return;
        }

        const nextMessages = await listStartupMessagesForAdmin();
        if (!mounted) return;

        setMessages(nextMessages);
        if (nextMessages.length > 0) {
          setDraft(convertStartupMessageToDraft(nextMessages[0]));
        }
      } catch (error: any) {
        console.error('Failed to load startup message admin screen:', error);
        if (!mounted) return;
        setErrorMessage(
          c.loadFailed,
        );
      } finally {
        if (mounted) {
          setIsAuthorizing(false);
          setIsLoading(false);
        }
      }
    };

    if (!user) {
      setIsAdmin(false);
      setIsAuthorizing(false);
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }

    void loadScreen();

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleFieldChange = <K extends keyof StartupMessageDraft>(
    field: K,
    value: StartupMessageDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleCreateNew = () => {
    setDraft({ ...DEFAULT_STARTUP_MESSAGE_DRAFT });
    setErrorMessage(null);
  };

  const handleSelectMessage = (message: StartupMessage) => {
    setDraft(convertStartupMessageToDraft(message));
    setErrorMessage(null);
  };

  const reloadMessages = async (preferredId?: string) => {
    const nextMessages = await listStartupMessagesForAdmin();
    setMessages(nextMessages);

    if (preferredId) {
      const selectedMessage = nextMessages.find((item) => item.id === preferredId);
      if (selectedMessage) {
        setDraft(convertStartupMessageToDraft(selectedMessage));
        return;
      }
    }

    if (nextMessages.length > 0) {
      setDraft(convertStartupMessageToDraft(nextMessages[0]));
      return;
    }

    setDraft({ ...DEFAULT_STARTUP_MESSAGE_DRAFT });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const savedMessage = await saveStartupMessage(draft);
      await reloadMessages(savedMessage.id);
      Alert.alert(
        c.saved,
        draft.id
          ? c.updated
          : c.created,
      );
    } catch (error: any) {
      console.error('Failed to save startup message:', error);
      setErrorMessage(
        c.saveFailed,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft.id) {
      handleCreateNew();
      return;
    }

    Alert.alert(
      c.deleteTitle,
      c.deleteQuestion,
      [
        { text: c.cancel, style: 'cancel' },
        {
          text: c.delete,
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeletingId(draft.id!);
              setErrorMessage(null);
              try {
                await deleteStartupMessage(draft.id!);
                await reloadMessages();
              } catch (error: any) {
                console.error('Failed to delete startup message:', error);
                setErrorMessage(
                  c.deleteFailed,
                );
              } finally {
                setDeletingId(null);
              }
            })();
          },
        },
      ],
    );
  };

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
        />

        <Header
          title={c.title}
          subtitle={c.subtitle}
          showBackButton
          showBabySwitcher={false}
          onBackPress={() => router.push('/app-settings')}
        />

        {isAuthorizing || isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={theme.accent} />
            <ThemedText style={[styles.stateText, { color: textSecondary }]}>
              {c.loading}
            </ThemedText>
          </View>
        ) : !isAdmin ? (
          <View style={styles.centerState}>
            <IconSymbol name="lock.fill" size={22} color={textSecondary} />
            <ThemedText style={[styles.stateText, { color: textSecondary }]}>
              {c.adminsOnly}
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <LiquidGlassCard
              style={styles.sectionCard}
              intensity={26}
              overlayColor={glassOverlay}
            >
              <View style={styles.sectionHeaderRow}>
                <View>
                  <ThemedText style={styles.sectionTitle}>{c.editor}</ThemedText>
                  <ThemedText style={[styles.sectionDescription, { color: textSecondary }]}>
                    {c.editorText}
                  </ThemedText>
                </View>

                <TouchableOpacity style={styles.newButton} onPress={handleCreateNew}>
                  <IconSymbol name="plus" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.newButtonText}>{c.new}</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.infoBanner}>
                <IconSymbol name="info.circle.fill" size={16} color="#A55E3A" />
                <ThemedText style={styles.infoBannerText}>
                  {c.info}
                </ThemedText>
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={styles.label}>{c.fieldTitle}</ThemedText>
                <TextInput
                  value={draft.title}
                  onChangeText={(value) => handleFieldChange('title', value)}
                  placeholder={c.titlePlaceholder}
                  placeholderTextColor="rgba(125,90,80,0.55)"
                  style={[styles.input, { color: textPrimary }]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={styles.label}>{c.intro}</ThemedText>
                <TextInput
                  value={draft.summary}
                  onChangeText={(value) => handleFieldChange('summary', value)}
                  placeholder={c.introPlaceholder}
                  placeholderTextColor="rgba(125,90,80,0.55)"
                  style={[styles.input, { color: textPrimary }]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={styles.label}>{c.displayType}</ThemedText>
                <View style={styles.typeOptions}>
                  {contentTypeOptions.map((option) => {
                    const selected = draft.contentType === option.value;

                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.typeOption,
                          selected && styles.typeOptionSelected,
                        ]}
                        onPress={() => handleFieldChange('contentType', option.value)}
                      >
                        <ThemedText
                          style={[
                            styles.typeOptionTitle,
                            selected && styles.typeOptionTitleSelected,
                          ]}
                        >
                          {option.label}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.typeOptionDescription,
                            selected && styles.typeOptionDescriptionSelected,
                          ]}
                        >
                          {option.description}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <ThemedText style={[styles.fieldHint, { color: textSecondary }]}>
                  {modeHint}
                </ThemedText>
              </View>

              {draft.contentType === 'remote_url' ? (
                <View style={styles.fieldGroup}>
                  <ThemedText style={styles.label}>{c.url}</ThemedText>
                  <TextInput
                    value={draft.sourceUrl}
                    onChangeText={(value) => handleFieldChange('sourceUrl', value)}
                    placeholder="https://www.lottibaby.de/..."
                    placeholderTextColor="rgba(125,90,80,0.55)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.input, { color: textPrimary }]}
                  />
                </View>
              ) : (
                <View style={styles.fieldGroup}>
                  <ThemedText style={styles.label}>
                    {draft.contentType === 'html' ? 'HTML' : c.content}
                  </ThemedText>
                  <TextInput
                    value={draft.content}
                    onChangeText={(value) => handleFieldChange('content', value)}
                    placeholder={
                      draft.contentType === 'html'
                        ? '<h1>Release Notes</h1><p>...</p>'
                        : c.contentPlaceholder
                    }
                    placeholderTextColor="rgba(125,90,80,0.55)"
                    multiline
                    textAlignVertical="top"
                    style={[styles.textArea, { color: textPrimary }]}
                  />
                </View>
              )}

              <View style={styles.fieldGroup}>
                <ThemedText style={styles.label}>{c.button}</ThemedText>
                <TextInput
                  value={draft.buttonLabel}
                  onChangeText={(value) => handleFieldChange('buttonLabel', value)}
                  placeholder="Okay"
                  placeholderTextColor="rgba(125,90,80,0.55)"
                  style={[styles.input, { color: textPrimary }]}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <ThemedText style={styles.label}>{c.active}</ThemedText>
                  <ThemedText style={[styles.fieldHint, { color: textSecondary }]}>
                    {c.activeHint}
                  </ThemedText>
                </View>
                <Switch
                  value={draft.isActive}
                  onValueChange={(value) => handleFieldChange('isActive', value)}
                  trackColor={{ false: 'rgba(125,90,80,0.2)', true: '#D7A58B' }}
                  thumbColor={draft.isActive ? '#C9825C' : '#FFFFFF'}
                />
              </View>

              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <IconSymbol
                    name="exclamationmark.triangle.fill"
                    size={15}
                    color="#B05D5D"
                  />
                  <ThemedText style={styles.errorBannerText}>
                    {errorMessage}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.primaryButton, isSaving && styles.disabledButton]}
                  onPress={() => {
                    void handleSave();
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <IconSymbol name="checkmark.circle.fill" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.primaryButtonText}>
                        {draft.id ? c.saveChanges : c.createMessage}
                      </ThemedText>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    (!draft.id || deletingId === draft.id) && styles.disabledButton,
                  ]}
                  onPress={handleDelete}
                  disabled={!draft.id || deletingId === draft.id}
                >
                  {deletingId === draft.id ? (
                    <ActivityIndicator color="#A55E3A" />
                  ) : (
                    <>
                      <IconSymbol name="trash" size={16} color="#A55E3A" />
                      <ThemedText style={styles.secondaryButtonText}>
                        {c.delete}
                      </ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </LiquidGlassCard>

            <LiquidGlassCard
              style={styles.sectionCard}
              intensity={26}
              overlayColor={glassOverlay}
            >
              <ThemedText style={styles.sectionTitle}>{c.existing}</ThemedText>
              <ThemedText style={[styles.sectionDescription, { color: textSecondary }]}>
                {c.existingHint}
              </ThemedText>

              {messages.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol
                    name="text.bubble"
                    size={18}
                    color={textSecondary}
                  />
                  <ThemedText style={[styles.stateText, { color: textSecondary }]}>
                    {c.empty}
                  </ThemedText>
                </View>
              ) : (
                messages.map((message) => {
                  const isSelected = draft.id === message.id;

                  return (
                    <TouchableOpacity
                      key={message.id}
                      style={[
                        styles.messageRow,
                        isSelected && styles.messageRowSelected,
                      ]}
                      onPress={() => handleSelectMessage(message)}
                    >
                      <View style={styles.messageRowMain}>
                        <View style={styles.messageRowHeader}>
                          <ThemedText style={styles.messageTitle}>
                            {message.title}
                          </ThemedText>
                          <View
                            style={[
                              styles.statusChip,
                              message.is_active
                                ? styles.statusChipActive
                                : styles.statusChipInactive,
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.statusChipText,
                                message.is_active
                                  ? styles.statusChipTextActive
                                  : styles.statusChipTextInactive,
                              ]}
                            >
                              {message.is_active ? c.activeStatus : c.inactiveStatus}
                            </ThemedText>
                          </View>
                        </View>

                        <ThemedText style={[styles.messageMeta, { color: textSecondary }]}>
                          {c.type}: {message.content_type} · {c.lastUpdated}: {formatAdminDate(message.updated_at, localeTag, c.unknown)}
                        </ThemedText>

                        {message.summary ? (
                          <ThemedText style={[styles.messageSummary, { color: textSecondary }]}>
                            {message.summary}
                          </ThemedText>
                        ) : null}
                      </View>

                      <IconSymbol name="chevron.right" size={18} color={trailingIconColor} />
                    </TouchableOpacity>
                  );
                })
              )}
            </LiquidGlassCard>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 28,
    gap: 16,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  stateText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  sectionCard: {
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#5C4033',
  },
  sectionDescription: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#C9825C',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  newButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(201, 130, 92, 0.12)',
  },
  infoBannerText: {
    flex: 1,
    color: '#8A593E',
    fontSize: 13,
    lineHeight: 19,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5C4033',
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(201, 130, 92, 0.16)',
    fontSize: 15,
  },
  textArea: {
    minHeight: 160,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(201, 130, 92, 0.16)',
    fontSize: 15,
  },
  typeOptions: {
    gap: 10,
  },
  typeOption: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(201, 130, 92, 0.16)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  typeOptionSelected: {
    borderColor: 'rgba(201, 130, 92, 0.55)',
    backgroundColor: 'rgba(201, 130, 92, 0.16)',
  },
  typeOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5C4033',
    marginBottom: 4,
  },
  typeOptionTitleSelected: {
    color: '#A55E3A',
  },
  typeOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: '#7D5A50',
  },
  typeOptionDescriptionSelected: {
    color: '#8A593E',
  },
  fieldHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(201, 130, 92, 0.12)',
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  errorBannerText: {
    flex: 1,
    color: '#A14C4C',
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#C9825C',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(201, 130, 92, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#A55E3A',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(125,90,80,0.14)',
  },
  messageRowSelected: {
    backgroundColor: 'rgba(201, 130, 92, 0.08)',
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  messageRowMain: {
    flex: 1,
    gap: 6,
  },
  messageRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  messageTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#5C4033',
  },
  messageMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  messageSummary: {
    fontSize: 13,
    lineHeight: 18,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipActive: {
    backgroundColor: 'rgba(91, 113, 93, 0.14)',
  },
  statusChipInactive: {
    backgroundColor: 'rgba(125, 90, 80, 0.1)',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusChipTextActive: {
    color: '#5B715D',
  },
  statusChipTextInactive: {
    color: '#7D5A50',
  },
});
