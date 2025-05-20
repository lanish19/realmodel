
import React, { ChangeEvent } from 'react';
import { RentRollEntry, ReimbursementType, EscalationType } from '../types';
import { formatCurrency, formatPercentage, formatBasicNumber } from '../utils/formatters';

interface RentRollTableProps {
  rentRoll: RentRollEntry[];
  onRentRollChange: (updatedRentRoll: RentRollEntry[]) => void;
  addRentRollEntry: () => void;
  removeRentRollEntry: (id: string) => void;
  validationErrors: Record<string, string>;
}

const RentRollTable: React.FC<RentRollTableProps> = ({ 
    rentRoll, onRentRollChange, addRentRollEntry, removeRentRollEntry, validationErrors 
}) => {
  const handleEntryChange = (id: string, field: keyof RentRollEntry, value: any) => {
    const updatedRentRoll = rentRoll.map(entry => {
      if (entry.id === id) {
        let processedValue = value;
        const numericFields: (keyof RentRollEntry)[] = [
            'squareFeet', 'currentRentPerSF', 'escalationPercent', 
            'renewalProbabilityPercent', 'renewalDowntimeMonths', 
            'renewalMarketRentPerSF', 'renewalTiPerSF', 'renewalLcPercentOfFirstYearRent',
            'renewTermYears', 'renewRentBumpPercent'
        ];
        if (numericFields.includes(field as keyof RentRollEntry)) {
            processedValue = parseFloat(value);
            if (isNaN(processedValue) && value !== '' && value !== '-') { // Allow empty or minus for typing
                 processedValue = entry[field]; // Revert to old value if invalid and not empty/minus
            } else if (isNaN(processedValue)) {
                 processedValue = value; // Keep as string if empty or minus
            }
        }
        return { ...entry, [field]: processedValue };
      }
      return entry;
    });
    onRentRollChange(updatedRentRoll);
  };
  
  const handleBlurNumeric = (id: string, field: keyof RentRollEntry, value: string | number) => {
    let numericValue = parseFloat(value as string);
    if (isNaN(numericValue)) {
        numericValue = 0; // Default to 0 if NaN after typing
    }
     const updatedRentRoll = rentRoll.map(entry => 
        entry.id === id ? { ...entry, [field]: numericValue } : entry
    );
    onRentRollChange(updatedRentRoll);
  };


  const reimbursementOptions: { value: ReimbursementType; label: string }[] = [
    { value: 'nnn', label: 'NNN' },
    { value: 'gross', label: 'Gross' },
    { value: 'modifiedGross', label: 'Mod. Gross' },
    { value: '', label: 'N/A' }
  ];
  
  const escalationTypeOptions: { value: EscalationType; label: string}[] = [
      { value: 'fixedPercent', label: 'Fixed %' },
      { value: 'stepUp', label: 'Step-Up (Future)' },
      { value: 'cpi', label: 'CPI (Future)' },
      { value: '', label: 'None' },
  ];

  const renderInput = (entry: RentRollEntry, field: keyof RentRollEntry, type: string = 'text', options?: {value: string, label: string}[], title?: string) => {
    const errorKey = `rentroll-${entry.id}-${field}`;
    const error = validationErrors[errorKey];
    const commonProps = {
        id: `rentroll-${entry.id}-${field}`,
        name: field,
        className: `w-full p-1 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm sm:text-xs focus:ring-indigo-500 focus:border-indigo-500`,
        value: entry[field] as any,
        onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => handleEntryChange(entry.id, field, e.target.value),
        'aria-invalid': !!error,
        'aria-describedby': error ? `${errorKey}-error` : undefined,
        title: title || field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()) // Default title
    };
    
    const numericFields: (keyof RentRollEntry)[] = [
        'squareFeet', 'currentRentPerSF', 'escalationPercent', 
        'renewalProbabilityPercent', 'renewalDowntimeMonths', 
        'renewalMarketRentPerSF', 'renewalTiPerSF', 'renewalLcPercentOfFirstYearRent',
        'renewTermYears', 'renewRentBumpPercent'
    ];

    if (type === 'select' && options) {
        return (
            <>
                <select {...commonProps}>
                    {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                {error && <p id={`${errorKey}-error`} className="mt-0.5 text-xs text-red-600">{error}</p>}
            </>
        );
    }
    return (
        <>
            <input 
              type={type} 
              {...commonProps} 
              step={type === 'number' ? '0.01' : undefined}
              onBlur={numericFields.includes(field as keyof RentRollEntry) ? (e) => handleBlurNumeric(entry.id, field, e.target.value) : undefined}
            />
            {error && <p id={`${errorKey}-error`} className="mt-0.5 text-xs text-red-600">{error}</p>}
        </>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table id="rentRollTable" className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider">Suite</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider">Use</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider">SF</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider" title="Current Annual Rent per SF">Rent/SF ($)</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider">Start</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider">End</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider" title="Escalation Type">Esc.Type</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider" title="Annual Escalation % (if Fixed %)">Escal.(%)</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider">Reimb.</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider" title="Renewal Probability %">Ren.Prob(%)</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider" title="Renewal Term (Years)">Ren.Term(Yr)</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider" title="Renewal Rent Bump %">Ren.Bump(%)</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider" title="Renewal Downtime (Months)">Down(Mo)</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider" title="Renewal Market Rent $/SF">Ren.Rent($/SF)</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider" title="Renewal TI $/SF">Ren.TI($/SF)</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider" title="Renewal LC % of 1st Yr Rent">Ren.LC(%)</th>
            <th className="px-1 py-2 text-left font-medium text-gray-500 tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rentRoll.map((entry) => (
            <tr key={entry.id}>
              <td className="px-1 py-1 whitespace-nowrap min-w-[80px]">{renderInput(entry, 'suite', 'text')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[70px]">{renderInput(entry, 'useType', 'text', undefined, 'Office/Retail...')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[60px]">{renderInput(entry, 'squareFeet', 'number')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[70px]">{renderInput(entry, 'currentRentPerSF', 'number')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[110px]">{renderInput(entry, 'leaseStartDate', 'date')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[110px]">{renderInput(entry, 'leaseEndDate', 'date')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[90px]">{renderInput(entry, 'escalationType', 'select', escalationTypeOptions)}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[60px]">{renderInput(entry, 'escalationPercent', 'number')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[90px]">{renderInput(entry, 'reimbursementType', 'select', reimbursementOptions)}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[70px]">{renderInput(entry, 'renewalProbabilityPercent', 'number')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[60px]">{renderInput(entry, 'renewTermYears', 'number', undefined, 'Years')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[70px]">{renderInput(entry, 'renewRentBumpPercent', 'number', undefined, '%')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[60px]">{renderInput(entry, 'renewalDowntimeMonths', 'number')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[70px]">{renderInput(entry, 'renewalMarketRentPerSF', 'number')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[70px]">{renderInput(entry, 'renewalTiPerSF', 'number')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[70px]">{renderInput(entry, 'renewalLcPercentOfFirstYearRent', 'number')}</td>
              <td className="px-1 py-1 whitespace-nowrap min-w-[50px]">
                <button 
                    type="button" 
                    onClick={() => removeRentRollEntry(entry.id)} 
                    className="text-red-500 hover:text-red-700 text-xs p-0.5"
                    aria-label={`Remove suite ${entry.suite || 'entry'}`}
                >Del</button>
                 {/* Add duplicate button here later if needed */}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button 
        type="button" 
        onClick={addRentRollEntry} 
        className="mt-3 bg-green-500 hover:bg-green-600 text-white font-semibold py-1.5 px-3 rounded-md text-xs shadow focus:outline-none focus:ring-2 focus:ring-green-400"
      >
        Add Tenant/Suite
      </button>
    </div>
  );
};

export default RentRollTable;
