import React from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { LAYOUT_PAD } from '@/constants/DesignGuide';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLocale } from '@/contexts/LocaleContext';
import { getLegalDocument } from '@/lib/legalTranslations';
import { LocalizedLegalDocument } from '@/components/LocalizedLegalDocument';
import appPrivacySections from '@/lib/appPrivacySections.json';

type BulletItem = string | { label: string; text: string };

const BulletList = ({ items }: { items: BulletItem[] }) => (
  <View style={styles.list}>
    {items.map((item, index) => (
      <ThemedText key={`bullet-${index}`} type="body" style={styles.listItem}>
        {'\u2022 '}
        {typeof item === 'string' ? (
          item
        ) : (
          <>
            <ThemedText type="bodyStrong">{item.label}</ThemedText>
            {item.text}
          </>
        )}
      </ThemedText>
    ))}
  </View>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <ThemedText type="sectionTitle" style={styles.sectionTitle}>{title}</ThemedText>
    {children}
  </View>
);

const Subsection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.subsection}>
    <ThemedText type="headline" style={styles.subsectionTitle}>{title}</ThemedText>
    {children}
  </View>
);

export default function DatenschutzScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { locale } = useLocale();
  const localizedDocument = getLegalDocument(locale, 'privacy');
  if (localizedDocument) return <LocalizedLegalDocument document={localizedDocument} />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar hidden={true} />

          <Header
            title="Datenschutz"
            subtitle="Datenschutzerklärung"
            showBackButton
          />

          <ScrollView contentContainerStyle={styles.content}>
            <View
              style={[
                styles.card,
                { backgroundColor: colorScheme === 'dark' ? theme.cardDark : '#FFF5EE', borderColor: theme.border },
              ]}
            >
              <ThemedText type="pageTitle" style={styles.pageTitle}>Datenschutzerklärung</ThemedText>

              <Section title="Präambel">
                <ThemedText type="body" style={styles.paragraph}>
                  Mit der folgenden Datenschutzerklärung möchten wir Sie darüber aufklären, welche Arten Ihrer
                  personenbezogenen Daten (nachfolgend auch kurz als „Daten“ bezeichnet) wir zu welchen Zwecken und in
                  welchem Umfang verarbeiten. Die Datenschutzerklärung gilt für alle von uns durchgeführten
                  Verarbeitungen personenbezogener Daten, sowohl im Rahmen der Erbringung unserer Leistungen als auch
                  insbesondere auf unseren Webseiten, in mobilen Applikationen sowie innerhalb externer Onlinepräsenzen,
                  wie z. B. unserer Social-Media-Profile (nachfolgend zusammenfassend bezeichnet als „Onlineangebot“).
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>Die verwendeten Begriffe sind nicht geschlechtsspezifisch.</ThemedText>
                <ThemedText type="bodySmall" style={styles.paragraph}>Stand: 11. September 2026</ThemedText>
              </Section>

              <Section title="Inhaltsübersicht">
                <BulletList
                  items={[
                    'Präambel',
                    'Verantwortlicher',
                    ...appPrivacySections.de.map((section) => section.title),
                    'Übersicht der Verarbeitungen',
                    'Maßgebliche Rechtsgrundlagen',
                    'Sicherheitsmaßnahmen',
                    'Übermittlung von personenbezogenen Daten',
                    'Internationale Datentransfers',
                    'Allgemeine Informationen zur Datenspeicherung und Löschung',
                    'Rechte der betroffenen Personen',
                    'Bereitstellung des Onlineangebots und Webhosting',
                    'Einsatz von Cookies',
                    'Registrierung, Anmeldung und Nutzerkonto',
                    'Single-Sign-On-Anmeldung',
                    'Blogs und Publikationsmedien',
                    'Kontakt- und Anfrageverwaltung',
                    'Änderung und Aktualisierung',
                    'Begriffsdefinitionen',
                  ]}
                />
              </Section>

              <Section title="Verantwortlicher">
                <ThemedText type="body" style={styles.paragraph}>Laura-Michelle Zeppenfeld</ThemedText>
                <ThemedText type="body" style={styles.paragraph}>Tilburger Str. 31</ThemedText>
                <ThemedText type="body" style={styles.paragraph}>28259, Bremen, Deutschland</ThemedText>
                <ThemedText type="body" style={styles.paragraph}>E-Mail-Adresse: support@lottibaby.de</ThemedText>
              </Section>

              {appPrivacySections.de.map((section) => (
                <Section key={section.title} title={section.title}>
                  {section.paragraphs.map((paragraph, index) => (
                    <ThemedText key={index} selectable type="body" style={styles.paragraph}>
                      {paragraph}
                    </ThemedText>
                  ))}
                </Section>
              ))}

              <Section title="Übersicht der Verarbeitungen">
                <ThemedText type="body" style={styles.paragraph}>
                  Die nachfolgende Übersicht fasst die Arten der verarbeiteten Daten und die Zwecke ihrer Verarbeitung
                  zusammen und verweist auf die betroffenen Personen.
                </ThemedText>

                <Subsection title="Arten der verarbeiteten Daten">
                  <BulletList
                    items={[
                      'Bestandsdaten.',
                      'Kontaktdaten.',
                      'Inhaltsdaten.',
                      'Nutzungsdaten.',
                      'Meta-, Kommunikations- und Verfahrensdaten.',
                      'Protokolldaten.',
                    ]}
                  />
                </Subsection>

                <Subsection title="Kategorien betroffener Personen">
                  <BulletList items={['Kommunikationspartner.', 'Nutzer.']} />
                </Subsection>

                <Subsection title="Zwecke der Verarbeitung">
                  <BulletList
                    items={[
                      'Erbringung vertraglicher Leistungen und Erfüllung vertraglicher Pflichten.',
                      'Kommunikation.',
                      'Sicherheitsmaßnahmen.',
                      'Organisations- und Verwaltungsverfahren.',
                      'Feedback.',
                      'Anmeldeverfahren.',
                      'Bereitstellung unseres Onlineangebotes und Nutzerfreundlichkeit.',
                      'Informationstechnische Infrastruktur.',
                    ]}
                  />
                </Subsection>
              </Section>

              <Section title="Maßgebliche Rechtsgrundlagen">
                <ThemedText type="body" style={styles.paragraph}>
                  Maßgebliche Rechtsgrundlagen nach der DSGVO: Im Folgenden erhalten Sie eine Übersicht der
                  Rechtsgrundlagen der DSGVO, auf deren Basis wir personenbezogene Daten verarbeiten. Bitte nehmen Sie
                  zur Kenntnis, dass neben den Regelungen der DSGVO nationale Datenschutzvorgaben in Ihrem bzw. unserem
                  Wohn- oder Sitzland gelten können. Sollten ferner im Einzelfall speziellere Rechtsgrundlagen maßgeblich
                  sein, teilen wir Ihnen diese in der Datenschutzerklärung mit.
                </ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Einwilligung (Art. 6 Abs. 1 S. 1 lit. a) DSGVO) - ',
                      text: 'Die betroffene Person hat ihre Einwilligung in die Verarbeitung der sie betreffenden personenbezogenen Daten für einen spezifischen Zweck oder mehrere bestimmte Zwecke gegeben.',
                    },
                    {
                      label: 'Vertragserfüllung und vorvertragliche Anfragen (Art. 6 Abs. 1 S. 1 lit. b) DSGVO) - ',
                      text: 'Die Verarbeitung ist für die Erfüllung eines Vertrags, dessen Vertragspartei die betroffene Person ist, oder zur Durchführung vorvertraglicher Maßnahmen erforderlich, die auf Anfrage der betroffenen Person erfolgen.',
                    },
                    {
                      label: 'Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO) - ',
                      text: 'Die Verarbeitung ist zur Wahrung der berechtigten Interessen des Verantwortlichen oder eines Dritten notwendig, vorausgesetzt, dass die Interessen, Grundrechte und Grundfreiheiten der betroffenen Person, die den Schutz personenbezogener Daten verlangen, nicht überwiegen.',
                    },
                  ]}
                />

                <ThemedText type="body" style={styles.paragraph}>
                  Nationale Datenschutzregelungen in Deutschland: Zusätzlich zu den Datenschutzregelungen der DSGVO
                  gelten nationale Regelungen zum Datenschutz in Deutschland. Hierzu gehört insbesondere das Gesetz zum
                  Schutz vor Missbrauch personenbezogener Daten bei der Datenverarbeitung (Bundesdatenschutzgesetz –
                  BDSG). Das BDSG enthält insbesondere Spezialregelungen zum Recht auf Auskunft, zum Recht auf Löschung,
                  zum Widerspruchsrecht, zur Verarbeitung besonderer Kategorien personenbezogener Daten, zur Verarbeitung
                  für andere Zwecke und zur Übermittlung sowie automatisierten Entscheidungsfindung im Einzelfall
                  einschließlich Profiling. Ferner können Landesdatenschutzgesetze der einzelnen Bundesländer zur
                  Anwendung gelangen.
                </ThemedText>
              </Section>

              <Section title="Sicherheitsmaßnahmen">
                <ThemedText type="body" style={styles.paragraph}>
                  Wir treffen nach Maßgabe der gesetzlichen Vorgaben unter Berücksichtigung des Stands der Technik, der
                  Implementierungskosten und der Art, des Umfangs, der Umstände und der Zwecke der Verarbeitung sowie der
                  unterschiedlichen Eintrittswahrscheinlichkeiten und des Ausmaßes der Bedrohung der Rechte und
                  Freiheiten natürlicher Personen geeignete technische und organisatorische Maßnahmen, um ein dem Risiko
                  angemessenes Schutzniveau zu gewährleisten.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Zu den Maßnahmen gehören insbesondere die Sicherung der Vertraulichkeit, Integrität und Verfügbarkeit
                  von Daten durch Kontrolle des physischen und elektronischen Zugangs zu den Daten als auch des sie
                  betreffenden Zugriffs, der Eingabe, der Weitergabe, der Sicherung der Verfügbarkeit und ihrer Trennung.
                  Des Weiteren haben wir Verfahren eingerichtet, die eine Wahrnehmung von Betroffenenrechten, die
                  Löschung von Daten und Reaktionen auf die Gefährdung der Daten gewährleisten. Ferner berücksichtigen wir
                  den Schutz personenbezogener Daten bereits bei der Entwicklung bzw. Auswahl von Hardware, Software
                  sowie Verfahren entsprechend dem Prinzip des Datenschutzes, durch Technikgestaltung und durch
                  datenschutzfreundliche Voreinstellungen.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Sicherung von Online-Verbindungen durch TLS-/SSL-Verschlüsselungstechnologie (HTTPS): Um die Daten der
                  Nutzer, die über unsere Online-Dienste übertragen werden, vor unerlaubten Zugriffen zu schützen, setzen
                  wir auf die TLS-/SSL-Verschlüsselungstechnologie. Secure Sockets Layer (SSL) und Transport Layer
                  Security (TLS) sind die Eckpfeiler der sicheren Datenübertragung im Internet. Diese Technologien
                  verschlüsseln die Informationen, die zwischen der Website oder App und dem Browser des Nutzers (oder
                  zwischen zwei Servern) übertragen werden, wodurch die Daten vor unbefugtem Zugriff geschützt sind. TLS,
                  als die weiterentwickelte und sicherere Version von SSL, gewährleistet, dass alle Datenübertragungen
                  den höchsten Sicherheitsstandards entsprechen. Wenn eine Website durch ein SSL-/TLS-Zertifikat
                  gesichert ist, wird dies durch die Anzeige von HTTPS in der URL signalisiert. Dies dient als ein
                  Indikator für die Nutzer, dass ihre Daten sicher und verschlüsselt übertragen werden.
                </ThemedText>
              </Section>

              <Section title="Übermittlung von personenbezogenen Daten">
                <ThemedText type="body" style={styles.paragraph}>
                  Im Rahmen unserer Verarbeitung von personenbezogenen Daten kommt es vor, dass diese an andere Stellen,
                  Unternehmen, rechtlich selbstständige Organisationseinheiten oder Personen übermittelt beziehungsweise
                  ihnen gegenüber offengelegt werden. Zu den Empfängern dieser Daten können z. B. mit IT-Aufgaben
                  beauftragte Dienstleister gehören oder Anbieter von Diensten und Inhalten, die in eine Website
                  eingebunden sind. In solchen Fällen beachten wir die gesetzlichen Vorgaben und schließen insbesondere
                  entsprechende Verträge bzw. Vereinbarungen, die dem Schutz Ihrer Daten dienen, mit den Empfängern Ihrer
                  Daten ab.
                </ThemedText>
              </Section>

              <Section title="Internationale Datentransfers">
                <ThemedText type="body" style={styles.paragraph}>
                  Die Empfänger und möglichen Verarbeitungen außerhalb der EU/des EWR sind in den vorstehenden
                  App-Abschnitten erläutert. Maßgeblich sind die für den jeweiligen Empfänger tatsächlich geltenden
                  Übermittlungsgrundlagen und Garantien. Informationen und eine Kopie der eingesetzten Garantien
                  können Sie über support@lottibaby.de anfordern.
                </ThemedText>
              </Section>

              <Section title="Allgemeine Informationen zur Datenspeicherung und Löschung">
                <ThemedText type="body" style={styles.paragraph}>
                  Wir löschen personenbezogene Daten, die wir verarbeiten, gemäß den gesetzlichen Bestimmungen, sobald
                  die zugrundeliegenden Einwilligungen widerrufen werden oder keine weiteren rechtlichen Grundlagen für
                  die Verarbeitung bestehen. Dies betrifft Fälle, in denen der ursprüngliche Verarbeitungszweck entfällt
                  oder die Daten nicht mehr benötigt werden. Ausnahmen von dieser Regelung bestehen, wenn gesetzliche
                  Pflichten oder besondere Interessen eine längere Aufbewahrung oder Archivierung der Daten erfordern.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Insbesondere müssen Daten, die aus handels- oder steuerrechtlichen Gründen aufbewahrt werden müssen
                  oder deren Speicherung notwendig ist zur Rechtsverfolgung oder zum Schutz der Rechte anderer
                  natürlicher oder juristischer Personen, entsprechend archiviert werden.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Unsere Datenschutzhinweise enthalten zusätzliche Informationen zur Aufbewahrung und Löschung von
                  Daten, die speziell für bestimmte Verarbeitungsprozesse gelten.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Bei mehreren Angaben zur Aufbewahrungsdauer oder Löschungsfristen eines Datums, ist stets die längste
                  Frist maßgeblich. Daten, die nicht mehr für den ursprünglich vorgesehenen Zweck, sondern aufgrund
                  gesetzlicher Vorgaben oder anderer Gründe aufbewahrt werden, verarbeiten wir ausschließlich zu den
                  Gründen, die ihre Aufbewahrung rechtfertigen.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Aufbewahrung und Löschung von Daten: Die folgenden allgemeinen Fristen gelten für die Aufbewahrung und
                  Archivierung nach deutschem Recht:
                </ThemedText>

                <BulletList
                  items={[
                    '10 Jahre - Aufbewahrungsfrist für Bücher und Aufzeichnungen, Jahresabschlüsse, Inventare, Lageberichte, Eröffnungsbilanz sowie die zu ihrem Verständnis erforderlichen Arbeitsanweisungen und sonstigen Organisationsunterlagen (§ 147 Abs. 1 Nr. 1 i.V.m. Abs. 3 AO, § 14b Abs. 1 UStG, § 257 Abs. 1 Nr. 1 i.V.m. Abs. 4 HGB).',
                    '8 Jahre - Buchungsbelege, wie z. B. Rechnungen und Kostenbelege (§ 147 Abs. 1 Nr. 4 und 4a i.V.m. Abs. 3 Satz 1 AO sowie § 257 Abs. 1 Nr. 4 i.V.m. Abs. 4 HGB).',
                    '6 Jahre - Übrige Geschäftsunterlagen: empfangene Handels- oder Geschäftsbriefe, Wiedergaben der abgesandten Handels- oder Geschäftsbriefe, sonstige Unterlagen, soweit sie für die Besteuerung von Bedeutung sind, z. B. Stundenlohnzettel, Betriebsabrechnungsbögen, Kalkulationsunterlagen, Preisauszeichnungen, aber auch Lohnabrechnungsunterlagen, soweit sie nicht bereits Buchungsbelege sind und Kassenstreifen (§ 147 Abs. 1 Nr. 2, 3, 5 i.V.m. Abs. 3 AO, § 257 Abs. 1 Nr. 2 u. 3 i.V.m. Abs. 4 HGB).',
                    '3 Jahre - Daten, die erforderlich sind, um potenzielle Gewährleistungs- und Schadensersatzansprüche oder ähnliche vertragliche Ansprüche und Rechte zu berücksichtigen sowie damit verbundene Anfragen zu bearbeiten, basierend auf früheren Geschäftserfahrungen und üblichen Branchenpraktiken, werden für die Dauer der regulären gesetzlichen Verjährungsfrist von drei Jahren gespeichert (§§ 195, 199 BGB).',
                  ]}
                />

                <ThemedText type="body" style={styles.paragraph}>
                  Fristbeginn mit Ablauf des Jahres: Beginnt eine Frist nicht ausdrücklich zu einem bestimmten Datum und
                  beträgt sie mindestens ein Jahr, so startet sie automatisch am Ende des Kalenderjahres, in dem das
                  fristauslösende Ereignis eingetreten ist. Im Fall laufender Vertragsverhältnisse, in deren Rahmen Daten
                  gespeichert werden, ist das fristauslösende Ereignis der Zeitpunkt des Wirksamwerdens der Kündigung
                  oder sonstige Beendigung des Rechtsverhältnisses.
                </ThemedText>
              </Section>

              <Section title="Rechte der betroffenen Personen">
                <ThemedText type="body" style={styles.paragraph}>
                  Rechte der betroffenen Personen aus der DSGVO: Ihnen stehen als Betroffene nach der DSGVO verschiedene
                  Rechte zu, die sich insbesondere aus Art. 15 bis 21 DSGVO ergeben:
                </ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Widerspruchsrecht: ',
                      text: 'Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit gegen die Verarbeitung der Sie betreffenden personenbezogenen Daten, die aufgrund von Art. 6 Abs. 1 lit. e oder f DSGVO erfolgt, Widerspruch einzulegen; dies gilt auch für ein auf diese Bestimmungen gestütztes Profiling. Werden die Sie betreffenden personenbezogenen Daten verarbeitet, um Direktwerbung zu betreiben, haben Sie das Recht, jederzeit Widerspruch gegen die Verarbeitung der Sie betreffenden personenbezogenen Daten zum Zwecke derartiger Werbung einzulegen; dies gilt auch für das Profiling, soweit es mit solcher Direktwerbung in Verbindung steht.',
                    },
                    {
                      label: 'Widerrufsrecht bei Einwilligungen: ',
                      text: 'Sie haben das Recht, erteilte Einwilligungen jederzeit zu widerrufen.',
                    },
                    {
                      label: 'Auskunftsrecht: ',
                      text: 'Sie haben das Recht, eine Bestätigung darüber zu verlangen, ob betreffende Daten verarbeitet werden und auf Auskunft über diese Daten sowie auf weitere Informationen und Kopie der Daten entsprechend den gesetzlichen Vorgaben.',
                    },
                    {
                      label: 'Recht auf Berichtigung: ',
                      text: 'Sie haben entsprechend den gesetzlichen Vorgaben das Recht, die Vervollständigung der Sie betreffenden Daten oder die Berichtigung der Sie betreffenden unrichtigen Daten zu verlangen.',
                    },
                    {
                      label: 'Recht auf Löschung und Einschränkung der Verarbeitung: ',
                      text: 'Sie haben nach Maßgabe der gesetzlichen Vorgaben das Recht, zu verlangen, dass Sie betreffende Daten unverzüglich gelöscht werden, bzw. alternativ nach Maßgabe der gesetzlichen Vorgaben eine Einschränkung der Verarbeitung der Daten zu verlangen.',
                    },
                    {
                      label: 'Recht auf Datenübertragbarkeit: ',
                      text: 'Sie haben das Recht, Sie betreffende Daten, die Sie uns bereitgestellt haben, nach Maßgabe der gesetzlichen Vorgaben in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten oder deren Übermittlung an einen anderen Verantwortlichen zu fordern.',
                    },
                    {
                      label: 'Beschwerde bei Aufsichtsbehörde: ',
                      text: 'Sie haben unbeschadet eines anderweitigen verwaltungsrechtlichen oder gerichtlichen Rechtsbehelfs das Recht auf Beschwerde bei einer Aufsichtsbehörde, insbesondere in dem Mitgliedstaat ihres gewöhnlichen Aufenthaltsorts, ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes, wenn Sie der Ansicht sind, dass die Verarbeitung der Sie betreffenden personenbezogenen Daten gegen die Vorgaben der DSGVO verstößt.',
                    },
                  ]}
                />
              </Section>

              <Section title="Bereitstellung des Onlineangebots und Webhosting">
                <ThemedText type="body" style={styles.paragraph}>
                  Wir verarbeiten die Daten der Nutzer, um ihnen unsere Online-Dienste zur Verfügung stellen zu können. Zu
                  diesem Zweck verarbeiten wir die IP-Adresse des Nutzers, die notwendig ist, um die Inhalte und
                  Funktionen unserer Online-Dienste an den Browser oder das Endgerät der Nutzer zu übermitteln.
                </ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Verarbeitete Datenarten: ',
                      text: 'Nutzungsdaten (z. B. Seitenaufrufe und Verweildauer, Klickpfade, Nutzungsintensität und -frequenz, verwendete Gerätetypen und Betriebssysteme, Interaktionen mit Inhalten und Funktionen); Meta-, Kommunikations- und Verfahrensdaten (z. B. IP-Adressen, Zeitangaben, Identifikationsnummern, beteiligte Personen). Protokolldaten (z. B. Logfiles betreffend Logins oder den Abruf von Daten oder Zugriffszeiten.).',
                    },
                    {
                      label: 'Betroffene Personen: ',
                      text: 'Nutzer (z. B. Webseitenbesucher, Nutzer von Onlinediensten).',
                    },
                    {
                      label: 'Zwecke der Verarbeitung: ',
                      text: 'Bereitstellung unseres Onlineangebotes und Nutzerfreundlichkeit; Informationstechnische Infrastruktur (Betrieb und Bereitstellung von Informationssystemen und technischen Geräten (Computer, Server etc.)). Sicherheitsmaßnahmen.',
                    },
                    {
                      label: 'Aufbewahrung und Löschung: ',
                      text: 'Löschung entsprechend Angaben im Abschnitt "Allgemeine Informationen zur Datenspeicherung und Löschung".',
                    },
                    {
                      label: 'Rechtsgrundlagen: ',
                      text: 'Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO).',
                    },
                  ]}
                />

                <ThemedText type="body" style={styles.paragraph}>Weitere Hinweise zu Verarbeitungsprozessen, Verfahren und Diensten:</ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Bereitstellung Onlineangebot auf gemietetem Speicherplatz: ',
                      text: 'Für die Bereitstellung unseres Onlineangebotes nutzen wir Speicherplatz, Rechenkapazität und Software, die wir von einem entsprechenden Serveranbieter (auch "Webhoster" genannt) mieten oder anderweitig beziehen; Rechtsgrundlagen: Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO).',
                    },
                    {
                      label: 'Erhebung von Zugriffsdaten und Logfiles: ',
                      text: 'Der Zugriff auf unser Onlineangebot wird in Form von sogenannten "Server-Logfiles" protokolliert. Zu den Serverlogfiles können die Adresse und der Name der abgerufenen Webseiten und Dateien, Datum und Uhrzeit des Abrufs, übertragene Datenmengen, Meldung über erfolgreichen Abruf, Browsertyp nebst Version, das Betriebssystem des Nutzers, Referrer URL (die zuvor besuchte Seite) und im Regelfall IP-Adressen und der anfragende Provider gehören. Die Serverlogfiles können zum einen zu Sicherheitszwecken eingesetzt werden, z. B. um eine Überlastung der Server zu vermeiden (insbesondere im Fall von missbräuchlichen Angriffen, sogenannten DDoS-Attacken), und zum anderen, um die Auslastung der Server und ihre Stabilität sicherzustellen; Rechtsgrundlagen: Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO). Löschung von Daten: Logfile-Informationen werden für die Dauer von maximal 30 Tagen gespeichert und danach gelöscht oder anonymisiert. Daten, deren weitere Aufbewahrung zu Beweiszwecken erforderlich ist, sind bis zur endgültigen Klärung des jeweiligen Vorfalls von der Löschung ausgenommen.',
                    },
                  ]}
                />
              </Section>

              <Section title="Einsatz von Cookies">
                <ThemedText type="body" style={styles.paragraph}>
                  Unter dem Begriff „Cookies“ werden Funktionen, die Informationen auf Endgeräten der Nutzer speichern und
                  aus ihnen auslesen, verstanden. Cookies können ferner in Bezug auf unterschiedliche Anliegen Einsatz
                  finden, etwa zu Zwecken der Funktionsfähigkeit, der Sicherheit und des Komforts von Onlineangeboten
                  sowie der Erstellung von Analysen der Besucherströme. Wir verwenden Cookies gemäß den gesetzlichen
                  Vorschriften. Dazu holen wir, wenn erforderlich, vorab die Zustimmung der Nutzer ein. Ist eine
                  Zustimmung nicht notwendig, setzen wir auf unsere berechtigten Interessen. Dies gilt, wenn das Speichern
                  und Auslesen von Informationen unerlässlich ist, um ausdrücklich angeforderte Inhalte und Funktionen
                  bereitstellen zu können. Dazu zählen etwa die Speicherung von Einstellungen sowie die Sicherstellung der
                  Funktionalität und Sicherheit unseres Onlineangebots. Die Einwilligung kann jederzeit widerrufen werden.
                  Wir informieren klar über deren Umfang und welche Cookies genutzt werden.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Hinweise zu datenschutzrechtlichen Rechtsgrundlagen: Ob wir personenbezogene Daten mithilfe von Cookies
                  verarbeiten, hängt von einer Einwilligung ab. Liegt eine Einwilligung vor, dient sie als Rechtsgrundlage.
                  Ohne Einwilligung stützen wir uns auf unsere berechtigten Interessen, die vorstehend in diesem Abschnitt
                  und im Kontext der jeweiligen Dienste und Verfahren erläutert sind.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Speicherdauer: Im Hinblick auf die Speicherdauer werden die folgenden Arten von Cookies unterschieden:
                </ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Temporäre Cookies (auch: Session- oder Sitzungscookies): ',
                      text: 'Temporäre Cookies werden spätestens gelöscht, nachdem ein Nutzer ein Onlineangebot verlassen und sein Endgerät (z. B. Browser oder mobile Applikation) geschlossen hat.',
                    },
                    {
                      label: 'Permanente Cookies: ',
                      text: 'Permanente Cookies bleiben auch nach dem Schließen des Endgeräts gespeichert. So können beispielsweise der Log-in-Status gespeichert und bevorzugte Inhalte direkt angezeigt werden, wenn der Nutzer eine Website erneut besucht. Ebenso können die mithilfe von Cookies erhobenen Nutzerdaten zur Reichweitenmessung Verwendung finden. Sofern wir Nutzern keine expliziten Angaben zur Art und Speicherdauer von Cookies mitteilen (z. B. im Rahmen der Einholung der Einwilligung), sollten sie davon ausgehen, dass diese permanent sind und die Speicherdauer bis zu zwei Jahre betragen kann.',
                    },
                  ]}
                />

                <ThemedText type="body" style={styles.paragraph}>
                  Allgemeine Hinweise zum Widerruf und Widerspruch (Opt-out): Nutzer können die von ihnen abgegebenen
                  Einwilligungen jederzeit widerrufen und zudem einen Widerspruch gegen die Verarbeitung entsprechend den
                  gesetzlichen Vorgaben, auch mittels der Privatsphäre-Einstellungen ihres Browsers, erklären.
                </ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Verarbeitete Datenarten: ',
                      text: 'Meta-, Kommunikations- und Verfahrensdaten (z. B. IP-Adressen, Zeitangaben, Identifikationsnummern, beteiligte Personen).',
                    },
                    {
                      label: 'Betroffene Personen: ',
                      text: 'Nutzer (z. B. Webseitenbesucher, Nutzer von Onlinediensten).',
                    },
                    {
                      label: 'Rechtsgrundlagen: ',
                      text: 'Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO). Einwilligung (Art. 6 Abs. 1 S. 1 lit. a) DSGVO).',
                    },
                  ]}
                />

                <ThemedText type="body" style={styles.paragraph}>Weitere Hinweise zu Verarbeitungsprozessen, Verfahren und Diensten:</ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Verarbeitung von Cookie-Daten auf Grundlage einer Einwilligung: ',
                      text: 'Wir setzen eine Einwilligungs-Management-Lösung ein, bei der die Einwilligung der Nutzer zur Verwendung von Cookies oder zu den im Rahmen der Einwilligungs-Management-Lösung genannten Verfahren und Anbietern eingeholt wird. Dieses Verfahren dient der Einholung, Protokollierung, Verwaltung und dem Widerruf von Einwilligungen, insbesondere bezogen auf den Einsatz von Cookies und vergleichbaren Technologien, die zur Speicherung, zum Auslesen und zur Verarbeitung von Informationen auf den Endgeräten der Nutzer eingesetzt werden. Im Rahmen dieses Verfahrens werden die Einwilligungen der Nutzer für die Nutzung von Cookies und die damit verbundenen Verarbeitungen von Informationen, einschließlich der im Einwilligungs-Management-Verfahren genannten spezifischen Verarbeitungen und Anbieter, eingeholt. Die Nutzer haben zudem die Möglichkeit, ihre Einwilligungen zu verwalten und zu widerrufen. Die Einwilligungserklärungen werden gespeichert, um eine erneute Abfrage zu vermeiden und den Nachweis der Einwilligung gemäß der gesetzlichen Anforderungen führen zu können. Die Speicherung erfolgt serverseitig und/oder in einem Cookie (sogenanntes Opt-In-Cookie) oder mittels vergleichbarer Technologien, um die Einwilligung einem spezifischen Nutzer oder dessen Gerät zuordnen zu können. Sofern keine spezifischen Angaben zu den Anbietern von Einwilligungs-Management-Diensten vorliegen, gelten folgende allgemeine Hinweise: Die Dauer der Speicherung der Einwilligung beträgt bis zu zwei Jahre. Dabei wird ein pseudonymer Nutzer-Identifikator erstellt, der zusammen mit dem Zeitpunkt der Einwilligung, den Angaben zum Umfang der Einwilligung (z. B. betreffende Kategorien von Cookies und/oder Diensteanbieter) sowie Informationen über den Browser, das System und das verwendete Endgerät gespeichert wird; Rechtsgrundlagen: Einwilligung (Art. 6 Abs. 1 S. 1 lit. a) DSGVO).',
                    },
                  ]}
                />
              </Section>

              <Section title="Registrierung, Anmeldung und Nutzerkonto">
                <ThemedText type="body" style={styles.paragraph}>
                  Nutzer können ein Nutzerkonto anlegen. Im Rahmen der Registrierung werden den Nutzern die erforderlichen
                  Pflichtangaben mitgeteilt und zu Zwecken der Bereitstellung des Nutzerkontos auf Grundlage vertraglicher
                  Pflichterfüllung verarbeitet. Zu den verarbeiteten Daten gehören insbesondere die Login-Informationen
                  (Nutzername, Passwort sowie eine E-Mail-Adresse).
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Im Rahmen der Inanspruchnahme unserer Registrierungs- und Anmeldefunktionen sowie der Nutzung des
                  Nutzerkontos speichern wir die IP-Adresse und den Zeitpunkt der jeweiligen Nutzerhandlung. Die
                  Speicherung erfolgt auf Grundlage unserer berechtigten Interessen als auch jener der Nutzer an einem
                  Schutz vor Missbrauch und sonstiger unbefugter Nutzung. Eine Weitergabe dieser Daten an Dritte erfolgt
                  grundsätzlich nicht, es sei denn, sie ist zur Verfolgung unserer Ansprüche erforderlich oder es besteht
                  eine gesetzliche Verpflichtung hierzu.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Die Nutzer können über Vorgänge, die für deren Nutzerkonto relevant sind, wie z. B. technische
                  Änderungen, per E-Mail informiert werden.
                </ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Verarbeitete Datenarten: ',
                      text: 'Bestandsdaten (z. B. der vollständige Name, Wohnadresse, Kontaktinformationen, Kundennummer, etc.); Kontaktdaten (z. B. Post- und E-Mail-Adressen oder Telefonnummern); Inhaltsdaten (z. B. textliche oder bildliche Nachrichten und Beiträge sowie die sie betreffenden Informationen, wie z. B. Angaben zur Autorenschaft oder Zeitpunkt der Erstellung); Nutzungsdaten (z. B. Seitenaufrufe und Verweildauer, Klickpfade, Nutzungsintensität und -frequenz, verwendete Gerätetypen und Betriebssysteme, Interaktionen mit Inhalten und Funktionen). Protokolldaten (z. B. Logfiles betreffend Logins oder den Abruf von Daten oder Zugriffszeiten.).',
                    },
                    {
                      label: 'Betroffene Personen: ',
                      text: 'Nutzer (z. B. Webseitenbesucher, Nutzer von Onlinediensten).',
                    },
                    {
                      label: 'Zwecke der Verarbeitung: ',
                      text: 'Erbringung vertraglicher Leistungen und Erfüllung vertraglicher Pflichten; Sicherheitsmaßnahmen; Organisations- und Verwaltungsverfahren. Bereitstellung unseres Onlineangebotes und Nutzerfreundlichkeit.',
                    },
                    {
                      label: 'Aufbewahrung und Löschung: ',
                      text: 'Löschung entsprechend Angaben im Abschnitt "Allgemeine Informationen zur Datenspeicherung und Löschung". Löschung nach Kündigung.',
                    },
                    {
                      label: 'Rechtsgrundlagen: ',
                      text: 'Vertragserfüllung und vorvertragliche Anfragen (Art. 6 Abs. 1 S. 1 lit. b) DSGVO). Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO).',
                    },
                  ]}
                />

                <ThemedText type="body" style={styles.paragraph}>Weitere Hinweise zu Verarbeitungsprozessen, Verfahren und Diensten:</ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Zwei-Faktor-Authentifizierung: ',
                      text: 'Die Zwei-Faktor-Authentifizierung bietet eine zusätzliche Sicherheitsebene für Ihr Benutzerkonto und stellt sicher, dass nur Sie auf Ihr Konto zugreifen können, auch, wenn jemand anderes Ihr Passwort kennt. Zu diesem Zweck müssen Sie zusätzlich zu Ihrem Passwort eine weitere Authentifizierungsmaßnahme durchführen (z. B. einen an ein mobiles Gerät gesandten Code eingeben). Wir werden Sie über das von uns eingesetzte Verfahren informieren; Rechtsgrundlagen: Vertragserfüllung und vorvertragliche Anfragen (Art. 6 Abs. 1 S. 1 lit. b) DSGVO).',
                    },
                    {
                      label: 'Löschung von Daten nach Kündigung: ',
                      text: 'Wenn Nutzer ihr Nutzerkonto gekündigt haben, werden deren Daten im Hinblick auf das Nutzerkonto, vorbehaltlich einer gesetzlichen Erlaubnis, Pflicht oder Einwilligung der Nutzer, gelöscht; Rechtsgrundlagen: Vertragserfüllung und vorvertragliche Anfragen (Art. 6 Abs. 1 S. 1 lit. b) DSGVO).',
                    },
                    {
                      label: 'Keine Aufbewahrungspflicht für Daten: ',
                      text: 'Es obliegt den Nutzern, ihre Daten bei erfolgter Kündigung vor dem Vertragsende zu sichern. Wir sind berechtigt, sämtliche während der Vertragsdauer gespeicherte Daten des Nutzers unwiederbringlich zu löschen; Rechtsgrundlagen: Vertragserfüllung und vorvertragliche Anfragen (Art. 6 Abs. 1 S. 1 lit. b) DSGVO).',
                    },
                  ]}
                />
              </Section>

              <Section title="Single-Sign-On-Anmeldung">
                <ThemedText type="body" style={styles.paragraph}>
                  Als „Single-Sign-On“ oder „Single-Sign-On-Anmeldung bzw. -Authentifizierung“ werden Verfahren
                  bezeichnet, die es Nutzern erlauben, sich mit Hilfe eines Nutzerkontos bei einem Anbieter von
                  Single-Sign-On-Verfahren (z. B. einem sozialen Netzwerk), auch bei unserem Onlineangebot, anzumelden.
                  Voraussetzung der Single-Sign-On-Authentifizierung ist, dass die Nutzer bei dem jeweiligen
                  Single-Sign-On-Anbieter registriert sind und die erforderlichen Zugangsdaten in dem dafür vorgesehenen
                  Onlineformular eingeben, bzw. schon bei dem Single-Sign-On-Anbieter angemeldet sind und die
                  Single-Sign-On-Anmeldung via Schaltfläche bestätigen.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Die Authentifizierung erfolgt direkt bei dem jeweiligen Single-Sign-On-Anbieter. Im Rahmen einer
                  solchen Authentifizierung erhalten wir eine Nutzer-ID mit der Information, dass der Nutzer unter dieser
                  Nutzer-ID beim jeweiligen Single-Sign-On-Anbieter eingeloggt ist und eine für uns für andere Zwecke
                  nicht weiter nutzbare ID (sog. „User Handle“). Ob uns zusätzliche Daten übermittelt werden, hängt allein
                  von dem genutzten Single-Sign-On-Verfahren ab, von den gewählten Datenfreigaben im Rahmen der
                  Authentifizierung und zudem davon, welche Daten Nutzer in den Privatsphäre- oder sonstigen Einstellungen
                  des Nutzerkontos beim Single-Sign-On-Anbieter freigegeben haben. Es können je nach
                  Single-Sign-On-Anbieter und der Wahl der Nutzer verschiedene Daten sein, in der Regel sind es die
                  E-Mail-Adresse und der Benutzername. Das im Rahmen des Single-Sign-On-Verfahrens eingegebene Passwort
                  bei dem Single-Sign-On-Anbieter ist für uns weder einsehbar, noch wird es von uns gespeichert.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Die Nutzer werden gebeten, zu beachten, dass deren bei uns gespeicherte Angaben automatisch mit ihrem
                  Nutzerkonto beim Single-Sign-On-Anbieter abgeglichen werden können, dies jedoch nicht immer möglich ist
                  oder tatsächlich erfolgt. Ändern sich z. B. die E-Mail-Adressen der Nutzer, müssen sie diese manuell in
                  ihrem Nutzerkonto bei uns ändern.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Die Single-Sign-On-Anmeldung können wir, sofern mit den Nutzern vereinbart, im Rahmen der oder vor der
                  Vertragserfüllung einsetzen, soweit die Nutzer darum gebeten wurden, im Rahmen einer Einwilligung
                  verarbeiten und setzen sie ansonsten auf Grundlage der berechtigten Interessen unsererseits und der
                  Interessen der Nutzer an einem effektiven und sicheren Anmeldesystem ein.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Sollten Nutzer sich einmal entscheiden, die Verknüpfung ihres Nutzerkontos beim Single-Sign-On-Anbieter
                  nicht mehr für das Single-Sign-On-Verfahren nutzen zu wollen, müssen sie diese Verbindung innerhalb
                  ihres Nutzerkontos beim Single-Sign-On-Anbieter aufheben. Möchten Nutzer deren Daten bei uns löschen,
                  müssen sie ihre Registrierung bei uns kündigen.
                </ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Verarbeitete Datenarten: ',
                      text: 'Bestandsdaten (z. B. der vollständige Name, Wohnadresse, Kontaktinformationen, Kundennummer, etc.); Kontaktdaten (z. B. Post- und E-Mail-Adressen oder Telefonnummern); Nutzungsdaten (z. B. Seitenaufrufe und Verweildauer, Klickpfade, Nutzungsintensität und -frequenz, verwendete Gerätetypen und Betriebssysteme, Interaktionen mit Inhalten und Funktionen). Meta-, Kommunikations- und Verfahrensdaten (z. B. IP-Adressen, Zeitangaben, Identifikationsnummern, beteiligte Personen).',
                    },
                    {
                      label: 'Betroffene Personen: ',
                      text: 'Nutzer (z. B. Webseitenbesucher, Nutzer von Onlinediensten).',
                    },
                    {
                      label: 'Zwecke der Verarbeitung: ',
                      text: 'Erbringung vertraglicher Leistungen und Erfüllung vertraglicher Pflichten; Sicherheitsmaßnahmen; Anmeldeverfahren. Bereitstellung unseres Onlineangebotes und Nutzerfreundlichkeit.',
                    },
                    {
                      label: 'Aufbewahrung und Löschung: ',
                      text: 'Löschung entsprechend Angaben im Abschnitt "Allgemeine Informationen zur Datenspeicherung und Löschung". Löschung nach Kündigung.',
                    },
                    {
                      label: 'Rechtsgrundlagen: ',
                      text: 'Vertragserfüllung und vorvertragliche Anfragen (Art. 6 Abs. 1 S. 1 lit. b) DSGVO). Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO).',
                    },
                  ]}
                />

                <ThemedText type="body" style={styles.paragraph}>Weitere Hinweise zu Verarbeitungsprozessen, Verfahren und Diensten:</ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Apple Single-Sign-On: ',
                      text: 'Authentifizierungsdienste für Nutzeranmeldungen, Bereitstellung von Single Sign-On-Funktionen, Verwaltung von Identitätsinformationen und Anwendungsintegrationen; Dienstanbieter: Apple Inc., Infinite Loop, Cupertino, CA 95014, USA; Rechtsgrundlagen: Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO); Website: https://www.apple.com/de/. Datenschutzerklärung: https://www.apple.com/legal/privacy/de-ww/.',
                    },
                  ]}
                />
              </Section>

              <Section title="Blogs und Publikationsmedien">
                <ThemedText type="body" style={styles.paragraph}>
                  Wir nutzen Blogs oder vergleichbare Mittel der Onlinekommunikation und Publikation (nachfolgend
                  „Publikationsmedium“). Die Daten der Leser werden für die Zwecke des Publikationsmediums nur insoweit
                  verarbeitet, als es für dessen Darstellung und die Kommunikation zwischen Autoren und Lesern oder aus
                  Gründen der Sicherheit erforderlich ist. Im Übrigen verweisen wir auf die Informationen zur
                  Verarbeitung der Besucher unseres Publikationsmediums im Rahmen dieser Datenschutzhinweise.
                </ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Verarbeitete Datenarten: ',
                      text: 'Bestandsdaten (z. B. der vollständige Name, Wohnadresse, Kontaktinformationen, Kundennummer, etc.); Kontaktdaten (z. B. Post- und E-Mail-Adressen oder Telefonnummern); Inhaltsdaten (z. B. textliche oder bildliche Nachrichten und Beiträge sowie die sie betreffenden Informationen, wie z. B. Angaben zur Autorenschaft oder Zeitpunkt der Erstellung); Nutzungsdaten (z. B. Seitenaufrufe und Verweildauer, Klickpfade, Nutzungsintensität und -frequenz, verwendete Gerätetypen und Betriebssysteme, Interaktionen mit Inhalten und Funktionen). Meta-, Kommunikations- und Verfahrensdaten (z. B. IP-Adressen, Zeitangaben, Identifikationsnummern, beteiligte Personen).',
                    },
                    {
                      label: 'Betroffene Personen: ',
                      text: 'Nutzer (z. B. Webseitenbesucher, Nutzer von Onlinediensten).',
                    },
                    {
                      label: 'Zwecke der Verarbeitung: ',
                      text: 'Feedback (z. B. Sammeln von Feedback via Online-Formular). Bereitstellung unseres Onlineangebotes und Nutzerfreundlichkeit.',
                    },
                    {
                      label: 'Aufbewahrung und Löschung: ',
                      text: 'Löschung entsprechend Angaben im Abschnitt "Allgemeine Informationen zur Datenspeicherung und Löschung".',
                    },
                    {
                      label: 'Rechtsgrundlagen: ',
                      text: 'Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO).',
                    },
                  ]}
                />
              </Section>

              <Section title="Moderation von Community-Inhalten">
                <ThemedText type="body" style={styles.paragraph}>
                  Damit wir anstößige Inhalte und missbräuchliches Verhalten unterbinden können, verarbeiten wir
                  Meldungen und Blockierungen, die Nutzerinnen und Nutzer in der App auslösen. Gespeichert werden dabei
                  die gemeldete Inhaltsart und -kennung, eine Kopie des gemeldeten Inhalts zum Zeitpunkt der Meldung,
                  der Meldegrund, eine optionale Beschreibung sowie die Kennungen der meldenden und der gemeldeten
                  Person. Blockierungen speichern wir als Beziehung zwischen zwei Nutzerkennungen.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Ein automatischer Wortfilter prüft Beiträge und Nachrichten beim Absenden; Treffer können abgewiesen
                  oder zur manuellen Prüfung vorgemerkt werden. Meldungen prüfen wir innerhalb von 24 Stunden.
                </ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Verarbeitete Datenarten: ',
                      text: 'Inhaltsdaten (Kopie des gemeldeten Beitrags, Kommentars oder der gemeldeten Nachricht); Meta-, Kommunikations- und Verfahrensdaten (Nutzerkennungen der meldenden und gemeldeten Person, Zeitangaben, Meldegrund, Bearbeitungsstatus).',
                    },
                    {
                      label: 'Betroffene Personen: ',
                      text: 'Nutzer (meldende Personen sowie Personen, deren Inhalte gemeldet oder blockiert werden).',
                    },
                    {
                      label: 'Zwecke der Verarbeitung: ',
                      text: 'Sicherheitsmaßnahmen, Verhinderung von Missbrauch und Belästigung, Erfüllung der Plattformpflichten für nutzergenerierte Inhalte.',
                    },
                    {
                      label: 'Aufbewahrung und Löschung: ',
                      text: 'Meldungen werden nach Abschluss der Prüfung so lange aufbewahrt, wie es zur Nachvollziehbarkeit wiederholter Verstöße und zur Abwehr von Ansprüchen erforderlich ist. Blockierungen bestehen, bis sie aufgehoben werden.',
                    },
                    {
                      label: 'Rechtsgrundlagen: ',
                      text: 'Erfüllung eines Vertrags und vorvertragliche Anfragen (Art. 6 Abs. 1 S. 1 lit. b) DSGVO); Berechtigte Interessen an einem sicheren, belästigungsfreien Betrieb (Art. 6 Abs. 1 S. 1 lit. f) DSGVO).',
                    },
                  ]}
                />
              </Section>

              <Section title="Kontakt- und Anfrageverwaltung">
                <ThemedText type="body" style={styles.paragraph}>
                  Bei der Kontaktaufnahme mit uns (z. B. per Post, Kontaktformular, E-Mail, Telefon oder via soziale
                  Medien) sowie im Rahmen bestehender Nutzer- und Geschäftsbeziehungen werden die Angaben der
                  anfragenden Personen verarbeitet, soweit dies zur Beantwortung der Kontaktanfragen und etwaiger
                  angefragter Maßnahmen erforderlich ist.
                </ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Verarbeitete Datenarten: ',
                      text: 'Kontaktdaten (z. B. Post- und E-Mail-Adressen oder Telefonnummern); Inhaltsdaten (z. B. textliche oder bildliche Nachrichten und Beiträge sowie die sie betreffenden Informationen, wie z. B. Angaben zur Autorenschaft oder Zeitpunkt der Erstellung). Meta-, Kommunikations- und Verfahrensdaten (z. B. IP-Adressen, Zeitangaben, Identifikationsnummern, beteiligte Personen).',
                    },
                    {
                      label: 'Betroffene Personen: ',
                      text: 'Kommunikationspartner.',
                    },
                    {
                      label: 'Zwecke der Verarbeitung: ',
                      text: 'Kommunikation; Organisations- und Verwaltungsverfahren; Feedback (z. B. Sammeln von Feedback via Online-Formular). Bereitstellung unseres Onlineangebotes und Nutzerfreundlichkeit.',
                    },
                    {
                      label: 'Aufbewahrung und Löschung: ',
                      text: 'Löschung entsprechend Angaben im Abschnitt "Allgemeine Informationen zur Datenspeicherung und Löschung".',
                    },
                    {
                      label: 'Rechtsgrundlagen: ',
                      text: 'Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO). Vertragserfüllung und vorvertragliche Anfragen (Art. 6 Abs. 1 S. 1 lit. b) DSGVO).',
                    },
                  ]}
                />

                <ThemedText type="body" style={styles.paragraph}>Weitere Hinweise zu Verarbeitungsprozessen, Verfahren und Diensten:</ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Kontaktformular: ',
                      text: 'Bei Kontaktaufnahme über unser Kontaktformular, per E-Mail oder anderen Kommunikationswegen, verarbeiten wir die uns übermittelten personenbezogenen Daten zur Beantwortung und Bearbeitung des jeweiligen Anliegens. Dies umfasst in der Regel Angaben wie Name, Kontaktinformationen und gegebenenfalls weitere Informationen, die uns mitgeteilt werden und zur angemessenen Bearbeitung erforderlich sind. Wir nutzen diese Daten ausschließlich für den angegebenen Zweck der Kontaktaufnahme und Kommunikation; Rechtsgrundlagen: Vertragserfüllung und vorvertragliche Anfragen (Art. 6 Abs. 1 S. 1 lit. b) DSGVO), Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO).',
                    },
                  ]}
                />
              </Section>

              <Section title="Änderung und Aktualisierung">
                <ThemedText type="body" style={styles.paragraph}>
                  Wir bitten Sie, sich regelmäßig über den Inhalt unserer Datenschutzerklärung zu informieren. Wir passen
                  die Datenschutzerklärung an, sobald die Änderungen der von uns durchgeführten Datenverarbeitungen dies
                  erforderlich machen. Wir informieren Sie, sobald durch die Änderungen eine Mitwirkungshandlung
                  Ihrerseits (z. B. Einwilligung) oder eine sonstige individuelle Benachrichtigung erforderlich wird.
                </ThemedText>
                <ThemedText type="body" style={styles.paragraph}>
                  Sofern wir in dieser Datenschutzerklärung Adressen und Kontaktinformationen von Unternehmen und
                  Organisationen angeben, bitten wir zu beachten, dass die Adressen sich über die Zeit ändern können und
                  bitten die Angaben vor Kontaktaufnahme zu prüfen.
                </ThemedText>
              </Section>

              <Section title="Begriffsdefinitionen">
                <ThemedText type="body" style={styles.paragraph}>
                  In diesem Abschnitt erhalten Sie eine Übersicht über die in dieser Datenschutzerklärung verwendeten
                  Begrifflichkeiten. Soweit die Begrifflichkeiten gesetzlich definiert sind, gelten deren gesetzliche
                  Definitionen. Die nachfolgenden Erläuterungen sollen dagegen vor allem dem Verständnis dienen.
                </ThemedText>

                <BulletList
                  items={[
                    {
                      label: 'Bestandsdaten: ',
                      text: 'Bestandsdaten umfassen wesentliche Informationen, die für die Identifikation und Verwaltung von Vertragspartnern, Benutzerkonten, Profilen und ähnlichen Zuordnungen notwendig sind. Diese Daten können u.a. persönliche und demografische Angaben wie Namen, Kontaktinformationen (Adressen, Telefonnummern, E-Mail-Adressen), Geburtsdaten und spezifische Identifikatoren (Benutzer-IDs) beinhalten. Bestandsdaten bilden die Grundlage für jegliche formelle Interaktion zwischen Personen und Diensten, Einrichtungen oder Systemen, indem sie eine eindeutige Zuordnung und Kommunikation ermöglichen.',
                    },
                    {
                      label: 'Inhaltsdaten: ',
                      text: 'Inhaltsdaten umfassen Informationen, die im Zuge der Erstellung, Bearbeitung und Veröffentlichung von Inhalten aller Art generiert werden. Diese Kategorie von Daten kann Texte, Bilder, Videos, Audiodateien und andere multimediale Inhalte einschließen, die auf verschiedenen Plattformen und Medien veröffentlicht werden. Inhaltsdaten sind nicht nur auf den eigentlichen Inhalt beschränkt, sondern beinhalten auch Metadaten, die Informationen über den Inhalt selbst liefern, wie Tags, Beschreibungen, Autoreninformationen und Veröffentlichungsdaten.',
                    },
                    {
                      label: 'Kontaktdaten: ',
                      text: 'Kontaktdaten sind essentielle Informationen, die die Kommunikation mit Personen oder Organisationen ermöglichen. Sie umfassen u.a. Telefonnummern, postalische Adressen und E-Mail-Adressen, sowie Kommunikationsmittel wie soziale Medien-Handles und Instant-Messaging-Identifikatoren.',
                    },
                    {
                      label: 'Meta-, Kommunikations- und Verfahrensdaten: ',
                      text: 'Meta-, Kommunikations- und Verfahrensdaten sind Kategorien, die Informationen über die Art und Weise enthalten, wie Daten verarbeitet, übermittelt und verwaltet werden. Meta-Daten, auch bekannt als Daten über Daten, umfassen Informationen, die den Kontext, die Herkunft und die Struktur anderer Daten beschreiben. Sie können Angaben zur Dateigröße, dem Erstellungsdatum, dem Autor eines Dokuments und den Änderungshistorien beinhalten. Kommunikationsdaten erfassen den Austausch von Informationen zwischen Nutzern über verschiedene Kanäle, wie E-Mail-Verkehr, Anrufprotokolle, Nachrichten in sozialen Netzwerken und Chat-Verläufe, inklusive der beteiligten Personen, Zeitstempel und Übertragungswege. Verfahrensdaten beschreiben die Prozesse und Abläufe innerhalb von Systemen oder Organisationen, einschließlich Workflow-Dokumentationen, Protokolle von Transaktionen und Aktivitäten, sowie Audit-Logs, die zur Nachverfolgung und Überprüfung von Vorgängen verwendet werden.',
                    },
                    {
                      label: 'Nutzungsdaten: ',
                      text: 'Nutzungsdaten beziehen sich auf Informationen, die erfassen, wie Nutzer mit digitalen Produkten, Dienstleistungen oder Plattformen interagieren. Diese Daten umfassen eine breite Palette von Informationen, die aufzeigen, wie Nutzer Anwendungen nutzen, welche Funktionen sie bevorzugen, wie lange sie auf bestimmten Seiten verweilen und über welche Pfade sie durch eine Anwendung navigieren. Nutzungsdaten können auch die Häufigkeit der Nutzung, Zeitstempel von Aktivitäten, IP-Adressen, Geräteinformationen und Standortdaten einschließen. Sie sind besonders wertvoll für die Analyse des Nutzerverhaltens, die Optimierung von Benutzererfahrungen, das Personalisieren von Inhalten und das Verbessern von Produkten oder Dienstleistungen. Darüber hinaus spielen Nutzungsdaten eine entscheidende Rolle beim Erkennen von Trends, Vorlieben und möglichen Problembereichen innerhalb digitaler Angebote.',
                    },
                    {
                      label: 'Personenbezogene Daten: ',
                      text: '"Personenbezogene Daten" sind alle Informationen, die sich auf eine identifizierte oder identifizierbare natürliche Person (im Folgenden "betroffene Person") beziehen; als identifizierbar wird eine natürliche Person angesehen, die direkt oder indirekt, insbesondere mittels Zuordnung zu einer Kennung wie einem Namen, zu einer Kennnummer, zu Standortdaten, zu einer Online-Kennung (z. B. Cookie) oder zu einem oder mehreren besonderen Merkmalen identifiziert werden kann, die Ausdruck der physischen, physiologischen, genetischen, psychischen, wirtschaftlichen, kulturellen oder sozialen Identität dieser natürlichen Person sind.',
                    },
                    {
                      label: 'Protokolldaten: ',
                      text: 'Protokolldaten sind Informationen über Ereignisse oder Aktivitäten, die in einem System oder Netzwerk protokolliert wurden. Diese Daten enthalten typischerweise Informationen wie Zeitstempel, IP-Adressen, Benutzeraktionen, Fehlermeldungen und andere Details über die Nutzung oder den Betrieb eines Systems. Protokolldaten werden oft zur Analyse von Systemproblemen, zur Sicherheitsüberwachung oder zur Erstellung von Leistungsberichten verwendet.',
                    },
                    {
                      label: 'Verantwortlicher: ',
                      text: 'Als "Verantwortlicher" wird die natürliche oder juristische Person, Behörde, Einrichtung oder andere Stelle, die allein oder gemeinsam mit anderen über die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten entscheidet, bezeichnet.',
                    },
                    {
                      label: 'Verarbeitung: ',
                      text: '"Verarbeitung" ist jeder mit oder ohne Hilfe automatisierter Verfahren ausgeführte Vorgang oder jede solche Vorgangsreihe im Zusammenhang mit personenbezogenen Daten. Der Begriff reicht weit und umfasst praktisch jeden Umgang mit Daten, sei es das Erheben, das Auswerten, das Speichern, das Übermitteln oder das Löschen.',
                    },
                  ]}
                />
              </Section>

              <ThemedText type="caption" style={styles.seal}>
                Erstellt mit kostenlosem Datenschutz-Generator.de von Dr. Thomas Schwenke
                (https://datenschutz-generator.de/)
              </ThemedText>
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 40,
    paddingTop: 10,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 10,
  },
  pageTitle: {
    textAlign: 'center',
    marginBottom: 14,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  subsection: {
    marginTop: 8,
    marginBottom: 10,
  },
  subsectionTitle: {
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 8,
  },
  list: {
    paddingLeft: 6,
    marginBottom: 8,
  },
  listItem: {
    marginBottom: 6,
  },
  seal: {
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 8,
  },
});
