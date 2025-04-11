import React from 'react';
import { GeburtsplanSection } from './GeburtsplanSection';
import { TextInputField } from './TextInputField';
import { SonstigeWuensche } from '@/types/geburtsplan';

interface SonstigeWuenscheSectionProps {
  data: SonstigeWuensche;
  onChange: (data: SonstigeWuensche) => void;
}

export const SonstigeWuenscheSection: React.FC<SonstigeWuenscheSectionProps> = ({ data, onChange }) => {
  return (
    <GeburtsplanSection title="6. Sonstige Wünsche / Hinweise">
      <TextInputField
        label="Weitere Wünsche und Hinweise"
        value={data.freitext}
        onChangeText={(text) => onChange({ ...data, freitext: text })}
        multiline
        numberOfLines={6}
        placeholder="Hier kannst du weitere Wünsche und Hinweise eintragen, die in den vorherigen Kategorien nicht abgedeckt wurden..."
      />
    </GeburtsplanSection>
  );
};
