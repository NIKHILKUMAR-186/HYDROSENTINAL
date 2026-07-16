import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPicker } from './MapPicker';
import { getZone } from '@/lib/utils';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDevice: (device: {
    name: string;
    lat: number;
    lng: number;
    zone: string;
    location: string;
    city: string;
    district: string;
    state: string;
    country: string;
    postalCode: string;
    accuracy: number | null;
    permissionStatus: string;
    gpsStatus: string;
  }) => Promise<boolean>;
}

type SelectedLocationState = {
  lat: number | null;
  lng: number | null;
  zone: string;
  address: string;
  city: string;
  district: string;
  state: string;
  country: string;
  postalCode: string;
  accuracy: number | null;
  permissionStatus: string;
  gpsStatus: string;
  isConfirmed: boolean;
};

const EMPTY_LOCATION: SelectedLocationState = {
  lat: null,
  lng: null,
  zone: '',
  address: '',
  city: '',
  district: '',
  state: '',
  country: '',
  postalCode: '',
  accuracy: null,
  permissionStatus: 'unknown',
  gpsStatus: 'idle',
  isConfirmed: false,
};

export const AddDeviceModal: React.FC<AddDeviceModalProps> = ({ isOpen, onClose, onAddDevice }) => {
  const [name, setName] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocationState>(EMPTY_LOCATION);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLocationSelect = React.useCallback(
    (next: {
      lat: number;
      lng: number;
      address: string;
      city: string;
      district: string;
      state: string;
      country: string;
      postalCode: string;
      accuracy: number | null;
      permissionStatus: string;
      gpsStatus: string;
      source: 'sync' | 'current-location' | 'search' | 'map-click' | 'marker-drag';
    }) => {
      setSelectedLocation((prev) => {
        const nextConfirmed =
          prev.isConfirmed ||
          next.source !== 'sync' ||
          next.gpsStatus === 'ready' ||
          next.gpsStatus === 'tracking';

        const updated = {
          lat: next.lat,
          lng: next.lng,
          address: next.address,
          city: next.city,
          district: next.district,
          state: next.state,
          country: next.country,
          postalCode: next.postalCode,
          accuracy: next.accuracy,
          permissionStatus: next.permissionStatus,
          gpsStatus: next.gpsStatus,
          zone: getZone(next.lat, next.lng),
          isConfirmed: nextConfirmed,
        };

        return updated;
      });
    },
    [],
  );

  const resetForm = () => {
    setName('');
    setSelectedLocation(EMPTY_LOCATION);
    setSubmitError('');
    setSubmitting(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!name.trim()) {
      setSubmitError('Please enter a device name.');
      return;
    }

    if (
      !Number.isFinite(selectedLocation.lat) ||
      !Number.isFinite(selectedLocation.lng)
    ) {
      setSubmitError('Please select a location on the map.');
      return;
    }

    if (!selectedLocation.isConfirmed) {
      setSubmitError('Please wait for GPS or interact with map/search before submitting.');
      return;
    }

    setSubmitting(true);

    const success = await onAddDevice({
      name: name.trim(),
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      zone: selectedLocation.zone,
      location:
        selectedLocation.address ||
        `${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)}`,
      city: selectedLocation.city,
      district: selectedLocation.district,
      state: selectedLocation.state,
      country: selectedLocation.country,
      postalCode: selectedLocation.postalCode,
      accuracy: selectedLocation.accuracy,
      permissionStatus: selectedLocation.permissionStatus,
      gpsStatus: selectedLocation.gpsStatus,
    });

    setSubmitting(false);

    if (success) {
      resetForm();
      onClose();
    } else {
      setSubmitError('Unable to add device. Please check your connection and try again.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm md:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative my-6 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-3rem)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Add New Device</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="device-name">Device Name</Label>
                  <Input
                    id="device-name"
                    type="text"
                    placeholder="Enter device name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zone">Zone (Auto-calculated)</Label>
                  <Input
                    id="zone"
                    type="text"
                    value={selectedLocation.zone}
                    readOnly
                    placeholder="Select location on map"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Search manually or pick a spot on the map like Rapido/Swiggy.
                </p>
                <MapPicker
                  onLocationSelect={handleLocationSelect}
                />
                {Number.isFinite(selectedLocation.lat) && Number.isFinite(selectedLocation.lng) && (
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex flex-wrap gap-4">
                      <span className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                      </span>
                      <span>Accuracy: {Number.isFinite(selectedLocation.accuracy) ? `${selectedLocation.accuracy?.toFixed(1)} m` : 'N/A'}</span>
                      <span>Permission: {selectedLocation.permissionStatus}</span>
                      <span>GPS: {selectedLocation.gpsStatus}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs leading-5 dark:border-slate-700 dark:bg-slate-900/50">
                      <p><span className="font-semibold">Detected Address:</span> {selectedLocation.address || 'N/A'}</p>
                      <p><span className="font-semibold">Country:</span> {selectedLocation.country || 'N/A'}</p>
                      <p><span className="font-semibold">State:</span> {selectedLocation.state || 'N/A'}</p>
                      <p><span className="font-semibold">District:</span> {selectedLocation.district || 'N/A'}</p>
                      <p><span className="font-semibold">City:</span> {selectedLocation.city || 'N/A'}</p>
                      <p><span className="font-semibold">Pincode:</span> {selectedLocation.postalCode || 'N/A'}</p>
                    </div>
                  </div>
                )}
              </div>

              {submitError ? (
                <p className="text-sm text-red-500">{submitError}</p>
              ) : null}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !name.trim() ||
                    !Number.isFinite(selectedLocation.lat) ||
                    !Number.isFinite(selectedLocation.lng) ||
                    !selectedLocation.isConfirmed ||
                    submitting
                  }
                  className="bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  {submitting ? 'Adding...' : 'Add Device'}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddDeviceModal;