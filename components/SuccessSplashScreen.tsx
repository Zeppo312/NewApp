import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Modal } from 'react-native';

interface SuccessSplashScreenProps {
  visible: boolean;
  onFinish: () => void;
  backgroundColor: string;
}

const SuccessSplashScreen: React.FC<SuccessSplashScreenProps> = ({ visible, onFinish, backgroundColor }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.back(1.5),
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(onFinish, 1500);
      return () => clearTimeout(timer);
    }
  }, [visible, onFinish, scaleAnim]);

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={[styles.container, { backgroundColor }]}>
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
          <Animated.Text style={styles.icon}>✓</Animated.Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    color: '#FFFFFF',
    fontSize: 70,
    fontWeight: 'bold',
  },
});

export default SuccessSplashScreen;
