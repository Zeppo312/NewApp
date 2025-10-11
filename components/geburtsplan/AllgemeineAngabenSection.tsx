import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GeburtsplanSection } from './GeburtsplanSection';
import { TextInputField } from './TextInputField';
import { AllgemeineAngaben } from '@/types/geburtsplan';

interface AllgemeineAngabenSectionProps {
  data: AllgemeineAngaben;
  onChange: (data: AllgemeineAngaben) => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export const AllgemeineAngabenSection: React.FC<AllgemeineAngabenSectionProps> = ({ data, onChange, containerStyle }) => {
  const handleChange = (field: keyof AllgemeineAngaben, value: string) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <GeburtsplanSection title="1. Allgemeine Angaben" containerStyle={containerStyle}>
      <TextInputField
        label="Name der Mutter"
        value={data.mutterName}
        onChangeText={(text) => handleChange('mutterName', text)}
        placeholder="z.B. Lisa Müller"
      />
      <TextInputField
        label="Entbindungstermin (ET)"
        value={data.entbindungstermin}
        onChangeText={(text) => handleChange('entbindungstermin', text)}
        placeholder="z.B. 01.06.2025"
      />
      <TextInputField
        label="Geburtsklinik / Hausgeburt"
        value={data.geburtsklinik}
        onChangeText={(text) => handleChange('geburtsklinik', text)}
        placeholder="z.B. Krankenhaus XY"
      />
      <TextInputField
        label="Begleitperson(en)"
        value={data.begleitpersonen}
        onChangeText={(text) => handleChange('begleitpersonen', text)}
        placeholder="z.B. Max Müller (Partner), Hebamme Laura"
      />
    </GeburtsplanSection>
  );
};
