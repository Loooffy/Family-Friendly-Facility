import { useQuery } from '@apollo/client';
import { LOCATION_DETAILS } from '../graphql/queries';

interface PlacePopupProps {
  place: {
    id: string;
    name: string;
    address?: string;
    facilities?: Array<{ id: string; equipmentName?: string | null }>;
  };
}

export function PlacePopup({ place }: PlacePopupProps) {
  const { data } = useQuery(LOCATION_DETAILS, {
    variables: { id: place.id },
    skip: !place.id,
  });

  const locationData = data?.locations_by_pk;
  const placeDetails = locationData || place;

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
      {placeDetails.note && (
        <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
          {placeDetails.note}
        </p>
      )}
      {placeDetails.facilities && placeDetails.facilities.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <strong style={{ fontSize: '12px' }}>設施:</strong>
          <div style={{ marginTop: '4px' }}>
            {placeDetails.facilities.map((facility: { id: string; equipmentName?: string | null }) => (
              <span
                key={facility.id}
                style={{
                  display: 'inline-block',
                  margin: '2px 4px 2px 0',
                  padding: '2px 8px',
                  backgroundColor: '#e0f2fe',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              >
                {facility.equipmentName || '設施'}
              </span>
            ))}
          </div>
        </div>
      )}
      {placeDetails.district && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#666',
          }}
        >
          {placeDetails.district.city?.name} {placeDetails.district.name}
        </div>
      )}
    </div>
  );
}
