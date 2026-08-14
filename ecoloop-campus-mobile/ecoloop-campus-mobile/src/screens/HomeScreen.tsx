import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { useAppContext } from '../context/AppContext';
import { MainTabParamList, RootStackParamList } from '../types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList & MainTabParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { currentUser, points, missions, submissions, syncSource, syncError } = useAppContext();
  const [clickedTaskId, setClickedTaskId] = useState<string | null>(null);

  const openSubmission = submissions.find(
    item =>
      item.userId === currentUser.id &&
      ['CREATED', 'QR_SCANNED', 'PENDING_REVIEW', 'POINT_PENDING'].includes(item.status)
  );

  const onTaskAction = (id: string, actionLabel: string) => {
    setClickedTaskId(id);
    setTimeout(() => setClickedTaskId(null), 200);

    if (actionLabel.toLowerCase().includes('gửi rác') || actionLabel.toLowerCase().includes('quét') || actionLabel.toLowerCase().includes('scan') || id === 'scan') {
      navigation.navigate('Submit');
    } else if (actionLabel.toLowerCase().includes('đổi') || actionLabel.toLowerCase().includes('quà') || id === 'redeem') {
      navigation.navigate('Rewards');
    } else {
      Alert.alert('Thành công', `Thực hiện hành động: ${actionLabel}`);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Xin chào, {currentUser.name}</Text>
          <Text style={styles.title}>Hôm nay bạn tái chế gì?</Text>
        </View>
        <Pressable style={styles.icon} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person" size={24} color={colors.ecoDarkBlue} />
        </Pressable>
      </View>

      <View style={styles.syncWrap}>
        <SyncStatusBadge syncSource={syncSource} syncError={syncError} />
      </View>

      <View style={styles.pointsCard}>
        <Text style={styles.pointsLabel}>Ví Ecopoint</Text>
        <Text style={styles.points}>{points.toLocaleString('en-US')}</Text>
        <Text style={styles.pointsHint}>Đổi quà, voucher và ghi danh bảng xếp hạng.</Text>
      </View>

      {openSubmission && (
        <View style={styles.openQr}>
          <Text style={styles.openLabel}>QR đang mở</Text>
          <Text style={styles.openToken}>{openSubmission.qrToken}</Text>
          <Text style={styles.openMeta}>Trạng thái: {openSubmission.status}</Text>
        </View>
      )}

      {/* Web-like Glass Card for Missions */}
      <View style={styles.glassCardWrapper}>
        <View style={styles.glassCard}>
          <View style={styles.pillBadge}>
            <Text style={styles.pillText}>Nhiệm vụ tuần</Text>
          </View>

          <Text style={styles.autoProgress}>Tự động cập nhật sau khi tạo QR, gửi phản hồi hoặc đổi thưởng.</Text>

          <View style={styles.tasksContainer}>
            {missions.map(task => (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.taskInfo}>
                  <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]}>
                    {task.title}
                  </Text>
                  {task.target > 1 && (
                    <Text style={styles.taskProgress}>{task.current}/{task.target}</Text>
                  )}
                  {task.target === 1 && !task.completed && (
                    <Text style={styles.taskProgress}>Chưa hoàn thành</Text>
                  )}
                  {task.completed && (
                    <Text style={styles.taskProgressDone}>Hoàn thành</Text>
                  )}
                </View>

                <Pressable
                  disabled={task.completed}
                  onPress={() => onTaskAction(task.id, task.actionLabel)}
                  style={[
                    styles.taskButton,
                    task.completed && styles.taskButtonDone,
                    clickedTaskId === task.id && styles.taskButtonPressed
                  ]}
                >
                  <Text style={[
                    styles.taskButtonText,
                    task.completed && styles.taskButtonTextDone
                  ]}>
                    {task.actionLabel}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ height: 40 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  syncWrap: { marginBottom: 14 },
  hello: { color: colors.ecoDarkBlue, fontWeight: '900' },
  title: { color: colors.ecoDarkBlue, fontSize: 24, fontWeight: '900', maxWidth: 280, marginTop: 4 },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },

  pointsCard: { backgroundColor: colors.ecoDarkBlue, borderRadius: 20, padding: 16, marginBottom: 16 },
  pointsLabel: { color: colors.ecoPill, fontWeight: '800' },
  points: { color: colors.white, fontSize: 42, fontWeight: '900', marginTop: 4 },
  pointsHint: { color: colors.ecoBlue, fontWeight: '700', marginTop: 4 },

  openQr: { backgroundColor: colors.coral, borderRadius: 20, padding: 16, marginBottom: 16 },
  openLabel: { color: colors.white, fontWeight: '900' },
  openToken: { color: colors.white, fontSize: 24, fontWeight: '900', marginTop: 4 },
  openMeta: { color: colors.pink, fontWeight: '800', marginTop: 4 },

  glassCardWrapper: {
    marginTop: 32,
    paddingHorizontal: 4,
    marginBottom: 40,
  },
  glassCard: {
    backgroundColor: colors.ecoBlue,
    borderRadius: 20,
    borderBottomWidth: 4,
    borderBottomColor: colors.ecoCardShadow,
    paddingTop: 32,
    paddingHorizontal: 16,
    paddingBottom: 16,
    position: 'relative',
  },
  pillBadge: {
    position: 'absolute',
    top: -24,
    alignSelf: 'center',
    backgroundColor: colors.ecoPill,
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 3,
    borderColor: colors.white,
    borderBottomWidth: 5,
    borderBottomColor: '#d9eaf4',
    zIndex: 10,
  },
  pillText: {
    color: '#659bad',
    fontWeight: '900',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 18,
  },
  autoProgress: { color: '#659bad', fontWeight: '700', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 8 },
  tasksContainer: {
    marginTop: 12,
    gap: 12,
  },
  taskCard: {
    backgroundColor: '#dcf3f9',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderBottomWidth: 4,
    borderBottomColor: '#aee0eb',
  },
  taskInfo: {
    flex: 1,
    paddingRight: 12,
  },
  taskTitle: {
    color: '#5194a8',
    fontWeight: 'bold',
    fontSize: 16,
  },
  taskTitleDone: {
    color: '#a0aec0',
    textDecorationLine: 'line-through',
  },
  taskProgress: {
    color: '#659bad',
    fontWeight: '600',
    marginTop: 4,
  },
  taskProgressDone: {
    color: '#48bb78',
    fontWeight: '600',
    marginTop: 4,
  },
  taskButton: {
    backgroundColor: colors.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderBottomWidth: 4,
    borderBottomColor: '#d9eaf4',
  },
  taskButtonDone: {
    backgroundColor: '#e2e8f0',
    borderBottomWidth: 0,
    marginTop: 4, // compensate for border loss
  },
  taskButtonPressed: {
    borderBottomWidth: 0,
    transform: [{ translateY: 4 }],
  },
  taskButtonText: {
    color: '#659bad',
    fontWeight: 'bold',
  },
  taskButtonTextDone: {
    color: '#a0aec0',
  }
});
