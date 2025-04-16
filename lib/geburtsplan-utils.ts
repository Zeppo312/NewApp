import { Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getGeburtsplan } from './supabase';
import { formatContentForHTMLLeftColumn, formatContentForHTMLRightColumn } from '@/components/geburtsplan/formatHelpers';

// Funktion zum Generieren und Herunterladen des Geburtsplans als PDF
export const generateAndDownloadPDF = async (babyIconBase64: string | null, setIsGeneratingPDF?: (value: boolean) => void) => {
  try {
    if (setIsGeneratingPDF) {
      setIsGeneratingPDF(true);
    }

    // Geburtsplan laden
    const { data, error } = await getGeburtsplan();

    if (error) {
      console.error('Error loading geburtsplan:', error);
      Alert.alert('Fehler', 'Der Geburtsplan konnte nicht geladen werden.');
      return;
    }

    if (!data) {
      Alert.alert('Hinweis', 'Es wurde noch kein Geburtsplan erstellt.');
      return;
    }

    // Generiere den Inhalt für das PDF
    let content = '';
    
    if (data.structured_data) {
      // Wenn es einen gespeicherten Textinhalt gibt, verwenden wir diesen
      if (data.textContent) {
        content = data.textContent;
      } else {
        // Ansonsten verwenden wir den Inhalt aus der Datenbank
        content = data.content || '';
      }
    } else {
      // Wenn keine strukturierten Daten vorhanden sind, verwenden wir den Textinhalt
      content = data.content || '';
    }

    // Erstelle HTML für das PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Mein Geburtsplan</title>
        <style>
          @page {
            margin: 1.5cm;
            size: A4;
          }
          body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            margin: 0;
            padding: 0;
            color: #333;
            background-color: #FFF8F0;
            font-size: 10pt;
          }
          .container {
            max-width: 100%;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #E8D5C4;
          }
          h1 {
            color: #7D5A50;
            font-size: 18pt;
            margin: 0 0 5px 0;
          }
          h2 {
            color: #7D5A50;
            font-size: 12pt;
            margin: 10px 0 5px 0;
            border-bottom: 1px solid #E8D5C4;
            padding-bottom: 3px;
          }
          h3 {
            color: #7D5A50;
            font-size: 11pt;
            margin: 8px 0 4px 0;
          }
          p {
            margin: 4px 0;
          }
          .columns {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            gap: 20px;
          }
          .column {
            width: 48%;
          }
          .section {
            margin-bottom: 10px;
          }
          .item {
            margin-bottom: 4px;
          }
          .item-label {
            font-weight: bold;
            color: #5D4037;
          }
          .item-value {
            margin-left: 3px;
          }
          .footer {
            text-align: center;
            margin-top: 15px;
            font-size: 9pt;
            color: #7D5A50;
            font-style: italic;
            border-top: 1px solid #E8D5C4;
            padding-top: 10px;
          }
          .baby-icon {
            text-align: center;
            margin: 10px auto;
          }
          .baby-icon img {
            height: 50px;
            width: auto;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mein Geburtsplan</h1>
            <p>Erstellt am ${new Date().toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'})}</p>
          </div>
          
          <div class="columns">
            <div class="column left-column">
              ${formatContentForHTMLLeftColumn(content)}
            </div>
            <div class="column right-column">
              ${formatContentForHTMLRightColumn(content)}
            </div>
          </div>
          
          <div class="footer">
            ${babyIconBase64 ? `<div class="baby-icon"><img src="data:image/png;base64,${babyIconBase64}" alt="Baby Icon" /></div>` : ''}
            <p>Dieser Geburtsplan wurde mit der Wehen-Tracker App erstellt.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Generiere das PDF mit expo-print
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    // Teile die PDF-Datei
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Geburtsplan als PDF speichern',
        UTI: 'com.adobe.pdf'
      });
    } else {
      Alert.alert('Teilen nicht verfügbar', 'Das Teilen von Dateien wird auf diesem Gerät nicht unterstützt.');
    }

  } catch (error) {
    console.error('Fehler beim Generieren des PDFs:', error);
    Alert.alert('Fehler', 'Der Geburtsplan konnte nicht als PDF gespeichert werden.');
  } finally {
    if (setIsGeneratingPDF) {
      setIsGeneratingPDF(false);
    }
  }
};
