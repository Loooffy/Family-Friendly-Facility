import { useQuery } from '@apollo/client';
import { useState } from 'react';
import { FACILITY_TYPES } from '../graphql/queries';

interface FacilityFilterProps {
  selectedFacilities: string[];
  onFacilityChange: (facilities: string[]) => void;
}

export function FacilityFilter({
  selectedFacilities,
  onFacilityChange,
}: FacilityFilterProps) {
  const { data } = useQuery(FACILITY_TYPES);
  const [isOpen, setIsOpen] = useState(false);

  const facilities = data?.facilityTypes || [];

  const toggleFacility = (key: string) => {
    if (selectedFacilities.includes(key)) {
      onFacilityChange(selectedFacilities.filter((k) => k !== key));
    } else {
      onFacilityChange([...selectedFacilities, key]);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        minWidth: '200px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          設施類型
        </h3>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
          }}
        >
          {isOpen ? '−' : '+'}
        </button>
      </div>

      {isOpen && (
        <div>
          {facilities.map((facility: { key: string; name: string }) => (
            <label
              key={facility.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={selectedFacilities.includes(facility.key)}
                onChange={() => toggleFacility(facility.key)}
                style={{ marginRight: '8px' }}
              />
              <span>{facility.name}</span>
            </label>
          ))}
        </div>
      )}

      {selectedFacilities.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
          已選擇: {selectedFacilities.length} 項
        </div>
      )}
    </div>
  );
}
