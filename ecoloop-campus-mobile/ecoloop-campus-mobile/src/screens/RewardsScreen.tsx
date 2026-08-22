import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '../components/AppButton';
import { Screen } from '../components/Screen';
import { useAppContext } from '../context/AppContext';
import { Reward, RewardRedemption } from '../types';
import { colors, radius } from '../theme/colors';

function redemptionStatusLabel(status: RewardRedemption['status']) {
  const labels: Record<RewardRedemption['status'], string> = {
    requested: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
    delivered: 'Đã nhận'
  };
  return labels[status];
}

const CATEGORIES = ['Tất cả', 'Theo tháng', 'Giải trí', 'Mua sắm', 'Đồ ăn'];

type RewardIcon = {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
};

function getIconForReward(reward: Reward): RewardIcon {
  const title = reward.title.toLowerCase();
  if (title.includes('giảm')) return { icon: 'cash-outline', bg: '#dcf3f9', color: colors.ecoDarkBlue };
  if (title.includes('game') || title.includes('giải trí')) return { icon: 'game-controller-outline', bg: '#fff3d6', color: '#b7791f' };
  if (title.includes('ăn') || title.includes('uống')) return { icon: 'cafe-outline', bg: '#dcfce7', color: colors.green };
  if (title.includes('sức khỏe') || title.includes('thuốc')) return { icon: 'medkit-outline', bg: '#dbeafe', color: '#2563eb' };
  return { icon: 'gift-outline', bg: colors.ecoPill, color: reward.color || colors.ecoDarkBlue };
}

