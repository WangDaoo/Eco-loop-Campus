import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { useAppContext } from '../context/AppContext';
import { RecyclingSubmission, WasteType } from '../types';
import { colors, radius } from '../theme/colors';
import { predictionService, suggestWasteTypeFromClass } from '../services/predictionService';
import { getSubmissionExpiryInfo } from '../services/submissionExpiry';
import { buildSubmitAiSuggestion, SubmitAiSuggestion } from './submitAiFlow';
import { buildSubmissionQrPayload, extractStationQrCode } from '../services/qrPayload';
import { launchImageLibraryWithFallback } from '../services/imagePickerFallback';

const feedbackTypes = [
  { id: 'bin_full', label: 'Thùng đầy' },
  { id: 'qr_error', label: 'Lỗi QR' },
  { id: 'wrong_sorting', label: 'Phân loại sai' },
  { id: 'damage', label: 'Hư hỏng' },
  { id: 'other', label: 'Khác' }
] as const;

type AiSuggestion = SubmitAiSuggestion;

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isMissingCameraActivity(error: unknown) {
  return messageOf(error).includes('Failed to resolve activity');
}

function aiRuntimeLabel(suggestion: AiSuggestion) {
  if (suggestion.runtime === 'local') return 'Chạy trên thiết bị';
  if (suggestion.runtime === 'remote') return suggestion.fallbackReason ? 'Dịch vụ AI dự phòng' : 'Dịch vụ AI';
  return 'AI';
}

