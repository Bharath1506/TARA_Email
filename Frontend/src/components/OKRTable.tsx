import { useState, Fragment } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Target,
    Star,
    Calendar,
    Weight,
    TrendingUp
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';

interface KeyResult {
    id: string;
    description: string;
    target: string;
    current: string;
    metrics: string;
    employeeRating: number;
    managerRating: number;
    progress?: number;
    dueDate?: string;
    weight?: number;
}

interface OKR {
    id: string;
    objective: string;
    weight?: number;
    dueDate?: string;
    progress?: number;
    employeeRating: number;
    managerRating: number;
    keyResults: KeyResult[];
}

interface OKRTableProps {
    okrs: OKR[];
}

export const OKRTable = ({ okrs }: OKRTableProps) => {
    const [expandedObjectives, setExpandedObjectives] = useState<Record<string, boolean>>(
        okrs.reduce((acc, okr) => ({ ...acc, [okr.id]: true }), {})
    );

    const toggleObjective = (id: string) => {
        setExpandedObjectives(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const StarRating = ({ rating }: { rating: number }) => {
        return (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={18}
                        className={`${star <= rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-gray-100 text-gray-200'
                            }`}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <Table>
                <TableHeader className="bg-gray-50/50">
                    <TableRow className="hover:bg-transparent border-b border-gray-100">
                        <TableHead className="w-[400px] text-xs font-bold uppercase tracking-wider text-gray-600 py-4 px-6">OBJECTIVE</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-600 py-4 px-6">DUE DATE</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-600 py-4 px-6">WEIGHT</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-600 py-4 px-6">PROGRESS</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-600 py-4 px-6">Employee Rating</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-600 py-4 px-6">Manager Rating</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {okrs.map((okr) => (
                        <Fragment key={okr.id}>
                            <TableRow className="group border-b border-gray-50 transition-colors hover:bg-gray-50/30">
                                <TableCell className="py-6 px-6">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => toggleObjective(okr.id)}
                                            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                                        >
                                            {expandedObjectives[okr.id] ? (
                                                <ChevronDown size={20} className="text-gray-500" />
                                            ) : (
                                                <ChevronRight size={20} className="text-gray-500" />
                                            )}
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <div className="bg-gray-100 p-1.5 rounded-full">
                                                <Target size={16} className="text-gray-700" />
                                            </div>
                                            <span className="font-semibold text-gray-800 text-[15px] hover:text-primary transition-colors cursor-pointer">
                                                {okr.objective}
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="py-6 px-6 text-sm text-gray-500 font-medium">
                                    {okr.dueDate || '31 Jan 2026'}
                                </TableCell>
                                <TableCell className="py-6 px-6 text-sm text-gray-500 font-medium">
                                    {okr.weight || '50'}
                                </TableCell>
                                <TableCell className="py-6 px-6">
                                    <div className="flex flex-col gap-1.5 min-w-[120px]">
                                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                                            <div
                                                className="bg-green-600 h-full transition-all duration-500 ease-in-out"
                                                style={{ width: `${okr.progress || 75}%` }}
                                            />
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-500 italic">
                                            {okr.progress || 75}%
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-6 px-6">
                                    <StarRating rating={okr.employeeRating} />
                                </TableCell>
                                <TableCell className="py-6 px-6">
                                    <StarRating rating={okr.managerRating} />
                                </TableCell>
                            </TableRow>

                            {/* Key Results Rows */}
                            {expandedObjectives[okr.id] && okr.keyResults.map((kr) => (
                                <TableRow key={kr.id} className="bg-gray-50/20 border-b border-gray-50/50 hover:bg-gray-50/40">
                                    <TableCell className="py-4 px-6">
                                        <div className="flex items-center gap-4 pl-12">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-white p-1 rounded-full border border-gray-100 shadow-sm">
                                                    <Target size={12} className="text-gray-400" />
                                                </div>
                                                <span className="text-sm text-gray-600 font-medium underline decoration-gray-300 underline-offset-4 cursor-pointer hover:text-gray-900 transition-colors">
                                                    {kr.description}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 px-6 text-sm text-gray-400">
                                        {kr.dueDate || okr.dueDate || '31 Jan 2026'}
                                    </TableCell>
                                    <TableCell className="py-4 px-6 text-sm text-gray-400">
                                        {kr.weight || '25'}
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <div className="flex flex-col gap-1 w-24">
                                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                <div
                                                    className="bg-green-600 h-1.5 rounded-full transition-all duration-500"
                                                    style={{ width: `${kr.progress || 0}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-[10px] text-gray-500 font-bold italic">
                                                {Math.round(kr.progress || 0)}%
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <StarRating rating={kr.employeeRating} />
                                    </TableCell>
                                    <TableCell className="py-4 px-6">
                                        <StarRating rating={kr.managerRating} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </Fragment>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
