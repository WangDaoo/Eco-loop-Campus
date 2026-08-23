/**
 * buildCampusMapHtml – Leaflet GIS campus map, hoàn toàn offline
 *
 * - Leaflet + proj4 được nhúng inline (không cần CDN)
 * - GeoJSON campus được nhúng inline (không cần server, không cần require .geojson)
 * - Không có tile layer (hoạt động 100% offline)
 * - Toạ độ trạm nhận từ props (API) qua tham số stations[]
 *
 * Giao tiếp với React Native:
 *   window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_STATION', stationId }))
 */

import { BinStation } from '../types';
import { getStationCapacityLevel } from '../services/stationPresentation';

// GeoJSON campus data – inlined từ admin public assets
import { FRAME_GEOJSON, BUILDINGS_GEOJSON, ROADS_GEOJSON, CONTOURS_GEOJSON } from '../assets/campusGeoData';

// Leaflet + proj4 bundled offline (base64-encoded để tránh escape issues trong TypeScript)
import { LEAFLET_JS_B64, PROJ4_JS_B64 } from '../assets/offlineBundles';

// Leaflet CSS – nhúng inline (critical subset)
const LEAFLET_CSS = `
.leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-tile-container,.leaflet-pane>svg,.leaflet-pane>canvas,.leaflet-zoom-box,.leaflet-image-layer,.leaflet-layer{position:absolute;left:0;top:0}.leaflet-container{overflow:hidden}.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow{-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-user-drag:none}.leaflet-tile::selection{background:transparent}.leaflet-safari .leaflet-tile{image-rendering:crisp-edges}.leaflet-zoom-anim .leaflet-zoom-animated{-webkit-transform-origin:0 0;transform-origin:0 0}.leaflet-zoom-anim .leaflet-zoom-animated{transition:transform .25s cubic-bezier(0,0,0.25,1)}.leaflet-zoom-anim .leaflet-tile,.leaflet-pan-anim .leaflet-tile{transition:none}.leaflet-zoom-anim .leaflet-zoom-animated.leaflet-zoom-hide{visibility:hidden}.leaflet-map-pane canvas{z-index:1}.leaflet-map-pane svg{z-index:2}.leaflet-vml-shape{width:1px;height:1px}.lvml{behavior:url(#default#VML);display:inline-block;position:absolute}.leaflet-control{position:relative;z-index:800;pointer-events:visiblePainted;pointer-events:auto}.leaflet-top,.leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}.leaflet-top{top:0}.leaflet-right{right:0}.leaflet-bottom{bottom:0}.leaflet-left{left:0}.leaflet-control{float:left;clear:both}.leaflet-right .leaflet-control{float:right}.leaflet-top .leaflet-control{margin-top:10px}.leaflet-bottom .leaflet-control{margin-bottom:10px}.leaflet-left .leaflet-control{margin-left:10px}.leaflet-right .leaflet-control{margin-right:10px}.leaflet-fade-anim .leaflet-popup{opacity:0;transition:opacity .2s linear}.leaflet-fade-anim .leaflet-map-pane .leaflet-popup{opacity:1}.leaflet-zoom-animated{-webkit-transform-origin:0 0;transform-origin:0 0}.leaflet-zoom-anim .leaflet-zoom-animated{transition:transform .25s cubic-bezier(0,0,.25,1)}.leaflet-pan-anim .leaflet-tile{transition:none}.leaflet-marker-icon,.leaflet-marker-shadow{display:block}.leaflet-container img.leaflet-tile{padding:0;max-width:none!important}.leaflet-container img{max-width:none!important}.leaflet-map-pane,.leaflet-tile-pane{z-index:200}.leaflet-overlay-pane{z-index:400}.leaflet-shadow-pane{z-index:500}.leaflet-marker-pane{z-index:600}.leaflet-tooltip-pane{z-index:650}.leaflet-popup-pane{z-index:700}.leaflet-map-pane canvas{z-index:1}.leaflet-map-pane svg{z-index:2}.leaflet-vml-shape{width:1px;height:1px}.lvml{behavior:url(#default#VML);display:inline-block;position:absolute}.leaflet-tooltip{position:absolute;padding:8px 12px;background-color:#fff;border:none;border-radius:10px;white-space:nowrap;-webkit-user-select:none;-moz-user-select:none;user-select:none;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.16)}.leaflet-tooltip.leaflet-interactive{cursor:pointer;pointer-events:auto}.leaflet-tooltip-top:before,.leaflet-tooltip-bottom:before,.leaflet-tooltip-left:before,.leaflet-tooltip-right:before{position:absolute;pointer-events:none;border:6px solid transparent;background:transparent;content:""}.leaflet-tooltip-bottom{margin-top:6px}.leaflet-tooltip-top{margin-top:-6px}.leaflet-tooltip-bottom:before,.leaflet-tooltip-top:before{left:50%;margin-left:-6px}.leaflet-tooltip-top:before{bottom:0;margin-bottom:-12px;border-top-color:#fff}.leaflet-tooltip-bottom:before{top:0;margin-top:-12px;margin-left:-6px;border-bottom-color:#fff}.leaflet-tooltip-left:before{right:0;margin-right:-12px;top:50%;margin-top:-6px;border-left-color:#fff}.leaflet-tooltip-right:before{left:0;margin-left:-12px;top:50%;margin-top:-6px;border-right-color:#fff}.leaflet-control-zoom{border:none!important;border-radius:12px!important;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.18)!important}.leaflet-control-zoom a{background:#fff!important;color:#0f172a!important;font-weight:800!important;width:36px!important;height:36px!important;line-height:36px!important;font-size:18px!important;border:none!important;display:block;text-align:center;text-decoration:none}.leaflet-control-zoom a:hover{background:#f1f5f9!important}.leaflet-control-zoom-in{border-radius:12px 12px 0 0!important;border-bottom:1px solid #e2e8f0!important}.leaflet-control-zoom-out{border-radius:0 0 12px 12px!important}.leaflet-control-attribution{display:none!important}
`;

