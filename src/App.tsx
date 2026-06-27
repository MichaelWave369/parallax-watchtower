import { WatchtowerDashboard } from "../components/WatchtowerDashboard";

const defaultZone = {
  name: "Corning Field Lens",
  lat: 39.9277,
  lon: -122.1792,
  radiusKm: 250
};

export default function App() {
  return <WatchtowerDashboard defaultZone={defaultZone} />;
}
