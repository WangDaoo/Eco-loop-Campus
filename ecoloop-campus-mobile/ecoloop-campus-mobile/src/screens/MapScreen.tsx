import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, DEFAULT_BOTTOM_CLEARANCE } from '../components/Screen';
import { CampusLeafletMap } from '../components/CampusLeafletMap';
import { useAppContext } from '../context/AppContext';
import {
  getStationCapacityLevel,
  getStationStatusLabel,
  getStationSubtitle,
} from '../services/stationPresentation';
import { colors, radius } from '../theme/colors';
import { BinStation } from '../types';

const MAP_CARD_HEIGHT = 280;

function needsAttention(s: BinStation) {
  const lv = getStationCapacityLevel(s);
  return lv !== 'normal' || s.status === 'maintenance' || s.status === 'closed';
}

function hasMapPosition(station: BinStation) {
  return typeof station.mapX === 'number' && typeof station.mapY === 'number';
}

export default function MapScreen() {
  const { stations } = useAppContext();
  const [selected, setSelected] = useState<BinStation | null>(null);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [mapGestureActive, setMapGestureActive] = useState(false);

  function selectStation(station: BinStation, focusMap = false) {
    setSelected(station);
    if (focusMap && hasMapPosition(station)) setFocusRequestId(value => value + 1);
  }

  function beginMapGestureCapture() {
    setMapGestureActive(true);
    return false;
  }

  function endMapGesture() {
    setMapGestureActive(false);
  }

  useEffect(() => {
    if (!selected) return;
    const latest = stations.find(station => station.id === selected.id);
    setSelected(latest ?? null);
  }, [selected, stations]);

  const attentionStations = useMemo(() => stations.filter(needsAttention), [stations]);

  const selectedLevel   = selected ? getStationCapacityLevel(selected) : null;
  const capacityColor   =
    selectedLevel === 'full'    ? colors.coralDark :
    selectedLevel === 'warning' ? colors.gold      : colors.green;

  return (
    <Screen
      scroll
      noPadding
      style={styles.safe}
      contentContainerStyle={styles.pageContent}
      bottomClearance={DEFAULT_BOTTOM_CLEARANCE + 96}
      scrollEnabled={!mapGestureActive}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Bản đồ</Text>
      </View>

      {/* Bản đồ Leaflet offline, cùng cơ chế pan/zoom/focus như web admin. */}
      <View
        style={styles.mapCard}
        onStartShouldSetResponderCapture={beginMapGestureCapture}
        onMoveShouldSetResponderCapture={beginMapGestureCapture}
        onTouchStart={beginMapGestureCapture}
        onTouchEnd={endMapGesture}
        onTouchCancel={endMapGesture}
      >
        <CampusLeafletMap
          stations={stations}
          selectedStationId={selected?.id}
          focusRequestId={focusRequestId}
          onSelect={station => selectStation(station)}
          onGestureActiveChange={setMapGestureActive}
          style={styles.map}
        />
      </View>

      <View style={styles.stationContent}>
        {/* Chi tiết trạm đang chọn */}
        {selected && (
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={[styles.detailDot, { backgroundColor: capacityColor }]} />
              <Text style={styles.detailName}>{selected.name}</Text>
              <View style={[styles.statusPill, { borderColor: capacityColor }]}>
                <Text style={[styles.statusPillText, { color: capacityColor }]}>
                  {getStationStatusLabel(selected.status)}
                </Text>
              </View>
            </View>
            <Text style={styles.detailSub}>{getStationSubtitle(selected)}</Text>
            {!hasMapPosition(selected) && (
              <Text style={styles.locationNotice}>Chưa đặt vị trí trên bản đồ</Text>
            )}
            <View style={styles.capRow}>
              <View style={styles.capBar}>
                <View style={[styles.capFill, { width: `${selected.capacity}%` as any, backgroundColor: capacityColor }]} />
              </View>
              <Text style={[styles.capText, { color: capacityColor }]}>{selected.capacity}%</Text>
            </View>
            <Text style={styles.detailGroup}>Nhóm: {selected.binGroup}</Text>
          </View>
        )}

        {/* Cảnh báo */}
        {attentionStations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cần chú ý ({attentionStations.length})</Text>
            {attentionStations.map(s => {
              const lv = getStationCapacityLevel(s);
              const ac = lv === 'full' ? colors.coralDark : colors.gold;
              return (
                <View key={s.id} style={[styles.alertCard, { borderLeftColor: ac }]}>
                  <View style={styles.alertRow}>
                    <Text style={styles.alertName}>{s.name}</Text>
                    <View style={[styles.statusPill, { borderColor: ac }]}>
                      <Text style={[styles.statusPillText, { color: ac }]}>
                        {getStationStatusLabel(s.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.alertSub}>{s.location} · {s.capacity}% sức chứa</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Danh sách tất cả trạm */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tất cả trạm ({stations.length})</Text>
          {stations.map(s => {
            const lv = getStationCapacityLevel(s);
            const dc =
              lv === 'full'    ? colors.coralDark :
              lv === 'warning' ? colors.gold      : colors.green;
            return (
              <Pressable key={s.id} onPress={() => selectStation(s, true)} style={[styles.rowCard, selected?.id === s.id && styles.rowCardSelected]}>
                <View style={[styles.rowDot, { backgroundColor: dc }]} />
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{s.name}</Text>
                  <Text style={styles.rowMeta}>
                    {s.building ? `Tòa ${s.building} · ` : ''}Tầng {s.floor} · {s.capacity}%
                  </Text>
                  {!hasMapPosition(s) && <Text style={styles.locationNotice}>Chưa đặt vị trí trên bản đồ</Text>}
                </View>
                <View style={[styles.statusPill, { borderColor: dc }]}>
                  <Text style={[styles.statusPillText, { color: dc }]}>
                    {getStationStatusLabel(s.status)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPink },
  pageContent: { paddingBottom: DEFAULT_BOTTOM_CLEARANCE + 44 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: { color: colors.ink, fontSize: 24, fontWeight: '900' },

  mapCard: {
    height: MAP_CARD_HEIGHT,
    marginHorizontal: 12,
    borderRadius: radius.xl,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  map: { flex: 1 },

  stationContent: { paddingHorizontal: 12, paddingTop: 10, gap: 10 },

  detailCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    gap: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailDot: { width: 12, height: 12, borderRadius: 6 },
  detailName: { flex: 1, fontWeight: '900', color: colors.ink, fontSize: 15 },
  detailSub: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  locationNotice: { color: colors.coralDark, fontWeight: '800', fontSize: 11, marginTop: 2 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  capBar: { flex: 1, height: 6, backgroundColor: colors.cream, borderRadius: 3, overflow: 'hidden' },
  capFill: { height: '100%', borderRadius: 3 },
  capText: { fontWeight: '900', fontSize: 13, minWidth: 36, textAlign: 'right' },
  detailGroup: { color: colors.muted, fontSize: 12, fontWeight: '700' },

  section: { gap: 8 },
  sectionTitle: { fontWeight: '900', color: colors.ink, fontSize: 15, marginBottom: 2 },

  alertCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 12,
    borderLeftWidth: 4,
    gap: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertName: { flex: 1, fontWeight: '900', color: colors.ink, fontSize: 14 },
  alertSub: { color: colors.muted, fontWeight: '700', fontSize: 12 },

  rowCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  rowCardSelected: { borderWidth: 2, borderColor: colors.green },
  rowDot: { width: 12, height: 12, borderRadius: 6 },
  rowInfo: { flex: 1 },
  rowName: { fontWeight: '900', color: colors.ink, fontSize: 14 },
  rowMeta: { color: colors.muted, fontWeight: '700', fontSize: 12, marginTop: 2 },

  statusPill: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusPillText: { fontSize: 11, fontWeight: '900' },
});
