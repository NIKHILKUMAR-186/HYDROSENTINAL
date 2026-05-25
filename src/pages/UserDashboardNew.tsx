import React, { useState } from 'react';
import { toIsoTimestamp } from '@/lib/deviceStore';
import { useAuth } from '../contexts/AuthContext';
import { useDevices } from '../hooks/useDevices';
import { AddDeviceModal } from '../components/AddDeviceModal';
import { SyncMonitor } from '../components/SyncMonitor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

const UserDashboard = () => {
  const { user, logout } = useAuth();
  const { devices, addDevice, removeDevice } = useDevices();
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);

  const handleAddDevice = async (deviceData: { name: string; lat: number; lng: number; zone: string; location: string }) => {
    // location is currently unused by the simple local hook; keep API compatible
    addDevice({ name: deviceData.name, lat: deviceData.lat, lng: deviceData.lng, zone: deviceData.zone });
    return true;
  };

  const handleRemoveDevice = (id: string) => {
    removeDevice(id);
  };

  const handleAddReading = () => {
    if (devices.length === 0) {
      alert('Please add a device first');
      return;
    }
    // TODO: Implement add reading functionality
    alert('Add reading functionality not implemented yet');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <SyncMonitor userId={user?.uid} />

      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                HydroSentinel Dashboard
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Welcome back, {user?.email}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setShowAddDeviceModal(true)}
                className="bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Device
              </Button>
              <Button
                onClick={handleAddReading}
                variant="outline"
                className="border-cyan-500 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950"
              >
                <Activity className="w-4 h-4 mr-2" />
                Add Reading
              </Button>
              <Button onClick={logout} variant="outline">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {devices.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-cyan-100 dark:bg-cyan-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <MapPin className="w-12 h-12 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                No devices added yet
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Start monitoring water quality by adding your first device with location tracking.
              </p>
              <Button
                onClick={() => setShowAddDeviceModal(true)}
                className="bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Device
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{devices.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Active monitoring devices
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Zones Covered</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Set(devices.map(d => d.zone)).size}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Different monitoring zones
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last Added</CardTitle>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {devices.length > 0 ? (() => {
                      const iso = toIsoTimestamp(devices[devices.length - 1].createdAt);
                      return iso ? new Date(iso).toLocaleDateString() : String(devices[devices.length - 1].createdAt);
                    })() : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Most recent device addition
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Devices List */}
            <Card>
              <CardHeader>
                <CardTitle>Your Devices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {devices.map((device) => (
                    <motion.div
                      key={device.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900 rounded-full flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {device.name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Badge variant="secondary">{device.zone}</Badge>
                            <span>
                              {device.lat.toFixed(4)}, {device.lng.toFixed(4)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleRemoveDevice(device.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Add Device Modal */}
      <AddDeviceModal
        isOpen={showAddDeviceModal}
        onClose={() => setShowAddDeviceModal(false)}
        onAddDevice={handleAddDevice}
      />
    </div>
  );
};

export default UserDashboard;
