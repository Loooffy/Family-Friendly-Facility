import { useQuery } from '@apollo/client';
import { PLACE_DETAILS } from '../graphql/queries';

interface PlacePopupProps {
  place: {
    id: string;
    name: string;
    address?: string;
    facilities: Array<{ key: string; name: string }>;
  };
}

export function PlacePopup({ place }: PlacePopupProps) {
  const { data } = useQuery(PLACE_DETAILS, {
    variables: { id: place.id },
  });

  const placeDetails = data?.place || place;

  return (
    <div style={{ maxWidth: '300px' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
        {placeDetails.name}
      </h3>
      {placeDetails.address && (
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
          {placeDetails.address}
        </p>
      )}
      {placeDetails.description && (
        <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
          {placeDetails.description}
        </p>
      )}
      <div style={{ marginTop: '8px' }}>
        <strong style={{ fontSize: '12px' }}>設施:</strong>
        <div style={{ marginTop: '4px' }}>
          {placeDetails.facilities.map((facility: { key: string; name: string }) => (
            <span
              key={facility.key}
              style={{
                display: 'inline-block',
                margin: '2px 4px 2px 0',
                padding: '2px 8px',
                backgroundColor: '#e0f2fe',
                borderRadius: '4px',
                fontSize: '12px',
              }}
            >
              {facility.name}
            </span>
          ))}
        </div>
      </div>
      {placeDetails.city && placeDetails.district && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#666',
          }}
        >
          {placeDetails.city.name} {placeDetails.district.name}
        </div>
      )}
    </div>
  );
}
