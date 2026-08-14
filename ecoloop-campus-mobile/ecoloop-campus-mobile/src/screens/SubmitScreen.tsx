import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { useAppContext } from '../context/AppContext';
import { RecyclingSubmission, WasteType } from '../types';
import { colors, radius } from '../theme/colors';
import { predictionService, suggestWasteTypeFromClass } from '../services/predictionService';
import { buildSubmitAiSuggestion, SubmitAiSuggestion } from './submitAiFlow';
import { buildSubmissionQrPayload } from '../services/qrPayload';

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
  if (suggestion.runtime === 'remote') return suggestion.fallbackReason ? 'FastAPI fallback' : 'FastAPI';
  return 'AI';
}

export default function SubmitScreen() {
  const { stations, wasteTypes, createSubmission, saveAiPrediction, submitFeedback, isLoading, syncSource } = useAppContext();
  const [stationId, setStationId] = useState(stations[0]?.id ?? '');
  const [wasteTypeId, setWasteTypeId] = useState(wasteTypes[0]?.id ?? '');
  const [quantity, setQuantity] = useState('1');
  const [latestSubmission, setLatestSubmission] = useState<RecyclingSubmission | null>(null);
  const [feedbackType, setFeedbackType] = useState<(typeof feedbackTypes)[number]['id']>('bin_full');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);

  const selectedWaste = useMemo(() => wasteTypes.find(item => item.id === wasteTypeId) ?? wasteTypes[0], [wasteTypeId, wasteTypes]);
  const quantityNumber = Number(quantity.replace(',', '.'));
  const estimatedPoints = selectedWaste && Number.isFinite(quantityNumber) ? Math.max(0, Math.round(quantityNumber * selectedWaste.pointPerUnit)) : 0;

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
      Alert.alert('AI chưa phản hồi', `${messageOf(error)}
Kiểm tra backend FastAPI, URL API và reverse port 8000 trên Android Studio Emulator.`);
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
        Alert.alert('Không mở được camera', 'LDPlayer này chưa có ứng dụng camera. Tôi sẽ mở thư viện ảnh để bạn chọn ảnh thay thế.');
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
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {stations.map(station => {
              const isActive = stationId === station.id;
              return (
                <Pressable
                  key={station.id}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setStationId(station.id)}
                >
                  <Text style={[styles.chipTitle, isActive && styles.chipTextActive]} numberOfLines={2}>{station.name}</Text>
                  <Text style={[styles.chipMeta, isActive && styles.chipTextActive]} numberOfLines={2}>{station.location}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

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

        {latestSubmission && (
          <View style={[styles.glassCard, styles.qrCard]}>
            <Text style={styles.qrTitle}>MÃ QR CỦA BẠN</Text>
            <View style={styles.qrPlaceholder}>
              <QRCode value={buildSubmissionQrPayload(latestSubmission)} size={164} backgroundColor="#ffffff" color="#111827" />
            </View>
            <Text style={styles.qrPlaceholderText} numberOfLines={1} ellipsizeMode="middle">{latestSubmission.qrToken}</Text>
            <Text style={styles.qrInstruction}>Đưa mã QR này cho Tình nguyện viên tại trạm Eco-loop để xác nhận số lượng thực tế và cộng Ecopoint.</Text>
            <Text style={styles.qrMeta}>Điểm vẫn cần volunteer xác nhận trước khi cộng vào ví.</Text>
            <Text style={styles.qrMeta}>Hết hạn: {latestSubmission.expiredAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Text>
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
    paddingBottom: 160,
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
