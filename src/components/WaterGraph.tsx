import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

type Props = {
  data: WaterPoint[];
  type: "tds" | "ph" | "turbidity";
  title?: string;
  color?: string;
  unit?: string;
};

type WaterPoint = {
  time: number | string;
  tds?: number;
  ph?: number;
  turbidity?: number;
};

type DotRendererProps = {
  cx?: number;
  cy?: number;
  index?: number;
};

export const WaterGraph = ({ data, type, title = "Graph", color = "#3b82f6", unit = "" }: Props) => {
  const visibleData = useMemo(
    () => data.slice(-10).map((point, index) => ({ ...point, time: index + 1 })),
    [data],
  );

  const computeDomain = () => {
    if (type === "ph") return [0, 14];
    if (type === "tds") {
      const maxVal = Math.max(1000, ...(data.map((d) => d.tds ?? 0)), 200);
      return [0, Math.ceil(maxVal + 50)];
    }
    // turbidity
    const maxT = Math.max(25, ...(data.map((d) => d.turbidity ?? 0)));
    return [0, Math.ceil(maxT + 10)];
  };
  const yDomain = useMemo(computeDomain, [data, type]);

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-xl"
    >
      {" "}
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={visibleData}>
          <CartesianGrid stroke="#0b1220" strokeDasharray="3 6" />
          <XAxis dataKey="time" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" domain={yDomain} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "10px",
            }}
          />
          {type === "tds" && (
            <>
              <ReferenceLine y={1000} stroke="#ef4444" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="tds"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                isAnimationActive
              />
            </>
          )}

          {type === "ph" && (
            <>
              <ReferenceLine y={6.5} stroke="#f97316" strokeDasharray="3 3" />
              <ReferenceLine y={8.5} stroke="#f97316" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="ph"
                stroke="#22c55e"
                strokeWidth={2}
                dot={(props: DotRendererProps) => {
                  const { cx = 0, cy = 0, index = 0 } = props;
                  const dotKey = `ph-dot-${index}`;

                  if (index === visibleData.length - 1) {
                    return (
                      <circle key={dotKey} cx={cx} cy={cy} r={6} fill="#22c55e" />
                    );
                  }

                  return (
                    <circle key={dotKey} cx={cx} cy={cy} r={3} fill="#22c55e" />
                  );
                }}

                activeDot={{ r: 6 }}
                isAnimationActive
              />
              <Line
                type="monotone"
                dataKey="turbidity"
                stroke="#eab308"
                strokeWidth={2}
                dot={(props: DotRendererProps) => {
                  const { cx = 0, cy = 0, index = 0 } = props;
                  const dotKey = `turbidity-dot-${index}`;

                  if (index === visibleData.length - 1) {
                    return (
                      <circle key={dotKey} cx={cx} cy={cy} r={6} fill="#eab308" />
                    );
                  }

                  return (
                    <circle key={dotKey} cx={cx} cy={cy} r={3} fill="#eab308" />
                  );
                }}

                activeDot={{ r: 6 }}
                isAnimationActive
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
};
