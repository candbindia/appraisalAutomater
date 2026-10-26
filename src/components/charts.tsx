"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 12, fill: "#646767" };
const legendText = (v: string) => <span style={{ color: "#646767" }}>{v}</span>;
const tooltipStyle = { borderRadius: 8, border: "1px solid #e7e3d8", fontSize: 12 };

export function ScoreTrend({ data }: { data: { cycle: string; score: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="#eeebe3" vertical={false} />
        <XAxis dataKey="cycle" tick={axis} tickLine={false} axisLine={{ stroke: "#e7e3d8" }} />
        <YAxis domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} unit="%" />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => (v == null ? "Pending" : `${v}%`)} />
        <Line name="Final score" type="monotone" dataKey="score" stroke="#f2ac3c" strokeWidth={2.5} dot={{ r: 3.5 }} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DeptProgress({
  data,
}: {
  data: { dept: string; approved: number; awaiting: number; inProgress: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(170, data.length * 46 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }} barSize={16}>
        <CartesianGrid stroke="#eeebe3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="dept" tick={axis} tickLine={false} axisLine={false} width={150} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#faf8f3" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
        <Bar name="Approved" dataKey="approved" stackId="a" fill="#2f7d4f" />
        <Bar name="Awaiting approval" dataKey="awaiting" stackId="a" fill="#f2ac3c" />
        <Bar name="In progress" dataKey="inProgress" stackId="a" fill="#e7e3d8" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
