import { useQuery } from '@apollo/client';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useState } from 'react';
import Map, { Marker, Popup, ViewState } from 'react-map-gl';
import Supercluster from 'supercluster';
import { PLACES_IN_BOUNDS } from '../graphql/queries';
import { FacilityFilter } from './FacilityFilter';
import { PlacePopup } from './PlacePopup';

interface Place {
  id: string;
  name: string;
  address?: string;
  location: { lat: number; lng: number };
  facilities: Array<{ key: string; name: string }>;
}

interface MapProps {
  selectedFacilities: string[];
  onFacilityChange: (facilities: string[]) => void;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN';

export function MapComponent({ selectedFacilities, onFacilityChange }: MapProps) {
  const [viewState, setViewState] = useState<ViewState>({
    longitude: 121.5654, // Taipei
    latitude: 25.0330,
    zoom: 12,
  });
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [bounds, setBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

  const clustererRef = useRef<Supercluster | null>(null);

  // Calculate bounds from viewState
  useEffect(() => {
    const { longitude, latitude, zoom } = viewState;
    const lngPerPixel = (360 / 256) * Math.pow(2, -zoom);
    const latPerPixel = (180 / 256) * Math.pow(2, -zoom);
    const width = window.innerWidth;
    const height = window.innerHeight;

    setBounds({
      north: latitude + (height / 2) * latPerPixel,
      south: latitude - (height / 2) * latPerPixel,
      east: longitude + (width / 2) * lngPerPixel,
      west: longitude - (width / 2) * lngPerPixel,
    });
  }, [viewState]);

  // Query places when bounds or selected facilities change
  const { data, loading, error } = useQuery(PLACES_IN_BOUNDS, {
    variables: {
      facilityKey: selectedFacilities[0] || 'nursing_room',
      bounds: bounds || {
        north: 25.1,
        south: 24.9,
        east: 121.7,
        west: 121.4,
      },
    },
    skip: !bounds || selectedFacilities.length === 0,
  });

  // Initialize clusterer
  useEffect(() => {
    if (data?.placesInBounds) {
      const points = data.placesInBounds.map((place: Place) => ({
        type: 'Feature' as const,
        properties: { place },
        geometry: {
          type: 'Point' as const,
          coordinates: [place.location.lng, place.location.lat],
        },
      }));

      const clusterer = new Supercluster({
        radius: 50,
        maxZoom: 14,
      });

      clusterer.load(points);
      clustererRef.current = clusterer;
    }
  }, [data]);

  const handleMapMove = (evt: { viewState: ViewState }) => {
    setViewState(evt.viewState);
  };

  const places = data?.placesInBounds || [];

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <FacilityFilter
        selectedFacilities={selectedFacilities}
        onFacilityChange={onFacilityChange}
      />
      <Map
        {...viewState}
        onMove={handleMapMove}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        {places.map((place: Place) => (
          <Marker
            key={place.id}
            longitude={place.location.lng}
            latitude={place.location.lat}
            anchor="bottom"
            onClick={() => setSelectedPlace(place)}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                border: '2px solid white',
                cursor: 'pointer',
              }}
            />
          </Marker>
        ))}

        {selectedPlace && (
          <Popup
            longitude={selectedPlace.location.lng}
            latitude={selectedPlace.location.lat}
            anchor="bottom"
            onClose={() => setSelectedPlace(null)}
            closeOnClick={false}
          >
            <PlacePopup place={selectedPlace} />
          </Popup>
        )}
      </Map>
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            padding: '8px 16px',
            backgroundColor: 'white',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          載入中...
        </div>
      )}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            padding: '8px 16px',
            backgroundColor: '#ef4444',
            color: 'white',
            borderRadius: '4px',
          }}
        >
          錯誤: {error.message}
        </div>
      )}
    </div>
  );
}
