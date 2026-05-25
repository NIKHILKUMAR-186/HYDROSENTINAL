import MapPicker from "./MapPicker.jsx";

type Props = {
  value: { lat: number; lng: number; label: string; zone: string; address: string };
  onChange: (next: { lat: number; lng: number; label: string; zone: string; address: string }) => void;
};

export const DeviceLocationPicker = ({ value, onChange }: Props) => {
  return (
    <MapPicker
      value={value}
      onChange={onChange}
      height="18rem"
      label={value.label || "Pinned location"}
    />
  );
};
