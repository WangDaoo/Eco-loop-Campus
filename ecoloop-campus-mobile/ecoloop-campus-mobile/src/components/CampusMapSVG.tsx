/**
 * CampusMapSVG – Bản đồ khuôn viên campus offline hoàn toàn
 * Render GeoJSON bằng react-native-svg, không cần internet, không WebView.
 *
 * Hệ toạ độ: UTM EPSG:32648 → toạ độ màn hình (linear projection)
 * Tương tác: kéo để pan, pinch để zoom (dùng PanResponder)
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  G,
  Path,
  Rect,
} from 'react-native-svg';

import { BUILDINGS_GEOJSON, CONTOURS_GEOJSON, FRAME_GEOJSON, ROADS_GEOJSON } from '../assets/campusGeoData';
import { getStationCapacityLevel, getStationStatusLabel } from '../services/stationPresentation';
import { colors, radius } from '../theme/colors';
import { BinStation } from '../types';

// ── Hệ toạ độ UTM campus ──────────────────────────────────────────────────────
const CAMPUS = {
  minX: 609973.5284937217,
  minY: 2315979.1727699493,
  maxX: 610853.1673639194,
  maxY: 2316582.0362756485,
};
const CAMPUS_W = CAMPUS.maxX - CAMPUS.minX; // ~879m
const CAMPUS_H = CAMPUS.maxY - CAMPUS.minY; // ~603m

// Kích thước SVG viewBox (giữ tỷ lệ campus)
const VB_W = 880;
const VB_H = 604;

function utmToSvg(x: number, y: number): [number, number] {
  return [
    ((x - CAMPUS.minX) / CAMPUS_W) * VB_W,
    ((CAMPUS.maxY - y) / CAMPUS_H) * VB_H,
  ];
}

// ── Convert GeoJSON feature sang SVG path string ──────────────────────────────
function coordsToPath(ring: number[][]): string {
  if (!ring || ring.length < 2) return '';
  return ring
    .map(([x, y], i) => {
      const [sx, sy] = utmToSvg(x, y);
      return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`;
    })
    .join(' ') + ' Z';
}

function featuresToPaths(geojson: any): string[] {
  if (!geojson || !geojson.features) return [];
  const paths: string[] = [];
  for (const f of geojson.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates) paths.push(coordsToPath(ring));
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates)
        for (const ring of poly) paths.push(coordsToPath(ring));
    } else if (g.type === 'LineString') {
      paths.push(coordsToPath(g.coordinates));
    } else if (g.type === 'MultiLineString') {
      for (const line of g.coordinates) paths.push(coordsToPath(line));
    }
  }
  return paths;
}

// ── Toạ độ pin trạm (từ mapX/mapY % do Supabase quản lý) ────────────────────
function stationSvgPos(s: BinStation): [number, number] | null {
  if (typeof s.mapX !== 'number' || typeof s.mapY !== 'number') return null;
  // % → UTM → SVG
  const utmX = CAMPUS.minX + (CAMPUS_W * s.mapX) / 100;
  const utmY = CAMPUS.maxY - (CAMPUS_H * s.mapY) / 100;
  return utmToSvg(utmX, utmY);
}

function pinColor(s: BinStation): string {
  const lv = getStationCapacityLevel(s);
  if (s.status === 'maintenance' || s.status === 'closed') return '#94a3b8';
  if (lv === 'full') return '#e05c45';
  if (lv === 'warning') return '#f59e0b';
  return '#22c55e';
}

// ── Render GeoJSON (memoised paths) ──────────────────────────────────────────
const buildingPaths = featuresToPaths(BUILDINGS_GEOJSON);
const roadPaths     = featuresToPaths(ROADS_GEOJSON);
const contourPaths  = featuresToPaths(CONTOURS_GEOJSON);
const framePaths    = featuresToPaths(FRAME_GEOJSON);

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  stations: BinStation[];
  onSelect?: (station: BinStation) => void;
  selectedStationId?: string;
  focusRequestId?: number;
  style?: object;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const INIT_SCALE = 1.45;
const ZOOM_STEP = 1.35;

export function CampusMapSVG({ stations, onSelect, selectedStationId, focusRequestId = 0, style }: Props) {
  const [scale, setScale]   = useState(INIT_SCALE);
  const [tx, setTx]         = useState(0);
  const [ty, setTy]         = useState(0);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  const lastScale   = useRef(INIT_SCALE);
  const lastTx      = useRef(0);
  const lastTy      = useRef(0);
  const lastDist    = useRef<number | null>(null);
  const lastMidX    = useRef(0);
  const lastMidY    = useRef(0);
  const isPinch     = useRef(false);
  const initialCentered = useRef(false);

  const mapTransform = `matrix(${scale} 0 0 ${scale} ${tx} ${ty})`;

  function viewportGeometry(size = mapSize) {
    const width = size.width || VB_W;
    const height = size.height || VB_H;
    const fitScale = Math.min(width / VB_W, height / VB_H) || 1;
    return {
      width: width / fitScale,
      height: height / fitScale,
      fitScale,
    };
  }

  function screenDeltaToSvg(dx: number, dy: number): [number, number] {
    const { fitScale } = viewportGeometry();
    return [dx / fitScale, dy / fitScale];
  }

  function dist(t: React.Touch[]): number {
    const dx = t[0].pageX - t[1].pageX;
    const dy = t[0].pageY - t[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function mid(t: React.Touch[]): [number, number] {
    return [(t[0].pageX + t[1].pageX) / 2, (t[0].pageY + t[1].pageY) / 2];
  }

  function clampScale(value: number) {
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value));
  }

  function applyViewport(nextScale: number, nextTx: number, nextTy: number) {
    const safeScale = clampScale(nextScale);
    setScale(safeScale);
    setTx(nextTx);
    setTy(nextTy);
    lastScale.current = safeScale;
    lastTx.current = nextTx;
    lastTy.current = nextTy;
  }

  function centerCampus(targetScale = INIT_SCALE) {
    const safeScale = clampScale(targetScale);
    const { width, height } = viewportGeometry();
    applyViewport(safeScale, (width - VB_W * safeScale) / 2, (height - VB_H * safeScale) / 2);
  }

  function centerOnStation(station: BinStation, targetScale = Math.max(lastScale.current, 3)) {
    const position = stationSvgPos(station);
    if (!position) return;
    const safeScale = clampScale(targetScale);
    const { width, height } = viewportGeometry();
    applyViewport(safeScale, width / 2 - position[0] * safeScale, height / 2 - position[1] * safeScale);
  }

  function zoomAroundCenter(multiplier: number) {
    const nextScale = clampScale(lastScale.current * multiplier);
    const { width, height } = viewportGeometry();
    const centerX = width / 2;
    const centerY = height / 2;
    const contentX = (centerX - lastTx.current) / lastScale.current;
    const contentY = (centerY - lastTy.current) / lastScale.current;
    applyViewport(nextScale, centerX - contentX * nextScale, centerY - contentY * nextScale);
  }

  function selectStationMarker(station: BinStation) {
    centerOnStation(station);
    onSelect?.(station);
  }

  function zoomIn() {
    zoomAroundCenter(ZOOM_STEP);
  }

  function zoomOut() {
    zoomAroundCenter(1 / ZOOM_STEP);
  }

  function handleMapLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setMapSize({ width, height });
  }

  useEffect(() => {
    if (!mapSize.width || !mapSize.height || initialCentered.current) return;
    centerCampus(INIT_SCALE);
    initialCentered.current = true;
  }, [mapSize]);

  useEffect(() => {
    if (!focusRequestId || !selectedStationId) return;
    const station = stations.find(item => item.id === selectedStationId);
    if (station) centerOnStation(station);
  }, [focusRequestId, selectedStationId, stations]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (e) => {
        lastDist.current  = null;
        isPinch.current   = false;

        if (e.nativeEvent.touches.length === 2) {
          const ts = Array.from(e.nativeEvent.touches) as unknown as React.Touch[];
          lastDist.current = dist(ts);
          const [mx, my] = mid(ts);
          lastMidX.current = mx;
          lastMidY.current = my;
          isPinch.current = true;
        }
      },

      onPanResponderMove: (e, gs) => {
        const ts = Array.from(e.nativeEvent.touches) as unknown as React.Touch[];

        if (ts.length === 2) {
          isPinch.current = true;
          const d = dist(ts);
          const [mx, my] = mid(ts);

          if (lastDist.current !== null) {
            const ratio = d / lastDist.current;
            const newScale = clampScale(lastScale.current * ratio);
            const [dmx, dmy] = screenDeltaToSvg(mx - lastMidX.current, my - lastMidY.current);
            applyViewport(newScale, lastTx.current + dmx, lastTy.current + dmy);
          }
          lastDist.current = d;
          lastMidX.current = mx;
          lastMidY.current = my;
        } else if (!isPinch.current) {
          const [dx, dy] = screenDeltaToSvg(gs.dx, gs.dy);
          setTx(lastTx.current + dx);
          setTy(lastTy.current + dy);
        }
      },

      onPanResponderRelease: (_, gs) => {
        if (!isPinch.current) {
          const [dx, dy] = screenDeltaToSvg(gs.dx, gs.dy);
          applyViewport(lastScale.current, lastTx.current + dx, lastTy.current + dy);
        }
        isPinch.current = false;
      },
    })
  ).current;

  function recenter() {
    centerCampus(INIT_SCALE);
  }

  return (
    <View style={[styles.wrapper, style]}>
      {/* Bản đồ SVG */}
      <View style={styles.mapArea} onLayout={handleMapLayout} {...panResponder.panHandlers}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
        >
          {/* Nền campus */}
          <Rect x={0} y={0} width={VB_W} height={VB_H} fill="#f0f9f4" />

          <G transform={mapTransform}>
            <Rect x={0} y={0} width={VB_W} height={VB_H} fill="#f0f9f4" />

            {/* Lớp địa hình (contours) */}
            <G>
              {contourPaths.map((d, i) => (
                <Path key={`c${i}`} d={d} stroke="#7892ad" strokeWidth={0.75} fill="none" strokeDasharray="3,3" />
              ))}
            </G>

            {/* Lớp tòa nhà */}
            <G>
              {buildingPaths.map((d, i) => (
                <Path key={`b${i}`} d={d} stroke="#52677f" strokeWidth={1.05} fill="#d5dee8" fillOpacity={0.9} />
              ))}
            </G>

            {/* Lớp đường */}
            <G>
              {roadPaths.map((d, i) => (
                <Path key={`r${i}`} d={d} stroke="#2386ee" strokeWidth={2.4} fill="none" strokeOpacity={0.95} />
              ))}
            </G>

            {/* Ranh giới campus */}
            <G>
              {framePaths.map((d, i) => (
                <Path key={`f${i}`} d={d} stroke="#0f172a" strokeWidth={2.6} fill="none" />
              ))}
            </G>

            {/* Station markers */}
            {stations.map((s) => {
              const position = stationSvgPos(s);
              if (!position) return null;
              const [sx, sy] = position;
              const pc = pinColor(s);
              const isSelected = s.id === selectedStationId;
              return (
                <G key={s.id} onPress={() => selectStationMarker(s)}>
                  {/* Halo */}
                  <Circle cx={sx} cy={sy} r={isSelected ? 20 : 14} fill={pc} opacity={isSelected ? 0.34 : 0.22} />
                  {/* Pin body */}
                  <Circle cx={sx} cy={sy} r={isSelected ? 11 : 9} fill={pc} stroke="white" strokeWidth={isSelected ? 3 : 2} />
                  {/* Inner dot */}
                  <Circle cx={sx} cy={sy} r={isSelected ? 4.5 : 3.5} fill="rgba(255,255,255,0.88)" />
                </G>
              );
            })}
          </G>
        </Svg>
      </View>

      <View style={styles.zoomControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Phóng to bản đồ"
          hitSlop={8}
          style={styles.zoomButton}
          onPress={zoomIn}
        >
          <Text style={styles.zoomButtonText}>+</Text>
        </Pressable>
        <View style={styles.zoomDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thu nhỏ bản đồ"
          hitSlop={8}
          style={styles.zoomButton}
          onPress={zoomOut}
        >
          <Text style={styles.zoomButtonText}>-</Text>
        </Pressable>
      </View>

      {/* Nút căn giữa */}
      <Pressable style={styles.recenterBtn} onPress={recenter}>
        <Text style={styles.recenterText}>⊙ Căn giữa</Text>
      </Pressable>

      {/* Legend */}
      <View style={styles.legend}>
        <LegendDot color={colors.green}     label="Bình thường" />
        <LegendDot color={colors.gold}      label="Gần đầy" />
        <LegendDot color={colors.coralDark} label="Đầy" />
        <LegendDot color="#94a3b8"          label="Bảo trì" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, position: 'relative', overflow: 'hidden' },
  mapArea: { flex: 1, backgroundColor: '#f0f9f4' },
  zoomControls: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.94)',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  zoomButton: {
    width: 44,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonText: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  zoomDivider: { height: 1, backgroundColor: 'rgba(15,23,42,0.1)' },
  recenterBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 24,
    flexDirection: 'row',
    gap: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  recenterText: { fontSize: 13, fontWeight: '800', color: colors.ink },
  legend: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { fontSize: 10, fontWeight: '700', color: colors.ink },
});
