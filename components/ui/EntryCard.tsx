import { View, StyleSheet, ViewProps } from 'react-native';
import { CardBorder, CardBg, Shadow } from '@/constants/Colors';

export default function EntryCard(
  { style, children, ...rest }: ViewProps & { children: React.ReactNode }
) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CardBorder,
    backgroundColor: CardBg,
    shadowColor: '#000',
    shadowOffset: { width: Shadow.width, height: Shadow.height },
    shadowOpacity: Shadow.opacity,
    shadowRadius: Shadow.radius,
    elevation: 3,
  },
}); 