export default function RewardsScreen() {
  const { points, rewards, rewardRedemptions, requestReward } = useAppContext();
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState<Reward | null>(null);

  const redeem = async (reward: Reward) => {
    const ok = await requestReward(reward);
    Alert.alert(
      ok ? 'Đổi quà thành công' : 'Chưa đủ Ecopoint',
      ok ? 'Vui lòng kiểm tra lịch sử.' : `Bạn cần thêm ${reward.costPoints - points} Ecopoint để đổi phần thưởng này.`
    );
    if (ok) setSelectedVoucher(null);
  };

  const filteredRewards = rewards.filter(reward => {
    if (searchQuery && !reward.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <Screen scroll noPadding style={styles.container}>
      <View style={styles.headerCard}>
        <View>
          <Text style={styles.headerLabel}>Ví Ecopoint</Text>
          <Text style={styles.headerText}>{points.toLocaleString('vi-VN')} điểm</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="gift-outline" size={28} color={colors.ecoDarkBlue} />
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={colors.ecoDarkBlue} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm voucher..."
          placeholderTextColor="#659bad"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
        {CATEGORIES.map(category => {
          const isActive = activeCategory === category;
          return (
            <Pressable
              key={category}
              onPress={() => setActiveCategory(category)}
              style={({ pressed }) => [styles.categoryBtn, isActive && styles.categoryBtnActive, pressed && styles.pressed]}
            >
              <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>{category}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.gridSection}>
        <Text style={styles.sectionTitle}>Khám phá quà mới</Text>
        {filteredRewards.length > 0 ? (
          <View style={styles.grid}>
            {filteredRewards.map(reward => {
              const icon = getIconForReward(reward);
              return (
                <Pressable
                  key={reward.id}
                  style={({ pressed }) => [styles.voucherCard, pressed && styles.pressed]}
                  onPress={() => setSelectedVoucher(reward)}
                >
                  <View style={[styles.voucherIconBox, { backgroundColor: icon.bg }]}>
                    <Ionicons name={icon.icon} size={24} color={icon.color} />
                  </View>
                  <View style={styles.voucherInfo}>
                    <Text style={styles.voucherTitle} numberOfLines={2}>{reward.title}</Text>
                    <Text style={styles.voucherSub} numberOfLines={2}>{reward.description}</Text>
                    <View style={styles.voucherCostRow}>
                      <View style={styles.ecopointBadge}>
                        <Text style={styles.ecopointBadgeText}>E</Text>
                      </View>
                      <Text style={styles.voucherCost}>{reward.costPoints.toLocaleString('vi-VN')}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Image source={require('../assets/mascot_2.png')} style={styles.mascot} />
            <Text style={styles.emptyStateTitle}>Chưa có quà tặng nào</Text>
            <Text style={styles.emptyStateSub}>Đang cập nhật các ưu đãi mới. Hãy quay lại sau nhé.</Text>
          </View>
        )}
      </View>

      {rewardRedemptions.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Yêu cầu đổi thưởng</Text>
          {rewardRedemptions.map(item => (
            <View key={item.id} style={styles.historyCard}>
              <View style={styles.historyInfo}>
                <Text style={styles.historyTitle}>{item.rewardLabel}</Text>
                <Text style={styles.historyMeta}>{item.costPoints} Ecopoint - {item.requestedAt.toLocaleDateString('vi-VN')}</Text>
              </View>
              <Text style={styles.historyStatus}>{redemptionStatusLabel(item.status)}</Text>
            </View>
          ))}
        </View>
      )}

      <Modal visible={!!selectedVoucher} transparent animationType="slide" onRequestClose={() => setSelectedVoucher(null)}>
        {selectedVoucher && (
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setSelectedVoucher(null)} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Chi tiết ưu đãi</Text>
                <Pressable onPress={() => setSelectedVoucher(null)} style={styles.closeBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                  <Ionicons name="close" size={18} color={colors.ecoDarkBlue} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody}>
                <View style={styles.modalCenter}>
                  <View style={[styles.modalIconBox, { backgroundColor: getIconForReward(selectedVoucher).bg }]}>
                    <Ionicons name={getIconForReward(selectedVoucher).icon} size={42} color={getIconForReward(selectedVoucher).color} />
                  </View>
                  <Text style={styles.modalItemTitle}>{selectedVoucher.title}</Text>

                  <View style={styles.modalCostRow}>
                    <View style={styles.ecopointBadgeLarge}>
                      <Text style={styles.ecopointBadgeTextLarge}>E</Text>
                    </View>
                    <Text style={styles.modalCostText}>{selectedVoucher.costPoints.toLocaleString('vi-VN')}</Text>
                  </View>
                </View>

                <View style={styles.modalDetails}>
                  <Text style={styles.detailsLabel}>Thông tin chi tiết</Text>
                  <Text style={styles.detailsText}>{selectedVoucher.description}</Text>
                  <Text style={styles.detailsText}>Số lượng còn: {selectedVoucher.stock}</Text>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <AppButton
                  title={`${selectedVoucher.costPoints.toLocaleString('vi-VN')} điểm - Đổi ngay`}
                  onPress={() => void redeem(selectedVoucher)}
                />
              </View>
            </View>
          </View>
        )}
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgPink,
    paddingHorizontal: 16,
  },
  headerCard: {
    backgroundColor: colors.ecoBlue,
    borderRadius: 24,
    borderBottomWidth: 5,
    borderBottomColor: colors.ecoCardShadow,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    color: '#5194a8',
    fontWeight: '900',
    fontSize: 14,
  },
  headerText: {
    color: colors.ecoDarkBlue,
    fontWeight: '900',
    fontSize: 30,
    marginTop: 2,
  },
  headerIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.ecoPill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ecoPill,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: colors.white,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.ecoDarkBlue,
    fontWeight: '700',
  },
  categoriesContainer: {
    paddingVertical: 8,
    gap: 8,
  },
  categoryBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
    marginRight: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  categoryBtnActive: {
    backgroundColor: colors.ecoDarkBlue,
    borderColor: colors.ecoDarkBlue,
  },
  categoryText: {
    color: '#659bad',
    fontWeight: '900',
    fontSize: 14,
  },
  categoryTextActive: {
    color: colors.white,
  },
  gridSection: {
    marginTop: 8,
  },
  sectionTitle: {
    color: colors.ecoDarkBlue,
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  voucherCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 12,
    width: '48%',
    minHeight: 150,
    borderWidth: 2,
    borderColor: '#f1f8fc',
    borderBottomWidth: 4,
    borderBottomColor: '#d9eaf4',
  },
  voucherIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  voucherInfo: {
    flex: 1,
  },
  voucherTitle: {
    color: colors.ecoDarkBlue,
    fontWeight: '900',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  voucherSub: {
    color: '#659bad',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 8,
  },
  voucherCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
  },
  ecopointBadge: {
    width: 18,
    height: 18,
    backgroundColor: colors.coral,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  ecopointBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  voucherCost: {
    color: colors.coralDark,
    fontWeight: '900',
    fontSize: 14,
  },
  historySection: {
    marginTop: 24,
  },
  historyCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.ecoPill,
  },
  historyInfo: {
    flex: 1,
    paddingRight: 10,
  },
  historyTitle: {
    color: colors.ecoDarkBlue,
    fontWeight: '900',
    fontSize: 15,
  },
  historyMeta: {
    color: '#659bad',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 4,
  },
  historyStatus: {
    color: colors.green,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '58%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.ecoPill,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.ecoDarkBlue,
  },
  closeBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.ecoPill,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 24,
  },
  modalCenter: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: colors.ecoPill,
    paddingBottom: 24,
    marginBottom: 24,
  },
  modalIconBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalItemTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.ecoDarkBlue,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  ecopointBadgeLarge: {
    width: 24,
    height: 24,
    backgroundColor: colors.coral,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  ecopointBadgeTextLarge: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  modalCostText: {
    color: colors.coralDark,
    fontWeight: '900',
    fontSize: 20,
  },
  modalDetails: {
    gap: 8,
  },
  detailsLabel: {
    fontWeight: '900',
    color: colors.ecoDarkBlue,
    fontSize: 16,
    marginBottom: 4,
  },
  detailsText: {
    color: '#659bad',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 22,
  },
  modalFooter: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.ecoPill,
    backgroundColor: colors.white,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.ecoPill,
    marginTop: 8,
  },
  mascot: { width: 140, height: 140, resizeMode: 'contain', marginBottom: 12 },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ecoDarkBlue,
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#659bad',
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
  }
});