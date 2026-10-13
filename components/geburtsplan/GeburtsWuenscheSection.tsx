import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { GeburtsplanSection } from './GeburtsplanSection';
import { OptionGroup } from './OptionGroup';
import { CheckboxOption } from './CheckboxOption';
import { RadioOption } from './RadioOption';
import { TextInputField } from './TextInputField';
import { GeburtsWuensche } from '@/types/geburtsplan';
import { useLocale } from '@/contexts/LocaleContext';
import { getBirthPlanOptions, localizeBirthPlanOptionValue, translateBirthPlanText } from '@/lib/birthPlanTranslations';

interface GeburtsWuenscheSectionProps {
  data: GeburtsWuensche;
  onChange: (data: GeburtsWuensche) => void;
  containerStyle?: StyleProp<ViewStyle>;
  readOnly?: boolean;
}

export const GeburtsWuenscheSection: React.FC<GeburtsWuenscheSectionProps> = ({ data, onChange, containerStyle, readOnly = false }) => {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translateBirthPlanText>[1]) => translateBirthPlanText(locale, key);
  // Geburtspositionen
  const geburtspositionenOptions = getBirthPlanOptions(locale, 'positions').map(({ label }) => label);
  
  const toggleGeburtsposition = (option: string) => {
    if (readOnly) return;
    const normalized = data.geburtspositionen.map((value) => localizeBirthPlanOptionValue(locale, value));
    const newPositionen = normalized.includes(option) ? normalized.filter(pos => pos !== option) : [...normalized, option];
    
    onChange({
      ...data,
      geburtspositionen: newPositionen,
    });
  };

  // Schmerzmittel
  const schmerzmittelOptions = getBirthPlanOptions(locale, 'painRelief').map(({ label }) => label);
  
  const toggleSchmerzmittel = (option: string) => {
    if (readOnly) return;
    const normalized = data.schmerzmittel.map((value) => localizeBirthPlanOptionValue(locale, value));
    const newSchmerzmittel = normalized.includes(option) ? normalized.filter(sm => sm !== option) : [...normalized, option];
    
    onChange({
      ...data,
      schmerzmittel: newSchmerzmittel,
    });
  };

  // Rolle der Begleitperson
  const rolleOptions = getBirthPlanOptions(locale, 'companionRole').map(({ label }) => label);
  
  const selectRolle = (option: string) => {
    if (readOnly) return;
    onChange({
      ...data,
      rolleBegleitperson: option,
    });
  };

  // Musik / Atmosphäre
  const atmosphaereOptions = getBirthPlanOptions(locale, 'atmosphere').map(({ label }) => label);
  
  const toggleAtmosphaere = (option: string) => {
    if (readOnly) return;
    const normalized = data.musikAtmosphaere.map((value) => localizeBirthPlanOptionValue(locale, value));
    const newAtmosphaere = normalized.includes(option) ? normalized.filter(atm => atm !== option) : [...normalized, option];
    
    onChange({
      ...data,
      musikAtmosphaere: newAtmosphaere,
    });
  };

  return (
    <GeburtsplanSection title={t('section.birthWishes')} containerStyle={containerStyle}>
      <OptionGroup label={t('birthWishes.positions')}>
        {geburtspositionenOptions.map((option) => (
          <CheckboxOption
            key={option}
            label={option}
            checked={data.geburtspositionen.some((value) => localizeBirthPlanOptionValue(locale, value) === option)}
            onToggle={() => toggleGeburtsposition(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label={t('birthWishes.painRelief')}>
        {schmerzmittelOptions.map((option) => (
          <CheckboxOption
            key={option}
            label={option}
            checked={data.schmerzmittel.some((value) => localizeBirthPlanOptionValue(locale, value) === option)}
            onToggle={() => toggleSchmerzmittel(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label={t('birthWishes.companionRole')}>
        {rolleOptions.map((option) => (
          <RadioOption
            key={option}
            label={option}
            selected={localizeBirthPlanOptionValue(locale, data.rolleBegleitperson) === option}
            onSelect={() => selectRolle(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <OptionGroup label={t('birthWishes.atmosphere')}>
        {atmosphaereOptions.map((option) => (
          <CheckboxOption
            key={option}
            label={option}
            checked={data.musikAtmosphaere.some((value) => localizeBirthPlanOptionValue(locale, value) === option)}
            onToggle={() => toggleAtmosphaere(option)}
            disabled={readOnly}
          />
        ))}
      </OptionGroup>

      <TextInputField
        label={t('birthWishes.other')}
        value={data.sonstigeWuensche}
        onChangeText={(text) => {
          if (readOnly) return;
          onChange({ ...data, sonstigeWuensche: text });
        }}
        multiline
        numberOfLines={3}
        placeholder={t('birthWishes.otherPlaceholder')}
        readOnly={readOnly}
      />
    </GeburtsplanSection>
  );
};
