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
  }) => Promise<boolean>;
}

export const AddDeviceModal: React.FC<AddDeviceModalProps> = ({ isOpen, onClose, onAddDevice }) => {
  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [lat, setLat] = useState(20.5937);
  const [lng, setLng] = useState(78.9629);
  const [selectedLat, setSelectedLat] = useState<number | null>(null); // Force location selection
  const [selectedLng, setSelectedLng] = useState<number | null>(null); // Force location selection
  const [locationText, setLocationText] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLocationSelect = React.useCallback(
    (newLat: number, newLng: number, address: string) => {
      setSelectedLat(newLat);
      setSelectedLng(newLng);
      setLocationText(address);
      setZone(getZone(newLat, newLng));
    },
    [],
  );

  const resetForm = () => {
    setName('');
    setZone('');
    setSelectedLat(null); // Force location selection on next registration
    setSelectedLng(null); // Force location selection on next registration
    setLocationText('');
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

    if (selectedLat === null || selectedLng === null) {
      setSubmitError('Please select a location on the map.');
      return;
    }

    setSubmitting(true);

    const success = await onAddDevice({
      name: name.trim(),
      lat: selectedLat,
      lng: selectedLng,
      zone,
      location: locationText || `${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`,
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-2xl mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
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

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                    value={zone}
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
                <Input
                  type="text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="Type address or location"
                />
                <MapPicker
                  onLocationSelect={(newLat, newLng, address) => {
                    handleLocationSelect(newLat, newLng, address);
                  }}
                  initialLat={lat}
                  initialLng={lng}
                />
                {selectedLat !== null && selectedLng !== null && (
                  <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
                    </span>
                    <span>Address: {locationText || 'Selected location'}</span>
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
                  disabled={!name.trim() || selectedLat === null || selectedLng === null || submitting}
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