import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { useAppContext } from '../context/AppContext';
import { extractSubmissionQrToken } from '../services/qrPayload';
import { colors, radius } from '../theme/colors';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isMissingCameraActivity(error: unknown) {
  return messageOf(error).includes('Failed to resolve activity');
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const {
    confirmSubmission,
    dutyStationId,
    markSubmissionScanned,
    rejectSubmission,
    requestReview,
    attachProofImage,
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
  const canConfirmSubmission = selectedSubmission?.status === 'QR_SCANNED';
  const selectedStation = stations.find(item => item.id === (selectedSubmission?.binId ?? dutyStationId));
  const selectedWaste = wasteTypes.find(item => item.id === selectedSubmission?.wasteTypeId);
  const pendingAtDuty = submissions.filter(
    item => item.binId === dutyStationId && (item.status === 'CREATED' || item.status === 'QR_SCANNED')
  );

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
        Alert.alert('Không mở được camera', 'LDPlayer này chưa có ứng dụng camera. Tôi sẽ mở thư viện ảnh để chọn ảnh minh chứng thay thế.');
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
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.72 });
      if (!result.canceled && result.assets[0]?.uri) setProofImageUri(result.assets[0].uri);
    } catch (error) {
      Alert.alert('Không mở được thư viện ảnh', messageOf(error));
    }
  };

  const loadQr = async (qrToken: string) => {
    const token = extractSubmissionQrToken(qrToken);
    if (!token) {
      Alert.alert('Chưa có QR', 'Nhập hoặc quét QR giao dịch.');
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
    setSelectedSubmissionId(submission.id);
    setActualQuantity(String(submission.actualQuantity ?? submission.quantity));
    setVolunteerNote('');
    setProofImageUri('');
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

  const ensureProofImage = async () => {
    if (!selectedSubmission) return false;
    if (selectedSubmission.proofImage) return true;
    if (!proofImageUri) {
      Alert.alert('Chưa có ảnh minh chứng', 'Chụp ảnh rác thực tế tại trạm trước khi xác nhận hoặc yêu cầu review.');
      return false;
    }
    const updated = await attachProofImage(selectedSubmission.id, {
      imageUri: proofImageUri,
      fileName: `proof-${selectedSubmission.id}.jpg`,
      mimeType: 'image/jpeg',
      note: volunteerNote || 'Ảnh minh chứng volunteer chụp tại trạm'
    });
    return Boolean(updated?.proofImage);
  };

  const handleAccept = async () => {
    if (!selectedSubmission) return;
    const parsedQuantity = Number(actualQuantity.replace(',', '.'));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert('Số lượng chưa đúng', 'Nhập số lượng thực tế lớn hơn 0.');
      return;
    }
    if (!(await ensureProofImage())) return;
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
    await rejectSubmission(selectedSubmission.id, volunteerNote || 'Không đạt điều kiện tiếp nhận');
    Alert.alert('Đã từ chối', 'Giao dịch đã được cập nhật trạng thái.');
    setSelectedSubmissionId(null);
  };

  const handleRequestReview = async () => {
    if (!selectedSubmission) return;
    if (!(await ensureProofImage())) return;
    await requestReview(selectedSubmission.id, volunteerNote || 'Yêu cầu review vì nghi ngờ sai loại hoặc số lượng');
    Alert.alert('Đã yêu cầu review', 'Giao dịch đã được chuyển sang pending review.');
  };

  return (
    <Screen scroll style={styles.container}>
      <Text style={styles.title}>Xác nhận QR Giao dịch</Text>
      <Text style={styles.subtitle}>Tải giao dịch của sinh viên, nhập số lượng thực tế, chụp ảnh minh chứng rồi xác nhận hoặc từ chối.</Text>
      <View style={styles.scannerBox}>
        {enabled ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={({ data }) => {
                setEnabled(false);
                void loadQr(data);
              }}
            >
            <View style={styles.overlay}>
              <View style={styles.topMask} />
              <View style={styles.middleRow}>
                <View style={styles.sideMask} />
                <View style={styles.targetFrame}>
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
      <Card style={styles.tip}>
        <Text style={styles.tipTitle}>Trạm trực</Text>
        <Text style={styles.tipText}>{selectedStation?.name ?? 'Chưa chọn trạm'} - {pendingAtDuty.length} giao dịch đang chờ</Text>
      </Card>
      {!enabled && (
        <AppButton title="Bắt đầu quét QR" onPress={startScan} />
      )}

      <Card style={styles.manualCard}>
        <Text style={styles.tipTitle}>Nhập mã QR thủ công</Text>
        <TextInput value={manualQrToken} onChangeText={setManualQrToken} autoCapitalize="characters" style={styles.input} placeholder="ECO-SUB-001" placeholderTextColor={colors.muted} />
        <AppButton title="Tải giao dịch" variant="light" onPress={() => void loadQr(manualQrToken)} />
      </Card>

      {pendingAtDuty.length > 0 && (
        <View style={styles.pendingList}>
          <Text style={styles.section}>Đang chờ tại trạm</Text>
          {pendingAtDuty.map(item => (
            <Pressable key={item.id} onPress={() => void loadQr(item.qrToken)} style={styles.pendingChip}>
              <Text style={styles.pendingText} numberOfLines={1} ellipsizeMode="middle">{item.qrToken}</Text>
              <Text style={styles.pendingAction}>Kiểm tra giao dịch</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Modal visible={!!selectedSubmission} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          {selectedSubmission && (
            <Card style={styles.modalCard}>
              <Text style={styles.detailTitle}>Kiểm tra giao dịch</Text>
              <Text style={styles.detailText}>Sinh viên: {selectedSubmission.userId}</Text>
              <Text style={styles.detailText}>QR: {selectedSubmission.qrToken}</Text>
              <Text style={styles.detailText}>Loại rác khai báo: {selectedWaste?.name ?? selectedSubmission.wasteTypeId}</Text>
              <Text style={styles.detailText}>Số lượng khai báo: {selectedSubmission.quantity} {selectedSubmission.unit}</Text>
              <Text style={styles.detailStatus}>Trạng thái: {selectedSubmission.status}</Text>

              <Text style={styles.label}>Số lượng thực tế ({selectedSubmission.unit})</Text>
              <TextInput value={actualQuantity} onChangeText={setActualQuantity} keyboardType="decimal-pad" style={styles.input} />

              <Text style={styles.label}>Ghi chú thêm</Text>
              <TextInput value={volunteerNote} onChangeText={setVolunteerNote} multiline style={[styles.input, styles.noteInput]} placeholder="Bất thường, sai loại..." placeholderTextColor={colors.muted} />

              <View style={styles.proofActions}>
                <AppButton title={proofImageUri ? "Chụp lại minh chứng" : "Bắt buộc: Chụp ảnh minh chứng"} variant={proofImageUri ? "light" : "primary"} onPress={() => void captureProofImage()} />
                {proofImageUri ? <Image source={{ uri: proofImageUri }} style={styles.proofPreview} /> : null}
              </View>

              <View style={styles.actionRow}>
                <View style={styles.actionButton}>
                  <AppButton title="Từ chối" variant="light" onPress={handleReject} />
                </View>
                <View style={styles.actionButton}>
                  <AppButton title={canConfirmSubmission ? 'Xác nhận & Cộng điểm' : 'Chưa scan hợp lệ'} disabled={!canConfirmSubmission} onPress={handleAccept} />
                </View>
              </View>
              <AppButton title="Yêu cầu kiểm tra lại (Review)" variant="light" onPress={handleRequestReview} />

              <Pressable style={styles.closeModalButton} onPress={() => setSelectedSubmissionId(null)}>
                <Text style={styles.closeModalText}>Đóng</Text>
              </Pressable>
            </Card>
          )}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 0 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.muted, fontWeight: '700', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  scannerBox: { height: 300, borderRadius: radius.xl, backgroundColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  placeholderContainer: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  placeholderImage: { width: 120, height: 120, opacity: 0.9, marginBottom: 16 },
  placeholderText: { color: colors.white, fontWeight: '800', textAlign: 'center', fontSize: 14 },
  tip: { marginBottom: 18 },
  tipTitle: { color: colors.green, fontWeight: '900', fontSize: 18 },
  tipText: { color: colors.muted, fontWeight: '700', marginTop: 4 },
  manualCard: { gap: 10, marginTop: 16, marginBottom: 16 },
  input: { backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontWeight: '800' },
  pendingList: { marginBottom: 96 },
  section: { color: colors.ink, fontSize: 19, fontWeight: '900', marginBottom: 10 },
  pendingChip: { backgroundColor: colors.cream, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.line },
  pendingText: { color: colors.coralDark, fontWeight: '900' },
  pendingAction: { color: colors.green, fontWeight: '900', marginTop: 6 },
  detail: { gap: 9 },
  detailTitle: { color: colors.ink, fontSize: 21, fontWeight: '900' },
  detailText: { color: colors.muted, fontWeight: '800' },
  detailStatus: { color: colors.green, fontWeight: '900', marginTop: 4 },
  label: { color: colors.green, fontWeight: '900', marginTop: 4 },
  noteInput: { minHeight: 82, textAlignVertical: 'top' },
  proofCard: { backgroundColor: colors.cream, borderRadius: radius.md, padding: 12, marginTop: 12 },
  proofActions: { gap: 10, marginTop: 8 },
  proofPreview: { width: '100%', height: 190, borderRadius: radius.md, backgroundColor: colors.cream },
  proofLabel: { color: colors.ink, fontWeight: '900', marginBottom: 6 },
  proofText: { color: colors.muted, fontWeight: '700', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionButton: { flex: 1 },
  overlay: { flex: 1 },
  topMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  middleRow: { flexDirection: 'row', height: 200 },
  sideMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  targetFrame: { width: 200, height: 200, backgroundColor: 'transparent', position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: colors.green, borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 40, gap: 12 },
  closeModalButton: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  closeModalText: { color: colors.muted, fontWeight: '900', fontSize: 16 }
});
