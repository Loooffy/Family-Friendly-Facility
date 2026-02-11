import { useRef, useEffect } from 'react';
import { FaBaby, FaChild, FaToilet } from 'react-icons/fa';

interface FilterButtonsProps {
  selectedFacilities: string[];
  onFacilityChange: (facilities: string[]) => void;
}

// 前端固定的 filter 按鈕（對應後端 location_types 的 id）
const FILTER_OPTIONS = [
  { id: 1, name: '親子廁所', icon: FaToilet },
  { id: 2, name: '哺乳室', icon: FaBaby },
  { id: 3, name: '遊戲場', icon: FaChild },
] as const;

export function FilterButtons({
  selectedFacilities,
  onFacilityChange,
}: FilterButtonsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggleFacility = (typeId: string | number) => {
    const idStr = String(typeId);
    if (selectedFacilities.includes(idStr)) {
      onFacilityChange(selectedFacilities.filter((id) => id !== idStr));
    } else {
      onFacilityChange([...selectedFacilities, idStr]);
    }
  };

  // 確保選中的按鈕在視窗內
  useEffect(() => {
    if (scrollContainerRef.current) {
      const selectedButton = scrollContainerRef.current.querySelector(
        `[data-selected="true"]`
      ) as HTMLElement;
      if (selectedButton) {
        selectedButton.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [selectedFacilities]);

  return (
    <div
      style={{
        position: 'absolute',
        top: '68px', // 在搜尋列下方
        left: 0,
        right: 0,
        zIndex: 999,
        padding: '8px 16px',
        backgroundColor: 'transparent',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none', // Firefox
        msOverflowStyle: 'none', // IE/Edge
      }}
      ref={scrollContainerRef}
    >
      <style>
        {`
          div::-webkit-scrollbar {
            display: none; /* Chrome/Safari */
          }
        `}
      </style>
      <div
        style={{
          display: 'inline-flex',
          gap: '8px',
          paddingBottom: '4px',
        }}
      >
        {FILTER_OPTIONS.map((type) => {
          const idStr = String(type.id);
          const isSelected = selectedFacilities.includes(idStr);
          const IconComponent = type.icon;

          return (
            <button
              key={idStr}
              data-selected={isSelected}
              onClick={() => toggleFacility(type.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: isSelected ? '#4285f4' : '#4a4a4a',
                color: isSelected ? '#ffffff' : '#ffffff',
                fontSize: '14px',
                fontWeight: isSelected ? '600' : '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
                transition: 'all 0.2s ease',
                minHeight: '44px',
                minWidth: '44px',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#5a5a5a';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#4a4a4a';
                }
              }}
            >
              <span style={{ fontSize: '16px', display: 'flex', alignItems: 'center' }}>
                <IconComponent />
              </span>
              <span>{type.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
