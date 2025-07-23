// Hilfsfunktion zum Formatieren des Inhalts
export const formatContent = (content: string): string => {
  // Ersetze Zeilenumbrüche durch <br>
  let formattedContent = content.replace(/\n/g, '<br>');
  
  // Ersetze Markdown-Überschriften durch HTML-Überschriften und entferne die Hashtags
  formattedContent = formattedContent.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  formattedContent = formattedContent.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  
  // Entferne alle verbliebenen Hashtags am Anfang von Zeilen
  formattedContent = formattedContent.replace(/^#+ (.*)(<br>|$)/gm, '<h3>$1</h3>');
  
  // Formatiere Schlüssel-Wert-Paare (z.B. "Name der Mutter: Anna")
  formattedContent = formattedContent.replace(/(.*?): (.*?)(<br>|$)/g, '<div class="item"><span class="item-label">$1:</span> <span class="item-value">$2</span></div>');
  
  return formattedContent;
};

// Funktion zum Formatieren der linken Spalte (Abschnitte 1-3)
export const formatContentForHTMLLeftColumn = (content: string): string => {
  // Extrahiere die ersten drei Abschnitte (1-3)
  const sections = content.split(/\n\n/);
  let leftColumnContent = '';
  
  // Abschnitt 1: Allgemeine Angaben
  if (sections.length > 0 && sections[0].includes('GEBURTSPLAN')) {
    leftColumnContent += sections[0] + '\n\n';
  }
  
  // Abschnitt 1: Allgemeine Angaben
  const section1Index = sections.findIndex(s => s.includes('1. Allgemeine Angaben'));
  if (section1Index !== -1) {
    leftColumnContent += sections[section1Index] + '\n\n';
  }
  
  // Abschnitt 2: Wünsche zur Geburt
  const section2Index = sections.findIndex(s => s.includes('2. Wünsche zur Geburt'));
  if (section2Index !== -1) {
    leftColumnContent += sections[section2Index] + '\n\n';
  }
  
  // Abschnitt 3: Medizinische Eingriffe
  const section3Index = sections.findIndex(s => s.includes('3. Medizinische Eingriffe'));
  if (section3Index !== -1) {
    leftColumnContent += sections[section3Index] + '\n\n';
  }
  
  // Formatiere den Inhalt
  let formattedContent = formatContent(leftColumnContent);
  
  // Gruppiere Abschnitte
  formattedContent = formattedContent.replace(/<h2>(.*?)<\/h2>/g, '</div><div class="section"><h2>$1</h2>');
  
  // Schließe den ersten Abschnitt und füge einen öffnenden div für den ersten Abschnitt hinzu
  formattedContent = '<div class="section">' + formattedContent + '</div>';
  
  // Entferne leere Abschnitte
  formattedContent = formattedContent.replace(/<div class="section"><\/div>/g, '');
  
  return formattedContent;
};

// Funktion zum Formatieren der rechten Spalte (Abschnitte 4-5)
export const formatContentForHTMLRightColumn = (content: string): string => {
  // Extrahiere die letzten zwei Abschnitte (4-5)
  const sections = content.split(/\n\n/);
  let rightColumnContent = '';
  
  // Abschnitt 4: Nach der Geburt
  const section4Index = sections.findIndex(s => s.includes('4. Nach der Geburt'));
  if (section4Index !== -1) {
    rightColumnContent += sections[section4Index] + '\n\n';
  }
  
  // Abschnitt 5: Für den Notfall / Kaiserschnitt
  const section5Index = sections.findIndex(s => s.includes('5. Für den Notfall'));
  if (section5Index !== -1) {
    rightColumnContent += sections[section5Index] + '\n\n';
  }
  
  // Abschnitt 6: Sonstige Wünsche / Hinweise
  const section6Index = sections.findIndex(s => s.includes('6. Sonstige Wünsche'));
  if (section6Index !== -1) {
    rightColumnContent += sections[section6Index] + '\n\n';
  }
  
  // Formatiere den Inhalt
  let formattedContent = formatContent(rightColumnContent);
  
  // Gruppiere Abschnitte
  formattedContent = formattedContent.replace(/<h2>(.*?)<\/h2>/g, '</div><div class="section"><h2>$1</h2>');
  
  // Schließe den ersten Abschnitt und füge einen öffnenden div für den ersten Abschnitt hinzu
  formattedContent = '<div class="section">' + formattedContent + '</div>';
  
  // Entferne leere Abschnitte
  formattedContent = formattedContent.replace(/<div class="section"><\/div>/g, '');
  
  return formattedContent;
};
