
import React, { useState, useMemo, useCallback, ChangeEvent, useEffect } from 'react';
import { 
  AppraisalInputs, IncomeApproachResults, SalesComparisonResults, CostApproachResults, 
  PropertyRights, TopographyOptions, QualityOptions, ConditionOptions, CostApproachCostType,
  OpexBuckets, ComparableSale, SalesCompAdjustments, AdjustedComparableSale,
  LEEDCertificationLevel, ESGRiskCategory, CreditRating,
  RentRollEntry, CapitalExpenditureEntry, AnnualCashFlow, ReimbursementType, EscalationType,
  DCFResults, // Added for DCF
  SalesCompValueSelectionType
} from './types';
import { 
  formatCurrency, formatPercentage, formatYear, formatMonths, 
  formatBasicNumber, formatAmountPerSF, formatNumberWithCommas 
} from './utils/formatters';
import {
  calcIncomeDirectCap, calcSalesComparison, calcCostApproach, reconcileValues, 
  validateInputs, generateCashFlows // generateCashFlows is the simpler one
} from './utils/model-core';
import { buildFullDCFCashFlows } from './dcf'; // Import DCF engine
import SliderInput from './components/SliderInput';
import ComparableSaleCard from './components/ComparableSaleCard';
import RentRollTable from './components/RentRollTable';
import CapitalExpendituresTable from './components/CapitalExpendituresTable';
// import ProjectedCashFlowsTable from './components/ProjectedCashFlowsTable'; // Old one
import ProjectedCashFlowViewerTable from './components/ProjectedCashFlowsTable'; // New DCF table - Corrected Path
import ScenarioDrawer from './components/ScenarioDrawer'; // For DCF Sensitivity
import { v4 as uuidv4 } from 'uuid';

const initialOpexBuckets: OpexBuckets = {
  taxes: 15000,
  insurance: 5000,
  repairsMaintenance: 10000,
  managementPercentOfEGI: 3, 
  reserves: 3000,
};

const initialSalesCompAdjustments: SalesCompAdjustments = {
  propertyRights: 0, financing: 0, conditionsOfSale: 0, marketTime: 0,
  location: 0, physicalSize: 0, ageCondition: 0, site: 0,
};

const createNewComparable = (): ComparableSale => ({
  id: uuidv4(),
  address: '',
  saleDate: new Date().toISOString().split('T')[0],
  salePrice: 1000000,
  gba: 10000,
  propertyRightsConveyed: 'feeSimple', // Updated to use PropertyRights type
  financingTerms: 'Conventional', // Updated to use FinancingTerms type
  conditionOfSale: 'ArmsLength', // Updated to use ConditionOfSale type
  locationQuality: 'Average', // Updated to use LocationQuality type
  siteUtility: 'Average', // Updated to use SiteUtility type
  adjustments: { ...initialSalesCompAdjustments },
});

const createNewRentRollEntry = (): RentRollEntry => ({
    id: uuidv4(),
    suite: '',
    useType: 'Office', // Valid UseType
    squareFeet: 1000,
    currentRentPerSF: 15,
    leaseStartDate: new Date().toISOString().split('T')[0],
    leaseEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0],
    escalationType: 'fixedPercent', 
    escalationPercent: 2.5,
    escalationDetail: '', // Initialized as empty string
    reimbursementType: 'nnn',
    renewalProbabilityPercent: 75,
    renewTermYears: 5, // DCF field
    renewRentBumpPercent: 5, // DCF field
    renewalDowntimeMonths: 3,
    renewalMarketRentPerSF: 18,
    renewalTiPerSF: 10,
    renewalLcPercentOfFirstYearRent: 6,
});

const createNewCapExEntry = (): CapitalExpenditureEntry => ({
    id: uuidv4(),
    year: 1,
    description: '',
    amount: 5000,
});


const initialInputs: AppraisalInputs = {
  // Assignment Details
  effectiveDate: new Date().toISOString().split('T')[0],
  reportDate: new Date().toISOString().split('T')[0],
  intendedUse: 'For internal valuation purposes.',
  intendedUsers: 'Client XYZ',
  propertyRightsAppraised: 'feeSimple',
  isExtraordinaryAssumption: false,
  extraordinaryAssumptionDetail: '',
  isHypotheticalCondition: false,
  hypotheticalConditionDetail: '',

  // Site Characteristics
  topography: 'level',
  landShapeDescription: 'Rectangular, 150ft frontage, 200ft depth, Good utility.',
  accessFrontageFeet: 150,
  accessCurbCuts: 2,
  accessIngressEgressNotes: 'Good access from Main Street.',
  utilities: { water: true, sewer: true, gas: true, electric: true, telecom: true },

  // Improvement Details
  gba: 20000,
  rentableSF: 18000,
  usableSF: 17000,
  actualAge: 15,
  effectiveAge: 10,
  quality: 'B',
  condition: 'good',
  highestBestUse: {
    physicallyPossible: true,
    legallyPermissible: true,
    financiallyFeasible: true,
    maximallyProductive: true,
    narrative: 'Continued use as a commercial office building.',
  },

  // Income Approach Inputs (Summary)
  grossPotentialIncome: 250000, 
  vacancyLossPercent: 7, 
  creditCollectionLossPercent: 2, 
  operatingExpensesBuckets: initialOpexBuckets,
  capRateIncome: 7.5,
  marketRentPerSF: 15, 
  inPlaceRentPerSF: 14,

  // Cash Flow Projection / DCF Assumptions
  projectionYears: 10,
  globalMarketRentGrowthPercent: 2.5,
  globalExpenseInflationPercent: 2.0,
  generalVacancyRatePercentForProjections: 5, 
  discountRatePercent: 8.5,
  exitCapRate: 7.75, // Also used by DCF
  saleCostPercent: 3, // DCF: Cost to sell property

  // Rent Roll
  rentRoll: [createNewRentRollEntry(), createNewRentRollEntry()],

  // Capital Expenditures
  capitalExpenditures: [createNewCapExEntry()],
  
  opexVolatilityPercent: 5, 
  propertyTaxAppealProbability: 10,

  // Sales Comparison Inputs
  salesComparables: [createNewComparable(), createNewComparable(), createNewComparable()],
  annualMarketConditionsAdjustmentPercent: 2.0,
  salesCompValueSelection: 'average', // New
  salesCompCustomValue: 0, // New


  // Cost Approach Inputs
  landValue: 500000,
  costType: 'replacement',
  improvementCostNew: 1500000,
  economicLife: 50,
  annualCostIndexEscalationPercent: 2.5,

  // Reconciliation & Data Sources
  incomeApproachWeight: 40,
  salesApproachWeight: 40,
  costApproachWeight: 20,
  dataSourceDisclosure: 'Market data sourced from CoStar, MLS, and public records.',
  reconciliationNarrative: 'Income and Sales approaches given most weight due to nature of property and available data. Cost approach provides a supportive role.',

  // ESG 
  leedCertification: 'none',
  energyStarScore: 75,
  energyUseIntensity: 55, 
  scope1CarbonEmissions: 100, 
  esgRiskCategory: 'none',
  esgRiskDetail: '',

  // Climate-resilience
  femaFloodHazardClass: 'X', // Valid FemaFloodZone
  seaLevelRise2050ScenarioAffected: false,
  wildFireRiskIndex: 1, 
  hurricaneRiskIndex: 1, 
  heatStressRiskIndex: 1, 

  // Tenant / lease-risk (summary)
  weightedAverageLeaseTerm: 5, 
  anchorTenantCreditRating: 'NA',
  hasCoTenancyClause: false,
  annualRolloverSchedule: Array(10).fill(10), 

  // Lease-structure (summary)
  expenseStopPerSF: 0,
  percentageRentBreakpoint: 0,
  percentageRentOveragePercent: 0,
  freeRentMonths: 0,
  tiAllowancePerSF: 20,
  lcAllowancePerSF: 5,

  // Rollover & re-letting (summary)
  downtimeBetweenLeasesMonths: 3,
  relettingCostPercentOfRent: 15,

  // Market-derived capital
  // exitCapRate moved to DCF assumptions
  targetUnleveredIRR: 10, 
  dcrThreshold: 1.25,
};


interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="mb-6 bg-white shadow-lg rounded-lg transform hover:scale-101 transition-transform duration-300">
      <button
        type="button"
        className="w-full flex justify-between items-center p-4 bg-gray-100 hover:bg-gray-200 focus:outline-none rounded-t-lg"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
        <svg className={`w-6 h-6 text-gray-600 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {isOpen && (
        <div id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`} className="p-5 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
};


