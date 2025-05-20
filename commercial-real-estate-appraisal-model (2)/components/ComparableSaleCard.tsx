
import React, { ChangeEvent } from 'react';
import { ComparableSale, SalesCompAdjustments } from '../types';

interface ComparableSaleCardProps {
  comp: ComparableSale;
  index: number;
  onCompChange: (index: number, updatedComp: ComparableSale) => void;
  onRemoveComp: (index: number) => void;
  isRemovable: boolean;
  annualMarketConditionsAdjustmentPercent: number;
  validationErrors: Record<string, string>; // Added to receive validation errors
}

const ComparableSaleCard: React.FC<ComparableSaleCardProps> = ({
  comp,
  index,
  onCompChange,
  onRemoveComp,
  isRemovable,
  annualMarketConditionsAdjustmentPercent,
  validationErrors,
}) => {

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let finalValue: string | number;

    if (type === 'number') {
      let numericValue = parseFloat(value); // Don't default to 0 immediately, allow empty input
      if (value.trim() === '' || value.trim() === '-') { // Allow empty or just negative sign temporarily
        finalValue = value; // Keep as string for controlled input
      } else if (isNaN(numericValue)) {
        numericValue = 0; // Default to 0 if truly not a number (e.g. "abc")
        finalValue = numericValue;
      } else {
          // Basic clamping can remain here for immediate feedback, detailed validation is external
          if ((name === 'gba' || name === 'salePrice') && numericValue < 0) {
            numericValue = 0;
          }
          finalValue = numericValue;
      }
    } else {
      finalValue = value;
    }
    // If it's a string that was intended to be a number but is temporarily empty/invalid,
    // the external validation will catch it. The onCompChange will send what's typed.
    onCompChange(index, { ...comp, [name]: finalValue });
  };


  const handleAdjustmentChange = (adjName: keyof SalesCompAdjustments, value: string) => {
    const numericValue = parseFloat(value);
    const valToSet = isNaN(numericValue) ? 0 : numericValue; // Default to 0 if parsing fails
    onCompChange(index, {
      ...comp,
      adjustments: {
        ...comp.adjustments,
        [adjName]: valToSet, // Clamping/validation is external or by SliderInput if used
      },
    });
  };
  
  const pricePerSF = comp.gba > 0 ? (comp.salePrice / comp.gba) : 0;

  const renderCompInput = (fieldName: keyof ComparableSale, label: string, type: string = "text", title?: string, placeholder?: string) => {
    const errorKey = `comp-${index}-${fieldName}`;
    const error = validationErrors[errorKey];
    const value = comp[fieldName];
    return (
        <div className={type === 'textarea' ? "col-span-1 md:col-span-2" : ""}>
            <label htmlFor={`comp-${comp.id}-${fieldName}`} className="block text-xs font-medium text-gray-700" title={title}>{label}</label>
            {type === 'textarea' ? (
                <textarea 
                    name={fieldName as string} 
                    id={`comp-${comp.id}-${fieldName}`} 
                    value={value as string} 
                    onChange={handleInputChange} 
                    className={`mt-0.5 block w-full p-1 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                    placeholder={placeholder}
                    rows={2}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${errorKey}-error` : undefined}
                />
            ) : (
                <input 
                    type={type} 
                    name={fieldName as string} 
                    id={`comp-${comp.id}-${fieldName}`} 
                    value={value as string | number} 
                    onChange={handleInputChange} 
                    min={ (fieldName === 'salePrice' || fieldName === 'gba') ? 0 : undefined}
                    className={`mt-0.5 block w-full p-1 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                    placeholder={placeholder}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${errorKey}-error` : undefined}
                />
            )}
            {error && <p id={`${errorKey}-error`} className="mt-0.5 text-xs text-red-600">{error}</p>}
        </div>
    );
  };


  // Helper function to render adjustment input
  const renderAdjustmentInput = (adjName: keyof SalesCompAdjustments, label: string) => {
    const errorKey = `comp-${index}-adj-${adjName}`;
    const error = validationErrors[errorKey];
    return (
    <div className="grid grid-cols-2 gap-2 items-center mb-1">
      <label htmlFor={`comp-${comp.id}-${adjName}`} className="text-xs text-gray-600">{label}:</label>
      <div>
        <input
            type="number"
            id={`comp-${comp.id}-${adjName}`}
            name={adjName}
            value={comp.adjustments[adjName]}
            onChange={(e) => handleAdjustmentChange(adjName, e.target.value)}
            className={`w-full p-1 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs`}
            step="0.1" // Allow finer adjustments
            aria-invalid={!!error}
            aria-describedby={error ? `${errorKey}-error` : undefined}
        />
        {error && <p id={`${errorKey}-error`} className="mt-0.5 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )};

  return (
    <div className="p-4 border border-gray-300 rounded-lg mb-4 bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-md text-indigo-700">Comparable Sale #{index + 1}</h4>
        {isRemovable && (
          <button
            type="button"
            onClick={() => onRemoveComp(index)}
            className="text-red-500 hover:text-red-700 text-sm"
            aria-label={`Remove Comparable Sale ${index + 1}`}
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
        {renderCompInput('address', 'Address')}
        {renderCompInput('saleDate', 'Sale Date', 'date')}
        {renderCompInput('salePrice', 'Sale Price ($)', 'number')}
        {renderCompInput('gba', 'GBA (SF)', 'number', "Gross Building Area")}
        
        <div className="col-span-1 md:col-span-2">
            <p className="text-xs text-gray-600 mt-1">Price per SF: <span className="font-medium">{pricePerSF.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
        </div>
        
        {renderCompInput('propertyRightsConveyed', 'Property Rights Conveyed', 'text', undefined, 'e.g., Fee Simple')}
        {renderCompInput('financingTerms', 'Financing Terms', 'text', undefined, 'e.g., Conventional')}
        {renderCompInput('conditionOfSale', 'Conditions of Sale', 'text', undefined, 'e.g., Arms-length')}
        {renderCompInput('locationQuality', 'Location Quality', 'text', undefined, 'e.g., Prime, Secondary')}
        {renderCompInput('siteUtility', 'Site Features/Utility', 'textarea', undefined, 'e.g., Good access, avg topography')}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <h5 className="text-sm font-semibold text-gray-700 mb-1.5">Adjustments (%)</h5>
        <p className="text-xs text-gray-500 mb-2">Guidance: Annual Market Conditions Trend is {annualMarketConditionsAdjustmentPercent > 0 ? '+' : ''}{annualMarketConditionsAdjustmentPercent.toFixed(1)}%. Apply to "Market Time" based on sale date vs. effective date.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-x-4 gap-y-0.5"> {/* Adjusted grid for better fit */}
          {renderAdjustmentInput('propertyRights', 'Property Rights')}
          {renderAdjustmentInput('financing', 'Financing')}
          {renderAdjustmentInput('conditionsOfSale', 'Conditions of Sale')}
          {renderAdjustmentInput('marketTime', 'Market Time/Conditions')}
          {renderAdjustmentInput('location', 'Location')}
          {renderAdjustmentInput('physicalSize', 'Physical Size (GBA)')}
          {renderAdjustmentInput('ageCondition', 'Age/Condition (Property)')}
          {renderAdjustmentInput('site', 'Site Features')}
        </div>
      </div>
    </div>
  );
};

export default ComparableSaleCard;
