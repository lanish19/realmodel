
import React from 'react';
import { AnnualCashFlowDCF } from '../types'; // Changed from AnnualCashFlow
import { formatCurrency, formatPercentage, formatBasicNumber } from '../utils/formatters';

interface ProjectedCashFlowViewerTableProps {
  cashFlows: AnnualCashFlowDCF[]; // Changed from AnnualCashFlow
  projectionYears: number;
}

const ProjectedCashFlowViewerTable: React.FC<ProjectedCashFlowViewerTableProps> = ({ cashFlows, projectionYears }) => {
  if (!cashFlows || cashFlows.length === 0) {
    return <p className="text-sm text-gray-500">No DCF cash flow data to display. Adjust projection inputs.</p>;
  }

  const yearsToDisplay = Array.from({ length: projectionYears }, (_, i) => i + 1);

  // Define the order and labels for rows
  const rowOrder: Array<{key: keyof AnnualCashFlowDCF, label: string, isCurrency?: boolean, isPercentage?: boolean, isFactor?: boolean}> = [
    { key: 'potentialGrossRevenue', label: 'Potential Gross Revenue', isCurrency: true },
    { key: 'generalVacancyLoss', label: 'General Vacancy Loss', isCurrency: true },
    { key: 'creditLoss', label: 'Credit Loss', isCurrency: true },
    { key: 'effectiveGrossIncome', label: 'Effective Gross Income', isCurrency: true },
    { key: 'operatingExpenses', label: 'Operating Expenses', isCurrency: true },
    { key: 'netOperatingIncome', label: 'Net Operating Income (NOI)', isCurrency: true },
    { key: 'tenantImprovementsAndLcs', label: 'Tenant Improvements & LCs', isCurrency: true },
    { key: 'capitalExpenditures', label: 'Capital Expenditures', isCurrency: true },
    { key: 'netCashFlow', label: 'Net Cash Flow (NCF)', isCurrency: true },
    { key: 'netCashFlowWithTerminal', label: 'NCF with Terminal Value', isCurrency: true },
    { key: 'presentValueFactor', label: 'PV Factor @ Discount Rate', isFactor: true },
    { key: 'presentValueOfNetCashFlow', label: 'PV of NCF (with Terminal)', isCurrency: true },
  ];


  return (
    <div className="overflow-x-auto shadow-lg rounded-lg border border-gray-200">
      <table id="dcfTable" className="min-w-full divide-y divide-gray-300 text-xs">
        <thead className="bg-slate-100 sticky top-0 z-20">
          <tr>
            <th className="py-2.5 px-3 text-left font-semibold text-slate-700 sticky left-0 bg-slate-100 z-30">Metric</th>
            {yearsToDisplay.map(year => (
              <th key={year} className="py-2.5 px-3 text-right font-semibold text-slate-700">Year {year}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rowOrder.map(rowInfo => {
            const { key, label, isCurrency, isPercentage, isFactor } = rowInfo;
            // Skip rendering 'year' as a row, it's a column header
            if (key === 'year') return null; 
            // Also skip some base AnnualCashFlow fields if they are summed up elsewhere or too granular for this view
             if (['potentialBaseRent', 'scheduledEscalationsRevenue', 'potentialMarketRentFromVacancy', 'totalScheduledRentalRevenue', 'tenantReimbursementsNNN'].includes(key)) return null;

            return (
              <tr key={key} className="hover:bg-slate-50">
                <td className="py-2 px-3 text-left text-slate-600 font-medium sticky left-0 bg-white hover:bg-slate-50 z-10">{label}</td>
                {yearsToDisplay.map(yearIndex => {
                  const flowForYear = cashFlows.find(cf => cf.year === yearIndex);
                  const value = flowForYear ? flowForYear[key] : 0;
                  
                  let displayValue: string | number = value as string | number;
                  if (typeof value === 'number') {
                    if (isCurrency) {
                       const isTypicallyNegative = ['generalVacancyLoss', 'creditLoss', 'operatingExpenses', 'tenantImprovementsAndLcs', 'capitalExpenditures'].includes(key);
                       displayValue = formatCurrency(isTypicallyNegative && value > 0 ? -value : value);
                    } else if (isPercentage) {
                       displayValue = formatPercentage(value);
                    } else if (isFactor) {
                        displayValue = value.toFixed(4);
                    } else {
                       displayValue = formatBasicNumber(value, 0);
                    }
                  }
                  
                  return (
                    <td key={`${key}-${yearIndex}`} className="py-2 px-3 text-right text-slate-700">
                      {displayValue}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ProjectedCashFlowViewerTable;
