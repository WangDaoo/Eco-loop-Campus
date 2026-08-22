import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, Image } from 'react-native';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { UserAvatar } from '../components/UserAvatar';
import { useAppContext } from '../context/AppContext';
import { selectLeaderboardUsers } from '../services/leaderboard';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Leaderboard'>;

export default function LeaderboardScreen({ navigation }: Props) {
  const { users, currentUser } = useAppContext();
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
      ) : rows.map(row => {
        const sourceUser = users.find(item => item.id === row.id);
        const isCurrentUser = row.id === currentUser.id;

        return (
          <Card key={row.id} style={[styles.row, isCurrentUser && styles.currentUserRow]}>
            <View style={[styles.rank, row.rank === 1 && styles.top]}><Text style={styles.rankText}>{row.rank}</Text></View>
            <View style={styles.avatarSlot}>
              <UserAvatar avatarKey={sourceUser?.avatarKey} avatarUrl={sourceUser?.avatarUrl} size={50} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{row.name}</Text>
              <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">{row.displayMeta}</Text>
            </View>
            <Text style={styles.point} numberOfLines={1} ellipsizeMode="tail">{row.points.toLocaleString('vi-VN')}</Text>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.coralDark, fontWeight: '900', marginBottom: 10 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '900', marginBottom: 14 },
  row: { width: '92%', alignSelf: 'center', minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingVertical: 12, paddingHorizontal: 14 },
  currentUserRow: { borderWidth: 2, borderColor: colors.coral, backgroundColor: '#fffaf1' },
  rowBody: { flex: 1, minWidth: 0, paddingRight: 6 },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  mascot: { width: 160, height: 160, resizeMode: 'contain', marginBottom: 16 },
  avatarSlot: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rank: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  top: { backgroundColor: colors.gold },
  rankText: { color: colors.ink, fontWeight: '900', fontSize: 16 },
  name: { color: colors.ink, fontWeight: '900', fontSize: 15 },
  meta: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  point: { color: colors.green, fontWeight: '900', fontSize: 15, minWidth: 66, textAlign: 'right', flexShrink: 0 }
});
