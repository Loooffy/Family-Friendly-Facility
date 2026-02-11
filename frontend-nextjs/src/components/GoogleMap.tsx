import { useCallback, useRef } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface Place {
  id: string;
  name: string;
  address?: string;
  location: { lat: number; lng: number };
  facilities?: Array<{ id: string; equipmentName?: string | null }>;
}

interface GoogleMapComponentProps {
  places: Place[];
  center?: { lat: number; lng: number };
  zoom?: number;
  onMapLoad?: (map: google.maps.Map) => void;
  onBoundsChanged?: (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => void;
  onMarkerClick?: (place: Place) => void;
  selectedPlace?: Place | null;
}

const defaultCenter = { lat: 25.0330, lng: 121.5654 }; // Taipei
const defaultZoom = 12;

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'on' }],
    },
  ],
};

// 將 libraries 定義為常數，避免每次渲染都建立新陣列
const libraries: ('places' | 'drawing' | 'geometry' | 'localContext' | 'visualization')[] = ['places'];

const DEBOUNCE_MS = 300;

export function GoogleMapComponent({
  places,
  center = defaultCenter,
  zoom = defaultZoom,
  onMapLoad,
  onBoundsChanged,
  onMarkerClick,
  selectedPlace,
}: GoogleMapComponentProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: libraries,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBoundsChangedRef = useRef(onBoundsChanged);
  onBoundsChangedRef.current = onBoundsChanged;

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      map.setCenter(center);
      map.setZoom(zoom);
      if (onMapLoad) {
        onMapLoad(map);
      }
    },
    [onMapLoad, center, zoom]
  );

  const onUnmount = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    mapRef.current = null;
  }, []);

  // 僅在拖曳結束或縮放結束時通知父元件，並 debounce 避免頻繁 API 呼叫
  // 不使用 onBoundsChanged，因其在拖曳/縮放期間會高頻觸發造成卡頓與地圖重置
  const handleBoundsChanged = useCallback(() => {
    if (!mapRef.current || !onBoundsChangedRef.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const bounds = mapRef.current?.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        onBoundsChangedRef.current?.({
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng(),
        });
      }
    }, DEBOUNCE_MS);
  }, []);

  if (loadError) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          color: '#666',
        }}
      >
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>無法載入 Google Maps</p>
          <p style={{ fontSize: '12px', marginTop: '8px' }}>
            {loadError.message || '請檢查 API Key 設定'}
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          color: '#666',
        }}
      >
        <div>載入地圖中...</div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={zoom}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onDragEnd={handleBoundsChanged}
      onZoomChanged={handleBoundsChanged}
      options={defaultOptions}
    >
      {places.map((place) => {
        const isSelected = selectedPlace?.id === place.id;
        return (
          <Marker
            key={place.id}
            position={place.location}
            onClick={() => onMarkerClick && onMarkerClick(place)}
            icon={
              isSelected
                ? {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#4285f4',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  }
                : {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 6,
                    fillColor: '#34a853',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  }
            }
          />
        );
      })}
    </GoogleMap>
  );
}
