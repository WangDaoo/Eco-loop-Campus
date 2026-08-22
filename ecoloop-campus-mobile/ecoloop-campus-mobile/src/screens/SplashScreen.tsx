import React, { useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';

const splashMascot = require('../assets/mascot_2.png');

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Login'), 1200);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <LinearGradient colors={[colors.pink, colors.cream, colors.mint]} style={styles.container}>
      <View style={styles.mascotFrame}>
        <Image source={splashMascot} style={styles.mascotImage} resizeMode="contain" />
      </View>
      <Text style={styles.title}>Eco-loop Campus</Text>
      <Text style={styles.subtitle}>Tái chế thông minh. Sống xanh hơn.</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mascotFrame: {
    width: 156,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.green,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  mascotImage: { width: 156, height: 136 },
  title: { marginTop: 24, color: colors.ink, fontSize: 34, fontWeight: '900' },
  subtitle: { marginTop: 8, color: colors.muted, fontSize: 16, fontWeight: '700' }
});