import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface CompetencyScore {
    name: string;
    self: number;
    manager: number;
    average: number;
}

interface CompetencyTableProps {
    data: CompetencyScore[];
}

export const CompetencyTable = ({ data }: CompetencyTableProps) => {
    return (
        <div className="w-full overflow-hidden rounded-t-xl border border-gray-100 shadow-sm mb-8">
            <Table>
                <TableHeader className="bg-[#8da356]">
                    <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="w-[400px] text-white font-bold py-3 px-6">Employee Competency</TableHead>
                        <TableHead className="text-white font-bold text-center py-3 px-6">Self</TableHead>
                        <TableHead className="text-white font-bold text-center py-3 px-6">Manager</TableHead>
                        <TableHead className="text-white font-bold text-center py-3 px-6">Average</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item, idx) => (
                        <TableRow key={idx} className="border-b border-gray-100 bg-[#f9fafb]/50 hover:bg-white transition-colors">
                            <TableCell className="py-2 px-6 font-bold text-gray-800 text-lg">
                                {item.name}
                            </TableCell>
                            <TableCell className="py-2 px-6 text-center text-gray-600 font-medium">
                                {item.self || ''}
                            </TableCell>
                            <TableCell className="py-2 px-6 text-center text-gray-600 font-medium">
                                {item.manager || ''}
                            </TableCell>
                            <TableCell className="py-2 px-6 flex justify-center items-center">
                                <div className="bg-[#dce4c9] rounded-full w-9 h-9 flex items-center justify-center text-sm font-bold text-gray-700 border border-[#8da356]/20">
                                    {item.average.toFixed(2)}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
