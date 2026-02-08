import { useState } from 'react';
import { MapComponent } from './components/Map';

function App() {
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>(['nursing_room']);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <MapComponent
        selectedFacilities={selectedFacilities}
        onFacilityChange={setSelectedFacilities}
      />
    </div>
  );
}

export default App;
