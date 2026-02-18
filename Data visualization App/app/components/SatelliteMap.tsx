import React, { useEffect, useRef, useCallback, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { APP_CONFIG } from '../utils/constants';

interface SatelliteData {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    type: string;
    altitude?: number;
}

interface Props {
    satellites: SatelliteData[];
    selectedId?: string | null;
}

// Color per satellite type – matches TYPE_CONFIG in SatelliteTrackerScreen
const TYPE_COLORS: Record<string, string> = {
    NAVIGATION: '#0066FF',
    COMMUNICATION: '#00A3FF',
    EARTH_OBSERVATION: '#3B82F6',
    RESEARCH: '#3399FF',
    METEOROLOGICAL: '#00A3FF',
};

const mapHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<style>
body{margin:0;padding:0;background:#0F172A;touch-action:none}
#map{width:100%;height:100vh;touch-action:none}
.leaflet-container{background:#0F172A}
.leaflet-control-attribution{display:none!important}
.leaflet-control-zoom a{
  background:rgba(2,6,23,0.85)!important;
  color:#e2e8f0!important;
  border-color:rgba(255,255,255,0.15)!important;
  width:34px!important;height:34px!important;
  line-height:34px!important;font-size:18px!important;
  border-radius:8px!important;
}
.leaflet-control-zoom{border:none!important;border-radius:8px!important;overflow:hidden}
.sat-label{
  display:flex;flex-direction:column;align-items:center;gap:2px;
  pointer-events:auto;
}
.sat-dot{
  width:14px;height:14px;border-radius:50%;
  border:2px solid rgba(255,255,255,0.7);
  animation:satPulse 2s ease-in-out infinite;
  flex-shrink:0;
}
.sat-dot-sel{
  width:18px;height:18px;
  border:2px solid #fff;
}
.sat-name{
  color:#e2e8f0;font:700 9px/1 system-ui,sans-serif;
  background:rgba(2,6,23,0.8);
  padding:2px 5px;border-radius:4px;
  white-space:nowrap;margin-top:2px;
  border:1px solid rgba(255,255,255,0.08);
  text-shadow:0 1px 2px rgba(0,0,0,0.8);
  max-width:90px;overflow:hidden;text-overflow:ellipsis;
}
.sat-name-sel{
  color:#22d3ee;font-size:10px;
  background:rgba(2,6,23,0.92);
  border-color:rgba(34,211,238,0.3);
}
@keyframes satPulse{
  0%,100%{box-shadow:0 0 4px currentColor}
  50%{box-shadow:0 0 12px currentColor,0 0 20px currentColor}
}
.sat-tip{
  background:rgba(2,6,23,0.92);border:1px solid rgba(255,255,255,0.12);
  border-radius:8px;padding:8px 12px;color:#e2e8f0;
  font:600 11px/1.5 system-ui,sans-serif;white-space:nowrap;
}
.sat-tip b{color:#22d3ee;font-size:12px}
.sat-tip small{color:#94a3b8;font-size:10px}
.leaflet-popup-content-wrapper{background:transparent;box-shadow:none;padding:0;margin:0}
.leaflet-popup-content{margin:0}
.leaflet-popup-tip{border-top-color:rgba(2,6,23,0.92)}
.count-badge{
  position:fixed;top:8px;right:8px;z-index:9999;
  background:rgba(2,6,23,0.85);border:1px solid rgba(255,255,255,0.12);
  border-radius:8px;padding:4px 10px;color:#94a3b8;
  font:700 10px/1 system-ui;letter-spacing:0.5px;
}
.count-badge span{color:#22d3ee}
</style>
</head>
<body>
<div id="map"></div>
<div class="count-badge" id="badge">Satellites: <span>0</span></div>
<script>
var map=L.map('map',{
  zoomControl:true,
  attributionControl:false,
  worldCopyJump:true,
  minZoom:1,
  maxZoom:12,
  zoomSnap:0.5,
  zoomDelta:0.5,
  tap:true,
  dragging:true,
  touchZoom:true,
  scrollWheelZoom:true,
  doubleClickZoom:true,
  bounceAtZoomLimits:true
}).setView([20,78],3);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:12,subdomains:'abcd'}).addTo(map);
var markers={};

window.updateMarkers=function(json){
  try{
    var sats=JSON.parse(json);
    // Remove stale markers
    var ids={};
    sats.forEach(function(s){ids[s.id]=true});
    Object.keys(markers).forEach(function(id){
      if(!ids[id]){map.removeLayer(markers[id]);delete markers[id]}
    });
    // Upsert markers
    sats.forEach(function(sat){
      if(!sat.latitude||!sat.longitude)return;
      var c=sat.color||'#00A3FF';
      var sel=!!sat.selected;
      var dotSz=sel?18:14;
      var shortName=sat.name.length>12?sat.name.substring(0,11)+'…':sat.name;
      var icon=L.divIcon({
        className:'',
        html:'<div class="sat-label">'
          +'<div class="sat-dot'+(sel?' sat-dot-sel':'')+'" style="background:'+c+';color:'+c+'"></div>'
          +'<div class="sat-name'+(sel?' sat-name-sel':'')+'">'+shortName+'</div>'
          +'</div>',
        iconSize:[80,36],iconAnchor:[40,8]
      });
      var pop='<div class="sat-tip"><b>'+sat.name+'</b><br/>'+
        Math.abs(sat.latitude).toFixed(2)+'\\u00B0'+(sat.latitude>=0?'N':'S')+', '+
        Math.abs(sat.longitude).toFixed(2)+'\\u00B0'+(sat.longitude>=0?'E':'W')+
        (sat.altitude?'<br/><small>Alt: '+Math.round(sat.altitude)+' km</small>':'')+
        '</div>';
      if(markers[sat.id]){
        markers[sat.id].setLatLng([sat.latitude,sat.longitude]);
        markers[sat.id].setIcon(icon);
        markers[sat.id].getPopup().setContent(pop);
      }else{
        markers[sat.id]=L.marker([sat.latitude,sat.longitude],{icon:icon})
          .addTo(map).bindPopup(pop);
      }
      if(sel){map.setView([sat.latitude,sat.longitude],4);markers[sat.id].openPopup()}
    });
    document.querySelector('#badge span').textContent=String(sats.length);
  }catch(e){console.error('updateMarkers',e)}
};

window.ReactNativeWebView.postMessage('MAP_READY');
</script>
</body>
</html>
`;

const SatelliteMap: React.FC<Props> = ({ satellites, selectedId }) => {
    const webViewRef = useRef<WebView>(null);
    const [mapReady, setMapReady] = useState(false);

    // Build the payload for JS injection
    const buildPayload = useCallback(() => {
        return satellites.map(s => ({
            ...s,
            color: TYPE_COLORS[s.type] || '#00A3FF',
            selected: s.id === selectedId,
        }));
    }, [satellites, selectedId]);

    // Push markers into the WebView
    const pushMarkers = useCallback(() => {
        if (!webViewRef.current || !mapReady) return;
        const json = JSON.stringify(buildPayload());
        // Double JSON.stringify to produce a safe JS string literal
        webViewRef.current.injectJavaScript(
            `window.updateMarkers(${JSON.stringify(json)}); true;`
        );
    }, [buildPayload, mapReady]);

    // Re-push whenever data changes AND map is ready
    useEffect(() => {
        pushMarkers();
    }, [pushMarkers]);

    // WebView → RN message handler
    const onMessage = useCallback((e: WebViewMessageEvent) => {
        if (e.nativeEvent.data === 'MAP_READY') {
            setMapReady(true);
        }
    }, []);

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: mapHtml }}
                style={styles.webview}
                scrollEnabled={false}
                nestedScrollEnabled={true}
                overScrollMode="never"
                javaScriptEnabled
                domStorageEnabled
                onMessage={onMessage}
            />
            {!mapReady && (
                <View style={styles.loadingOverlay}>
                    <Text style={styles.loadingText}>Loading map...</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 400,
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: APP_CONFIG.colors.border.default,
        backgroundColor: APP_CONFIG.colors.background.card,
    },
    webview: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(15,23,42,0.8)',
    },
    loadingText: {
        color: APP_CONFIG.colors.text.secondary,
        fontSize: 12,
    },
});

export default SatelliteMap;
