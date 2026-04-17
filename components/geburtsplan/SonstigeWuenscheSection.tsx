import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GeburtsplanSection } from './GeburtsplanSection';
import { TextInputField } from './TextInputField';
import { SonstigeWuensche } from '@/types/geburtsplan';

interface SonstigeWuenscheSectionProps {
  data: SonstigeWuensche;
  onChange: (data: SonstigeWuensche) => void;
  containerStyle?: StyleProp<ViewStyle>;
  readOnly?: boolean;
}

export const SonstigeWuenscheSection: React.FC<SonstigeWuenscheSectionProps> = ({ data, onChange, containerStyle, readOnly = false }) => {
  return (
    <GeburtsplanSection title="6. Sonstige Wünsche / Hinweise" containerStyle={containerStyle}>
      <TextInputField
        label="Weitere Wünsche und Hinweise"
        value={data.freitext}
        onChangeText={(text) => {
          if (readOnly) return;
          onChange({ ...data, freitext: text });
        }}
        multiline
        numberOfLines={6}
        placeholder="Hier kannst du weitere Wünsche und Hinweise eintragen, die in den vorherigen Kategorien nicht abgedeckt wurden..."
        readOnly={readOnly}
      />
    </GeburtsplanSection>
  );
};
