import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { ADD_PLACE, FACILITY_TYPES } from '../graphql/queries';

interface AddPlaceFormProps {
  lat: number;
  lng: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPlaceForm({ lat, lng, onClose, onSuccess }: AddPlaceFormProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);

  const { data: facilityData } = useQuery(FACILITY_TYPES);
  const [addPlace, { loading }] = useMutation(ADD_PLACE);

  const facilities = facilityData?.facilityTypes || [];

  const toggleFacility = (key: string) => {
    if (selectedFacilities.includes(key)) {
      setSelectedFacilities(selectedFacilities.filter((k) => k !== key));
    } else {
      setSelectedFacilities([...selectedFacilities, key]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || selectedFacilities.length === 0) {
      alert('請填寫名稱並至少選擇一項設施');
      return;
    }

    try {
      await addPlace({
        variables: {
          input: {
            name,
            address: address || null,
            description: description || null,
            lat,
            lng,
            facilityKeys: selectedFacilities,
          },
        },
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding place:', error);
      alert('新增地點失敗，請稍後再試');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>新增地點</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              名稱 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              地址
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
              設施類型 * (至少選擇一項)
            </label>
            <div style={{ maxHeight: '200px', overflow: 'auto' }}>
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
          </div>

          <div style={{ marginBottom: '16px', fontSize: '14px', color: '#666' }}>
            位置: {lat.toFixed(6)}, {lng.toFixed(6)}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#3b82f6',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '新增中...' : '新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
