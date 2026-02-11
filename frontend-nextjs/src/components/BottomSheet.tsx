import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useQuery } from '@apollo/client';
import { LOCATION_DETAILS } from '../graphql/queries';

interface Place {
  id: string;
  name: string;
  address?: string;
  location: { lat: number; lng: number };
  facilities?: Array<{ id: string; equipmentName?: string | null }>;
}

interface BottomSheetProps {
  place: Place | null;
  onClose?: () => void;
}

const MIN_HEIGHT = 80; // Minimum height when collapsed
const HEADER_HEIGHT = 60;

// 計算 sheet 高度（在組件內部計算以避免 SSR 問題）
const getSheetHeight = () => {
  if (typeof window !== 'undefined') {
    return window.innerHeight * 0.7; // 70% of viewport height
  }
  return 500; // 預設值
};

export function BottomSheet({ place, onClose }: BottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(getSheetHeight());
  const y = useMotionValue(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // 更新 sheet height 當視窗大小改變時
  useEffect(() => {
    const updateHeight = () => {
      setSheetHeight(getSheetHeight());
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const { data } = useQuery(LOCATION_DETAILS, {
    variables: { id: place?.id },
    skip: !place?.id,
  });

  const locationData = data?.locations_by_pk;
  const placeDetails = locationData || place;

  // 計算當前高度
  const height = useTransform(y, (value) => {
    const newHeight = sheetHeight - value;
    return Math.max(MIN_HEIGHT, Math.min(sheetHeight, newHeight));
  });

  // 當有地點時，預設展開到部分高度
  useEffect(() => {
    if (place) {
      setIsExpanded(true);
      y.set(0);
    } else {
      setIsExpanded(false);
      y.set(sheetHeight - MIN_HEIGHT);
    }
  }, [place, y, sheetHeight]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    const velocity = info.velocity.y;

    if (velocity > 500 || info.offset.y > threshold) {
      // 向下拖曳，收起
      setIsExpanded(false);
      y.set(sheetHeight - MIN_HEIGHT);
      if (onClose) {
        setTimeout(() => onClose(), 300);
      }
    } else if (velocity < -500 || info.offset.y < -threshold) {
      // 向上拖曳，展開
      setIsExpanded(true);
      y.set(0);
    } else {
      // 回到當前狀態
      y.set(isExpanded ? 0 : sheetHeight - MIN_HEIGHT);
    }
  };

  const handleHeaderClick = () => {
    if (isExpanded) {
      setIsExpanded(false);
      y.set(sheetHeight - MIN_HEIGHT);
    } else {
      setIsExpanded(true);
      y.set(0);
    }
  };

  if (!place) {
    return null;
  }

  return (
    <motion.div
      ref={sheetRef}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: height,
        backgroundColor: '#ffffff',
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      initial={{ y: sheetHeight - MIN_HEIGHT }}
      animate={{ y: isExpanded ? 0 : sheetHeight - MIN_HEIGHT }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: sheetHeight - MIN_HEIGHT }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
    >
      {/* 拖曳條 */}
      <div
        onClick={handleHeaderClick}
        style={{
          height: `${HEADER_HEIGHT}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
          minHeight: '44px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '4px',
            backgroundColor: '#ccc',
            borderRadius: '2px',
            touchAction: 'none',
          }}
        />
      </div>

      {/* 內容區域 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 20px 20px',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {placeDetails && (
          <>
            <h2
              style={{
                margin: '0 0 12px 0',
                fontSize: '20px',
                fontWeight: '600',
                color: '#333',
              }}
            >
              {placeDetails.name}
            </h2>

            {placeDetails.address && (
              <p
                style={{
                  margin: '0 0 16px 0',
                  fontSize: '14px',
                  color: '#666',
                  lineHeight: '1.5',
                }}
              >
                {placeDetails.address}
              </p>
            )}

            {placeDetails.type && (
              <div style={{ marginBottom: '16px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    backgroundColor: '#e3f2fd',
                    color: '#1976d2',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500',
                  }}
                >
                  {placeDetails.type.name}
                </span>
              </div>
            )}

            {placeDetails.facilities && placeDetails.facilities.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#333',
                  }}
                >
                  設施
                </h3>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  {placeDetails.facilities.map(
                    (facility: { id: string; equipmentName?: string | null }) => (
                      <span
                        key={facility.id}
                        style={{
                          display: 'inline-block',
                          padding: '6px 12px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '16px',
                          fontSize: '13px',
                          color: '#333',
                        }}
                      >
                        {facility.equipmentName || '設施'}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            {placeDetails.note && (
              <div style={{ marginBottom: '16px' }}>
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#333',
                  }}
                >
                  備註
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    color: '#666',
                    lineHeight: '1.6',
                  }}
                >
                  {placeDetails.note}
                </p>
              </div>
            )}

            {placeDetails.openingHours && (
              <div style={{ marginBottom: '16px' }}>
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#333',
                  }}
                >
                  營業時間
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    color: '#666',
                  }}
                >
                  {placeDetails.openingHours}
                </p>
              </div>
            )}

            {placeDetails.district && (
              <div style={{ marginBottom: '16px' }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    color: '#999',
                  }}
                >
                  {placeDetails.district.city?.name} {placeDetails.district.name}
                </p>
              </div>
            )}

            {placeDetails.link && (
              <a
                href={placeDetails.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '16px',
                  padding: '10px 20px',
                  backgroundColor: '#4285f4',
                  color: '#ffffff',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                查看詳情
              </a>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