const CAMPUS_FRAME = {
  minX: 609973.5284937217,
  minY: 2315979.1727699493,
  maxX: 610853.1673639194,
  maxY: 2316582.0362756485,
};

const STATION_FOCUS_ZOOM = 19;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function hasMapPosition(station: BinStation) {
  return Number.isFinite(station.mapX) && Number.isFinite(station.mapY);
}

function markerColor(station: BinStation): string {
  const level = getStationCapacityLevel(station);
  if (station.status === 'maintenance' || station.status === 'closed') return '#94a3b8';
  if (level === 'full') return '#e05c45';
  if (level === 'warning') return '#f59e0b';
  return '#22c55e';
}

export function buildCampusMapHtml(stations: BinStation[], selectedStationId?: string): string {
  const stationData = JSON.stringify(
    stations.filter(hasMapPosition).map(s => ({
      id: s.id,
      name: s.name,
      location: s.location,
      building: s.building,
      floor: s.floor,
      binGroup: s.binGroup,
      status: s.status,
      capacity: s.capacity,
      qrCode: s.qrCode,
      color: markerColor(s),
      x: clampPercent(s.mapX as number),
      y: clampPercent(s.mapY as number),
    }))
  );
  const selectedStationJson = JSON.stringify(selectedStationId ?? null);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>Campus GIS</title>
<style>
${LEAFLET_CSS}
*{box-sizing:border-box;margin:0;padding:0}
html,body,#map{width:100%;height:100%;background:#f0f9f4;font-family:-apple-system,sans-serif}
.eg-pin{
  width:38px;height:38px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.28);
  cursor:pointer;transition:transform .15s;
  transform:scale(var(--pin-scale,1));transform-origin:center;
}
.eg-pin:hover,.eg-pin:focus{transform:scale(calc(var(--pin-scale,1) * 1.08))}
.eg-pin.is-selected{border-width:4px;box-shadow:0 0 0 7px rgba(47,143,91,.2),0 3px 16px rgba(0,0,0,.32);transform:scale(calc(var(--pin-scale,1) * 1.18))}
.eg-pin-inner{width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.9)}
.leaflet-tooltip{
  background:white;border:none;
  box-shadow:0 4px 18px rgba(0,0,0,.14);
  border-radius:12px;padding:12px 16px;
  font-size:13px;min-width:180px;pointer-events:none;
}
.leaflet-tooltip strong{display:block;font-size:14px;font-weight:800;color:#0f172a;margin-bottom:4px}
.tt-row{color:#64748b;font-size:12px;font-weight:600;line-height:1.6;display:block}
.cap-bar{height:5px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin:8px 0 3px}
.cap-fill{height:100%;border-radius:3px}
.cap-label{font-size:12px;font-weight:700;color:#475569}
#recenter{
  position:fixed;bottom:14px;left:50%;transform:translateX(-50%);
  background:white;border:none;border-radius:24px;
  padding:8px 20px;font-size:13px;font-weight:800;color:#0f172a;
  box-shadow:0 2px 10px rgba(0,0,0,.18);cursor:pointer;
  display:flex;align-items:center;gap:6px;z-index:1000;
}
</style>
</head>
<body>
<div id="map"></div>
<button id="recenter" onclick="recenter()">⊙ Căn giữa</button>

<script>eval(atob('${PROJ4_JS_B64}'))<\/script>
<script>eval(atob('${LEAFLET_JS_B64}'))<\/script>
<script>
// ── Dữ liệu GeoJSON campus (inline, không cần mạng) ──
var FRAME = ${JSON.stringify(CAMPUS_FRAME)};
var stations = ${stationData};
var selectedStationId = ${selectedStationJson};
var STATION_FOCUS_ZOOM = ${STATION_FOCUS_ZOOM};
var markerById = {};

var frameGeoJSON = ${JSON.stringify(FRAME_GEOJSON)};
var buildingsGeoJSON = ${JSON.stringify(BUILDINGS_GEOJSON)};
var roadsGeoJSON = ${JSON.stringify(ROADS_GEOJSON)};
var contoursGeoJSON = ${JSON.stringify(CONTOURS_GEOJSON)};

// ── Proj4 UTM → WGS84 ──
proj4.defs("EPSG:32648","+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs");
function utmToLatLng(c){
  var r=proj4("EPSG:32648","EPSG:4326",[c[0],c[1]]);
  return L.latLng(r[1],r[0]);
}
function stationLatLng(s){
  var x=FRAME.minX+((FRAME.maxX-FRAME.minX)*s.x)/100;
  var y=FRAME.maxY-((FRAME.maxY-FRAME.minY)*s.y)/100;
  return utmToLatLng([x,y]);
}

// ── Khởi tạo Leaflet (không có tile – offline hoàn toàn) ──
var map=L.map("map",{
  center:[20.942,106.059],zoom:17,
  minZoom:15,maxZoom:23,
  zoomControl:true,
  attributionControl:false,
  // Màu nền thay cho tile layer
  backgroundColor:"#f0f9f4",
});

// Không dùng tile layer – nền trắng xanh campus style
var layerGroup=L.featureGroup().addTo(map);

// ── GeoJSON layers ──
var geoLayers=[
  {data:contoursGeoJSON,  style:{color:"#94a3b8",weight:1,dashArray:"4,4",fillOpacity:0}},
  {data:buildingsGeoJSON, style:{color:"#64748b",fillColor:"#cbd5e1",weight:1.4,fillOpacity:0.76}},
  {data:roadsGeoJSON,     style:{color:"#3b82f6",weight:3,opacity:0.9,fillOpacity:0}},
  {data:frameGeoJSON,     style:{color:"#0f172a",weight:2.5,fillOpacity:0}},
];

geoLayers.forEach(function(item){
  L.geoJSON(item.data,{
    coordsToLatLng:function(c){return utmToLatLng(c);},
    style:function(){return item.style;},
    pointToLayer:function(f,ll){
      return L.circleMarker(ll,{
        radius:4,color:item.style.color,
        fillColor:item.style.fillColor||item.style.color,
        fillOpacity:0.75,weight:1
      });
    },
  }).addTo(layerGroup);
});

// ── Station markers (toạ độ từ API/props) ──
var STATUS_LABELS={open:"Hoạt động",full:"Đầy",maintenance:"Bảo trì",closed:"Tạm đóng"};
function markerHtml(s){
  var selected=s.id===selectedStationId?' is-selected':'';
  return '<div class="eg-pin'+selected+'" style="background:'+s.color+'"><div class="eg-pin-inner"></div></div>';
}
function markerScaleForZoom(zoom){
  var scale=0.58+((zoom-15)*0.085);
  return Math.max(0.58,Math.min(1.24,scale));
}
function updateMarkerScale(){
  var scale=markerScaleForZoom(map.getZoom()).toFixed(2);
  var pins=document.querySelectorAll(".eg-pin");
  for(var i=0;i<pins.length;i++) pins[i].style.setProperty("--pin-scale",scale);
}
function makeStationIcon(s){
  return L.divIcon({
    className:"",
    html:markerHtml(s),
    iconSize:[38,38],iconAnchor:[19,19],
  });
}
function setSelectedStation(stationId){
  selectedStationId=stationId;
  stations.forEach(function(item){
    if(markerById[item.id]) markerById[item.id].setIcon(makeStationIcon(item));
  });
  updateMarkerScale();
}
stations.forEach(function(s){
  var ll=stationLatLng(s);
  var sl=STATUS_LABELS[s.status]||s.status;
  var cc=s.capacity>=90?"#e05c45":s.capacity>=80?"#f59e0b":"#22c55e";
  var tt='<strong>'+s.name+'</strong>'
    +'<span class="tt-row">📍 '+s.location+(s.building?' – Tòa '+s.building:'')+' Tầng '+s.floor+'</span>'
    +'<span class="tt-row">'+s.binGroup+' · '+sl+'</span>'
    +'<div class="cap-bar"><div class="cap-fill" style="width:'+s.capacity+'%;background:'+cc+'"></div></div>'
    +'<span class="cap-label">Sức chứa: '+s.capacity+'%</span>';

  var marker=L.marker(ll,{icon:makeStationIcon(s)})
    .bindTooltip(tt,{direction:"top",offset:[0,-15],opacity:1,sticky:false})
    .on("click",function(){
      focusStation(s.id);
      try{window.ReactNativeWebView.postMessage(JSON.stringify({type:"SELECT_STATION",stationId:s.id}));}catch(e){}
    })
    .addTo(layerGroup);
  markerById[s.id]=marker;
});
map.on("zoom zoomend", updateMarkerScale);
updateMarkerScale();

// ── Fit campus ──
var campusBounds;
var b=layerGroup.getBounds();
if(b.isValid()){campusBounds=b;map.fitBounds(b,{padding:[28,28],maxZoom:18});}

function recenter(){
  if(campusBounds&&campusBounds.isValid())
    map.fitBounds(campusBounds,{padding:[28,28],maxZoom:18,animate:true});
}
function focusStation(stationId){
  var station=stations.find(function(item){return item.id===stationId;});
  if(!station) return;
  setSelectedStation(stationId);
  map.flyTo(stationLatLng(station), Math.max(map.getZoom(), STATION_FOCUS_ZOOM), { animate:true, duration:.45 });
}
window.focusStation=focusStation;
if(selectedStationId){setTimeout(function(){focusStation(selectedStationId);},120);}
</script>
</body>
</html>`;
}
