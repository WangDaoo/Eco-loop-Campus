import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export default function AboutScreen({ navigation }: Props) {
  return (
    <Screen scroll>
      <Text style={styles.back} onPress={() => navigation.pop()}>Quay lại</Text>
      <Text style={styles.title}>Về Eco-loop Campus</Text>
      <Card>
        <Text style={styles.body}>Eco-loop Campus giúp sinh viên gửi rác đúng trạm, tạo QR giao dịch, tích Ecopoint sau khi được xác nhận và đổi phần thưởng xanh trong khuôn viên.</Text>
        <Text style={styles.note}>AI chỉ đóng vai trò gợi ý phân loại. Điểm được cộng sau khi tình nguyện viên hoặc quản trị viên xác minh lượt gửi rác.</Text>
      </Card>
      <View style={styles.grid}>
        <Card style={styles.card}><Text style={styles.stat}>3+</Text><Text style={styles.label}>trạm thu gom trong khuôn viên</Text></Card>
        <Card style={styles.card}><Text style={styles.stat}>QR</Text><Text style={styles.label}>mỗi lượt gửi rác có mã xác nhận riêng</Text></Card>
        <Card style={styles.card}><Text style={styles.stat}>Ecopoint</Text><Text style={styles.label}>điểm được cộng sau khi xác minh</Text></Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.coralDark, fontWeight: '900', marginBottom: 10 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', marginBottom: 14 },
  body: { color: colors.ink, fontSize: 17, lineHeight: 25, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: '700', marginTop: 12 },
  grid: { gap: 12, marginTop: 12 },
  card: { minHeight: 112, justifyContent: 'center' },
  stat: { color: colors.green, fontSize: 34, fontWeight: '900' },
  label: { color: colors.muted, fontWeight: '800', marginTop: 4 }
});
