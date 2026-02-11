import { useState } from 'react';
import { MapComponent } from './components/Map';

function App() {
  // 預設選擇第一個設施類型（如果有的話）
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);

  return (
    <div style={{ width: '100%', height: '100vh', margin: 0, padding: 0 }}>
      <MapComponent
        selectedFacilities={selectedFacilities}
        onFacilityChange={setSelectedFacilities}
      />
    </div>
  );
}

export default App;
