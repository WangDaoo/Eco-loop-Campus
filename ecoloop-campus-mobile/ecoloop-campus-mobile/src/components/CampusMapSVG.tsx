/**
 * CampusMapSVG – Bản đồ khuôn viên campus offline hoàn toàn
 * Render GeoJSON bằng react-native-svg, không cần internet, không WebView.
 *
 * Hệ toạ độ: UTM EPSG:32648 → toạ độ màn hình (linear projection)
 * Tương tác: kéo để pan, pinch để zoom (dùng PanResponder)
 */
import React, { useRef, useState } from 'react';
import {
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  G,
  Path,
  Polygon,
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

// ── Toạ độ pin trạm (từ mapX/mapY %) ─────────────────────────────────────────
const FIXED: Record<string, { x: number; y: number }> = {
  E1:  { x: 35, y: 42 },
  LIB: { x: 62, y: 28 },
  CAF: { x: 50, y: 68 },
};
const FALLBACKS = [{ x: 43, y: 73 }, { x: 50, y: 82 }, { x: 65, y: 64 }, { x: 33, y: 92 }];

function stationSvgPos(s: BinStation, i: number): [number, number] {
  const base = FIXED[s.building] || FALLBACKS[i % FALLBACKS.length];
  const pct = {
    x: typeof s.mapX === 'number' ? s.mapX : base.x,
    y: typeof s.mapY === 'number' ? s.mapY : base.y,
  };
  // % → UTM → SVG
  const utmX = CAMPUS.minX + (CAMPUS_W * pct.x) / 100;
  const utmY = CAMPUS.maxY - (CAMPUS_H * pct.y) / 100;
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
  style?: object;
}

const MIN_SCALE = 0.8;
const MAX_SCALE = 4.0;
const INIT_SCALE = 1.0;

export function CampusMapSVG({ stations, onSelect, style }: Props) {
  const [scale, setScale]   = useState(INIT_SCALE);
  const [tx, setTx]         = useState(0);
  const [ty, setTy]         = useState(0);

  const lastScale   = useRef(INIT_SCALE);
  const lastTx      = useRef(0);
  const lastTy      = useRef(0);
  const lastDist    = useRef<number | null>(null);
  const lastMidX    = useRef(0);
  const lastMidY    = useRef(0);
  const isPinch     = useRef(false);

  function dist(t: React.Touch[]): number {
    const dx = t[0].pageX - t[1].pageX;
    const dy = t[0].pageY - t[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function mid(t: React.Touch[]): [number, number] {
    return [(t[0].pageX + t[1].pageX) / 2, (t[0].pageY + t[1].pageY) / 2];
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (e) => {
        lastScale.current = scale;
        lastTx.current    = tx;
        lastTy.current    = ty;
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
            const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, lastScale.current * ratio));
            setScale(newScale);
            // pan follow midpoint
            const dmx = mx - lastMidX.current;
            const dmy = my - lastMidY.current;
            setTx(lastTx.current + dmx);
            setTy(lastTy.current + dmy);
          }
          lastDist.current = d;
          lastMidX.current = mx;
          lastMidY.current = my;
          lastScale.current = scale;
          lastTx.current    = tx;
          lastTy.current    = ty;
        } else if (!isPinch.current) {
          setTx(lastTx.current + gs.dx);
          setTy(lastTy.current + gs.dy);
        }
      },

      onPanResponderRelease: (_, gs) => {
        if (!isPinch.current) {
          lastTx.current = lastTx.current + gs.dx;
          lastTy.current = lastTy.current + gs.dy;
        }
        isPinch.current = false;
      },
    })
  ).current;

  function recenter() {
    setScale(INIT_SCALE);
    setTx(0);
    setTy(0);
    lastScale.current = INIT_SCALE;
    lastTx.current = 0;
    lastTy.current = 0;
  }

  return (
    <View style={[styles.wrapper, style]}>
      {/* Bản đồ SVG */}
      <View style={styles.mapArea} {...panResponder.panHandlers}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          style={{
            transform: [
              { translateX: tx },
              { translateY: ty },
              { scale },
            ],
          }}
        >
          {/* Nền campus */}
          <Rect x={0} y={0} width={VB_W} height={VB_H} fill="#f0f9f4" />

          {/* Lớp địa hình (contours) */}
          <G>
            {contourPaths.map((d, i) => (
              <Path key={`c${i}`} d={d} stroke="#94a3b8" strokeWidth={0.5} fill="none" strokeDasharray="3,3" />
            ))}
          </G>

          {/* Lớp tòa nhà */}
          <G>
            {buildingPaths.map((d, i) => (
              <Path key={`b${i}`} d={d} stroke="#64748b" strokeWidth={0.8} fill="#cbd5e1" fillOpacity={0.76} />
            ))}
          </G>

          {/* Lớp đường */}
          <G>
            {roadPaths.map((d, i) => (
              <Path key={`r${i}`} d={d} stroke="#3b82f6" strokeWidth={2} fill="none" strokeOpacity={0.9} />
            ))}
          </G>

          {/* Ranh giới campus */}
          <G>
            {framePaths.map((d, i) => (
              <Path key={`f${i}`} d={d} stroke="#0f172a" strokeWidth={2} fill="none" />
            ))}
          </G>

          {/* Station markers */}
          {stations.map((s, i) => {
            const [sx, sy] = stationSvgPos(s, i);
            const pc = pinColor(s);
            return (
              <G key={s.id} onPress={() => onSelect?.(s)}>
                {/* Halo */}
                <Circle cx={sx} cy={sy} r={14} fill={pc} opacity={0.22} />
                {/* Pin body */}
                <Circle cx={sx} cy={sy} r={9} fill={pc} stroke="white" strokeWidth={2} />
                {/* Inner dot */}
                <Circle cx={sx} cy={sy} r={3.5} fill="rgba(255,255,255,0.85)" />
              </G>
            );
          })}
        </Svg>
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
