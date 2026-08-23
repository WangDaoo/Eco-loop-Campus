import React, { useEffect, useMemo, useRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { buildCampusMapHtml } from '../services/campusMapHtml';
import { BinStation } from '../types';

type Props = {
  stations: BinStation[];
  selectedStationId?: string;
  focusRequestId?: number;
  onSelect?: (station: BinStation) => void;
  style?: StyleProp<ViewStyle>;
};

export function CampusLeafletMap({
  stations,
  selectedStationId,
  focusRequestId = 0,
  onSelect,
  style,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const html = useMemo(
    () => buildCampusMapHtml(stations, selectedStationId),
    [selectedStationId, stations],
  );

  useEffect(() => {
    if (!focusRequestId || !selectedStationId) return;
    const stationId = JSON.stringify(selectedStationId);
    webViewRef.current?.injectJavaScript(`window.focusStation && window.focusStation(${stationId}); true;`);
  }, [focusRequestId, selectedStationId]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string; stationId?: string };
      if (message.type !== 'SELECT_STATION' || !message.stationId) return;
      const station = stations.find(station => station.id === message.stationId);
      if (station) onSelect?.(station);
    } catch {
      // Ignore malformed messages from the embedded map.
    }
  }

  return (
    <View style={[styles.shell, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={handleMessage}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#f0f9f4' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
