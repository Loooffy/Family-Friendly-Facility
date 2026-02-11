import { useQuery } from '@apollo/client';
import { useRef, useState } from 'react';
import { PLACES_IN_BOUNDS } from '../graphql/queries';
import { SearchBar } from './SearchBar';
import { FilterButtons } from './FilterButtons';
import { GoogleMapComponent } from './GoogleMap';
import { BottomSheet } from './BottomSheet';

interface Place {
  id: string;
  name: string;
  address?: string;
  location: { lat: number; lng: number };
  facilities?: Array<{ id: string; equipmentName?: string | null }>;
  type?: {
    id: string;
    name: string;
  };
  district?: {
    id: string;
    name: string;
    city?: {
      id: string;
      name: string;
    };
  };
}

interface MapProps {
  selectedFacilities: string[];
  onFacilityChange: (facilities: string[]) => void;
}

export function MapComponent({ selectedFacilities, onFacilityChange }: MapProps) {
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 25.0330, // Taipei
    lng: 121.5654,
  });
  const [zoom, setZoom] = useState(12);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [bounds, setBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // 轉換 selectedFacilities (typeIds as strings) 為數字
  const typeId = selectedFacilities.length > 0 ? parseInt(selectedFacilities[0]) : undefined;
  const defaultBounds = {
    north: 25.1,
    south: 24.9,
    east: 121.7,
    west: 121.4,
  };
  const b = bounds || defaultBounds;

  const { data, loading, error } = useQuery(PLACES_IN_BOUNDS, {
    variables: {
      typeId: typeId!,
      north: b.north,
      south: b.south,
      east: b.east,
      west: b.west,
    },
    skip: !bounds || selectedFacilities.length === 0,
  });

  // 將 locations 格式轉為 Place 格式（location_type -> type, latitude/longitude -> location, images.imageUrl -> url）
  const places: Place[] = (data?.locations || []).map(
    (loc: {
      id: string;
      name: string;
      address?: string;
      latitude: number;
      longitude: number;
      location_type?: { id: string; name: string };
      facilities?: Array<{ id: string; equipmentName?: string | null }>;
      images?: Array<{ id: string; imageUrl: string }>;
      openingHours?: string;
      link?: string;
      diaper?: boolean;
      note?: string;
      createdAt?: string;
    }) => ({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      location: { lat: Number(loc.latitude), lng: Number(loc.longitude) },
      type: loc.location_type ? { id: loc.location_type.id, name: loc.location_type.name } : undefined,
      facilities: loc.facilities,
      images: loc.images?.map((img) => ({ id: img.id, url: img.imageUrl })) ?? undefined,
      openingHours: loc.openingHours,
      link: loc.link,
      diaper: loc.diaper,
      note: loc.note,
      createdAt: loc.createdAt,
    })
  );

  const handleMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    // 初始化 bounds
    const bounds = map.getBounds();
    if (bounds) {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      setBounds({
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng(),
      });
    }
  };

  const handleBoundsChanged = (newBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => {
    setBounds(newBounds);
  };

  const handleMarkerClick = (place: Place) => {
    setSelectedPlace(place);
  };

  const handleSearch = (query: string) => {
    // TODO: 實作搜尋功能
    console.log('Search query:', query);
  };

  const handleBottomSheetClose = () => {
    setSelectedPlace(null);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'pan-x pan-y',
      }}
    >
      {/* 地圖層：z-index 較低，避免蓋住 UI */}
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 0,
          touchAction: 'none',
        }}
      >
        <GoogleMapComponent
          places={places}
          center={center}
          zoom={zoom}
          onMapLoad={handleMapLoad}
          onBoundsChanged={handleBoundsChanged}
          onMarkerClick={handleMarkerClick}
          selectedPlace={selectedPlace}
        />
      </div>

      {/* UI 覆蓋層：z-index 較高，確保顯示在地圖之上 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <SearchBar onSearch={handleSearch} />
        </div>
        <div style={{ pointerEvents: 'auto' }}>
          <FilterButtons
            selectedFacilities={selectedFacilities}
            onFacilityChange={onFacilityChange}
          />
        </div>

      {loading && (
        <div
          style={{
            position: 'absolute',
            top: '140px',
            right: '16px',
            padding: '8px 16px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            fontSize: '14px',
            color: '#333',
            zIndex: 998,
            pointerEvents: 'none',
          }}
        >
          載入中...
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            top: '140px',
            right: '16px',
            padding: '8px 16px',
            backgroundColor: '#ef4444',
            color: 'white',
            borderRadius: '20px',
            fontSize: '14px',
            zIndex: 998,
            pointerEvents: 'none',
          }}
        >
          錯誤: {error.message}
        </div>
      )}

        <BottomSheet place={selectedPlace} onClose={handleBottomSheetClose} />
      </div>
    </div>
  );
}
