/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Dot,
} from 'recharts';
import { TrendingDown, Clock, Award, BarChart3 } from 'lucide-react';

interface SessionAhtData {
  session: string;
  ahtSeconds: number;
  formattedAht: string;
  callsCount: number;
  targetSeconds: number;
}

const DEFAULT_AHT_SESSIONS: SessionAhtData[] = [
  { session: 'Sess #1', ahtSeconds: 168, formattedAht: '2m 48s', callsCount: 6, targetSeconds: 180 },
  { session: 'Sess #2', ahtSeconds: 154, formattedAht: '2m 34s', callsCount: 8, targetSeconds: 180 },
  { session: 'Sess #3', ahtSeconds: 142, formattedAht: '2m 22s', callsCount: 7, targetSeconds: 180 },
  { session: 'Sess #4', ahtSeconds: 135, formattedAht: '2m 15s', callsCount: 9, targetSeconds: 180 },
  { session: 'Sess #5', ahtSeconds: 124, formattedAht: '2m 04s', callsCount: 11, targetSeconds: 180 },
];

interface AgentPerformanceChartProps {
  agentName?: string;
  data?: SessionAhtData[];
  className?: string;
}

export const AgentPerformanceChart: React.FC<AgentPerformanceChartProps> = ({
  agentName = 'Agent',
  data = DEFAULT_AHT_SESSIONS,
  className = '',
}) => {
  const latestAht = data[data.length - 1];
  const previousAht = data[0];
  const improvementSeconds = previousAht ? previousAht.ahtSeconds - latestAht.ahtSeconds : 0;
  const avgAhtSeconds = Math.round(data.reduce((acc, d) => acc + d.ahtSeconds, 0) / data.length);

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
            <BarChart3 className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Agent Performance Metrics</h3>
            <p className="text-[11px] text-slate-500">Average Handling Time (AHT) • Last 5 Sessions</p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
          <TrendingDown className="w-3 h-3" />
          -{improvementSeconds}s AHT
        </span>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
            Latest AHT
          </span>
          <span className="text-base font-bold text-indigo-700 mt-0.5 block">
            {latestAht.formattedAht}
          </span>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
            5-Sess Avg
          </span>
          <span className="text-base font-bold text-slate-800 mt-0.5 block">
            {Math.floor(avgAhtSeconds / 60)}m {(avgAhtSeconds % 60).toString().padStart(2, '0')}s
          </span>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
            Target SLA
          </span>
          <span className="text-base font-bold text-emerald-600 mt-0.5 block">
            &lt; 3m 00s
          </span>
        </div>
      </div>

      {/* Small Recharts Line Chart */}
      <div className="h-44 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="session"
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fontSize: 10, fill: '#64748b' }}
            />
            <YAxis
              unit="s"
              domain={['dataMin - 15', 'dataMax + 15']}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fontSize: 10, fill: '#64748b' }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as SessionAhtData;
                  return (
                    <div className="bg-slate-900 text-white px-2.5 py-1.5 rounded-lg text-[11px] shadow-lg border border-slate-700">
                      <p className="font-bold text-amber-300">{item.session}</p>
                      <p className="font-mono">AHT: {item.formattedAht} ({item.ahtSeconds}s)</p>
                      <p className="text-[10px] text-slate-400">{item.callsCount} calls handled</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* Target SLA dashed line */}
            <Line
              type="monotone"
              dataKey="targetSeconds"
              stroke="#cbd5e1"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            {/* Actual AHT line */}
            <Line
              type="monotone"
              dataKey="ahtSeconds"
              stroke="#4f46e5"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#ffffff' }}
              activeDot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#ffffff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-0.5 bg-indigo-600 inline-block rounded" /> Actual Handling Time
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-0.5 bg-slate-300 border-dashed border-t inline-block" /> SLA Target (180s)
        </span>
      </div>
    </div>
  );
};
