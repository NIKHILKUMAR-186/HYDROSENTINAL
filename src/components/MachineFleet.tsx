import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, MapPinned, Navigation2, Satellite } from "lucide-react";

type MachineStatus = "ACTIVE" | "MAINTENANCE" | "ALERT";

type MachineNode = {
  id: string;
  name: string;
  site: string;
  address: string;
  lat: number;
  lng: number;
  zone: string;
  status: MachineStatus;
  signal: number;
  lastSync: string;
};

const MACHINES: MachineNode[] = [
  {
    id: "HS-001",
    name: "River Intake Pump",
    site: "Ward 12",
    address: "Nala Road, Ward 12, Smart Hack Zone",
    lat: 28.6139,
    lng: 77.209,
    zone: "North Canal",
    status: "ACTIVE",
    signal: 98,
    lastSync: "2 min ago",
  },
  {
    id: "HS-002",
    name: "Community Tank",
    site: "School Campus",
    address: "Government School Campus, Block B",
    lat: 28.5967,
    lng: 77.245,
    zone: "Central Campus",
    status: "ACTIVE",
    signal: 91,
    lastSync: "5 min ago",
  },
  {
    id: "HS-003",
    name: "Village Borewell",
    site: "Sector 9",
    address: "Sector 9 Pump House, Main Road",
    lat: 28.6353,
    lng: 77.17,
    zone: "West Supply Line",
    status: "MAINTENANCE",
    signal: 76,
    lastSync: "12 min ago",
  },
  {
    id: "HS-004",
    name: "Industrial Filter Node",
    site: "River Front",
    address: "Industrial Area, Plot 18, River Front",
    lat: 28.6578,
    lng: 77.2274,
    zone: "East Safety Belt",
    status: "ALERT",
    signal: 58,
    lastSync: "1 min ago",
  },
  {
    id: "HS-005",
    name: "Rural Supply Tower",
    site: "Village Outpost",
    address: "Outpost Road, Near Bus Stop 3",
    lat: 28.5724,
    lng: 77.2831,
    zone: "South Reach",
    status: "ACTIVE",
    signal: 87,
    lastSync: "8 min ago",
  },
];

const BOUNDS = {
  minLat: 28.55,
  maxLat: 28.68,
  minLng: 77.15,
  maxLng: 77.3,
};

const getStatusMeta = (status: MachineStatus) => {
  switch (status) {
    case "ACTIVE":
      return {
        label: "Active",
        className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        dotClassName: "bg-emerald-400",
        icon: CheckCircle2,
      };
    case "MAINTENANCE":
      return {
        label: "Maintenance",
        className: "border-amber-400/30 bg-amber-400/10 text-amber-300",
        dotClassName: "bg-amber-400",
        icon: Satellite,
      };
    case "ALERT":
      return {
        label: "Alert",
        className: "border-red-400/30 bg-red-400/10 text-red-300",
        dotClassName: "bg-red-400",
        icon: AlertTriangle,
      };
  }
};

const getMachinePosition = (machine: MachineNode) => {
  const latRange = BOUNDS.maxLat - BOUNDS.minLat;
  const lngRange = BOUNDS.maxLng - BOUNDS.minLng;

  const latRatio = (machine.lat - BOUNDS.minLat) / latRange;
  const lngRatio = (machine.lng - BOUNDS.minLng) / lngRange;

  return {
    top: `${Math.max(6, Math.min(94, 100 - latRatio * 100))}%`,
    left: `${Math.max(6, Math.min(94, lngRatio * 100))}%`,
  };
};

export const MachineFleet = () => {
  const activeCount = MACHINES.filter((machine) => machine.status === "ACTIVE").length;
  const maintenanceCount = MACHINES.filter((machine) => machine.status === "MAINTENANCE").length;
  const alertCount = MACHINES.filter((machine) => machine.status === "ALERT").length;

  return (
    <section id="fleet" className="mt-16 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
            <MapPinned className="h-3.5 w-3.5" /> Location Intelligence
          </p>
          <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
            Machine registry with exact site coordinates
          </h2>
          <p className="mt-3 text-sm text-white/65 md:text-base">
            Har machine ka unique ID, live site, GPS coordinates, aur current status yahan central view me dikh raha hai. Ye fleet view future me real GPS, QR, ya Supabase records se directly link kiya ja sakta hai.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center sm:w-full sm:max-w-xl lg:max-w-md">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-2xl font-bold text-white">{MACHINES.length}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Machines</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
            <p className="text-2xl font-bold text-emerald-300">{activeCount}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Active</p>
          </div>
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3">
            <p className="text-2xl font-bold text-red-300">{alertCount}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-red-200/70">Alerts</p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          {MACHINES.map((machine, index) => {
            const meta = getStatusMeta(machine.status);
            const Icon = meta.icon;

            return (
              <motion.article
                key={machine.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: index * 0.06, duration: 0.35 }}
                className="rounded-3xl border border-white/10 bg-black/20 p-5 shadow-lg"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-cyan-200">
                        {machine.id}
                      </span>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${meta.className}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-white">{machine.name}</h3>
                    <p className="mt-1 text-sm text-white/60">{machine.site} · {machine.zone}</p>
                    <p className="mt-2 max-w-xl text-sm text-white/70">{machine.address}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 sm:min-w-56">
                    <div className="flex items-center gap-2 text-white">
                      <Navigation2 className="h-4 w-4 text-cyan-300" /> Exact Location
                    </div>
                    <p className="mt-3 font-mono text-base text-cyan-200">
                      {machine.lat.toFixed(4)}, {machine.lng.toFixed(4)}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/40">Last sync {machine.lastSync}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/5 p-3 text-sm text-white/70">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">Signal Strength</p>
                    <p className="mt-1 text-lg font-semibold text-white">{machine.signal}%</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3 text-sm text-white/70">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">Machine ID</p>
                    <p className="mt-1 text-lg font-semibold text-white">{machine.id}</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3 text-sm text-white/70">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">Location Code</p>
                    <p className="mt-1 text-lg font-semibold text-white">{machine.zone}</p>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/40">Fleet Map</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Exact placement overview</h3>
            </div>
            <Satellite className="h-5 w-5 text-cyan-300" />
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] p-4">
            <div className="relative h-[460px] overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.12),transparent_45%)]" />
              <div className="absolute left-4 top-4 text-xs uppercase tracking-[0.3em] text-white/35">North</div>
              <div className="absolute bottom-4 right-4 text-xs uppercase tracking-[0.3em] text-white/35">East</div>

              {MACHINES.map((machine) => {
                const meta = getStatusMeta(machine.status);
                const Icon = meta.icon;
                const position = getMachinePosition(machine);

                return (
                  <motion.div
                    key={machine.id}
                    initial={{ scale: 0.7, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.35 }}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={position}
                  >
                    <div className={`flex items-center gap-2 rounded-full border px-3 py-2 shadow-xl backdrop-blur ${meta.className}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClassName}`} />
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-semibold">{machine.id}</span>
                    </div>
                  </motion.div>
                );
              })}

              <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/30 p-3 text-xs text-white/55">
                Exact GPS points shown with live fleet zones. Coordinates can be replaced with real device telemetry anytime.
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Maintenance</p>
              <p className="mt-1 text-lg font-semibold text-amber-300">{maintenanceCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Coverage</p>
              <p className="mt-1 text-lg font-semibold text-white">5 zones</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">GPS Ready</p>
              <p className="mt-1 text-lg font-semibold text-cyan-300">Enabled</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
