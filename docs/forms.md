# Gemeinsame Formular-Popups

`FormSheet` in `components/ui/form-sheet.tsx` verbindet den vorhandenen
`GlassSheetSurface` mit einem gemeinsamen Kopf, Safe-Area-/Tastaturabstand,
scrollbarem Inhalt und den bestehenden `DialogActions`. Rahmen, Rundung,
Material und Aktionsposition werden zentral vorgegeben. Lange Überschriften
und Erklärungen scrollen mit; die Bestätigung bleibt unter dem Inhalt sichtbar.

`FormSection`, `FormField` und `FormTextInput` verwenden dieselben Feldmaße
aus `constants/Forms.ts`, dieselben opaken Feldfarben aus `FormColors` und die
vorhandenen Rollen aus `constants/Typography.ts`. Die gemeinsamen Textrollen
wurden nicht verändert. Eigene Aktivitäts- und Statusfarben bleiben erhalten.

```tsx
<FormSheet visible={visible} title={title} isDark={isDark}
  onClose={close} onConfirm={save} busy={saving} confirmDisabled={!valid}>
  <FormSection label={label} isDark={isDark}>
    <FormField isDark={isDark} value={value} placeholder={placeholder} onPress={edit} />
  </FormSection>
</FormSheet>
```

Hauptformulare zeigen Abbrechen/Speichern. Text- und Datums-Unterdialoge
verwenden Abbrechen/Fertig beziehungsweise vorhandene Übernehmen-Labels.
Timerstart behält seine passende Beschriftung. Das Ausblenden einer eigenen
Aktivität steht separat im Inhalt und behält seine Sicherheitsbestätigung.
Abbrechen löst diese Aktion nicht mehr aus.

Native Unterdialoge gehören in die `overlays`-Prop der präsentierenden
`FormSheet`. Für virtualisierte Listen kann `scrollable={false}` verwendet
werden; ihre eigene ScrollView/FlatList übernimmt dann den Inhaltsbereich.
`busy` sperrt Bestätigung, Abbrechen, Header, Hintergrund und Systemschließen.
Der Aufrufer behält seine Speicher-, Fehler-, Entwurfs- und Berechtigungslogik.

Umgestellt sind Gewicht, Größe, Planer einschließlich Zeitraum/Person/Erinnerung,
manueller und schneller Schlaf, Aktivitäten, eigene Aktivitätsdefinitionen und
Einträge, Zahnerfassung, manuelle Wehen, Babynamen sowie die gemeinsamen Text-
und Datumsdialoge. Native System-Alerts, Informations- und Spezialeditoren
sind kein Bestandteil dieser Formularmigration.

Die Web-Vergleichsansicht liegt außerhalb des Repositorys unter
`/Users/janzeppenfeld/Documents/Codex/2026-10-12/LottiBaby-Einheitliche-Popups/Vorher-Nachher.html`.
Sie verwendet echte Komponenten beziehungsweise originales Formular-JSX mit
Beispieldaten. Native Unschärfe, Tastatur und Picker bleiben am Gerät zu prüfen.
