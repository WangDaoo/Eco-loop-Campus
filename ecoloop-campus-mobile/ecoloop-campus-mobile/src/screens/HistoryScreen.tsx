import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { useAppContext } from '../context/AppContext';
import { getPredictionStatusText, getPredictionStatusTone, getPredictionSubtitle } from '../services/predictionPresentation';
import { RewardRedemption } from '../types';
import { colors } from '../theme/colors';

function redemptionStatusText(status: RewardRedemption['status']) {
  switch (status) {
    case 'approved':
      return 'Đã duyệt';
    case 'delivered':
      return 'Đã nhận';
    case 'rejected':
      return 'Bị từ chối';
    case 'requested':
    default:
      return 'Chờ duyệt';
  }
}

export default function HistoryScreen() {
  const { aiPredictions, currentUser, pointTransactions, rewardRedemptions, submissions, stations, wasteTypes } = useAppContext();
  const userSubmissions =
    currentUser.role === 'student'
      ? submissions.filter(item => item.userId === currentUser.id)
      : submissions.filter(
          item =>
            item.verifiedBy === currentUser.id ||
            ['QR_SCANNED', 'CREATED', 'PENDING_REVIEW', 'POINT_PENDING'].includes(item.status)
        );
  const userTransactions =
    currentUser.role === 'student'
      ? pointTransactions.filter(item => item.userId === currentUser.id)
      : pointTransactions.filter(item => userSubmissions.some(submission => submission.id === item.submissionId));
  const userRewardRedemptions = rewardRedemptions.filter(item => item.userId === currentUser.id);
  const userAiPredictions =
    currentUser.role === 'student' ? aiPredictions.filter(item => item.userId === currentUser.id) : aiPredictions;

  return (
    <Screen>
      <Text style={styles.title}>{currentUser.role === 'student' ? 'Lịch sử của bạn' : 'Lịch sử xác minh'}</Text>
      <Text style={styles.section}>Giao dịch tái chế</Text>
      {userSubmissions.map(item => {
        const station = stations.find(stationItem => stationItem.id === item.binId);
        const waste = wasteTypes.find(wasteItem => wasteItem.id === item.wasteTypeId);
        return (
          <Card key={item.id} style={styles.item}>
            <View style={styles.row}>
              <Text style={styles.action}>{waste?.name ?? item.wasteTypeId}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
            <Text style={styles.time}>{item.quantity} {item.unit} tại {station?.name ?? item.binId}</Text>
            <Text style={styles.time}>QR: {item.qrToken}</Text>
            {item.actualQuantity ? <Text style={styles.time}>Thực tế: {item.actualQuantity} {item.unit}</Text> : null}
            {item.volunteerNote ? <Text style={styles.time}>Ghi chú: {item.volunteerNote}</Text> : null}
            {item.proofImage ? <Text style={styles.time}>Ảnh chứng minh: {item.proofImage.imageUrl}</Text> : null}
          </Card>
        );
      })}

      <Text style={styles.section}>Lịch sử AI</Text>
      {userAiPredictions.length ? (
        userAiPredictions.map(item => {
          const station = stations.find(stationItem => stationItem.id === item.binId);
          const tone = getPredictionStatusTone(item.status);
          return (
            <Card key={item.id} style={styles.item}>
              <View style={styles.row}>
                <Text style={styles.action}>Class AI: {item.className}</Text>
                <Text style={[styles.statusBadge, styles[tone]]}>{getPredictionStatusText(item.status)}</Text>
              </View>
              <Text style={styles.time}>{getPredictionSubtitle(item, station?.name)}</Text>
              <Text style={styles.time}>{item.timestamp.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</Text>
              {item.imageName ? <Text style={styles.time}>Ảnh: {item.imageName}</Text> : null}
            </Card>
          );
        })
      ) : (
        <View style={styles.emptyContainer}>
          <Image source={require('../assets/mascot_2.png')} style={styles.mascot} />
          <Text style={styles.empty}>Chưa có lượt AI nào được lưu.</Text>
        </View>
      )}

      <Text style={styles.section}>Lịch sử Ecopoint</Text>
      {userTransactions.map(item => (
        <Card key={item.id} style={styles.item}>
          <Text style={styles.action}>{item.description}</Text>
          <Text style={[styles.amount, item.type === 'earn' ? styles.earn : styles.spend]}>{item.type === 'earn' ? '+' : '-'}{item.points} Ecopoint</Text>
          <Text style={styles.time}>{item.createdAt.toLocaleDateString('vi-VN')} - {item.status}</Text>
        </Card>
      ))}

      <Text style={styles.section}>Yêu cầu đổi thưởng</Text>
      {userRewardRedemptions.length ? (
        userRewardRedemptions.map(item => (
          <Card key={item.id} style={styles.item}>
            <View style={styles.row}>
              <Text style={styles.action}>{item.rewardLabel}</Text>
              <Text style={styles.status}>{redemptionStatusText(item.status)}</Text>
            </View>
            <Text style={styles.amount}>-{item.costPoints} Ecopoint</Text>
            <Text style={styles.time}>{item.requestedAt.toLocaleDateString('vi-VN')}</Text>
            {item.adminNote ? <Text style={styles.time}>Ghi chú admin: {item.adminNote}</Text> : null}
          </Card>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Image source={require('../assets/eco_cloud.png')} style={styles.mascot} />
          <Text style={styles.empty}>Chưa có yêu cầu đổi thưởng.</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', marginBottom: 14 },
  section: { color: colors.green, fontSize: 19, fontWeight: '900', marginTop: 8, marginBottom: 10 },
  item: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  action: { color: colors.ink, fontSize: 17, fontWeight: '900', flex: 1 },
  status: { color: colors.coralDark, fontWeight: '900' },
  statusBadge: { borderRadius: 12, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '900' },
  success: { backgroundColor: colors.mint, color: colors.green },
  warning: { backgroundColor: colors.gold, color: colors.ink },
  danger: { backgroundColor: colors.coral, color: colors.white },
  amount: { color: colors.coralDark, fontSize: 18, fontWeight: '900', marginTop: 5 },
  earn: { color: colors.green },
  spend: { color: colors.coralDark },
  time: { color: colors.muted, marginTop: 4 },
  emptyContainer: { alignItems: 'center', marginVertical: 20 },
  mascot: { width: 120, height: 120, resizeMode: 'contain', marginBottom: 12 },
  empty: { color: colors.muted, fontWeight: '700', textAlign: 'center' }
});
