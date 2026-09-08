import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { useAppContext } from '../context/AppContext';
import { launchImageLibraryWithFallback } from '../services/imagePickerFallback';
import { extractSubmissionQrToken } from '../services/qrPayload';
import { getSubmissionStatusLabel, getWasteTypeDisplayName } from '../services/submissionPresentation';
import { colors, radius } from '../theme/colors';
import type { RecyclingSubmission } from '../types';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isMissingCameraActivity(error: unknown) {
  return messageOf(error).includes('Failed to resolve activity');
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { width: windowWidth } = useWindowDimensions();
  const {
    confirmSubmission,
    dutyStationId,
    markSubmissionScanned,
    rejectSubmission,
    unlockManualReview,
    attachProofImage,
    scanRewardRedemption,
    stations,
    submissions,
    wasteTypes
  } = useAppContext();
  const [enabled, setEnabled] = useState(false);
  const [manualQrToken, setManualQrToken] = useState('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [actualQuantity, setActualQuantity] = useState('');
  const [volunteerNote, setVolunteerNote] = useState('');
  const [proofImageUri, setProofImageUri] = useState('');
  const selectedSubmission = submissions.find(item => item.id === selectedSubmissionId);
  const canConfirmSubmission = selectedSubmission?.status === 'QR_SCANNED'
    || (selectedSubmission?.status === 'PENDING_REVIEW' && Boolean(selectedSubmission?.manualReviewUnlockedAt));
  const canUseManualReview = selectedSubmission?.status === 'CREATED' && selectedSubmission.binId === dutyStationId;
  const selectedStation = stations.find(item => item.id === (selectedSubmission?.binId ?? dutyStationId));
  const selectedWasteName = selectedSubmission ? getWasteTypeDisplayName(wasteTypes, selectedSubmission.wasteTypeId) : '';
  const scannerSize = Math.max(220, Math.min(300, windowWidth - 96));
  const scanFrameSize = Math.min(210, scannerSize - 48);
  const allPendingSubmissions = submissions.filter(item => ['CREATED', 'QR_SCANNED', 'PENDING_REVIEW'].includes(item.status));
  const pendingAtDuty = allPendingSubmissions.filter(item => item.binId === dutyStationId);

  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused && permission?.granted) {
      setEnabled(true);
    } else {
      setEnabled(false);
    }
  }, [isFocused, permission?.granted]);

  const startScan = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Cần quyền camera', 'Hãy cấp quyền camera để quét QR.');
        return;
      }
    }
    setEnabled(true);
  };

  const captureProofImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Cần quyền camera', 'Hãy cấp quyền camera để chụp ảnh minh chứng.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.72, allowsEditing: false });
      if (!result.canceled && result.assets[0]?.uri) setProofImageUri(result.assets[0].uri);
    } catch (error) {
      if (isMissingCameraActivity(error)) {
        Alert.alert('Không mở được camera', 'Thiết bị chưa mở được camera. Bạn có thể chọn ảnh minh chứng từ thư viện để tiếp tục.');
        await pickProofImage();
        return;
      }
      Alert.alert('Không mở được camera', messageOf(error));
    }
  };

  const pickProofImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Cần quyền ảnh', 'Hãy cấp quyền thư viện ảnh để chọn ảnh minh chứng.');
      return;
    }
    try {
      const result = await launchImageLibraryWithFallback({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.72 });
      if (!result.canceled && result.assets[0]?.uri) setProofImageUri(result.assets[0].uri);
    } catch (error) {
      Alert.alert('Không mở được thư viện ảnh', messageOf(error));
    }
  };

  const openSubmissionForReview = (submission: RecyclingSubmission) => {
    setSelectedSubmissionId(submission.id);
    setActualQuantity(String(submission.actualQuantity ?? submission.quantity));
    setVolunteerNote('');
    setProofImageUri('');
  };

  const openPendingSubmission = (submission: RecyclingSubmission) => {
    openSubmissionForReview(submission);
  };

  const loadQr = async (qrToken: string) => {
    const token = extractSubmissionQrToken(qrToken);
    if (!token) {
      Alert.alert('Chưa có QR', 'Nhập hoặc quét QR giao dịch.');
      return;
    }
    if (token.startsWith('ECL-REWARD-')) {
      try {
        await scanRewardRedemption(token);
        Alert.alert('Đổi thưởng thành công', 'Điểm đã được trừ và yêu cầu đổi thưởng đã được xác nhận.');
      } catch (error) {
        Alert.alert('Không thể đổi thưởng', messageOf(error));
      }
      return;
    }
    const scannedPending = submissions.find(item => item.qrToken.trim().toUpperCase() === token && item.status === 'QR_SCANNED');
    if (scannedPending) {
      openSubmissionForReview(scannedPending);
      return;
    }
    let outcome;
    try {
      outcome = await markSubmissionScanned(token);
    } catch (error) {
      Alert.alert('Không xử lý được QR', messageOf(error));
      return;
    }
    const submission = outcome.submission;
    if (!submission) {
      Alert.alert('Không tìm thấy QR', outcome.note || 'QR không khớp giao dịch trong hệ thống.');
      return;
    }
    openSubmissionForReview(submission);
    if (outcome.result === 'EXPIRED' || submission.status === 'EXPIRED') {
      Alert.alert('QR đã hết hạn', 'Giao dịch này quá hạn, không thể xác nhận Ecopoint.');
    } else if (outcome.result === 'WRONG_STATION') {
      Alert.alert('QR sai trạm', 'Giao dịch này thuộc trạm khác. Không thể xác nhận tại ca trực hiện tại.');
    } else if (outcome.result === 'ALREADY_USED') {
      Alert.alert('QR đã được sử dụng', 'Giao dịch này đã được xử lý trước đó.');
    } else if (outcome.result === 'INVALID_TOKEN') {
      Alert.alert('QR không hợp lệ', outcome.note);
    }
  };

  const uploadReviewerProofIfSelected = async () => {
    if (!selectedSubmission || !proofImageUri) return true;
    const updated = await attachProofImage(selectedSubmission.id, {
      imageUri: proofImageUri,
      fileName: `proof-${selectedSubmission.id}.jpg`,
      mimeType: 'image/jpeg',
      note: volunteerNote || 'Ảnh minh chứng tình nguyện viên chụp tại trạm'
    });
    return Boolean(updated);
  };

  const uploadReviewerProofSafely = async () => {
    try {
      return await uploadReviewerProofIfSelected();
    } catch (error) {
      Alert.alert('Không lưu được ảnh minh chứng', messageOf(error));
      return false;
    }
  };

  const handleAccept = async () => {
    if (!selectedSubmission) return;
    const parsedQuantity = Number(actualQuantity.replace(',', '.'));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert('Số lượng chưa đúng', 'Nhập số lượng thực tế lớn hơn 0.');
      return;
    }
    if (!(await uploadReviewerProofSafely())) return;
    try {
      await confirmSubmission(selectedSubmission.id, parsedQuantity, volunteerNote);
      Alert.alert('Đã xác nhận', 'Ecopoint đã được cộng sau khi xác nhận.');
      setSelectedSubmissionId(null);
    } catch (error) {
      Alert.alert('Không xác nhận được', messageOf(error));
    }
  };

  const handleReject = async () => {
    if (!selectedSubmission) return;
    if (!volunteerNote.trim()) {
      Alert.alert('Lý do từ chối là bắt buộc', 'Nhập lý do để sinh viên biết cần điều chỉnh điều gì.');
      return;
    }
    if (!(await uploadReviewerProofSafely())) return;
    try {
      await rejectSubmission(selectedSubmission.id, volunteerNote.trim());
      Alert.alert('Đã từ chối', 'Sinh viên sẽ thấy lý do trong lịch sử và trung tâm thông báo.');
      setSelectedSubmissionId(null);
    } catch (error) {
      Alert.alert('Không từ chối được', messageOf(error));
    }
  };

  const handleUnlockManualReview = async () => {
    if (!selectedSubmission) return;
    if (!volunteerNote.trim()) {
      Alert.alert('Nhập lý do không thể quét QR', 'Lý do là bắt buộc để mở phương án duyệt thủ công.');
      return;
    }
    try {
      await unlockManualReview(selectedSubmission.id, volunteerNote.trim());
      Alert.alert('Đã mở duyệt thủ công', 'Giao dịch chuyển sang Chờ duyệt thủ công. Bạn có thể duyệt hoặc từ chối dựa trên ảnh sinh viên.');
    } catch (error) {
      Alert.alert('Không mở được duyệt thủ công', messageOf(error));
    }
  };

  return (
    <Screen scroll style={styles.container}>
      <Text style={styles.title}>Xác nhận QR Giao dịch</Text>
      <Text style={styles.subtitle}>Tải giao dịch của sinh viên, nhập số lượng thực tế, chụp ảnh minh chứng rồi xác nhận hoặc từ chối.</Text>

      <Card style={styles.tip}>
        <Text style={styles.tipTitle}>Trạm trực</Text>
        <Text style={styles.tipText}>{selectedStation?.name ?? 'Chưa chọn trạm'} - {pendingAtDuty.length} tại trạm / {allPendingSubmissions.length} trên hệ thống</Text>
      </Card>

      {allPendingSubmissions.length > 0 && (
        <View style={styles.pendingList}>
          <Text style={styles.section}>Tất cả giao dịch đang chờ</Text>
          {allPendingSubmissions.map(item => (
            <Pressable key={item.id} onPress={() => openPendingSubmission(item)} style={({ pressed }) => [styles.pendingChip, pressed && styles.pressed]}>
              <View style={styles.pendingTopRow}>
                <Text style={styles.pendingText} numberOfLines={1} ellipsizeMode="middle">{item.qrToken}</Text>
                <Text style={styles.pendingStatus}>{getSubmissionStatusLabel(item.status)}</Text>
              </View>
              <Text style={styles.pendingAction}>{item.binId === dutyStationId ? 'Kiểm tra giao dịch tại trạm trực' : `Giao dịch ở trạm khác: ${stations.find(station => station.id === item.binId)?.name ?? item.binId}`}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={[styles.scannerBox, { width: scannerSize, height: scannerSize }]}>
        {enabled ? (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            ratio="1:1"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              setEnabled(false);
              void loadQr(data);
            }}
          >
            <View style={styles.overlay}>
              <View style={styles.topMask} />
              <View style={[styles.middleRow, { height: scanFrameSize }]}>
                <View style={styles.sideMask} />
                <View style={[styles.targetFrame, { width: scanFrameSize, height: scanFrameSize }]}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <View style={styles.sideMask} />
              </View>
              <View style={styles.bottomMask} />
            </View>
          </CameraView>
        ) : (
          <View style={styles.placeholderContainer}>
            <Image source={require('../assets/mascot_2.png')} style={styles.placeholderImage} resizeMode="contain" />
            <Text style={styles.placeholderText}>Nhấn "Bắt đầu quét QR" hoặc cấp quyền camera để tiếp tục</Text>
          </View>
        )}
      </View>

      {!enabled && <AppButton title="Bắt đầu quét QR" onPress={startScan} />}

      <Card style={styles.manualCard}>
        <Text style={styles.tipTitle}>Nhập mã QR thủ công</Text>
        <TextInput value={manualQrToken} onChangeText={setManualQrToken} autoCapitalize="characters" style={styles.input} placeholder="ECL-SUB-20260823120000-123456" placeholderTextColor={colors.muted} />
        <AppButton title="Tải giao dịch" variant="light" onPress={() => void loadQr(manualQrToken)} />
      </Card>

      <Modal visible={!!selectedSubmission} animationType="slide" transparent onRequestClose={() => setSelectedSubmissionId(null)}>
        <View style={styles.modalOverlay}>
          {selectedSubmission && (
            <Card style={styles.modalCard}>
              <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.detailTitle}>Kiểm tra giao dịch</Text>
                <Text style={styles.detailText}>Sinh viên: {selectedSubmission.userId}</Text>
                <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="middle">QR: {selectedSubmission.qrToken}</Text>
                <Text style={styles.detailText}>Loại rác khai báo: {selectedWasteName}</Text>
                <Text style={styles.detailText}>Số lượng khai báo: {selectedSubmission.quantity} {selectedSubmission.unit}</Text>
                <Text style={styles.detailStatus}>Trạng thái: {getSubmissionStatusLabel(selectedSubmission.status)}</Text>

                <Text style={styles.label}>Ảnh minh chứng sinh viên</Text>
                {(selectedSubmission.proofImages ?? []).filter(proof => proof.kind === 'STUDENT_PROOF').map(proof => (
                  <Image key={proof.id} source={{ uri: proof.imageUrl }} style={styles.studentProofPreview} />
                ))}

                <Text style={styles.label}>Số lượng thực tế ({selectedSubmission.unit})</Text>
                <TextInput value={actualQuantity} onChangeText={setActualQuantity} keyboardType="decimal-pad" style={styles.input} />

                <Text style={styles.label}>{canUseManualReview ? 'Lý do không thể quét QR' : 'Ghi chú / lý do từ chối'}</Text>
                <TextInput value={volunteerNote} onChangeText={setVolunteerNote} multiline style={[styles.input, styles.noteInput]} placeholder={canUseManualReview ? 'Bắt buộc khi chọn Không thể quét QR' : 'Bắt buộc nếu từ chối'} placeholderTextColor={colors.muted} />

                <View style={styles.proofActions}>
                  <AppButton title={proofImageUri ? 'Chụp lại ảnh xác minh' : 'Bổ sung ảnh xác minh (tùy chọn)'} variant="light" onPress={() => void captureProofImage()} />
                  {proofImageUri ? <Image source={{ uri: proofImageUri }} style={styles.proofPreview} /> : null}
                </View>

                <View style={styles.actionRow}>
                  {canUseManualReview ? <AppButton title="Không thể quét QR" variant="light" onPress={handleUnlockManualReview} /> : null}
                  <AppButton title="Từ chối" variant="light" disabled={!canConfirmSubmission} onPress={handleReject} />
                  <AppButton title={canConfirmSubmission ? 'Xác nhận & Cộng điểm' : 'Chưa scan hợp lệ'} disabled={!canConfirmSubmission} onPress={handleAccept} />
                </View>

                <Pressable style={styles.closeModalButton} onPress={() => setSelectedSubmissionId(null)}>
                  <Text style={styles.closeModalText}>Đóng</Text>
                </Pressable>
              </ScrollView>
            </Card>
          )}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 0 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.muted, fontWeight: '700', textAlign: 'center', marginTop: 8, marginBottom: 16 },
  scannerBox: { alignSelf: 'center', borderRadius: radius.xl, backgroundColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  placeholderContainer: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  placeholderImage: { width: 96, height: 96, opacity: 0.9, marginBottom: 12 },
  placeholderText: { color: colors.white, fontWeight: '800', textAlign: 'center', fontSize: 14 },
  tip: { marginBottom: 14 },
  tipTitle: { color: colors.green, fontWeight: '900', fontSize: 18 },
  tipText: { color: colors.muted, fontWeight: '700', marginTop: 4 },
  manualCard: { gap: 10, marginTop: 14, marginBottom: 16 },
  input: { backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontWeight: '800', borderWidth: 1, borderColor: colors.line, minHeight: 48 },
  pendingList: { marginBottom: 14 },
  section: { color: colors.ink, fontSize: 19, fontWeight: '900', marginBottom: 10 },
  pendingChip: { backgroundColor: colors.cream, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.line, minHeight: 72 },
  pendingTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingText: { color: colors.coralDark, fontWeight: '900', flex: 1 },
  pendingStatus: { color: colors.green, fontWeight: '900', fontSize: 12 },
  pendingAction: { color: colors.green, fontWeight: '900', marginTop: 6 },
  detailTitle: { color: colors.ink, fontSize: 21, fontWeight: '900' },
  detailText: { color: colors.muted, fontWeight: '800' },
  detailStatus: { color: colors.green, fontWeight: '900', marginTop: 4 },
  label: { color: colors.green, fontWeight: '900', marginTop: 4 },
  noteInput: { minHeight: 82, textAlignVertical: 'top' },
  proofActions: { gap: 10, marginTop: 8 },
  proofPreview: { width: '100%', height: 170, borderRadius: radius.md, backgroundColor: colors.cream },
  studentProofPreview: { width: '100%', height: 190, borderRadius: radius.md, backgroundColor: colors.cream },
  actionRow: { gap: 10, marginTop: 10 },
  overlay: { flex: 1 },
  topMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  middleRow: { flexDirection: 'row' },
  sideMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  targetFrame: { backgroundColor: 'transparent', position: 'relative' },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: colors.green, borderWidth: 5 },
  topLeft: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 0, maxHeight: '94%' },
  modalScrollContent: { padding: 20, paddingBottom: 32, gap: 12 },
  closeModalButton: { marginTop: 4, paddingVertical: 12, alignItems: 'center' },
  closeModalText: { color: colors.muted, fontWeight: '900', fontSize: 16 },
  pressed: { opacity: 0.78 }
});
