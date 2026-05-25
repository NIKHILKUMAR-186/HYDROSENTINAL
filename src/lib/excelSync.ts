import {
  DeviceReading,
  DeviceRecord,
  getLocalDeviceHistory,
  readLocalDevices,
} from "./deviceStore";

type WorkbookUser = {
  uid: string;
  email?: string | null;
};

type WorkbookSnapshot = {
  fileName: string;
  generatedAt: string;
  deviceCount: number;
  content: string;
};

type WorkbookOptions = {
  readingsByDevice?: Record<string, DeviceReading[]>;
};

const WORKBOOKS_KEY = "hydrosentinel.userWorkbooks";
const MAX_SHEET_NAME_LENGTH = 31;
const MAX_READINGS_PER_DEVICE = 10;

const xml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const safeFilePart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "user";

const safeSheetName = (value: string, fallback: string, usedNames: Set<string>) => {
  const base =
    value
      .replace(/[[\]:*?/\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_SHEET_NAME_LENGTH) || fallback;

  let candidate = base;
  let suffix = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    const tail = ` ${suffix}`;
    candidate = `${base.slice(0, MAX_SHEET_NAME_LENGTH - tail.length)}${tail}`;
    suffix += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
};

const cell = (value: unknown, type: "String" | "Number" | "DateTime" = "String") => {
  if (type === "DateTime" && value) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return `<Cell><Data ss:Type="DateTime">${xml(date.toISOString())}</Data></Cell>`;
    }
  }

  return `<Cell><Data ss:Type="${type === "DateTime" ? "String" : type}">${xml(value)}</Data></Cell>`;
};

const row = (values: Array<{ value: unknown; type?: "String" | "Number" | "DateTime" }>) =>
  `<Row>${values.map((item) => cell(item.value, item.type)).join("")}</Row>`;

const worksheet = (name: string, rows: string[]) => `
  <Worksheet ss:Name="${xml(name)}">
    <Table>
      ${rows.join("\n")}
    </Table>
  </Worksheet>`;

const readSnapshots = (): Record<string, WorkbookSnapshot> => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(WORKBOOKS_KEY) ?? "{}");
  } catch {
    return {};
  }
};

const saveSnapshot = (userId: string, snapshot: WorkbookSnapshot) => {
  if (typeof window === "undefined") {
    return;
  }

  const snapshots = readSnapshots();
  snapshots[userId] = snapshot;
  window.localStorage.setItem(WORKBOOKS_KEY, JSON.stringify(snapshots));
};

const getDevicesForUser = (userId: string, devices?: DeviceRecord[]) =>
  (devices ?? readLocalDevices()).filter((device) => device.ownerUid === userId);

const getReadingsForDevice = (deviceId: string, options?: WorkbookOptions) =>
  (options?.readingsByDevice?.[deviceId] ?? getLocalDeviceHistory(deviceId)).slice(
    -MAX_READINGS_PER_DEVICE
  );

export const buildUserWorkbookXml = (
  user: WorkbookUser,
  devices?: DeviceRecord[],
  options?: WorkbookOptions
) => {
  const userDevices = getDevicesForUser(user.uid, devices);
  const usedNames = new Set<string>();
  const generatedAt = new Date().toISOString();

  const sheets = [
    worksheet(safeSheetName("User Summary", "Summary", usedNames), [
      row([{ value: "HydroSentinel User Workbook" }]),
      row([{ value: "Generated At" }, { value: generatedAt, type: "DateTime" }]),
      row([{ value: "User Email" }, { value: user.email ?? "" }]),
      row([{ value: "User ID" }, { value: user.uid }]),
      row([{ value: "Total Devices" }, { value: userDevices.length, type: "Number" }]),
      row([{ value: "" }]),
      row([
        { value: "Device Name" },
        { value: "Unique ID" },
        { value: "Location" },
        { value: "Status" },
        { value: "Created At" },
        { value: "Reading Count" },
      ]),
      ...userDevices.map((device) =>
        row([
          { value: device.name },
          { value: device.uniqueId },
          { value: device.location },
          { value: device.status },
          { value: device.createdAt, type: "DateTime" },
          { value: getReadingsForDevice(device.id, options).length, type: "Number" },
        ])
      ),
    ]),
    ...userDevices.map((device, index) => {
      const readings = getReadingsForDevice(device.id, options);
      return worksheet(
        safeSheetName(device.name || device.uniqueId, `Device ${index + 1}`, usedNames),
        [
          row([{ value: "Device Name" }, { value: device.name }]),
          row([{ value: "Unique ID" }, { value: device.uniqueId }]),
          row([{ value: "Location" }, { value: device.location }]),
          row([{ value: "Status" }, { value: device.status }]),
          row([{ value: "" }]),
          row([
            { value: "Timestamp" },
            { value: "pH" },
            { value: "TDS" },
            { value: "Turbidity" },
            { value: "Temperature" },
            { value: "Status" },
          ]),
          ...readings.map((reading) =>
            row([
              { value: reading.timestamp, type: "DateTime" },
              { value: reading.ph, type: "Number" },
              { value: reading.tds, type: "Number" },
              { value: reading.turbidity, type: "Number" },
              { value: reading.temperature, type: "Number" },
              { value: reading.status },
            ])
          ),
        ]
      );
    }),
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
  </Styles>
  ${sheets.join("\n")}
</Workbook>`;
};

export const syncUserWorkbook = (
  user: WorkbookUser,
  devices?: DeviceRecord[],
  options?: WorkbookOptions
) => {
  const content = buildUserWorkbookXml(user, devices, options);
  const deviceCount = getDevicesForUser(user.uid, devices).length;
  const generatedAt = new Date().toISOString();
  const fileName = `hydrosentinel-${safeFilePart(user.email ?? user.uid)}.xls`;

  const snapshot = { fileName, generatedAt, deviceCount, content };
  saveSnapshot(user.uid, snapshot);
  return snapshot;
};

export const downloadUserWorkbook = (
  user: WorkbookUser,
  devices?: DeviceRecord[],
  options?: WorkbookOptions
) => {
  const snapshot = syncUserWorkbook(user, devices, options);
  const blob = new Blob([snapshot.content], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = snapshot.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return snapshot;
};

export const getUserWorkbookSnapshot = (userId: string) => readSnapshots()[userId] ?? null;
