import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image } from 'react-native';
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

export default function RewardsScreen() {
  const { points, rewards, rewardRedemptions, requestReward } = useAppContext();
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState<Reward | null>(null);

  const redeem = async (reward: Reward) => {
    const ok = await requestReward(reward);
    Alert.alert(
      ok ? 'Đổi quà thành công! 🎉' : 'Chưa đủ Ecopoint',
      ok ? `Vui lòng kiểm tra lịch sử.` : `Bạn cần thêm ${reward.costPoints - points} Ecopoint để đổi phần thưởng này.`
    );
    if (ok) setSelectedVoucher(null);
  };

  // Mock icons based on title or description for UI flavor
  const getIconForReward = (reward: Reward) => {
    const title = reward.title.toLowerCase();
    if (title.includes('giảm')) return { icon: '💸', bg: '#10b981' };
    if (title.includes('game') || title.includes('giải trí')) return { icon: '🎮', bg: '#f59e0b' };
    if (title.includes('ăn') || title.includes('uống')) return { icon: '🥤', bg: '#059669' };
    if (title.includes('sức khoẻ') || title.includes('thuốc')) return { icon: '💊', bg: '#3b82f6' };
    return { icon: '🎁', bg: reward.color || '#0f172a' };
  };

  const filteredRewards = rewards.filter(r => {
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    // Note: If you add category to DB later, filter here. For now, show all.
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Top Header - Current Points */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Ecopoints: {points.toLocaleString('vi-VN')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm voucher..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Categories Horizontal Scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[styles.categoryBtn, isActive && styles.categoryBtnActive]}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>{cat}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Voucher Grid */}
        <View style={styles.gridSection}>
          <Text style={styles.sectionTitle}>Khám phá quà mới</Text>
          {filteredRewards.length > 0 ? (
            <View style={styles.grid}>
              {filteredRewards.map(reward => {
                const { icon, bg } = getIconForReward(reward);
                return (
                  <Pressable
                    key={reward.id}
                    style={styles.voucherCard}
                    onPress={() => setSelectedVoucher(reward)}
                  >
                    <View style={[styles.voucherIconBox, { backgroundColor: `${bg}20` }]}>
                      <Text style={styles.voucherIcon}>{icon}</Text>
                    </View>
                    <View style={styles.voucherInfo}>
                      <Text style={styles.voucherTitle} numberOfLines={2}>{reward.title}</Text>
                      <Text style={styles.voucherSub} numberOfLines={1}>{reward.description}</Text>
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
              <Text style={styles.emptyStateSub}>Đang cập nhật các ưu đãi mới. Hãy quay lại sau nhé!</Text>
            </View>
          )}
        </View>

        {/* History Block */}
        {rewardRedemptions.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Yêu cầu đổi thưởng</Text>
            {rewardRedemptions.map(item => (
              <View key={item.id} style={styles.historyCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>{item.rewardLabel}</Text>
                  <Text style={styles.historyMeta}>{item.costPoints} Ecopoint • {item.requestedAt.toLocaleDateString('vi-VN')}</Text>
                </View>
                <Text style={styles.historyStatus}>{redemptionStatusLabel(item.status)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Voucher Modal overlay */}
      <Modal visible={!!selectedVoucher} transparent animationType="slide" onRequestClose={() => setSelectedVoucher(null)}>
        {selectedVoucher && (
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setSelectedVoucher(null)} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Chi tiết ưu đãi</Text>
                <Pressable onPress={() => setSelectedVoucher(null)} style={styles.closeBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                  <Text style={styles.closeBtnText}>X</Text>
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody}>
                <View style={styles.modalCenter}>
                  <View style={[styles.modalIconBox, { backgroundColor: `${getIconForReward(selectedVoucher).bg}15` }]}>
                    <Text style={styles.modalIcon}>{getIconForReward(selectedVoucher).icon}</Text>
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
                  <Text style={styles.detailsLabel}>ℹ️ Thông tin chi tiết</Text>
                  <Text style={styles.detailsText}>{selectedVoucher.description}</Text>
                  <Text style={styles.detailsText}>Số lượng còn: {selectedVoucher.stock}</Text>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <AppButton
                  title={`${selectedVoucher.costPoints.toLocaleString('vi-VN')} Xu - Đổi ngay`}
                  onPress={() => void redeem(selectedVoucher)}
                />
              </View>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7f9',
  },
  header: {
    backgroundColor: '#0ccbf5',
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.5)',
    zIndex: 20,
    elevation: 3,
    paddingTop: 48,
  },
  headerText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  scrollContent: {
    paddingBottom: 160,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
    fontSize: 18,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  categoryBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  categoryBtnActive: {
    backgroundColor: '#ffffff',
    borderColor: '#2563eb',
  },
  categoryText: {
    color: '#4b5563',
    fontWeight: 'bold',
    fontSize: 14,
  },
  categoryTextActive: {
    color: '#2563eb',
  },
  gridSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#1f2937',
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    width: '48%',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    elevation: 1,
  },
  voucherIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  voucherIcon: {
    fontSize: 22,
  },
  voucherInfo: {
    flex: 1,
    justifyContent: 'center',
    flexShrink: 1,
  },
  voucherTitle: {
    color: '#111827',
    fontWeight: '900',
    fontSize: 13,
    marginBottom: 2,
    flexShrink: 1,
  },
  voucherSub: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 6,
  },
  voucherCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
  },
  ecopointBadge: {
    width: 16,
    height: 16,
    backgroundColor: '#fb923c',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  ecopointBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  voucherCost: {
    color: '#f97316',
    fontWeight: 'bold',
    fontSize: 13,
  },
  historySection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  historyTitle: {
    color: '#111827',
    fontWeight: '900',
    fontSize: 15,
  },
  historyMeta: {
    color: '#6b7280',
    fontWeight: '700',
    fontSize: 13,
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
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '60%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#4b5563',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalBody: {
    padding: 24,
  },
  modalCenter: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: '#e5e7eb',
    paddingBottom: 24,
    marginBottom: 24,
  },
  modalIconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalIcon: {
    fontSize: 48,
  },
  modalItemTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
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
    backgroundColor: '#fb923c',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  ecopointBadgeTextLarge: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  modalCostText: {
    color: '#f97316',
    fontWeight: '900',
    fontSize: 20,
  },
  modalDetails: {
    gap: 8,
  },
  detailsLabel: {
    fontWeight: 'bold',
    color: '#111827',
    fontSize: 16,
    marginBottom: 4,
  },
  detailsText: {
    color: '#4b5563',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 22,
  },
  modalFooter: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  mascot: { width: 140, height: 140, resizeMode: 'contain', marginBottom: 12 },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  }
});
