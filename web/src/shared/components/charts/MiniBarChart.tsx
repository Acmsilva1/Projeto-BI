import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReactElement } from "react";

const sampleData = [
  { name: "Seg", value: 14 },
  { name: "Ter", value: 18 },
  { name: "Qua", value: 12 },
  { name: "Qui", value: 20 },
  { name: "Sex", value: 16 }
];

export function MiniBarChart(): ReactElement {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={sampleData} margin={{ top: 16, right: 8, left: -20, bottom: 6 }}>
          <XAxis dataKey="name" stroke="var(--table-header-muted)" />
          <YAxis stroke="var(--table-header-muted)" />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, var(--primary) 25%, transparent)" }}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid var(--table-grid)",
              background: "var(--app-surface)",
              color: "var(--app-fg)"
            }}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="var(--primary)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
