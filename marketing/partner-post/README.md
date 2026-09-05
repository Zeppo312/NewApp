# Lotti Baby – Partner-Post Appshots

Diese vier **inszenierten Demo-Screens** sind für das Reel „Lotti Baby ist nicht nur für Mamas“ erstellt. Sie zeigen keine echten Nutzer- oder Gesundheitsdaten und lassen sich ohne Qualitätsverlust in Remotion einbinden.

## Echte Simulator-Aufnahmen

Für das finale Video bevorzugt diese beiden Aufnahmen aus dem iPhone-17-Simulator:

- `simulator-account-linking-shot.png` – echter Flow „Accounts verknüpfen“
- `simulator-sleep-tracker-shot.png` – echter Schlaf-Tracker mit Testdaten

Die Appshots sind oben und unten nur beschnitten, damit ein wiederkehrender technischer Hinweis außerhalb des eigentlichen UI nicht im Video erscheint. Die sichtbare App-Oberfläche ist unverändert.

1. `01_accounts-linked.svg` – Verbindung über Einladungscode
2. `02_partner-update.svg` – Partner startet den Schlaftracker
3. `03_shared-overview.svg` – beide sehen denselben Tagesüberblick
4. `04_partner-notification.svg` – gemeinsames Update in der Nacht

Empfohlene Reihenfolge für ein 14–16-Sekunden-Reel:

| Zeit | Visual | On-Screen-Text |
| --- | --- | --- |
| 0.0–2.5 s | 01 | „Lotti Baby ist nicht nur für Mamas.“ |
| 2.5–5.5 s | 02 | „Er startet den Schlaf. Du siehst es sofort.“ |
| 5.5–9.0 s | 03 | „Ein Baby. Ein Überblick.“ |
| 9.0–12.0 s | 04 | „Auch nachts: ihr seid ein Team.“ |
| 12.0–15.0 s | 03, leicht gezoomt | „Weniger: Was war nochmal? · Mehr: Wir haben’s im Blick.“ |

Für Remotion: SVGs direkt mit `<Img src={staticFile('partner-post/01_accounts-linked.svg')} />` verwenden. Die Screens wirken am stärksten als leicht rotierte, schwebende Telefonfläche mit 6–8 % Zoom über die jeweilige Szene.

## Fertige Remotion-Szene

`PartnerPost.tsx` enthält eine fertige 15-Sekunden-Vertikalszene (30 FPS, 1080 × 1920). Lege den Ordner `partner-post/` in den `public/`-Ordner des Remotion-Projekts und die Komponente in `src/`. Danach z. B. in `Root.tsx` registrieren:

```tsx
<Composition
  id="LottiPartnerPost"
  component={PartnerPost}
  durationInFrames={450}
  fps={30}
  width={1080}
  height={1920}
/>
```

Die PNGs sind bewusst hochauflösend (1290 × 2796) gerendert; das lässt Raum für den langsamen Ken-Burns-Zoom im Video.
