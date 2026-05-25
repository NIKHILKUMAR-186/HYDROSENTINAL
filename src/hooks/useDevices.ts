import { useState, useEffect } from 'react';

export interface Device {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zone: string;
  createdAt: string;
}

export const useDevices = () => {
  const [devices, setDevices] = useState<Device[]>([]);

  const addDevice = (device: Omit<Device, 'id' | 'createdAt'>) => {
    const newDevice: Device = {
      ...device,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setDevices(prev => [...prev, newDevice]);
  };

  const removeDevice = (id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
  };

  return {
    devices,
    addDevice,
    removeDevice,
  };
};