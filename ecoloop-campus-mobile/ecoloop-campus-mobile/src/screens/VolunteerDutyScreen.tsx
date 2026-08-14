import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { useAppContext } from '../context/AppContext';
import { QRScanLog } from '../types';
import { colors, radius } from '../theme/colors';

function qrResultText(result: QRScanLog['result']) {
  switch (result) {
    case 'SUCCESS':
      return 'Hợp lệ';
    case 'EXPIRED':
      return 'Hết hạn';
    case 'ALREADY_USED':
      return 'Đã dùng';
    case 'WRONG_STATION':
      return 'Sai trạm';
    case 'INVALID_ROLE':
      return 'Sai vai trò';
    case 'SUSPECTED_FRAUD':
      return 'Nghi gian lận';
    case 'INVALID_TOKEN':
    default:
      return 'QR không hợp lệ';
  }
}

export default function VolunteerDutyScreen() {
  const { currentUser, qrScanLogs, stations, submissions, dutyStationId, setDutyStation } = useAppContext();
  const activeSubmissions = submissions.filter(
    item => item.binId === dutyStationId && (item.status === 'CREATED' || item.status === 'QR_SCANNED')
  );
  const selectedStation = stations.find(item => item.id === dutyStationId);
  const recentQrScanLogs = qrScanLogs
    .filter(item => item.stationId === dutyStationId || item.scannedBy === currentUser.id)
    .slice(0, 5);

  return (
    <Screen>
      <Text style={styles.kicker}>{currentUser.group}</Text>
      <Text style={styles.title}>Ca trực tình nguyện viên</Text>
      <Card style={styles.summary}>
        <Text style={styles.summaryLabel}>Trạm đang trực</Text>
        <Text style={styles.summaryStation}>{selectedStation?.name ?? 'Chưa chọn trạm'}</Text>
        <Text style={styles.summaryLabel}>Giao dịch đang chờ xử lý</Text>
        <Text style={styles.summaryValue}>{activeSubmissions.length}</Text>
      </Card>
      <Text style={styles.section}>Trạm phụ trách</Text>
      {stations.map(station => (
        <Pressable key={station.id} onPress={() => setDutyStation(station.id)}>
          <Card style={[styles.station, station.id === dutyStationId && styles.stationActive]}>
            <Text style={styles.stationTitle}>{station.name}</Text>
            <Text style={styles.stationMeta}>{station.location} - {station.status} - {station.capacity}% sức chứa</Text>
            <Text style={styles.stationHint}>{station.id === dutyStationId ? 'Đang chọn' : 'Chạm để nhận ca'}</Text>
          </Card>
        </Pressable>
      ))}

      <Text style={styles.section}>Log quét QR gần đây</Text>
      {recentQrScanLogs.length ? (
        recentQrScanLogs.map(log => (
          <Card key={log.id} style={styles.logCard}>
            <View style={styles.logRow}>
              <Text style={styles.logToken}>{log.qrToken}</Text>
              <Text style={[styles.logResult, log.result === 'SUCCESS' ? styles.logResultOk : styles.logResultWarn]}>{qrResultText(log.result)}</Text>
            </View>
            <Text style={styles.logMeta}>{log.scannedAt.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</Text>
            {log.note ? <Text style={styles.logMeta}>{log.note}</Text> : null}
          </Card>
        ))
      ) : (
        <Text style={styles.empty}>Chưa có log quét QR tại ca trực này.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.green, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', marginBottom: 14 },
  summary: { backgroundColor: colors.green, marginBottom: 18 },
  summaryLabel: { color: colors.mint, fontWeight: '800' },
  summaryStation: { color: colors.white, fontSize: 20, fontWeight: '900', marginTop: 4, marginBottom: 12 },
  summaryValue: { color: colors.white, fontSize: 46, fontWeight: '900', marginTop: 4 },
  section: { color: colors.ink, fontSize: 21, fontWeight: '900', marginBottom: 10 },
  station: { marginBottom: 10 },
  stationActive: { borderWidth: 2, borderColor: colors.green, borderRadius: radius.lg },
  stationTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  stationMeta: { color: colors.muted, marginTop: 4, fontWeight: '700' },
  stationHint: { color: colors.coralDark, marginTop: 8, fontWeight: '900' },
  logCard: { marginBottom: 10 },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  logToken: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '900' },
  logResult: { borderRadius: radius.sm, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '900' },
  logResultOk: { backgroundColor: colors.mint, color: colors.green },
  logResultWarn: { backgroundColor: colors.cream, color: colors.coralDark },
  logMeta: { color: colors.muted, marginTop: 5, fontWeight: '700' },
  empty: { color: colors.muted, fontWeight: '700', marginBottom: 12 }
});