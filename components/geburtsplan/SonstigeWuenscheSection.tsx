import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GeburtsplanSection } from './GeburtsplanSection';
import { TextInputField } from './TextInputField';
import { SonstigeWuensche } from '@/types/geburtsplan';
import { useLocale } from '@/contexts/LocaleContext';
import { translateBirthPlanText } from '@/lib/birthPlanTranslations';

interface SonstigeWuenscheSectionProps {
  data: SonstigeWuensche;
  onChange: (data: SonstigeWuensche) => void;
  containerStyle?: StyleProp<ViewStyle>;
  readOnly?: boolean;
}

export const SonstigeWuenscheSection: React.FC<SonstigeWuenscheSectionProps> = ({ data, onChange, containerStyle, readOnly = false }) => {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translateBirthPlanText>[1]) => translateBirthPlanText(locale, key);
  return (
    <GeburtsplanSection title={t('section.other')} containerStyle={containerStyle}>
      <TextInputField
        label={t('other.label')}
        value={data.freitext}
        onChangeText={(text) => {
          if (readOnly) return;
          onChange({ ...data, freitext: text });
        }}
        multiline
        numberOfLines={6}
        placeholder={t('other.placeholder')}
        readOnly={readOnly}
      />
    </GeburtsplanSection>
  );
};
