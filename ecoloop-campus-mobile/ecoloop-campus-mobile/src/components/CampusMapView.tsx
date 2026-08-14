/**
 * CampusMapView – bản đồ khuôn viên campus dựa trên tọa độ mapX/mapY (0-100%)
 * Hiển thị SVG campus làm nền, vẽ các pin trạm thu gom lên trên.
 * Không cần Google Maps API, hoạt động cả trên Android/iOS và Web.
 */
import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BinStation } from '../types';
import { colors, radius } from '../theme/colors';
import { getStationCapacityLevel, getStationStatusLabel } from '../services/stationPresentation';

// Ảnh vệ tinh khuôn viên campus (PNG, tương thích React Native)
const campusImage = require('../assets/campus-satellite.png');

interface Props {
  stations: BinStation[];
  onSelectStation?: (station: BinStation) => void;
  style?: object;
}

function pinColor(station: BinStation): string {
  const level = getStationCapacityLevel(station);
  if (station.status === 'maintenance' || station.status === 'closed') return colors.muted;
  if (level === 'full') return colors.coralDark;
  if (level === 'warning') return colors.gold;
  return colors.green;
}

function PinMarker({ station, onPress }: { station: BinStation; onPress: () => void }) {
  const bg = pinColor(station);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pin,
        { left: `${station.mapX}%` as any, top: `${station.mapY}%` as any },
      ]}
    >
      <View style={[styles.pinDot, { backgroundColor: bg }]}>
        <View style={styles.pinInner} />
      </View>
      <View style={[styles.pinTail, { borderTopColor: bg }]} />
    </Pressable>
  );
}

export function CampusMapView({ stations, onSelectStation, style }: Props) {
  const [selected, setSelected] = useState<BinStation | null>(null);

  const stationsWithPin = stations.filter(
    s => typeof s.mapX === 'number' && typeof s.mapY === 'number'
  );

  const handlePin = (station: BinStation) => {
    setSelected(prev => (prev?.id === station.id ? null : station));
    onSelectStation?.(station);
  };

  return (
    <View style={[styles.wrapper, style]}>
      {/* Bản đồ campus */}
      <ScrollView
        horizontal
        minimumZoomScale={1}
        maximumZoomScale={3}
        showsHorizontalScrollIndicator={false}
        bouncesZoom
        contentContainerStyle={styles.scrollContent}
      >
        <ScrollView
          minimumZoomScale={1}
          maximumZoomScale={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.mapBounds}>
            <Image
              source={campusImage}
              style={styles.campusImage}
              resizeMode="contain"
            />
            {/* Các pin trạm */}
            {stationsWithPin.map(station => (
              <PinMarker key={station.id} station={station} onPress={() => handlePin(station)} />
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Popup khi bấm pin */}
      {selected && (
        <View style={styles.popup}>
          <View style={styles.popupHeader}>
            <View style={[styles.popupDot, { backgroundColor: pinColor(selected) }]} />
            <Text style={styles.popupName}>{selected.name}</Text>
            <Pressable onPress={() => setSelected(null)} style={styles.popupClose}>
              <Text style={styles.popupCloseText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.popupLocation}>📍 {selected.location} – {selected.building ? `Tòa ${selected.building}` : ''} Tầng {selected.floor}</Text>
          <View style={styles.popupRow}>
            <View style={[styles.statusPill, { backgroundColor: pinColor(selected) + '22' }]}>
              <Text style={[styles.statusPillText, { color: pinColor(selected) }]}>
                {getStationStatusLabel(selected.status)}
              </Text>
            </View>
            <View style={styles.capacityBar}>
              <View style={[styles.capacityFill, {
                width: `${selected.capacity}%` as any,
                backgroundColor: selected.capacity >= 90 ? colors.coralDark : selected.capacity >= 80 ? colors.gold : colors.green
              }]} />
            </View>
            <Text style={styles.capacityText}>{selected.capacity}%</Text>
          </View>
          <Text style={styles.popupGroup}>Nhóm: {selected.binGroup}</Text>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <LegendItem color={colors.green} label="Bình thường" />
        <LegendItem color={colors.gold} label="Gần đầy" />
        <LegendItem color={colors.coralDark} label="Đầy / Cần thu" />
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const MAP_W = 800;
const MAP_H = 560;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
  },
  scrollContent: {},
  mapBounds: {
    width: MAP_W,
    height: MAP_H,
    position: 'relative',
  },
  campusImage: {
    width: MAP_W,
    height: MAP_H,
  },
  pin: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -14 }, { translateY: -36 }],
  },
  pinDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  pinInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  popup: {
    position: 'absolute',
    bottom: 56,
    left: 12,
    right: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    gap: 6,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  popupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  popupName: {
    flex: 1,
    fontWeight: '900',
    fontSize: 15,
    color: colors.ink,
  },
  popupClose: {
    padding: 4,
  },
  popupCloseText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 16,
  },
  popupLocation: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13,
  },
  popupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusPillText: {
    fontWeight: '900',
    fontSize: 12,
  },
  capacityBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.cream,
    borderRadius: 3,
    overflow: 'hidden',
  },
  capacityFill: {
    height: '100%',
    borderRadius: 3,
  },
  capacityText: {
    fontWeight: '900',
    color: colors.ink,
    fontSize: 13,
    minWidth: 36,
    textAlign: 'right',
  },
  popupGroup: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  legend: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
});
