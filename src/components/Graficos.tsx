import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface Serie {
  chave: string;
  rotulo: string;
  /** Índice do slot categórico (1..3), definido em styles.css como --chart-N. */
  slot: 1 | 2 | 3;
}

interface Props {
  dados: Record<string, unknown>[];
  x: string;
  series: Serie[];
  formatar?: (v: number) => string;
  altura?: number;
}

const estiloTooltip = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: 13,
  },
  labelStyle: { color: 'var(--text)', fontWeight: 600 },
  itemStyle: { color: 'var(--text)' },
};

const eixo = { stroke: 'var(--border)', tickLine: false, tick: { fill: 'var(--text-2)', fontSize: 12 } };

export function GraficoBarras({ dados, x, series, formatar = String, altura = 260 }: Props) {
  return (
    <div style={{ width: '100%', height: altura }}>
      <ResponsiveContainer>
        <BarChart data={dados} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey={x} {...eixo} />
          <YAxis {...eixo} axisLine={false} width={64} tickFormatter={(v) => formatar(Number(v))} />
          <Tooltip {...estiloTooltip} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => formatar(Number(v))} />
          {series.length > 1 && <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 13, color: 'var(--text)' }} />}
          {series.map((s) => (
            <Bar key={s.chave} dataKey={s.chave} name={s.rotulo} fill={`var(--chart-${s.slot})`} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficoLinha({ dados, x, series, formatar = String, altura = 260 }: Props) {
  return (
    <div style={{ width: '100%', height: altura }}>
      <ResponsiveContainer>
        <LineChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={x} {...eixo} minTickGap={24} />
          <YAxis {...eixo} axisLine={false} width={56} tickFormatter={(v) => formatar(Number(v))} domain={['auto', 'auto']} />
          <Tooltip {...estiloTooltip} cursor={{ stroke: 'var(--text-2)', strokeDasharray: '3 3' }} formatter={(v) => formatar(Number(v))} />
          {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />}
          {series.map((s) => (
            <Line
              key={s.chave}
              type="monotone"
              dataKey={s.chave}
              name={s.rotulo}
              stroke={`var(--chart-${s.slot})`}
              strokeWidth={2}
              dot={dados.length <= 12 ? { r: 4, strokeWidth: 2, fill: 'var(--surface)' } : false}
              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
