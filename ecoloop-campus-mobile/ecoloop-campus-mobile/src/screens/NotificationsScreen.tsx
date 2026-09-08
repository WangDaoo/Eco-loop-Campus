import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { useAppContext } from '../context/AppContext';
import { colors, radius } from '../theme/colors';

export default function NotificationsScreen() {
  const { notifications, markNotificationRead } = useAppContext();

  return (
    <Screen scroll>
      <Text style={styles.title}>Trung tâm thông báo</Text>
      <Text style={styles.subtitle}>Cập nhật kết quả duyệt giao dịch gửi rác của bạn.</Text>

      {notifications.length ? notifications.map(notification => (
        <Pressable
          key={notification.id}
          onPress={() => {
            if (!notification.readAt) void markNotificationRead(notification.id);
          }}
        >
          <Card style={[styles.notice, !notification.readAt && styles.unreadNotice]}>
            <View style={styles.noticeHeader}>
              <Text style={styles.noticeTitle}>{notification.title}</Text>
              {!notification.readAt ? <Text style={styles.unreadBadge}>Chưa đọc</Text> : null}
            </View>
            <Text style={styles.message}>{notification.message}</Text>
            <Text style={styles.time}>{notification.createdAt.toLocaleString('vi-VN')}</Text>
          </Card>
        </Pressable>
      )) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
          <Text style={styles.message}>Kết quả duyệt và lý do từ chối sẽ xuất hiện tại đây.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.muted, fontWeight: '700', marginTop: 6, marginBottom: 16 },
  notice: { marginBottom: 10 },
  unreadNotice: { borderWidth: 2, borderColor: colors.green },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  noticeTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', flex: 1 },
  unreadBadge: { backgroundColor: colors.mint, color: colors.green, borderRadius: radius.md, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  message: { color: colors.muted, lineHeight: 20, fontWeight: '700', marginTop: 7 },
  time: { color: colors.muted, fontSize: 12, marginTop: 8 },
  emptyCard: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
});
