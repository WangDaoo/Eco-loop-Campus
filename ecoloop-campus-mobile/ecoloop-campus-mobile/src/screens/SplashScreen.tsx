import React, { useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Login'), 1200);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <LinearGradient colors={[colors.pink, colors.cream, colors.mint]} style={styles.container}>
      <View style={styles.logo}><Text style={styles.logoText}>E</Text></View>
      <Text style={styles.title}>Ecoloop Campus</Text>
      <Text style={styles.subtitle}>Recycle smarter. Earn greener.</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 118, height: 118, borderRadius: 42, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  logoText: { color: colors.white, fontSize: 74, fontWeight: '900' },
  title: { marginTop: 26, color: colors.ink, fontSize: 34, fontWeight: '900' },
  subtitle: { marginTop: 8, color: colors.muted, fontSize: 16, fontWeight: '700' }
});
