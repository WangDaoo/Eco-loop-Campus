import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, Image } from 'react-native';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { useAppContext } from '../context/AppContext';
import { selectLeaderboardUsers } from '../services/leaderboard';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Leaderboard'>;

export default function LeaderboardScreen({ navigation }: Props) {
  const { users } = useAppContext();
  const rows = selectLeaderboardUsers(users, 20);

  return (
    <Screen>
      <Text style={styles.back} onPress={() => navigation.goBack()}>Quay lại</Text>
      <Text style={styles.title}>Bảng xếp hạng</Text>
      {rows.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Image source={require('../assets/mascot_1.png')} style={styles.mascot} />
          <Text style={styles.meta}>Chưa có dữ liệu Ecopoint.</Text>
        </View>
      ) : rows.map(row => (
        <Card key={row.id} style={styles.row}>
          <View style={[styles.rank, row.rank === 1 && styles.top]}><Text style={styles.rankText}>{row.rank}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.name}>{row.name}</Text><Text style={styles.meta}>{row.displayMeta}</Text></View>
          <Text style={styles.point}>{row.points.toLocaleString('en-US')}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.coralDark, fontWeight: '900', marginBottom: 10 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  mascot: { width: 160, height: 160, resizeMode: 'contain', marginBottom: 16 },
  rank: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  top: { backgroundColor: colors.gold },
  rankText: { color: colors.ink, fontWeight: '900', fontSize: 18 },
  name: { color: colors.ink, fontWeight: '900', fontSize: 17 },
  meta: { color: colors.muted, fontWeight: '700' },
  point: { color: colors.green, fontWeight: '900', fontSize: 18 }
});