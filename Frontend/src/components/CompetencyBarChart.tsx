import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Cell,
    LabelList
} from 'recharts';

interface CompetencyBarChartProps {
    title: string;
    selfScore: number;
    managerScore: number;
}

export const CompetencyBarChart = ({ title, selfScore, managerScore }: CompetencyBarChartProps) => {
    const data = [
        {
            name: 'Self Present & Prev Feedback',
            score: selfScore,
        },
        {
            name: 'Manager Present & Prev Feedback',
            score: managerScore,
        },
    ];

    const levels = [
        { label: 'Highly Satisfactory', value: 4 },
        { label: 'Satisfactory', value: 3 },
        { label: 'Unsatisfactory', value: 2 },
        { label: 'Highly Unsatisfactory', value: 1 },
    ];

    return (
        <div className="mb-12 last:mb-0">
            <h3 className="text-2xl font-bold mb-8 text-gray-800 tracking-tight">{title}</h3>

            <div className="flex flex-col lg:flex-row items-center gap-8">
                {/* Left Side Labels */}
                <div className="flex flex-col justify-around h-[300px] py-10 w-64">
                    {levels.map((level) => (
                        <div key={level.value} className="flex items-center justify-end gap-3">
                            <span className="text-sm font-medium text-gray-500">{level.label}</span>
                            <div className="bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center font-bold text-gray-600 text-sm">
                                {level.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Chart Area */}
                <div className="flex-1 w-full h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                            barSize={120}
                        >
                            <CartesianGrid strokeDasharray="1 1" vertical={true} horizontal={false} stroke="#e5e7eb" />
                            <XAxis
                                dataKey="name"
                                axisLine={true}
                                tickLine={false}
                                tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 500 }}
                                interval={0}
                                dy={10}
                            />
                            <YAxis
                                domain={[0, 5]}
                                axisLine={true}
                                tickLine={true}
                                ticks={[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]}
                                tick={{ fill: '#6b7280', fontSize: 12 }}
                            />
                            <Bar dataKey="score" radius={[2, 2, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#8da356' : '#f472b6'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