export default function SubmitScreen() {
  const { stations, wasteTypes, createSubmission, saveAiPrediction, submitFeedback, isLoading, syncSource } = useAppContext();
  const [stationCameraPermission, requestStationCameraPermission] = useCameraPermissions();
  const isFocused = useIsFocused();
  const { width: windowWidth } = useWindowDimensions();
  const [stationId, setStationId] = useState(stations[0]?.id ?? '');
  const [wasteTypeId, setWasteTypeId] = useState(wasteTypes[0]?.id ?? '');
  const [quantity, setQuantity] = useState('1');
  const [latestSubmission, setLatestSubmission] = useState<RecyclingSubmission | null>(null);
  const [feedbackType, setFeedbackType] = useState<(typeof feedbackTypes)[number]['id']>('bin_full');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [stationScannerEnabled, setStationScannerEnabled] = useState(false);
  const [stationScannerPaused, setStationScannerPaused] = useState(false);
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);
  const [stationScanMessage, setStationScanMessage] = useState('Đưa QR trên trạm vào khung vuông để chọn trạm tự động.');
  const [clockNow, setClockNow] = useState(new Date());

  const selectedStation = useMemo(() => stations.find(item => item.id === stationId) ?? stations[0], [stationId, stations]);
  const selectedWaste = useMemo(() => wasteTypes.find(item => item.id === wasteTypeId) ?? wasteTypes[0], [wasteTypeId, wasteTypes]);
  const quantityNumber = Number(quantity.replace(',', '.'));
  const estimatedPoints = selectedWaste && Number.isFinite(quantityNumber) ? Math.max(0, Math.round(quantityNumber * selectedWaste.pointPerUnit)) : 0;
  const qrExpiryInfo = latestSubmission ? getSubmissionExpiryInfo(latestSubmission.expiredAt, clockNow) : null;
  const stationScannerSize = Math.max(220, Math.min(300, windowWidth - 96));
  const stationScanFrameSize = Math.min(210, stationScannerSize - 48);

  useEffect(() => {
    if (!stations.length) return;
    if (!stations.some(station => station.id === stationId)) setStationId(stations[0].id);
  }, [stationId, stations]);

  useEffect(() => {
    if (!isFocused) {
      setStationScannerEnabled(false);
      return;
    }

    if (!stationCameraPermission) {
      void requestStationCameraPermission();
      return;
    }

    setStationScannerEnabled(Boolean(stationCameraPermission.granted));
  }, [isFocused, requestStationCameraPermission, stationCameraPermission]);

  useEffect(() => {
    if (!latestSubmission) return;
    setClockNow(new Date());
    const timer = setInterval(() => setClockNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, [latestSubmission]);

  const startStationScanner = async () => {
    if (!stationCameraPermission?.granted) {
      const permission = await requestStationCameraPermission();
      if (!permission.granted) {
        Alert.alert('Cần quyền camera', 'Hãy cấp quyền camera để quét QR trạm.');
        return;
      }
    }
    setStationScannerEnabled(true);
  };

  const findStationFromQr = (payload: string) => {
    const qrCode = extractStationQrCode(payload);
    const normalized = qrCode.trim().toUpperCase();
    return stations.find(station =>
      [station.qrCode, station.id, station.name]
        .filter(Boolean)
        .some(value => String(value).trim().toUpperCase() === normalized)
    );
  };

  const handleStationQrScanned = (payload: string) => {
    if (stationScannerPaused) return;
    setStationScannerPaused(true);
    const station = findStationFromQr(payload);
    if (station) {
      setStationId(station.id);
      setStationDropdownOpen(false);
      setStationScanMessage(`Đã chọn ${station.name}`);
    } else {
      setStationScanMessage('QR này chưa khớp trạm Eco-loop trong dữ liệu app.');
    }
    setTimeout(() => setStationScannerPaused(false), 1600);
  };

  const handleCreate = async () => {
    if (!stationId || !wasteTypeId || !selectedWaste) {
      Alert.alert('Thiếu dữ liệu', 'Hãy chọn trạm và loại rác.');
      return;
    }
    if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      Alert.alert('Số lượng chưa đúng', 'Nhập số lượng lớn hơn 0.');
      return;
    }

    try {
      const submission = await createSubmission({ binId: stationId, wasteTypeId, quantity: quantityNumber });
      setLatestSubmission(submission);
    } catch (error) {
      Alert.alert('Không tạo được QR', messageOf(error));
    }
  };

  const runAiPrediction = async (asset: ImagePicker.ImagePickerAsset, source: 'camera' | 'upload') => {
    setAiLoading(true);
    try {
      const suggestion = await buildSubmitAiSuggestion({
        asset,
        source,
        stationId,
        wasteTypes,
        predictImage: input => predictionService.predictImage(input),
        saveAiPrediction,
        suggestWasteTypeFromClass,
        messageOf
      });
      setAiSuggestion(suggestion);
      if (suggestion.saveWarning) {
        Alert.alert('AI đã nhận diện', suggestion.saveWarning);
      }
    } catch (error) {
      Alert.alert('AI chưa xử lý được ảnh', `${messageOf(error)}
Bạn có thể thử lại sau hoặc chọn loại rác thủ công.`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiCapture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền camera', 'Hãy cấp quyền camera để chụp ảnh rác.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
      if (!result.canceled && result.assets[0]) await runAiPrediction(result.assets[0], 'camera');
    } catch (error) {
      if (isMissingCameraActivity(error)) {
        Alert.alert('Không mở được camera', 'Thiết bị chưa mở được camera. Bạn có thể chọn ảnh từ thư viện để tiếp tục.');
        await handleAiPick();
        return;
      }
      Alert.alert('Không mở được camera', messageOf(error));
    }
  };

  const handleAiPick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền ảnh', 'Hãy cấp quyền thư viện ảnh để chọn ảnh rác.');
      return;
    }
    try {
      const result = await launchImageLibraryWithFallback({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
      if (!result.canceled && result.assets[0]) await runAiPrediction(result.assets[0], 'upload');
    } catch (error) {
      Alert.alert('Không mở được thư viện ảnh', messageOf(error));
    }
  };

  const handleUseSuggestion = () => {
    if (!aiSuggestion?.wasteType) {
      Alert.alert('Chưa dùng được gợi ý', 'Class AI này chưa có loại rác tương ứng trong app. Hãy chọn thủ công.');
      return;
    }
    setWasteTypeId(aiSuggestion.wasteType.id);
    Alert.alert('Đã dùng gợi ý', `Loại rác được đặt là ${aiSuggestion.wasteType.name}.`);
  };

  const handleFeedback = async () => {
    try {
      const feedback = await submitFeedback({ stationId, type: feedbackType, message: feedbackMessage });
      if (!feedback) {
        Alert.alert('Chưa có nội dung', 'Nhập nội dung phản hồi trước khi gửi.');
        return;
      }
      setFeedbackMessage('');
      Alert.alert('Đã gửi phản hồi', 'Tình nguyện viên sẽ xử lý trong ca trực.');
    } catch (error) {
      Alert.alert('Không gửi được phản hồi', messageOf(error));
    }
  };

  return (
    <Screen style={styles.container} scroll noPadding>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Khai báo Tái chế</Text>
          <Text style={styles.subtitle}>Tạo mã QR giao dịch dùng một lần</Text>
        </View>

        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>1. Chọn trạm thu gom</Text>
          <View style={[styles.stationScannerBox, { width: stationScannerSize, height: stationScannerSize }]}>
            {stationScannerEnabled ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                ratio="1:1"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => handleStationQrScanned(data)}
              >
                <View style={styles.stationScanOverlay}>
                  <View style={styles.stationMask} />
                  <View style={[styles.stationScanMiddleRow, { height: stationScanFrameSize }]}>
                    <View style={styles.stationMask} />
                    <View style={[styles.studentScanFrame, { width: stationScanFrameSize, height: stationScanFrameSize }]}>
                      <View style={[styles.scanCorner, styles.scanTopLeft]} />
                      <View style={[styles.scanCorner, styles.scanTopRight]} />
                      <View style={[styles.scanCorner, styles.scanBottomLeft]} />
                      <View style={[styles.scanCorner, styles.scanBottomRight]} />
                    </View>
                    <View style={styles.stationMask} />
                  </View>
                  <View style={styles.stationMask} />
                </View>
              </CameraView>
            ) : (
              <View style={styles.stationScannerPlaceholder}>
                <Text style={styles.stationScannerTitle}>Camera quét QR trạm</Text>
                <Pressable style={styles.stationScannerButton} onPress={startStationScanner}>
                  <Text style={styles.stationScannerButtonText}>Bật camera</Text>
                </Pressable>
              </View>
            )}
          </View>
          <Text style={styles.stationScannerHint}>{stationScanMessage}</Text>
          <Text style={styles.sectionTitle}>Hoặc chọn trạm thu gom</Text>
          <View style={styles.stationDropdownWrap}>
            <Pressable
              style={styles.stationDropdownButton}
              onPress={() => setStationDropdownOpen(!stationDropdownOpen)}
              accessibilityRole="button"
              accessibilityLabel="Chọn trạm thu gom"
            >
              <View style={styles.stationDropdownTextGroup}>
                <Text style={styles.stationDropdownValue} numberOfLines={1}>{selectedStation?.name ?? 'Chọn trạm'}</Text>
                <Text style={styles.stationDropdownMeta} numberOfLines={1}>{selectedStation?.location ?? 'Chưa có vị trí trạm'}</Text>
              </View>
              <Text style={styles.stationDropdownIcon}>{stationDropdownOpen ? '▲' : '▼'}</Text>
            </Pressable>
            {stationDropdownOpen && (
              <View style={styles.stationDropdownMenu}>
                {stations.map(station => {
                  const isActive = stationId === station.id;
                  return (
                    <Pressable
                      key={station.id}
                      style={[styles.stationDropdownOption, isActive && styles.stationDropdownOptionActive]}
                      onPress={() => {
                        setStationId(station.id);
                        setStationDropdownOpen(false);
                      }}
                    >
                      <Text style={[styles.stationDropdownOptionTitle, isActive && styles.stationDropdownOptionTextActive]} numberOfLines={1}>{station.name}</Text>
                      <Text style={[styles.stationDropdownOptionMeta, isActive && styles.stationDropdownOptionTextActive]} numberOfLines={1}>{station.location}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>2. Phân loại AI (Tùy chọn)</Text>
          <View style={styles.aiContainer}>
             <View style={styles.aiButtonRow}>
                <AppButton title={aiLoading ? 'Đang phân tích...' : 'Chụp ảnh AI'} onPress={handleAiCapture} disabled={aiLoading} />
                <AppButton title="Tải ảnh" variant="light" onPress={handleAiPick} disabled={aiLoading} />
             </View>

             {aiLoading ? (
               <View style={styles.aiLoadingOverlay}>
                 <ActivityIndicator size="large" color={colors.green} />
                 <Text style={styles.aiLoadingText}>Đang gửi ảnh cho AI phân loại...</Text>
               </View>
             ) : aiSuggestion ? (
               <View style={styles.aiResult}>
                 {aiSuggestion.sourceUri && <Image source={{ uri: aiSuggestion.sourceUri }} style={styles.aiPreview} />}
                 <Text style={styles.aiLabel}>Nhận diện: {aiSuggestion.predictedClass} ({aiSuggestion.confidencePercent}%)</Text>
                 <Text style={styles.aiRuntime}>{aiRuntimeLabel(aiSuggestion)}</Text>
                 {aiSuggestion.predictionId ? <Text style={styles.aiSaved}>Đã lưu AI #{aiSuggestion.predictionId}</Text> : null}
                 {aiSuggestion.note ? <Text style={styles.aiNote}>{aiSuggestion.note}</Text> : null}
                 <Pressable style={styles.aiSuggestButton} onPress={handleUseSuggestion}>
                   <Text style={styles.aiSuggestButtonText}>Áp dụng gợi ý này</Text>
                 </Pressable>
               </View>
             ) : (
               <Text style={styles.aiHint}>Chụp ảnh để AI nhận diện tự động loại rác của bạn.</Text>
             )}
          </View>

          <Text style={styles.sectionTitle}>3. Loại rác & Khối lượng</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {wasteTypes.map(waste => {
              const isActive = wasteTypeId === waste.id;
              return (
                <Pressable
                  key={waste.id}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setWasteTypeId(waste.id)}
                >
                  <Text style={[styles.chipTitle, isActive && styles.chipTextActive]} numberOfLines={2}>{waste.name}</Text>
                  <Text style={[styles.chipMeta, isActive && styles.chipTextActive]}>{waste.pointPerUnit} Ecopoint/{waste.unit}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.inputContainer}>
             <TextInput
               value={quantity}
               onChangeText={setQuantity}
               keyboardType="decimal-pad"
               style={styles.input}
             />
             <Text style={styles.unitText}>{selectedWaste?.unit ?? 'kg'}</Text>
          </View>

          <View style={styles.summaryBox}>
             <Text style={styles.summaryLabel}>Dự kiến nhận:</Text>
             <Text style={styles.summaryPoints}>{estimatedPoints} Ecopoint</Text>
          </View>

          <AppButton title={isLoading ? 'Đang tạo...' : 'TẠO MÃ QR'} disabled={isLoading} onPress={handleCreate} />
        </View>

        {latestSubmission && qrExpiryInfo && (
          <View style={[styles.glassCard, styles.qrCard, qrExpiryInfo.expired && styles.qrCardExpired]}>
            <Text style={styles.qrTitle}>MÃ QR CỦA BẠN</Text>
            {qrExpiryInfo.expired ? (
              <View style={styles.qrExpiredBox}>
                <Text style={styles.qrExpiredTitle}>Mã QR đã hết hạn</Text>
                <Text style={styles.qrExpiredText}>Tạo mã QR mới trước khi đưa cho tình nguyện viên xác nhận.</Text>
              </View>
            ) : (
              <View style={styles.qrPlaceholder}>
                <QRCode value={buildSubmissionQrPayload(latestSubmission)} size={164} backgroundColor="#ffffff" color="#111827" />
              </View>
            )}
            <Text style={styles.qrPlaceholderText} numberOfLines={1} ellipsizeMode="middle">{latestSubmission.qrToken}</Text>
            <Text style={styles.qrInstruction}>Đưa mã QR này cho Tình nguyện viên tại trạm Eco-loop để xác nhận số lượng thực tế và cộng Ecopoint.</Text>
            <Text style={styles.qrMeta}>Điểm được cộng sau khi lượt gửi rác được xác nhận.</Text>
            <Text style={[styles.qrExpiryLabel, qrExpiryInfo.expired && styles.qrExpiryExpired]}>{qrExpiryInfo.label}</Text>
            <Text style={styles.qrMeta}>{qrExpiryInfo.detail}</Text>
            {qrExpiryInfo.expired && <AppButton title="Tạo mã QR mới" variant="light" disabled={isLoading} onPress={handleCreate} />}
          </View>
        )}

        <View style={styles.glassCard}>
          <Text style={styles.sectionTitle}>Báo cáo sự cố</Text>
          <View style={styles.typeRow}>
            {feedbackTypes.map(type => (
              <Pressable
                key={type.id}
                style={[styles.feedbackChip, feedbackType === type.id && styles.feedbackChipActive]}
                onPress={() => setFeedbackType(type.id)}
              >
                <Text style={[styles.feedbackChipText, feedbackType === type.id && styles.feedbackChipTextActive]}>{type.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={feedbackMessage}
            onChangeText={setFeedbackMessage}
            multiline
            placeholder="Mô tả thêm về sự cố..."
            placeholderTextColor="#9ca3af"
            style={styles.textArea}
          />
          <AppButton title={isLoading ? 'Đang gửi...' : 'Gửi báo cáo'} variant="light" disabled={isLoading} onPress={handleFeedback} />
        </View>

      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffdcd2',
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#205063',
  },
  subtitle: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
    marginTop: 4,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 6,
    borderColor: 'rgba(178, 234, 245, 0.3)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#205063',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 12,
    marginTop: 8,
  },
  horizontalScroll: {
    paddingBottom: 12,
    gap: 12,
  },
  chip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginRight: 12,
    minWidth: 140,
    maxWidth: 200,
  },
  chipActive: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  chipTitle: {
    color: '#1f2937',
    fontWeight: 'bold',
    fontSize: 15,
  },
  chipMeta: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  stationScannerBox: {
    alignSelf: 'center',
    borderRadius: 28,
    backgroundColor: colors.ink,
    overflow: 'hidden',
    marginBottom: 12,
  },
  stationScanOverlay: {
    flex: 1,
  },
  stationMask: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  stationScanMiddleRow: {
    flexDirection: 'row',
  },
  studentScanFrame: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  scanCorner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: colors.green,
    borderWidth: 5,
  },
  scanTopLeft: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 14 },
  scanTopRight: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 14 },
  scanBottomLeft: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 14 },
  scanBottomRight: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 14 },
  stationScannerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  stationScannerTitle: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 17,
    marginBottom: 12,
  },
  stationScannerButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: '#f47c65',
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationScannerButtonText: {
    color: colors.white,
    fontWeight: '900',
  },
  stationScannerHint: {
    color: '#205063',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  stationDropdownWrap: {
    marginBottom: 14,
    position: 'relative',
    zIndex: 30,
    elevation: 10,
  },
  stationDropdownButton: {
    minHeight: 64,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#b2eaf5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stationDropdownTextGroup: {
    flex: 1,
  },
  stationDropdownValue: {
    color: '#205063',
    fontSize: 16,
    fontWeight: '900',
  },
  stationDropdownMeta: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  stationDropdownIcon: {
    color: '#205063',
    fontSize: 15,
    fontWeight: '900',
  },
  stationDropdownMenu: {
    position: 'absolute',
    top: 76,
    left: 0,
    right: 0,
    zIndex: 40,
    elevation: 12,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5f8fc',
    overflow: 'hidden',
    shadowColor: '#5bbcdc',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  stationDropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#ecfdf5',
  },
  stationDropdownOptionActive: {
    backgroundColor: '#10b981',
  },
  stationDropdownOptionTitle: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '900',
  },
  stationDropdownOptionMeta: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  stationDropdownOptionTextActive: {
    color: '#ffffff',
  },
  aiContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  aiButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  aiHint: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  aiResult: {
    marginTop: 12,
    alignItems: 'center',
  },
  aiPreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginBottom: 12,
  },
  aiLabel: {
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  aiRuntime: {
    color: '#205063',
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 6,
  },
  aiSaved: {
    color: '#059669',
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 6,
  },
  aiNote: {
    color: '#6b7280',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  aiSuggestButton: {
    backgroundColor: '#205063',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  aiSuggestButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  unitText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  summaryLabel: {
    color: '#065f46',
    fontWeight: 'bold',
    fontSize: 16,
  },
  summaryPoints: {
    color: '#047857',
    fontWeight: '900',
    fontSize: 20,
  },
  qrCard: {
    alignItems: 'center',
    backgroundColor: '#059669',
    borderColor: '#34d399',
  },
  qrCardExpired: {
    backgroundColor: '#b45309',
    borderColor: '#f59e0b',
  },
  qrTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 20,
    marginBottom: 16,
  },
  qrPlaceholder: {
    backgroundColor: '#ffffff',
    width: 200,
    height: 200,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  qrExpiredBox: {
    backgroundColor: '#ffffff',
    width: 220,
    minHeight: 168,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    marginBottom: 16,
  },
  qrExpiredTitle: {
    color: '#b45309',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  qrExpiredText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  qrPlaceholderText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    maxWidth: '92%',
    marginBottom: 12,
  },
  qrInstruction: {
    color: '#ecfdf5',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
  },
  qrMeta: {
    color: '#a7f3d0',
    fontWeight: 'bold',
  },
  qrExpiryLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  qrExpiryExpired: {
    color: '#fff7ed',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  feedbackChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 48,
    justifyContent: 'center',
  },
  feedbackChipActive: {
    backgroundColor: '#ef4444',
    borderColor: '#dc2626',
  },
  feedbackChipText: {
    color: '#4b5563',
    fontWeight: 'bold',
  },
  feedbackChipTextActive: {
    color: '#ffffff',
  },
  textArea: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  aiLoadingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  aiLoadingText: {
    marginTop: 12,
    color: colors.green,
    fontWeight: 'bold',
    fontSize: 15,
  }
});
