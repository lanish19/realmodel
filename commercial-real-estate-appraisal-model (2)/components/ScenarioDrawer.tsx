
import React, { useState } from 'react';
import SliderInput from './SliderInput';
import { formatPercentage, formatCurrency } from '../utils/formatters';
import { DCFResults } from '../types';

interface ScenarioDrawerProps {
  initialDiscountRate: number;
  initialExitCapRate: number;
  initialRentGrowth: number;
  onScenarioChange: (overrides: { discountRate?: number; exitCapRate?: number; rentGrowth?: number }) => void;
  baseDcfValue: number; // To show impact
  scenarioDcfResults: DCFResults | null; // To show scenario values
}

const ScenarioDrawer: React.FC<ScenarioDrawerProps> = ({
  initialDiscountRate,
  initialExitCapRate,
  initialRentGrowth,
  onScenarioChange,
  baseDcfValue,
  scenarioDcfResults,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempDiscountRate, setTempDiscountRate] = useState(initialDiscountRate);
  const [tempExitCapRate, setTempExitCapRate] = useState(initialExitCapRate);
  const [tempRentGrowth, setTempRentGrowth] = useState(initialRentGrowth);

  const handleApplyScenario = () => {
    onScenarioChange({
      discountRate: tempDiscountRate,
      exitCapRate: tempExitCapRate,
      rentGrowth: tempRentGrowth,
    });
  };
  
  const handleResetScenario = () => {
    setTempDiscountRate(initialDiscountRate);
    setTempExitCapRate(initialExitCapRate);
    setTempRentGrowth(initialRentGrowth);
    onScenarioChange({ // Pass undefined to signal reset to base inputs
        discountRate: undefined, 
        exitCapRate: undefined, 
        rentGrowth: undefined 
    }); 
  }

  // Update local state and trigger scenario recalculation in App.tsx via onScenarioChange
  const createSliderHandler = (setter: React.Dispatch<React.SetStateAction<number>>, overrideKey: 'discountRate' | 'exitCapRate' | 'rentGrowth') => {
    return (newValue: number) => {
        setter(newValue);
        // Immediately propagate change for live update
        onScenarioChange({
            discountRate: overrideKey === 'discountRate' ? newValue : tempDiscountRate,
            exitCapRate: overrideKey === 'exitCapRate' ? newValue : tempExitCapRate,
            rentGrowth: overrideKey === 'rentGrowth' ? newValue : tempRentGrowth,
        });
    };
  };


  return (
    <div className="my-6">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        aria-expanded={isOpen}
        aria-controls="scenario-drawer-content"
      >
        DCF Sensitivity Analysis / Scenario Drawer
        <svg className={`w-5 h-5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {isOpen && (
        <div id="scenario-drawer-content" className="mt-2 p-4 border border-indigo-200 rounded-md bg-white shadow">
          <p className="text-sm text-gray-600 mb-3">Adjust these key assumptions to see their impact on the DCF Value. These changes are temporary for sensitivity analysis.</p>
          <div className="grid md:grid-cols-3 gap-4">
            <SliderInput
              id="scenarioDiscountRate"
              label="Scenario Discount Rate"
              min={3} max={20} step={0.1}
              value={tempDiscountRate}
              onValueChange={createSliderHandler(setTempDiscountRate, 'discountRate')}
              displayFormatter={formatPercentage}
            />
            <SliderInput
              id="scenarioExitCapRate"
              label="Scenario Exit Cap Rate"
              min={3} max={15} step={0.1}
              value={tempExitCapRate}
              onValueChange={createSliderHandler(setTempExitCapRate, 'exitCapRate')}
              displayFormatter={formatPercentage}
            />
            <SliderInput
              id="scenarioRentGrowth"
              label="Scenario Rent Growth (Global)"
              min={-5} max={10} step={0.1}
              value={tempRentGrowth}
              onValueChange={createSliderHandler(setTempRentGrowth, 'rentGrowth')}
              displayFormatter={formatPercentage}
            />
          </div>
          <div className="mt-4 flex justify-end space-x-3">
            <button 
                type="button" 
                onClick={handleResetScenario}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                Reset to Base Assumptions
            </button>
            {/* Apply button is effectively removed as sliders propagate changes immediately */}
          </div>
          {scenarioDcfResults && (
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded text-center">
              <p className="text-sm text-indigo-700">
                Base DCF Value: <span className="font-semibold">{formatCurrency(baseDcfValue)}</span>
              </p>
              <p className="text-lg text-indigo-800 font-bold">
                Scenario DCF Value: {formatCurrency(scenarioDcfResults.dcfValue)}
              </p>
              <p className="text-sm text-indigo-700">
                (Scenario IRR: {formatPercentage(scenarioDcfResults.internalRateOfReturn)})
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScenarioDrawer;
