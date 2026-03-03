import { useState } from 'react';
import { MapComponent } from './components/Map';

function App() {
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