const App: React.FC = () => {
  const [inputs, setInputs] = useState<AppraisalInputs>(initialInputs);
  const [weightsSumError, setWeightsSumError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [scenarioOverrides, setScenarioOverrides] = useState<{
    discountRate?: number;
    exitCapRate?: number;
    rentGrowth?: number;
  } | null>(null);

const NUMERIC_FIELDS_REQUIRING_NUMBER: (keyof AppraisalInputs)[] = [
    'accessFrontageFeet', 'accessCurbCuts', 'gba', 'rentableSF', 'usableSF', 'actualAge', 'effectiveAge',
    'grossPotentialIncome', 'vacancyLossPercent', 'creditCollectionLossPercent', 'capRateIncome',
    'marketRentPerSF', 'inPlaceRentPerSF', 'opexVolatilityPercent', 'propertyTaxAppealProbability',
    'annualMarketConditionsAdjustmentPercent', 'landValue', 'improvementCostNew', 'economicLife',
    'annualCostIndexEscalationPercent', 'incomeApproachWeight', 'salesApproachWeight', 'costApproachWeight',
    'energyStarScore', 'energyUseIntensity', 'scope1CarbonEmissions', 'wildFireRiskIndex',
    'hurricaneRiskIndex', 'heatStressRiskIndex', 'weightedAverageLeaseTerm', 'expenseStopPerSF',
    'percentageRentBreakpoint', 'percentageRentOveragePercent', 'freeRentMonths',
    'tiAllowancePerSF', 'lcAllowancePerSF', 'downtimeBetweenLeasesMonths', 'relettingCostPercentOfRent',
    'exitCapRate', 'targetUnleveredIRR', 'dcrThreshold', 'saleCostPercent',
    'projectionYears', 'globalMarketRentGrowthPercent', 'globalExpenseInflationPercent',
    'generalVacancyRatePercentForProjections', 'discountRatePercent',
    'salesCompCustomValue'
];

  const handleInputChange = useCallback(<F extends keyof AppraisalInputs>(field: F, value: AppraisalInputs[F]) => {
    let processedValue = value;

    if (NUMERIC_FIELDS_REQUIRING_NUMBER.includes(field as any)) {
        if (typeof value === 'string') {
            const trimmedValue = value.trim();
            if (trimmedValue === '' || trimmedValue === '-') {
                processedValue = value as any; // Keep as is for typing
            } else {
                const parsed = parseFloat(trimmedValue);
                processedValue = isNaN(parsed) ? 0 : parsed as any;
            }
        } else if (typeof value === 'number' && isNaN(value)) {
            processedValue = 0 as AppraisalInputs[F];
        }
    }
    
    setInputs(prev => ({ ...prev, [field]: processedValue }));
  }, []);

  const handleInputBlur = <F extends keyof AppraisalInputs>(field: F) => {
    const value = inputs[field];
    if (NUMERIC_FIELDS_REQUIRING_NUMBER.includes(field as any) && typeof value === 'string') {
        const numericValue = parseFloat(value.trim());
        setInputs(prev => ({ ...prev, [field]: isNaN(numericValue) ? 0 : numericValue }));
    }

    // Specific validation warnings on blur
    // TODO: Consider implementing a more user-friendly notification system (e.g., toast messages or inline field errors)
    if (field === 'discountRatePercent') {
        const rate = typeof inputs.discountRatePercent === 'number' ? inputs.discountRatePercent : parseFloat(inputs.discountRatePercent as string);
        if (rate < 2 || rate > 20) {
            console.warn(`Warning: Discount Rate (${rate}%) is outside typical range (2% - 20%).`);
        }
    }
    if (field === 'exitCapRate') {
        const rate = typeof inputs.exitCapRate === 'number' ? inputs.exitCapRate : parseFloat(inputs.exitCapRate as string);
         if (rate < 2 || rate > 12) {
            console.warn(`Warning: Exit Cap Rate (${rate}%) is outside typical range (2% - 12%).`);
        }
    }
  };


  const handleNestedInputChange = useCallback(<
    K extends { [P in keyof AppraisalInputs]: AppraisalInputs[P] extends Record<string, any> ? P : never }[keyof AppraisalInputs],
    NK extends keyof AppraisalInputs[K]
  >(
    field: K,
    nestedField: NK,
    value: AppraisalInputs[K][NK]
  ) => {
    setInputs(prev => ({
      ...prev,
      [field]: {
        ...(prev[field] as object), 
        [nestedField]: value,
      },
    }));
  }, []);
  
  const handleUtilityChange = useCallback((utility: keyof AppraisalInputs['utilities'], value: boolean) => {
    handleNestedInputChange('utilities', utility, value);
  }, [handleNestedInputChange]);

  const handleHighestBestUseChange = useCallback((field: keyof AppraisalInputs['highestBestUse'], value: any) => {
     handleNestedInputChange('highestBestUse', field, value);
  }, [handleNestedInputChange]);
  
  const handleOpexChange = useCallback((opexField: keyof OpexBuckets, value: string) => {
    const numericValue = parseFloat(value);
    const valToSet = isNaN(numericValue) ? (value.trim() === '' ? inputs.operatingExpensesBuckets[opexField] : 0) : numericValue;
    setInputs(prev => ({
      ...prev,
      operatingExpensesBuckets: { ...prev.operatingExpensesBuckets, [opexField]: valToSet }
    }));
  }, [inputs.operatingExpensesBuckets]);

  // Rent Roll Handlers
  const handleRentRollChange = useCallback((updatedRentRoll: RentRollEntry[]) => {
    setInputs(prev => ({ ...prev, rentRoll: updatedRentRoll }));
  }, []);
  const addRentRollEntry = useCallback(() => {
    setInputs(prev => ({ ...prev, rentRoll: [...prev.rentRoll, createNewRentRollEntry()] }));
  }, []);
  const removeRentRollEntry = useCallback((id: string) => {
    setInputs(prev => ({ ...prev, rentRoll: prev.rentRoll.filter(entry => entry.id !== id) }));
  }, []);

  // CapEx Handlers
  const handleCapExChange = useCallback((updatedCapEx: CapitalExpenditureEntry[]) => {
    setInputs(prev => ({ ...prev, capitalExpenditures: updatedCapEx }));
  }, []);
  const addCapExEntry = useCallback(() => {
    setInputs(prev => ({ ...prev, capitalExpenditures: [...prev.capitalExpenditures, createNewCapExEntry()] }));
  }, []);
  const removeCapExEntry = useCallback((id: string) => {
    setInputs(prev => ({ ...prev, capitalExpenditures: prev.capitalExpenditures.filter(entry => entry.id !== id) }));
  }, []);


  const handleAddComparable = useCallback(() => {
    setInputs(prev => ({
      ...prev,
      salesComparables: [...prev.salesComparables, createNewComparable()]
    }));
  }, []);

  const handleRemoveComparable = useCallback((index: number) => {
    if (inputs.salesComparables.length <= 1) { 
        alert("At least one comparable sale is required."); // TODO: Consider replacing alert with a less intrusive UI notification.
        return;
    }
    setInputs(prev => ({
      ...prev,
      salesComparables: prev.salesComparables.filter((_, i) => i !== index)
    }));
  }, [inputs.salesComparables.length]);

  const handleComparableChange = useCallback((index: number, updatedComp: ComparableSale) => {
    setInputs(prev => {
      const newComps = [...prev.salesComparables];
      newComps[index] = updatedComp;
      return { ...prev, salesComparables: newComps };
    });
  }, []);

  const handleRolloverScheduleChange = useCallback((index: number, value: string) => {
    const trimmedValue = value.trim();
    let valToSet: number;

    if (trimmedValue === '') {
      valToSet = 0; // Default to 0 if empty
    } else {
      const numericValue = parseFloat(trimmedValue);
      if (isNaN(numericValue)) {
        valToSet = 0; // Default to 0 if not a valid number (and not empty)
      } else {
        valToSet = numericValue;
      }
    }
    
    setInputs(prev => {
      const newSchedule = [...prev.annualRolloverSchedule];
      newSchedule[index] = valToSet;
      return { ...prev, annualRolloverSchedule: newSchedule };
    });
  }, []);

  useEffect(() => {
    const errors = validateInputs(inputs);
    setValidationErrors(errors);
  }, [inputs]);

  // Scenario Drawer Handler
  const handleScenarioChange = useCallback((overrides: { discountRate?: number; exitCapRate?: number; rentGrowth?: number } | null) => {
    setScenarioOverrides(overrides);
  }, []);


  // Full DCF Calculation
  // These are the primary DCF results for the valuation, incorporating scenario overrides if active.
  // The `buildFullDCFCashFlows` function from `dcf.ts` is the core DCF engine.
  const dcfResults = useMemo<DCFResults | null>(() => {
    // Use scenario overrides if they exist, otherwise use base inputs
    const currentInputs = { ...inputs };
    if (scenarioOverrides?.discountRate !== undefined) currentInputs.discountRatePercent = scenarioOverrides.discountRate;
    if (scenarioOverrides?.exitCapRate !== undefined) currentInputs.exitCapRate = scenarioOverrides.exitCapRate;
    if (scenarioOverrides?.rentGrowth !== undefined) currentInputs.globalMarketRentGrowthPercent = scenarioOverrides.rentGrowth;
    
    if(currentInputs.projectionYears > 0 && currentInputs.rentRoll.length > 0) {
        try {
            return buildFullDCFCashFlows(currentInputs);
        } catch (error) {
            console.error("Error in DCF calculation:", error);
            // Optionally set an error state to display in UI
            return null;
        }
    }
    return null;
  }, [inputs, scenarioOverrides]); // Recalculate when base inputs or scenario overrides change

  const baseDcfValueForScenario = useMemo(() => { // DCF Value with base inputs, for scenario drawer comparison
    if(inputs.projectionYears > 0 && inputs.rentRoll.length > 0) {
        const baseResults = buildFullDCFCashFlows(inputs); // Uses base inputs without overrides
        return baseResults?.dcfValue || 0;
    }
    return 0;
  }, [inputs]);

  // Calculates the Income Approach value using Direct Capitalization.
  // It prioritizes using Year 1 figures (NOI, PGI, etc.) from the `dcfResults` if available and positive.
  // Otherwise, it falls back to calculating these based on the summary-level inputs provided in the UI.
  const incomeApproachResults = useMemo<IncomeApproachResults>(() => {
    const year1DCF = dcfResults?.projectedCashFlowsDCF.find(cf => cf.year === 1);
    return calcIncomeDirectCap(
      {
        rentableSF: inputs.rentableSF,
        marketRentPerSF: inputs.marketRentPerSF,
        grossPotentialIncome: inputs.grossPotentialIncome,
        vacancyLossPercent: inputs.vacancyLossPercent, 
        creditCollectionLossPercent: inputs.creditCollectionLossPercent, 
        capRateIncome: inputs.capRateIncome
      },
      inputs.operatingExpensesBuckets,
      year1DCF?.netOperatingIncome, // Pass Year 1 NOI from full DCF
      year1DCF?.potentialGrossRevenue,
      year1DCF?.generalVacancyLoss,
      year1DCF?.creditLoss,
      year1DCF?.effectiveGrossIncome,
      year1DCF?.operatingExpenses,
      year1DCF ? (year1DCF.effectiveGrossIncome * (inputs.operatingExpensesBuckets.managementPercentOfEGI / 100)) : undefined
    );
  }, [inputs, dcfResults]); // Depends on dcfResults now

  const salesComparisonResults = useMemo<SalesComparisonResults>(() => {
    return calcSalesComparison(
        inputs.salesComparables, 
        inputs.salesCompValueSelection, 
        inputs.salesCompCustomValue
    );
  }, [inputs.salesComparables, inputs.salesCompValueSelection, inputs.salesCompCustomValue]);

  const costApproachResults = useMemo<CostApproachResults>(() => {
    return calcCostApproach({
      effectiveAge: inputs.effectiveAge,
      economicLife: inputs.economicLife,
      improvementCostNew: inputs.improvementCostNew,
      landValue: inputs.landValue
    });
  }, [inputs.effectiveAge, inputs.economicLife, inputs.improvementCostNew, inputs.landValue]);

  useEffect(() => {
    const totalWeight = inputs.incomeApproachWeight + inputs.salesApproachWeight + inputs.costApproachWeight;
    if (Math.abs(totalWeight - 100) > 0.01) { 
      setWeightsSumError(`Total weight must be 100%. Current sum: ${totalWeight.toFixed(1)}%`);
    } else {
      setWeightsSumError(null);
    }
  }, [inputs.incomeApproachWeight, inputs.salesApproachWeight, inputs.costApproachWeight]);

  const reconciledValue = useMemo<number>(() => {
    return reconcileValues(
      incomeApproachResults.incomeApproachValue,
      salesComparisonResults.salesComparisonValue,
      costApproachResults.costApproachValue,
      {
        incomeApproachWeight: inputs.incomeApproachWeight,
        salesApproachWeight: inputs.salesApproachWeight,
        costApproachWeight: inputs.costApproachWeight
      }
    );
  }, [incomeApproachResults.incomeApproachValue, salesComparisonResults.salesComparisonValue, costApproachResults.costApproachValue, inputs.incomeApproachWeight, inputs.salesApproachWeight, inputs.costApproachWeight]);

  const renderStandardInputField = (id: keyof AppraisalInputs, label: string, type: string = "text", props: Record<string, any> = {}, tooltip?: string) => {
    const error = validationErrors[id];
    return (
        <div className="mb-4">
        <label htmlFor={id as string} className="block text-sm font-medium text-gray-700 mb-1" title={tooltip}>
            {label} {tooltip && <span className="text-blue-500">(?)</span>}
        </label>
        <input
            type={type}
            id={id as string}
            name={id as string}
            value={inputs[id as keyof AppraisalInputs] as string | number}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = type === 'number' ? parseFloat(e.target.value) : e.target.value;
                handleInputChange(id as keyof AppraisalInputs, value as any);
            }}
            onBlur={() => handleInputBlur(id as keyof AppraisalInputs)}
            className={`mt-1 block w-full p-2 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
            {...props}
            aria-label={label}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
  };
  
  const renderOpexInputField = (id: keyof OpexBuckets, label: string, isPercentage: boolean = false, tooltip?: string) => {
    const error = validationErrors[`opex-${id}`];
    return (
      <div className="mb-4">
        <label htmlFor={`opex-${id}`} className="block text-sm font-medium text-gray-700 mb-1" title={tooltip}>
          {label} {isPercentage ? `(% EGI)` : '($)'} {tooltip && <span className="text-blue-500">(?)</span>}
        </label>
        <input
          type="number"
          id={`opex-${id}`}
          name={id}
          value={inputs.operatingExpensesBuckets[id]}
          onChange={(e) => handleOpexChange(id, e.target.value)}
          onBlur={() => { // Finalize numeric value on blur
             const numericValue = parseFloat(inputs.operatingExpensesBuckets[id] as any);
             handleOpexChange(id, isNaN(numericValue) ? '0' : numericValue.toString());
          }}
          min="0"
          step={isPercentage ? "0.1" : "100"}
          max={isPercentage ? "100" : undefined}
          className={`mt-1 block w-full p-2 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
          aria-label={label}
          aria-invalid={!!error}
          aria-describedby={error ? `opex-${id}-error` : undefined}
        />
        {error && <p id={`opex-${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  };

  const renderTextareaField = (id: keyof AppraisalInputs, label: string, rows: number = 3, tooltip?: string) => {
    const error = validationErrors[id];
    return (
        <div className="mb-4">
        <label htmlFor={id as string} className="block text-sm font-medium text-gray-700 mb-1" title={tooltip}>{label} {tooltip && <span className="text-blue-500">(?)</span>}</label>
        <textarea 
            id={id as string} 
            name={id as string} 
            value={inputs[id] as string} 
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleInputChange(id, e.target.value)} 
            rows={rows} 
            className={`mt-1 block w-full p-2 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`} 
            aria-label={label}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
  };

  const renderSelectField = (id: keyof AppraisalInputs, label: string, options: {value: string; label: string}[], tooltip?: string) => {
    const error = validationErrors[id];
    return (
        <div className="mb-4">
        <label htmlFor={id as string} className="block text-sm font-medium text-gray-700 mb-1" title={tooltip}>{label} {tooltip && <span className="text-blue-500">(?)</span>}</label>
        <select 
            id={id as string} 
            name={id as string} 
            value={inputs[id] as string} 
            onChange={(e: ChangeEvent<HTMLSelectElement>) => handleInputChange(id, e.target.value as any)} 
            className={`mt-1 block w-full p-2 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`} 
            aria-label={label}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
        >
            <option value="">Select...</option>
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
  };

  const renderCheckboxField = (id: keyof AppraisalInputs, label: string, tooltip?: string) => (
    <div className="flex items-center mb-4">
      <input type="checkbox" id={id as string} name={id as string} checked={inputs[id] as boolean} onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange(id, e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" aria-label={label}/>
      <label htmlFor={id as string} className="ml-2 block text-sm text-gray-900" title={tooltip}>{label} {tooltip && <span className="text-blue-500">(?)</span>}</label>
    </div>
  );
  
  const propertyRightsOptions: { value: PropertyRights; label: string }[] = [ { value: 'feeSimple', label: 'Fee Simple' }, { value: 'leasedFee', label: 'Leased Fee' }, { value: 'leasehold', label: 'Leasehold' }];
  const topographyOptions: { value: TopographyOptions; label: string }[] = [ { value: 'level', label: 'Level' }, { value: 'sloping', label: 'Sloping' }, { value: 'hilly', label: 'Hilly' }];
  const qualityOptions: { value: QualityOptions; label: string }[] = [ { value: 'A', label: 'Class A' }, { value: 'B', label: 'Class B' }, { value: 'C', label: 'Class C' }];
  const conditionOptions: { value: ConditionOptions; label: string }[] = [ { value: 'excellent', label: 'Excellent' }, { value: 'good', label: 'Good' }, { value: 'average', label: 'Average' }, { value: 'fair', label: 'Fair' }, { value: 'poor', label: 'Poor' }];
  const costTypeOptions: { value: CostApproachCostType; label: string }[] = [ { value: 'replacement', label: 'Replacement Cost New' }, { value: 'reproduction', label: 'Reproduction Cost New' }];

  const leedCertificationOptions: { value: LEEDCertificationLevel; label: string }[] = [ { value: 'none', label: 'None' }, { value: 'certified', label: 'Certified' }, { value: 'silver', label: 'Silver' }, { value: 'gold', label: 'Gold' }, { value: 'platinum', label: 'Platinum' }];
  const esgRiskCategoryOptions: { value: ESGRiskCategory; label: string }[] = [ { value: 'none', label: 'None' }, { value: 'environmental', label: 'Environmental Hazard' }, { value: 'social', label: 'Social Conflict' }, { value: 'governance', label: 'Governance Concern' }];
  const creditRatingOptions: { value: CreditRating; label: string }[] = [ { value: 'AAA', label: 'AAA' }, { value: 'AA', label: 'AA' }, { value: 'A', label: 'A' }, { value: 'BBB', label: 'BBB' }, { value: 'BB', label: 'BB' }, { value: 'B', label: 'B' }, { value: 'CCC', label: 'CCC' }, { value: 'CC', label: 'CC' }, { value: 'C', label: 'C' }, { value: 'D', label: 'D' }, { value: 'NA', label: 'Not Applicable / Not Rated' } ];

  const salesCompValueSelectionOptions: { value: SalesCompValueSelectionType; label: string }[] = [
    { value: 'average', label: 'Average of Adjusted Comps' },
    { value: 'median', label: 'Median of Adjusted Comps' },
    { value: 'custom', label: 'Custom Value' },
  ];

  return (
    <div className="font-sans leading-normal tracking-normal flex flex-col min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-700 to-indigo-800 shadow-lg">
        <div className="container mx-auto py-6 px-4"><h1 className="text-4xl font-bold text-white text-center">Commercial Real Estate Appraisal Model</h1></div>
      </header>
      
      <main className="container mx-auto p-4 md:p-6 flex-grow flex flex-col overflow-hidden">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 h-full">
          {/* Input Panel - Left Column */}
          <div className="md:w-2/5 h-full overflow-y-auto space-y-6 pr-3 md:pr-4">
            <CollapsibleSection title="Assignment Details" defaultOpen={true}>
              {renderStandardInputField('effectiveDate', 'Effective Date of Valuation', 'date')}
              {renderStandardInputField('reportDate', 'Date of Report', 'date')}
              {renderTextareaField('intendedUse', 'Intended Use')}
              {renderTextareaField('intendedUsers', 'Intended User(s)')}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Rights Appraised</label>
                {propertyRightsOptions.map(opt => (
                  <div key={opt.value} className="flex items-center mb-1">
                    <input type="radio" id={`propRights-${opt.value}`} name="propertyRightsAppraised" value={opt.value} checked={inputs.propertyRightsAppraised === opt.value} onChange={(e) => handleInputChange('propertyRightsAppraised', e.target.value as PropertyRights)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/>
                    <label htmlFor={`propRights-${opt.value}`} className="ml-2 block text-sm text-gray-900">{opt.label}</label>
                  </div>
                ))}
                {validationErrors.propertyRightsAppraised && <p className="mt-1 text-xs text-red-600">{validationErrors.propertyRightsAppraised}</p>}
              </div>
              {renderCheckboxField('isExtraordinaryAssumption', 'Extraordinary Assumption?')}
              {inputs.isExtraordinaryAssumption && renderTextareaField('extraordinaryAssumptionDetail', 'Extraordinary Assumption Detail')}
              {renderCheckboxField('isHypotheticalCondition', 'Hypothetical Condition?')}
              {inputs.isHypotheticalCondition && renderTextareaField('hypotheticalConditionDetail', 'Hypothetical Condition Detail')}
            </CollapsibleSection>

            <CollapsibleSection title="Site Characteristics">
              {renderSelectField('topography', 'Topography', topographyOptions)}
              {renderTextareaField('landShapeDescription', 'Land Shape (Frontage, Depth, Shape Rating)')}
              <SliderInput id="accessFrontageFeet" label="Access: Frontage (ft)" min={0} max={1000} step={10} value={inputs.accessFrontageFeet} onValueChange={(val) => handleInputChange('accessFrontageFeet', val)} displayFormatter={(v) => formatBasicNumber(v,0) + " ft"} />
              {validationErrors.accessFrontageFeet && <p className="mt-1 text-xs text-red-600">{validationErrors.accessFrontageFeet}</p>}
              <SliderInput id="accessCurbCuts" label="Access: Curb Cut Count" min={0} max={10} step={1} value={inputs.accessCurbCuts} onValueChange={(val) => handleInputChange('accessCurbCuts', val)} displayFormatter={(v) => formatBasicNumber(v,0)} />
              {validationErrors.accessCurbCuts && <p className="mt-1 text-xs text-red-600">{validationErrors.accessCurbCuts}</p>}
              {renderTextareaField('accessIngressEgressNotes', 'Access: Ingress/Egress Notes')}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Utilities Available</label>
                {(Object.keys(inputs.utilities) as Array<keyof AppraisalInputs['utilities']>).map(key => (
                  <div key={key} className="flex items-center mb-1">
                    <input type="checkbox" id={`utility-${key}`} checked={inputs.utilities[key]} onChange={(e) => handleUtilityChange(key, e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                    <label htmlFor={`utility-${key}`} className="ml-2 block text-sm text-gray-900 capitalize">{key}</label>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Improvement Details">
              <SliderInput id="gba" label="Gross Building Area (GBA)" min={0} max={1000000} step={100} value={inputs.gba} onValueChange={(val) => handleInputChange('gba', val)} displayFormatter={formatNumberWithCommas} tooltip="Total floor area of a building." />
              {validationErrors.gba && <p className="mt-1 text-xs text-red-600">{validationErrors.gba}</p>}
              <SliderInput id="rentableSF" label="Rentable Square Feet" min={0} max={1000000} step={100} value={inputs.rentableSF} onValueChange={(val) => handleInputChange('rentableSF', val)} displayFormatter={formatNumberWithCommas} tooltip="Total area that can be leased." />
              {validationErrors.rentableSF && <p className="mt-1 text-xs text-red-600">{validationErrors.rentableSF}</p>}
              <SliderInput id="usableSF" label="Usable Square Feet" min={0} max={1000000} step={100} value={inputs.usableSF} onValueChange={(val) => handleInputChange('usableSF', val)} displayFormatter={formatNumberWithCommas} />
              {validationErrors.usableSF && <p className="mt-1 text-xs text-red-600">{validationErrors.usableSF}</p>}
              <SliderInput id="actualAge" label="Actual Age (Years)" min={0} max={100} step={1} value={inputs.actualAge} onValueChange={(val) => handleInputChange('actualAge', val)} displayFormatter={formatYear} />
              {validationErrors.actualAge && <p className="mt-1 text-xs text-red-600">{validationErrors.actualAge}</p>}
              <SliderInput id="effectiveAge" label="Effective Age (Years)" min={0} max={100} step={1} value={inputs.effectiveAge} onValueChange={(val) => handleInputChange('effectiveAge', val)} displayFormatter={formatYear} tooltip="Age indicated by condition and utility." />
              {validationErrors.effectiveAge && <p className="mt-1 text-xs text-red-600">{validationErrors.effectiveAge}</p>}
              {renderSelectField('quality', 'Quality', qualityOptions)}
              {renderSelectField('condition', 'Condition', conditionOptions)}
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-md font-semibold text-gray-700 mb-2">Highest & Best Use</h4>
                {(Object.keys(inputs.highestBestUse) as Array<keyof AppraisalInputs['highestBestUse']>)
                  .filter(key => key !== 'narrative').map(key => (
                  <div key={key} className="flex items-center mb-1">
                    <input type="checkbox" id={`hbu-${key}`} checked={inputs.highestBestUse[key as Exclude<keyof AppraisalInputs['highestBestUse'], 'narrative'>]} onChange={(e) => handleHighestBestUseChange(key as Exclude<keyof AppraisalInputs['highestBestUse'], 'narrative'>, e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                    <label htmlFor={`hbu-${key}`} className="ml-2 block text-sm text-gray-900 capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                  </div>
                ))}
                <div className="mt-2 mb-4">
                    <label htmlFor="hbu-narrative" className="block text-sm font-medium text-gray-700 mb-1">H&amp;BU Narrative</label>
                    <textarea id="hbu-narrative" name="narrative" value={inputs.highestBestUse.narrative} onChange={(e) => handleHighestBestUseChange('narrative', e.target.value)} rows={3} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" aria-label="Highest & Best Use Narrative"/>
                    {validationErrors['highestBestUse.narrative'] && <p className="mt-1 text-xs text-red-600">{validationErrors['highestBestUse.narrative']}</p>}
                </div>
              </div>
            </CollapsibleSection>
            
            <CollapsibleSection title="DCF & Cash Flow Assumptions" defaultOpen={true}>
                <SliderInput id="projectionYears" label="Projection / Analysis Years" min={1} max={30} step={1} value={inputs.projectionYears} onValueChange={(val) => handleInputChange('projectionYears', val)} displayFormatter={formatYear} tooltip="Number of years for detailed cash flow projection." />
                {validationErrors.projectionYears && <p className="mt-1 text-xs text-red-600">{validationErrors.projectionYears}</p>}
                <SliderInput id="discountRatePercent" label="Discount Rate (%)" min={3} max={20} step={0.1} value={inputs.discountRatePercent} onValueChange={(val) => {handleInputChange('discountRatePercent', val); handleInputBlur('discountRatePercent');}} displayFormatter={formatPercentage} tooltip="Rate used for discounting future cash flows to Present Value." />
                {validationErrors.discountRatePercent && <p className="mt-1 text-xs text-red-600">{validationErrors.discountRatePercent}</p>}
                <SliderInput id="exitCapRate" label="Exit (Terminal) Cap Rate (%)" min={3} max={15} step={0.1} value={inputs.exitCapRate} onValueChange={(val) => {handleInputChange('exitCapRate', val); handleInputBlur('exitCapRate');}} displayFormatter={formatPercentage} tooltip="Cap rate assumed at end of holding period for DCF." />
                {validationErrors.exitCapRate && <p className="mt-1 text-xs text-red-600">{validationErrors.exitCapRate}</p>}
                 <SliderInput id="saleCostPercent" label="Sale Cost (%)" min={0} max={15} step={0.1} value={inputs.saleCostPercent} onValueChange={(val) => handleInputChange('saleCostPercent', val)} displayFormatter={formatPercentage} tooltip="Costs associated with selling the property at terminal (e.g., commissions)." />
                {validationErrors.saleCostPercent && <p className="mt-1 text-xs text-red-600">{validationErrors.saleCostPercent}</p>}

                <h4 className="text-md font-semibold text-gray-700 mb-2 mt-4 pt-3 border-t">Growth & Inflation (Annual)</h4>
                <SliderInput id="globalMarketRentGrowthPercent" label="Global Market Rent Growth (%)" min={-5} max={10} step={0.1} value={inputs.globalMarketRentGrowthPercent} onValueChange={(val) => handleInputChange('globalMarketRentGrowthPercent', val)} displayFormatter={formatPercentage} tooltip="Annual growth rate for market rents (new/renewal leases)." />
                {validationErrors.globalMarketRentGrowthPercent && <p className="mt-1 text-xs text-red-600">{validationErrors.globalMarketRentGrowthPercent}</p>}
                <SliderInput id="globalExpenseInflationPercent" label="Global Expense Inflation (%)" min={-5} max={10} step={0.1} value={inputs.globalExpenseInflationPercent} onValueChange={(val) => handleInputChange('globalExpenseInflationPercent', val)} displayFormatter={formatPercentage} tooltip="Annual inflation rate for operating expenses." />
                {validationErrors.globalExpenseInflationPercent && <p className="mt-1 text-xs text-red-600">{validationErrors.globalExpenseInflationPercent}</p>}
                
                <h4 className="text-md font-semibold text-gray-700 mb-2 mt-4 pt-3 border-t">Vacancy & Credit Loss (for Projections)</h4>
                <SliderInput id="generalVacancyRatePercentForProjections" label="General Vacancy Rate for Projections (%)" min={0} max={50} step={0.5} value={inputs.generalVacancyRatePercentForProjections} onValueChange={(val) => handleInputChange('generalVacancyRatePercentForProjections', val)} displayFormatter={formatPercentage} tooltip="Vacancy applied to overall potential income in projections." />
                {validationErrors.generalVacancyRatePercentForProjections && <p className="mt-1 text-xs text-red-600">{validationErrors.generalVacancyRatePercentForProjections}</p>}
                 {/* Credit Collection Loss Percent from summary inputs is used for projections too */}
                 <p className="text-xs text-gray-500 mt-1">Credit & Collection Loss for projections uses the summary input: {formatPercentage(inputs.creditCollectionLossPercent)}</p>
            </CollapsibleSection>

            <CollapsibleSection title="Rent Roll Details">
                <RentRollTable 
                    rentRoll={inputs.rentRoll} 
                    onRentRollChange={handleRentRollChange}
                    addRentRollEntry={addRentRollEntry}
                    removeRentRollEntry={removeRentRollEntry}
                    validationErrors={validationErrors}
                />
                 {validationErrors.rentRoll && <p className="mt-1 text-xs text-red-600">{validationErrors.rentRoll}</p>}
            </CollapsibleSection>

            <CollapsibleSection title="Capital Expenditures">
                <CapitalExpendituresTable
                    capitalExpenditures={inputs.capitalExpenditures}
                    onCapitalExpendituresChange={handleCapExChange}
                    addCapExEntry={addCapExEntry}
                    removeCapExEntry={removeCapExEntry}
                    validationErrors={validationErrors}
                />
            </CollapsibleSection>


            <CollapsibleSection title="Income Approach Inputs (Summary / Direct Cap)">
              <p className="text-xs text-gray-500 mb-2">These inputs are used for a simple direct capitalization. If a detailed DCF projection is active, Year 1 NOI from that projection will override the NOI calculated from these summary inputs.</p>
              <SliderInput id="grossPotentialIncome" label="Gross Potential Income ($) - Summary" min={10000} max={5000000} step={10000} value={inputs.grossPotentialIncome} onValueChange={(val) => handleInputChange('grossPotentialIncome', val)} displayFormatter={formatCurrency} tooltip="Summary GPI. Overridden if Rentable SF & Market Rent/SF are provided, or by Y1 CF projection." />
              {validationErrors.grossPotentialIncome && <p className="mt-1 text-xs text-red-600">{validationErrors.grossPotentialIncome}</p>}
              <SliderInput id="vacancyLossPercent" label="Vacancy Loss (%) - Summary" min={0} max={50} step={0.5} value={inputs.vacancyLossPercent} onValueChange={(val) => handleInputChange('vacancyLossPercent', val)} displayFormatter={formatPercentage} />
              {validationErrors.vacancyLossPercent && <p className="mt-1 text-xs text-red-600">{validationErrors.vacancyLossPercent}</p>}
              <SliderInput id="creditCollectionLossPercent" label="Credit & Collection Loss (%) - Summary & Proj." min={0} max={25} step={0.5} value={inputs.creditCollectionLossPercent} onValueChange={(val) => handleInputChange('creditCollectionLossPercent', val)} displayFormatter={formatPercentage} tooltip="Applied in summary direct cap and DCF projections." />
              {validationErrors.creditCollectionLossPercent && <p className="mt-1 text-xs text-red-600">{validationErrors.creditCollectionLossPercent}</p>}
              
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-md font-semibold text-gray-700 mb-2">Operating Expenses (Base Year for DCF & Direct Cap)</h4>
                {renderOpexInputField('taxes', 'Taxes')}
                {renderOpexInputField('insurance', 'Insurance')}
                {renderOpexInputField('repairsMaintenance', 'Repairs & Maintenance')}
                {renderOpexInputField('managementPercentOfEGI', 'Management Fee', true, "Base year % of EGI. Applied to EGI in DCF and Direct Cap.")}
                {renderOpexInputField('reserves', 'Reserves for Replacement')}
              </div>
              
              <SliderInput id="capRateIncome" label="Overall Capitalization Rate (%) - Direct Cap" min={3} max={15} step={0.1} value={inputs.capRateIncome} onValueChange={(val) => handleInputChange('capRateIncome', val)} displayFormatter={formatPercentage} tooltip="NOI / Value. Applied to Year 1 NOI for direct cap method."/>
              {validationErrors.capRateIncome && <p className="mt-1 text-xs text-red-600">{validationErrors.capRateIncome}</p>}
              <SliderInput id="marketRentPerSF" label="Market Rent ($/SF/Year) - Summary" min={0} max={200} step={0.25} value={inputs.marketRentPerSF} onValueChange={(val) => handleInputChange('marketRentPerSF', val)} displayFormatter={formatAmountPerSF} />
              {validationErrors.marketRentPerSF && <p className="mt-1 text-xs text-red-600">{validationErrors.marketRentPerSF}</p>}
              <SliderInput id="inPlaceRentPerSF" label="In-Place Rent ($/SF/Year) - Summary" min={0} max={200} step={0.25} value={inputs.inPlaceRentPerSF} onValueChange={(val) => handleInputChange('inPlaceRentPerSF', val)} displayFormatter={formatAmountPerSF} />
              {validationErrors.inPlaceRentPerSF && <p className="mt-1 text-xs text-red-600">{validationErrors.inPlaceRentPerSF}</p>}
              
              <div className="mt-6 pt-4 border-t">
                 <h4 className="text-md font-semibold text-gray-700 mb-2">Operating Risk Metrics (Summary)</h4>
                <SliderInput id="opexVolatilityPercent" label="OpEx Volatility (%)" min={0} max={50} step={0.1} value={inputs.opexVolatilityPercent} onValueChange={(val) => handleInputChange('opexVolatilityPercent', val)} displayFormatter={formatPercentage} tooltip="Standard deviation of operating expenses, for sensitivity/Monte Carlo." />
                {validationErrors.opexVolatilityPercent && <p className="mt-1 text-xs text-red-600">{validationErrors.opexVolatilityPercent}</p>}
                <SliderInput id="propertyTaxAppealProbability" label="Property Tax Appeal Probability (%)" min={0} max={100} step={1} value={inputs.propertyTaxAppealProbability} onValueChange={(val) => handleInputChange('propertyTaxAppealProbability', val)} displayFormatter={formatPercentage} tooltip="Likelihood of a successful tax appeal." />
                {validationErrors.propertyTaxAppealProbability && <p className="mt-1 text-xs text-red-600">{validationErrors.propertyTaxAppealProbability}</p>}
              </div>
            </CollapsibleSection>
            
             <CollapsibleSection title="ESG & Sustainability">
              {renderSelectField('leedCertification', 'LEED Certification', leedCertificationOptions, "Leadership in Energy and Environmental Design rating.")}
              <SliderInput id="energyStarScore" label="ENERGY STAR Score" min={0} max={100} step={1} value={inputs.energyStarScore} onValueChange={(val) => handleInputChange('energyStarScore', val)} displayFormatter={formatBasicNumber} tooltip="EPA rating for energy efficiency (0-100)." />
              {validationErrors.energyStarScore && <p className="mt-1 text-xs text-red-600">{validationErrors.energyStarScore}</p>}
              <SliderInput id="energyUseIntensity" label="Energy Use Intensity (EUI)" min={0} max={500} step={1} value={inputs.energyUseIntensity} onValueChange={(val) => handleInputChange('energyUseIntensity', val)} displayFormatter={(v)=> v.toFixed(0) + " kBtu/SF/Yr"} tooltip="Energy consumed per square foot per year (kBtu/SF/Yr)." />
              {validationErrors.energyUseIntensity && <p className="mt-1 text-xs text-red-600">{validationErrors.energyUseIntensity}</p>}
              <SliderInput id="scope1CarbonEmissions" label="Scope 1 Carbon Emissions (tCO₂e)" min={0} max={10000} step={10} value={inputs.scope1CarbonEmissions} onValueChange={(val) => handleInputChange('scope1CarbonEmissions', val)} displayFormatter={formatNumberWithCommas} tooltip="Direct GHG emissions (metric tons CO2e/year)." />
              {validationErrors.scope1CarbonEmissions && <p className="mt-1 text-xs text-red-600">{validationErrors.scope1CarbonEmissions}</p>}
              {renderSelectField('esgRiskCategory', 'Overall ESG Risk Category', esgRiskCategoryOptions)}
              {renderTextareaField('esgRiskDetail', 'ESG Risk Detail', 3, "Specific ESG concerns or mitigants.")}
            </CollapsibleSection>

            <CollapsibleSection title="Climate Resilience">
              {renderStandardInputField('femaFloodHazardClass', 'FEMA Flood Hazard Class', 'text', {}, "Official FEMA flood zone designation (e.g., X, A, AE, VE).")}
              {renderCheckboxField('seaLevelRise2050ScenarioAffected', 'Affected by Sea Level Rise Scenario (2050)?')}
              <SliderInput id="wildFireRiskIndex" label="Wildfire Risk Index (1-5)" min={1} max={5} step={1} value={inputs.wildFireRiskIndex} onValueChange={(val) => handleInputChange('wildFireRiskIndex', val)} displayFormatter={formatBasicNumber} tooltip="1=Low, 5=Very High" />
              {validationErrors.wildFireRiskIndex && <p className="mt-1 text-xs text-red-600">{validationErrors.wildFireRiskIndex}</p>}
              <SliderInput id="hurricaneRiskIndex" label="Hurricane Risk Index (1-5)" min={1} max={5} step={1} value={inputs.hurricaneRiskIndex} onValueChange={(val) => handleInputChange('hurricaneRiskIndex', val)} displayFormatter={formatBasicNumber} tooltip="1=Low, 5=Very High" />
              {validationErrors.hurricaneRiskIndex && <p className="mt-1 text-xs text-red-600">{validationErrors.hurricaneRiskIndex}</p>}
              <SliderInput id="heatStressRiskIndex" label="Heat Stress Index (1-5)" min={1} max={5} step={1} value={inputs.heatStressRiskIndex} onValueChange={(val) => handleInputChange('heatStressRiskIndex', val)} displayFormatter={formatBasicNumber} tooltip="1=Low, 5=Very High" />
              {validationErrors.heatStressRiskIndex && <p className="mt-1 text-xs text-red-600">{validationErrors.heatStressRiskIndex}</p>}
            </CollapsibleSection>

            <CollapsibleSection title="Lease Details & Risk (Summary)">
              <p className="text-xs text-gray-500 mb-2">Summary inputs. Detailed lease information is managed in the 'Rent Roll Details' section.</p>
              <SliderInput id="weightedAverageLeaseTerm" label="Weighted Average Lease Term (WALT)" min={0} max={30} step={0.1} value={inputs.weightedAverageLeaseTerm} onValueChange={(val) => handleInputChange('weightedAverageLeaseTerm', val)} displayFormatter={formatYear} tooltip="WALT in years. Can be auto-calculated from rent roll in future." />
              {validationErrors.weightedAverageLeaseTerm && <p className="mt-1 text-xs text-red-600">{validationErrors.weightedAverageLeaseTerm}</p>}
              {renderSelectField('anchorTenantCreditRating', 'Anchor Tenant Credit Rating', creditRatingOptions, "Credit rating of the primary tenant.")}
              {renderCheckboxField('hasCoTenancyClause', 'Co-Tenancy / Kick-Out Clause Present?')}
              
              <div className="mt-4 pt-3 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Rollover Schedule (%) - Next 10 Years (Summary)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {inputs.annualRolloverSchedule.map((percent, idx) => {
                    const errorKey = `rollover-year-${idx+1}`;
                    const error = validationErrors[errorKey];
                    return (
                    <div key={`rollover-${idx}`}>
                      <label htmlFor={`rollover-year-${idx+1}`} className="block text-xs text-gray-600">Year {idx + 1}</label>
                      <input type="number" id={`rollover-year-${idx+1}`} name={`rollover-year-${idx+1}`} value={percent} onChange={(e) => handleRolloverScheduleChange(idx, e.target.value)} min="0" max="100" step="0.1" className={`mt-0.5 block w-full p-1 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs`} aria-label={`Rollover percentage for year ${idx + 1}`} aria-invalid={!!error} aria-describedby={error ? `${errorKey}-error` : undefined}/>
                      {error && <p id={`${errorKey}-error`} className="mt-0.5 text-xs text-red-600">{error}</p>}
                    </div>
                  )})}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <h4 className="text-md font-semibold text-gray-700 mb-2">Lease Structure Specifics (Summary)</h4>
                <SliderInput id="expenseStopPerSF" label="Expense Stop ($/SF)" min={0} max={50} step={0.01} value={inputs.expenseStopPerSF} onValueChange={(val) => handleInputChange('expenseStopPerSF', val)} displayFormatter={formatAmountPerSF} tooltip="For office leases, tenant pays OpEx above this amount." />
                {validationErrors.expenseStopPerSF && <p className="mt-1 text-xs text-red-600">{validationErrors.expenseStopPerSF}</p>}
                <SliderInput id="percentageRentBreakpoint" label="Percentage Rent Breakpoint ($)" min={0} max={2000000} step={1000} value={inputs.percentageRentBreakpoint} onValueChange={(val) => handleInputChange('percentageRentBreakpoint', val)} displayFormatter={formatCurrency} tooltip="Retail sales threshold for overage rent." />
                {validationErrors.percentageRentBreakpoint && <p className="mt-1 text-xs text-red-600">{validationErrors.percentageRentBreakpoint}</p>}
                <SliderInput id="percentageRentOveragePercent" label="Percentage Rent Overage (%)" min={0} max={100} step={0.1} value={inputs.percentageRentOveragePercent} onValueChange={(val) => handleInputChange('percentageRentOveragePercent', val)} displayFormatter={formatPercentage} tooltip="Retail percentage paid on sales above breakpoint." />
                {validationErrors.percentageRentOveragePercent && <p className="mt-1 text-xs text-red-600">{validationErrors.percentageRentOveragePercent}</p>}
              </div>
               <div className="mt-6 pt-4 border-t">
                <h4 className="text-md font-semibold text-gray-700 mb-2">Rollover & Re-letting Assumptions (Summary)</h4>
                <SliderInput id="freeRentMonths" label="Free Rent (Months per new lease)" min={0} max={24} step={0.5} value={inputs.freeRentMonths} onValueChange={(val) => handleInputChange('freeRentMonths', val)} displayFormatter={formatMonths} />
                {validationErrors.freeRentMonths && <p className="mt-1 text-xs text-red-600">{validationErrors.freeRentMonths}</p>}
                <SliderInput id="tiAllowancePerSF" label="Tenant Improvement Allowance ($/SF)" min={0} max={200} step={1} value={inputs.tiAllowancePerSF} onValueChange={(val) => handleInputChange('tiAllowancePerSF', val)} displayFormatter={formatAmountPerSF} />
                {validationErrors.tiAllowancePerSF && <p className="mt-1 text-xs text-red-600">{validationErrors.tiAllowancePerSF}</p>}
                <SliderInput id="lcAllowancePerSF" label="Leasing Commission Allowance ($/SF)" min={0} max={100} step={0.5} value={inputs.lcAllowancePerSF} onValueChange={(val) => handleInputChange('lcAllowancePerSF', val)} displayFormatter={formatAmountPerSF} />
                {validationErrors.lcAllowancePerSF && <p className="mt-1 text-xs text-red-600">{validationErrors.lcAllowancePerSF}</p>}
                <SliderInput id="downtimeBetweenLeasesMonths" label="Downtime Between Leases (Months)" min={0} max={24} step={0.5} value={inputs.downtimeBetweenLeasesMonths} onValueChange={(val) => handleInputChange('downtimeBetweenLeasesMonths', val)} displayFormatter={formatMonths} />
                 {validationErrors.downtimeBetweenLeasesMonths && <p className="mt-1 text-xs text-red-600">{validationErrors.downtimeBetweenLeasesMonths}</p>}
                <SliderInput id="relettingCostPercentOfRent" label="Re-letting Cost (% of 1st Yr Rent)" min={0} max={50} step={0.1} value={inputs.relettingCostPercentOfRent} onValueChange={(val) => handleInputChange('relettingCostPercentOfRent', val)} displayFormatter={formatPercentage} />
                {validationErrors.relettingCostPercentOfRent && <p className="mt-1 text-xs text-red-600">{validationErrors.relettingCostPercentOfRent}</p>}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Market & Capital Metrics (Summary)">
               <SliderInput id="targetUnleveredIRR" label="Target Unlevered IRR (%)" min={0} max={30} step={0.1} value={inputs.targetUnleveredIRR} onValueChange={(val) => handleInputChange('targetUnleveredIRR', val)} displayFormatter={formatPercentage} tooltip="Target internal rate of return for the investment, before debt." />
              {validationErrors.targetUnleveredIRR && <p className="mt-1 text-xs text-red-600">{validationErrors.targetUnleveredIRR}</p>}
               <SliderInput id="dcrThreshold" label="Debt Coverage Ratio (DCR) Threshold" min={0} max={3} step={0.01} value={inputs.dcrThreshold} onValueChange={(val) => handleInputChange('dcrThreshold', val)} displayFormatter={(v)=> v.toFixed(2)+"x"} tooltip="Minimum DCR (NOI / Debt Service) required by lenders." />
              {validationErrors.dcrThreshold && <p className="mt-1 text-xs text-red-600">{validationErrors.dcrThreshold}</p>}
               <SliderInput id="annualCostIndexEscalationPercent" label="Construction Cost Index Escalation (%)" min={-10} max={20} step={0.1} value={inputs.annualCostIndexEscalationPercent} onValueChange={(val) => handleInputChange('annualCostIndexEscalationPercent', val)} displayFormatter={formatPercentage} tooltip="Annual % change affecting Replacement Cost New over time." />
              {validationErrors.annualCostIndexEscalationPercent && <p className="mt-1 text-xs text-red-600">{validationErrors.annualCostIndexEscalationPercent}</p>}
            </CollapsibleSection>
            
            <CollapsibleSection title="Sales Comparison Inputs">
              <SliderInput id="annualMarketConditionsAdjustmentPercent" label="Annual Market Conditions Adjustment (%)" min={-10} max={20} step={0.1} value={inputs.annualMarketConditionsAdjustmentPercent} onValueChange={(val) => handleInputChange('annualMarketConditionsAdjustmentPercent', val)} displayFormatter={formatPercentage} tooltip="Overall annual trend to guide 'Market Time' adjustments for comps."/>
              {validationErrors.annualMarketConditionsAdjustmentPercent && <p className="mt-1 text-xs text-red-600">{validationErrors.annualMarketConditionsAdjustmentPercent}</p>}
              {inputs.salesComparables.map((comp, index) => (
                <ComparableSaleCard 
                  key={comp.id} 
                  comp={comp} 
                  index={index} 
                  onCompChange={handleComparableChange} 
                  onRemoveComp={handleRemoveComparable}
                  isRemovable={inputs.salesComparables.length > 1}
                  annualMarketConditionsAdjustmentPercent={inputs.annualMarketConditionsAdjustmentPercent}
                  validationErrors={validationErrors}
                />
              ))}
              <button type="button" onClick={handleAddComparable} className="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md shadow focus:outline-none focus:ring-2 focus:ring-blue-400">Add Comparable Sale</button>
            
              <div className="mt-6 pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-1">Indicated Value Determination</label>
                {salesCompValueSelectionOptions.map(opt => (
                  <div key={opt.value} className="flex items-center mb-1">
                    <input type="radio" id={`salesCompSelect-${opt.value}`} name="salesCompValueSelection" value={opt.value} checked={inputs.salesCompValueSelection === opt.value} onChange={(e) => handleInputChange('salesCompValueSelection', e.target.value as SalesCompValueSelectionType)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/>
                    <label htmlFor={`salesCompSelect-${opt.value}`} className="ml-2 block text-sm text-gray-900">{opt.label}</label>
                  </div>
                ))}
                {inputs.salesCompValueSelection === 'custom' && (
                  <SliderInput 
                    id="salesCompCustomValue" 
                    label="Custom Indicated Value ($)" 
                    min={0} 
                    max={Math.max(10000000, salesComparisonResults.averageAdjustedPrice * 2, salesComparisonResults.medianAdjustedPrice * 2)} // Dynamic max
                    step={1000} 
                    value={inputs.salesCompCustomValue} 
                    onValueChange={(val) => handleInputChange('salesCompCustomValue', val)} 
                    displayFormatter={formatCurrency} 
                  />
                )}
                {validationErrors.salesCompCustomValue && <p className="mt-1 text-xs text-red-600">{validationErrors.salesCompCustomValue}</p>}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Cost Approach Inputs">
              {renderSelectField('costType', 'Cost Basis', costTypeOptions, "Replacement Cost New (RCN) or Reproduction Cost New.")}
              <SliderInput id="improvementCostNew" label="Improvement Cost New ($)" min={100000} max={50000000} step={10000} value={inputs.improvementCostNew} onValueChange={(val) => handleInputChange('improvementCostNew', val)} displayFormatter={formatCurrency} tooltip="Estimated cost to construct the improvements today." />
              {validationErrors.improvementCostNew && <p className="mt-1 text-xs text-red-600">{validationErrors.improvementCostNew}</p>}
              <SliderInput id="economicLife" label="Economic Life (Years)" min={10} max={100} step={1} value={inputs.economicLife} onValueChange={(val) => handleInputChange('economicLife', val)} displayFormatter={formatYear} tooltip="Total period over which improvements are expected to contribute to value."/>
              {validationErrors.economicLife && <p className="mt-1 text-xs text-red-600">{validationErrors.economicLife}</p>}
              <SliderInput id="landValue" label="Land Value ($)" min={10000} max={10000000} step={10000} value={inputs.landValue} onValueChange={(val) => handleInputChange('landValue', val)} displayFormatter={formatCurrency} tooltip="Value of the land as if vacant and available for its highest and best use." />
              {validationErrors.landValue && <p className="mt-1 text-xs text-red-600">{validationErrors.landValue}</p>}
            </CollapsibleSection>

            <CollapsibleSection title="Reconciliation & Data Sources">
              <SliderInput id="incomeApproachWeight" label="Income Approach Weight (%)" min={0} max={100} step={1} value={inputs.incomeApproachWeight} onValueChange={(val) => handleInputChange('incomeApproachWeight', val)} displayFormatter={formatPercentage} />
              {validationErrors.incomeApproachWeight && <p className="mt-1 text-xs text-red-600">{validationErrors.incomeApproachWeight}</p>}
              <SliderInput id="salesApproachWeight" label="Sales Comparison Weight (%)" min={0} max={100} step={1} value={inputs.salesApproachWeight} onValueChange={(val) => handleInputChange('salesApproachWeight', val)} displayFormatter={formatPercentage} />
              {validationErrors.salesApproachWeight && <p className="mt-1 text-xs text-red-600">{validationErrors.salesApproachWeight}</p>}
              <SliderInput id="costApproachWeight" label="Cost Approach Weight (%)" min={0} max={100} step={1} value={inputs.costApproachWeight} onValueChange={(val) => handleInputChange('costApproachWeight', val)} displayFormatter={formatPercentage} />
              {validationErrors.costApproachWeight && <p className="mt-1 text-xs text-red-600">{validationErrors.costApproachWeight}</p>}
              {weightsSumError && ( <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded-md"> {weightsSumError} </div>)}
              {renderTextareaField('reconciliationNarrative', 'Reconciliation Narrative', 4)}
              {renderTextareaField('dataSourceDisclosure', 'Data Source Disclosure', 3)}
            </CollapsibleSection>

          </div> {/* End Input Panel */}

          {/* Output Panel - Right Column */}
          <div className="md:w-3/5 h-full overflow-y-auto space-y-6 pl-3 md:pl-4">
            <ScenarioDrawer 
                initialDiscountRate={initialInputs.discountRatePercent}
                initialExitCapRate={initialInputs.exitCapRate}
                initialRentGrowth={initialInputs.globalMarketRentGrowthPercent}
                onScenarioChange={handleScenarioChange}
                baseDcfValue={baseDcfValueForScenario}
                scenarioDcfResults={dcfResults}
            />

            {dcfResults && (
            <CollapsibleSection title="Discounted Cash Flow (DCF) Analysis" defaultOpen={true}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div className="p-4 bg-blue-50 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-blue-600">DCF Value</h3>
                        <p className="text-2xl font-semibold text-blue-800">{formatCurrency(dcfResults.dcfValue)}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-green-600">Going-In Cap Rate (Y1)</h3>
                        <p className="text-2xl font-semibold text-green-800">{formatPercentage(dcfResults.goingInCapRate)}</p>
                        <p className="text-xs text-gray-500">Based on Y1 NOI: {formatCurrency(dcfResults.projectedCashFlowsDCF[0]?.netOperatingIncome || 0)}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg shadow">
                        <h3 className="text-sm font-medium text-purple-600">Unlevered IRR</h3>
                        <p className="text-2xl font-semibold text-purple-800">{isNaN(dcfResults.internalRateOfReturn) ? 'N/A' : formatPercentage(dcfResults.internalRateOfReturn)}</p>
                    </div>
                </div>
                 <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                    <p><strong>Terminal Value (Gross):</strong> {formatCurrency(dcfResults.terminalValueGross)} (Year {inputs.projectionYears+1} NOI: {formatCurrency(dcfResults.yearNPlusOneNOI)} / Exit Cap: {formatPercentage(inputs.exitCapRate)})</p>
                    <p><strong>Net Sale Proceeds (Terminal):</strong> {formatCurrency(dcfResults.netSaleProceedsTerminal)} (after {formatPercentage(inputs.saleCostPercent)} sale costs)</p>
                </div>
                <ProjectedCashFlowViewerTable cashFlows={dcfResults.projectedCashFlowsDCF} projectionYears={inputs.projectionYears} />
            </CollapsibleSection>
            )}
            
            <CollapsibleSection title="Income Approach (Direct Capitalization)" defaultOpen={true}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Calculation Steps</h3>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {incomeApproachResults.isFromCashFlowProjection && <li className="text-green-600 font-medium">Using Year 1 figures from DCF Projection.</li>}
                    <li>Potential Gross Income: <span className="font-medium float-right">{formatCurrency(incomeApproachResults.potentialGrossIncome)}</span></li>
                    <li>Less: Vacancy Loss ({formatPercentage(inputs.vacancyLossPercent)}): <span className="font-medium float-right">{formatCurrency(incomeApproachResults.vacancyLossAmount)}</span></li>
                    <li>Less: Credit & Collection Loss ({formatPercentage(inputs.creditCollectionLossPercent)}): <span className="font-medium float-right">{formatCurrency(incomeApproachResults.creditCollectionLossAmount)}</span></li>
                    <li>Effective Gross Income (EGI): <span className="font-medium float-right">{formatCurrency(incomeApproachResults.effectiveGrossIncome)}</span></li>
                     <li>Less: Total Operating Expenses: <span className="font-medium float-right">{formatCurrency(incomeApproachResults.totalOperatingExpenses)}</span>
                        <ul className="ml-4 text-xs text-gray-600">
                            <li>Taxes: <span className="float-right">{formatCurrency(inputs.operatingExpensesBuckets.taxes)}</span></li>
                            <li>Insurance: <span className="float-right">{formatCurrency(inputs.operatingExpensesBuckets.insurance)}</span></li>
                            <li>Repairs & Maint.: <span className="float-right">{formatCurrency(inputs.operatingExpensesBuckets.repairsMaintenance)}</span></li>
                            <li>Management ({formatPercentage(inputs.operatingExpensesBuckets.managementPercentOfEGI)} of EGI): <span className="float-right">{formatCurrency(incomeApproachResults.managementFeeAmount)}</span></li>
                            <li>Reserves: <span className="float-right">{formatCurrency(inputs.operatingExpensesBuckets.reserves)}</span></li>
                        </ul>
                    </li>
                    <li>Net Operating Income (NOI): <span className="font-semibold float-right">{formatCurrency(incomeApproachResults.netOperatingIncome)}</span></li>
                  </ul>
                </div>
                <div className="p-6 bg-blue-50 rounded-lg shadow text-center self-center">
                  <h3 className="text-md font-medium text-blue-600">Indicated Value (Income)</h3>
                  <p className="text-3xl font-bold text-blue-800 my-2">{formatCurrency(incomeApproachResults.incomeApproachValue)}</p>
                  <p className="text-xs text-blue-700">Based on NOI of {formatCurrency(incomeApproachResults.netOperatingIncome)} and Cap Rate of {formatPercentage(inputs.capRateIncome)}</p>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Sales Comparison Approach" defaultOpen={true}>
                 <div className="mb-4">
                    {salesComparisonResults.comparablesDetail.map((comp, index) => (
                    <div key={comp.id} className="p-3 mb-2 bg-gray-50 border border-gray-200 rounded-md text-sm">
                        <h4 className="font-semibold text-gray-700">Comp #{index + 1}: {comp.address || 'N/A'}</h4>
                        <div className="grid grid-cols-2 gap-x-4">
                        <p>Sale Price: {formatCurrency(comp.salePrice)}</p>
                        <p>GBA: {formatNumberWithCommas(comp.gba)} SF</p>
                        <p>Price/SF: {formatAmountPerSF(comp.pricePerSF)}</p>
                        <p>Total Adj: {formatPercentage(comp.totalAdjustmentPercent)}</p>
                        <p className="font-medium">Adjusted Price: {formatCurrency(comp.adjustedSalePrice)}</p>
                        <p className="font-medium">Adjusted Price/SF: {formatAmountPerSF(comp.adjustedPricePerSF)}</p>
                        </div>
                    </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Summary of Adjusted Comps</h3>
                         <ul className="space-y-1 text-sm text-gray-700">
                            <li>Average Adjusted Sale Price: <span className="font-medium float-right">{formatCurrency(salesComparisonResults.averageAdjustedPrice)}</span></li>
                            <li>Median Adjusted Sale Price: <span className="font-medium float-right">{formatCurrency(salesComparisonResults.medianAdjustedPrice)}</span></li>
                        </ul>
                    </div>
                    <div className="p-6 bg-green-50 rounded-lg shadow text-center self-center">
                        <h3 className="text-md font-medium text-green-600">Indicated Value (Sales Comp)</h3>
                        <p className="text-3xl font-bold text-green-800 my-2">{formatCurrency(salesComparisonResults.salesComparisonValue)}</p>
                        <p className="text-xs text-green-700">Selection: {inputs.salesCompValueSelection.charAt(0).toUpperCase() + inputs.salesCompValueSelection.slice(1)}</p>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Cost Approach" defaultOpen={true}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Calculation Steps</h3>
                        <ul className="space-y-1 text-sm text-gray-700">
                            <li>{inputs.costType === 'replacement' ? 'Replacement' : 'Reproduction'} Cost New: <span className="font-medium float-right">{formatCurrency(inputs.improvementCostNew)}</span></li>
                            <li>Less: Total Depreciation: <span className="font-medium float-right">{formatCurrency(costApproachResults.totalDepreciationAmount)}</span>
                                <ul className="ml-4 text-xs text-gray-600">
                                <li>Age-Life ({formatPercentage(costApproachResults.ageLifeDepreciationPercent)} of RCN): <span className="float-right">{formatCurrency(inputs.improvementCostNew * (costApproachResults.ageLifeDepreciationPercent/100) )}</span></li>
                                {/* Placeholder for future functional/external obsolescence display */}
                                </ul>
                            </li>
                            <li>Depreciated Cost of Improvements: <span className="font-medium float-right">{formatCurrency(costApproachResults.depreciatedImprovementCost)}</span></li>
                            <li>Plus: Land Value: <span className="font-medium float-right">{formatCurrency(inputs.landValue)}</span></li>
                        </ul>
                    </div>
                     <div className="p-6 bg-purple-50 rounded-lg shadow text-center self-center">
                        <h3 className="text-md font-medium text-purple-600">Indicated Value (Cost)</h3>
                        <p className="text-3xl font-bold text-purple-800 my-2">{formatCurrency(costApproachResults.costApproachValue)}</p>
                        <p className="text-xs text-purple-700">Effective Age: {inputs.effectiveAge} yrs / Economic Life: {inputs.economicLife} yrs</p>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Final Reconciliation" defaultOpen={true}>
              <div className="p-6 bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-lg shadow-xl text-center">
                <h3 className="text-xl font-semibold mb-1">Final Reconciled Value Estimate</h3>
                <p className="text-5xl font-extrabold my-3 tracking-tight">{formatCurrency(reconciledValue)}</p>
                <div className="text-sm opacity-90 mt-4 grid grid-cols-3 gap-2">
                    <div>Income: {formatPercentage(inputs.incomeApproachWeight)}<br/>({formatCurrency(incomeApproachResults.incomeApproachValue)})</div>
                    <div>Sales: {formatPercentage(inputs.salesApproachWeight)}<br/>({formatCurrency(salesComparisonResults.salesComparisonValue)})</div>
                    <div>Cost: {formatPercentage(inputs.costApproachWeight)}<br/>({formatCurrency(costApproachResults.costApproachValue)})</div>
                </div>
                 {weightsSumError && ( <div className="mt-3 p-2 bg-red-200 border border-red-500 text-red-800 text-xs rounded-md"> {weightsSumError} </div>)}
              </div>
              {inputs.reconciliationNarrative && (
                <div className="mt-4 p-4 bg-gray-100 rounded-md shadow">
                  <h4 className="font-semibold text-gray-700 mb-1">Reconciliation Narrative:</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{inputs.reconciliationNarrative}</p>
                </div>
              )}
            </CollapsibleSection>
          </div> {/* End Output Panel */}
        </div>
      </main>
      <footer className="bg-gray-800 text-white text-center py-6">
        <p className="text-sm">&copy; {new Date().getFullYear()} Commercial Real Estate Appraisal Model. For educational and illustrative purposes only.</p>
      </footer>
    </div>
  );
};

export default App;
