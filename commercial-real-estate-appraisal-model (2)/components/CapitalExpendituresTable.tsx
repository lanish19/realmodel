
import React, { ChangeEvent } from 'react';
import { CapitalExpenditureEntry } from '../types';
import { formatCurrency, formatBasicNumber } from '../utils/formatters';

interface CapitalExpendituresTableProps {
  capitalExpenditures: CapitalExpenditureEntry[];
  onCapitalExpendituresChange: (updatedCapEx: CapitalExpenditureEntry[]) => void;
  addCapExEntry: () => void;
  removeCapExEntry: (id: string) => void;
  validationErrors: Record<string, string>;
}

const CapitalExpendituresTable: React.FC<CapitalExpendituresTableProps> = ({
  capitalExpenditures, onCapitalExpendituresChange, addCapExEntry, removeCapExEntry, validationErrors
}) => {
  const handleEntryChange = (id: string, field: keyof CapitalExpenditureEntry, value: any) => {
    const updatedCapEx = capitalExpenditures.map(entry => {
      if (entry.id === id) {
        let processedValue = value;
        if (field === 'year' || field === 'amount') {
            processedValue = parseFloat(value);
            if (isNaN(processedValue)) processedValue = 0;
        }
        return { ...entry, [field]: processedValue };
      }
      return entry;
    });
    onCapitalExpendituresChange(updatedCapEx);
  };

  const renderInput = (entry: CapitalExpenditureEntry, field: keyof CapitalExpenditureEntry, type: string = 'text') => {
    const errorKey = `capex-${entry.id}-${field}`;
    const error = validationErrors[errorKey];
    return (
        <>
            <input
                type={type}
                id={`capex-${entry.id}-${field}`}
                name={field}
                className={`w-full p-1 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm sm:text-xs focus:ring-indigo-500 focus:border-indigo-500`}
                value={entry[field] as any}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleEntryChange(entry.id, field, e.target.value)}
                step={type === 'number' ? (field === 'amount' ? '100' : '1') : undefined}
                aria-invalid={!!error}
                aria-describedby={error ? `${errorKey}-error` : undefined}
            />
            {error && <p id={`${errorKey}-error`} className="mt-0.5 text-xs text-red-600">{error}</p>}
        </>
    );
  };

  return (
    <div>
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-2 text-left font-medium text-gray-500 tracking-wider">Year</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 tracking-wider">Description</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 tracking-wider">Amount ($)</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {capitalExpenditures.map((entry) => (
            <tr key={entry.id}>
              <td className="px-2 py-1 whitespace-nowrap w-1/6">{renderInput(entry, 'year', 'number')}</td>
              <td className="px-2 py-1 whitespace-nowrap w-3/6">{renderInput(entry, 'description', 'text')}</td>
              <td className="px-2 py-1 whitespace-nowrap w-1/6">{renderInput(entry, 'amount', 'number')}</td>
              <td className="px-2 py-1 whitespace-nowrap w-1/6">
                <button 
                    type="button" 
                    onClick={() => removeCapExEntry(entry.id)} 
                    className="text-red-600 hover:text-red-800 text-xs"
                    aria-label={`Remove CapEx ${entry.description}`}
                >
                    Del
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button 
        type="button" 
        onClick={addCapExEntry} 
        className="mt-3 bg-green-500 hover:bg-green-600 text-white font-semibold py-1.5 px-3 rounded-md text-xs shadow focus:outline-none focus:ring-2 focus:ring-green-400"
      >
        Add CapEx Item
      </button>
    </div>
  );
};

export default CapitalExpendituresTable;
