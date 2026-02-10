import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type VolumeChartProps = {
  days: string[];
  conversationsCreated: number[];
  ticketsCreated: number[];
  ticketsResolved: number[];
};

export function VolumeChart({
  days,
  conversationsCreated,
  ticketsCreated,
  ticketsResolved,
}: VolumeChartProps) {
  const data = days.map((day, index) => ({
    day,
    conversationsCreated: conversationsCreated[index] ?? 0,
    ticketsCreated: ticketsCreated[index] ?? 0,
    ticketsResolved: ticketsResolved[index] ?? 0,
  }));

  return (
    <div className="w-full h-80 rounded-md border border-slate-800 bg-slate-950/60 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2933" />
          <XAxis dataKey="day" tick={{ fill: '#cbd5f5', fontSize: 11 }} />
          <YAxis tick={{ fill: '#cbd5f5', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#020617',
              borderColor: '#1f2933',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="conversationsCreated"
            name="Conversations"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="ticketsCreated"
            name="Tickets created"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="ticketsResolved"
            name="Tickets resolved"
            stroke="#f97316"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

