import React from "react";

export interface StatsCardProps {
  title: string;
  value: number | string;
  helperText?: string;
  icon?: React.ReactNode;
  accentColor?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  helperText,
  icon,
  accentColor = "#3B82F6",
}) => {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-200/70">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#555]">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-[#111]">{value}</p>
          {helperText && (
            <p className="mt-1 text-sm text-[#777]">{helperText}</p>
          )}
        </div>
        {icon && (
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
            style={{ background: accentColor }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
