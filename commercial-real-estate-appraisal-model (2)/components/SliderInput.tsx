
import React, { useState, useEffect, ChangeEvent } from 'react';

interface SliderInputProps {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (newValue: number) => void;
  displayFormatter: (value: number) => string;
  tooltip?: string;
}

const SliderInput: React.FC<SliderInputProps> = ({
  id,
  label,
  min,
  max,
  step,
  value,
  onValueChange,
  displayFormatter,
  tooltip,
}) => {
  const [inputValue, setInputValue] = useState<string>(value.toString());

  useEffect(() => {
    // Update internal input value when the prop 'value' changes (e.g. from external state update)
    // Format to a reasonable number of decimal places if step is a float
    const stepDecimalPlaces = step.toString().split('.')[1]?.length || 0;
    const fixedValue = value.toFixed(stepDecimalPlaces);
    if (parseFloat(fixedValue) !== parseFloat(inputValue) || isNaN(parseFloat(inputValue))) {
         setInputValue(fixedValue);
    }
  }, [value, step]);

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value);
    onValueChange(newValue);
    // setInputValue(newValue.toString()); // Directly handled by useEffect now
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    // Allow user to type, validate on blur or enter
  };
  
  const handleInputBlur = () => {
    let numericValue = parseFloat(inputValue);
    if (isNaN(numericValue)) {
      numericValue = value; // Reset to current prop value if input is not a number
    } else {
      if (numericValue < min) numericValue = min;
      if (numericValue > max) numericValue = max;
    }
     // Format to a reasonable number of decimal places if step is a float
    const stepDecimalPlaces = step.toString().split('.')[1]?.length || 0;
    const fixedValue = numericValue.toFixed(stepDecimalPlaces);
    
    onValueChange(parseFloat(fixedValue));
    setInputValue(fixedValue);
  };

  const handleInputKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleInputBlur();
      (event.target as HTMLInputElement).blur(); // Remove focus
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={id} title={tooltip}>
        {label} {tooltip && <span className="text-blue-500">(?)</span>}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          id={id}
          name={id}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          className="w-2/3 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          aria-label={label}
        />
        <input
            type="number"
            id={`${id}-number`}
            name={`${id}-number`}
            value={inputValue}
            min={min}
            max={max}
            step={step}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyPress={handleInputKeyPress}
            className="w-1/3 p-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-right"
            aria-label={`${label} numeric value`}
        />
        {/* Display formatted value is implicitly shown in the number input now, 
            but could be added separately if precise formatting (like currency) is needed beyond number input capability */}
        {/* <span className="whitespace-nowrap font-medium text-sm text-gray-600 w-28 text-right">
          {displayFormatter(value)}
        </span> */}
      </div>
    </div>
  );
};

export default SliderInput;
