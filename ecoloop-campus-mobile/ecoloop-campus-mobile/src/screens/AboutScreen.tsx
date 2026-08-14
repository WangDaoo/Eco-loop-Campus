import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export default function AboutScreen({ navigation }: Props) {
  return (
    <Screen>
      <Text style={styles.back} onPress={() => navigation.goBack()}>Back</Text>
      <Text style={styles.title}>Ve Ecoloop Campus</Text>
      <Card>
        <Text style={styles.body}>Ecoloop Campus giup sinh vien phan loai rac, quet QR tai tram thu gom va tich diem doi thuong. Muc tieu la bien moi hanh dong xanh thanh mot vong lap co gia tri.</Text>
      </Card>
      <Card style={styles.card}><Text style={styles.stat}>3+</Text><Text style={styles.label}>tram thu gom trong campus</Text></Card>
      <Card style={styles.card}><Text style={styles.stat}>50</Text><Text style={styles.label}>diem cho moi lan quet hop le</Text></Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.coralDark, fontWeight: '900', marginBottom: 10 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', marginBottom: 14 },
  body: { color: colors.ink, fontSize: 17, lineHeight: 25, fontWeight: '700' },
  card: { marginTop: 12 },
  stat: { color: colors.green, fontSize: 40, fontWeight: '900' },
  label: { color: colors.muted, fontWeight: '800' }
});
