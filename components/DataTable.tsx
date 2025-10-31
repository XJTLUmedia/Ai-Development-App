import React from 'react';
import { DataTableData } from '../types';

interface DataTableProps {
    data: DataTableData;
}

export const DataTable: React.FC<DataTableProps> = ({ data }) => {
    const { headers, rows } = data;

    if (!headers || headers.length === 0) {
        return (
            <div className="text-center text-gray-400 py-8">
                This Excel sheet appears to be empty or could not be read.
            </div>
        );
    }

    return (
        <div className="datatable-container">
            <table className="datatable">
                <thead>
                    <tr>
                        {headers.map((header, index) => (
                            <th key={`header-${index}`}>{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`}>
                            {row.map((cell, cellIndex) => (
                                <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                            ))}
                            {/* Pad cells if a row has fewer than the number of headers */}
                            {Array.from({ length: headers.length - row.length }).map((_, i) => (
                                <td key={`pad-${rowIndex}-${i}`} />
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
