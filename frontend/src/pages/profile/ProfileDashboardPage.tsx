import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SidebarNavigation } from "../../components/profile/SidebarNavigation";
import { StatsCard } from "../../components/profile/StatsCard";

const stats = [
  {
    title: "Total Trips",
    value: 12,
    helperText: "Trips planned this year",
  },
  {
    title: "Trips Saved",
    value: 5,
    helperText: "Ideas waiting on your list",
  },
  {
    title: "Trips Completed",
    value: 9,
    helperText: "Journeys already taken",
  },
];

const chartData = [
  { label: "Week", value: 3 },
  { label: "Month", value: 14 },
  { label: "Year", value: 6 },
];

export const ProfileDashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      <div className="flex flex-col md:flex-row">
        <SidebarNavigation active="dashboard" />
        <main className="flex-1 bg-white px-6 py-10 md:px-12 lg:px-16">
          <div>
            <h1 className="text-3xl font-semibold text-[#111]">Dashboard</h1>
            <p className="mt-2 text-base text-[#555]">
              Get a snapshot of how your travel plans are tracking.
            </p>

            <section className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {stats.map((metric) => (
                <StatsCard key={metric.title} {...metric} />
              ))}
            </section>

            <section className="mt-10 rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/70">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-[#111]">
                    Trips Over Time
                  </h2>
                  <p className="text-sm text-[#555]">
                    Track weekly, monthly, and yearly travel momentum.
                  </p>
                </div>
                <span className="rounded-full bg-[#EEF2FF] px-4 py-1 text-sm font-medium text-[#3B82F6]">
                  Updated weekly
                </span>
              </div>
              <div className="mt-6 h-[320px] w-full">
                <ResponsiveContainer>
                  <BarChart
                    data={chartData}
                    barSize={48}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="label"
                      stroke="#6B7280"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#6B7280"
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip cursor={{ fill: "rgba(59,130,246,0.08)" }} />
                    <Bar
                      dataKey="value"
                      fill="#3B82F6"
                      radius={[12, 12, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProfileDashboardPage;
