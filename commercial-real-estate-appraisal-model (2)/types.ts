
// Definitions for specific string union types used throughout the application.

export type UseType = 'Office' | 'Retail' | 'Industrial' | 'MixedUse' | 'Residential' | 'SpecialPurpose' | 'Other' | '';
export type PropertyRights = 'feeSimple' | 'leasedFee' | 'leasehold' | '';
export type TopographyOptions = 'level' | 'sloping' | 'hilly' | '';
export type QualityOptions = 'A' | 'B' | 'C' | '';
export type ConditionOptions = 'excellent' | 'good' | 'average' | 'fair' | 'poor' | '';
export type CostApproachCostType = 'replacement' | 'reproduction' | '';

// New Types for Phase 3 (ESG/Climate)
export type LEEDCertificationLevel = 'none' | 'certified' | 'silver' | 'gold' | 'platinum' | '';
export type ESGRiskCategory = 'none' | 'environmental' | 'social' | 'governance' | '';
export type CreditRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D' | 'NA' | '';
export type FemaFloodZone = 'X' | 'A' | 'AE' | 'VE' | 'AO' | 'D' | 'ShadedX' | 'Other' | '';

// Types for Phase 2 - Multi-tenant & Cash Flows
export type ReimbursementType = 'gross' | 'nnn' | 'modifiedGross' | '';
export type EscalationType = 'fixedPercent' | 'stepUp' | 'cpi' | ''; // For DCF

// Comparable Sale Specific Types
export type FinancingTerms = 'Cash' | 'Conventional' | 'SellerFinanced' | 'AssumedLoan' | 'Other' | '';
export type ConditionOfSale = 'ArmsLength' | 'REO' | 'ShortSale' | 'EstateSale' | 'RelatedParty' | 'Other' | '';
export type LocationQuality = 'Prime' | 'Secondary' | 'Tertiary' | 'Average' | 'Inferior' | 'Superior' | '';
export type SiteUtility = 'Good' | 'Average' | 'Poor' | 'Excellent' | 'Fair' | '';

export interface RentRollEntry {
  id: string; // UUID
  suite: string;
  squareFeet: number;
  currentRentPerSF: number; // Annual $/SF
  leaseStartDate: string; // YYYY-MM-DD
  leaseEndDate: string; // YYYY-MM-DD
  
  // DCF Specific Fields
  useType: UseType; 
  escalationType: EscalationType; 
  escalationPercent: number; // Annual % (used if escalationType is fixedPercent)
  // Placeholder for future complex escalation structures, e.g., for 'stepUp' or 'cpi'. Currently unused by logic.
  escalationDetail: string; 
  
  reimbursementType: ReimbursementType;
  
  // Renewal Assumptions for this specific lease
  renewalProbabilityPercent: number; // 0-100
  renewTermYears: number; // DCF: Expected renewal term length
  renewRentBumpPercent: number; // DCF: Percentage bump on last rent or to market
  renewalDowntimeMonths: number; // Months of vacancy before new lease starts
  renewalMarketRentPerSF: number; // Expected market rent $/SF for renewal term (can be same as current market)
  renewalTiPerSF: number; // TI $/SF for renewal
  renewalLcPercentOfFirstYearRent: number; // LC % of first year's renewed rent
}

export interface CapitalExpenditureEntry {
  id: string; // UUID
  year: number; // Projection year (1, 2, 3...)
  description: string;
  amount: number;
}

export interface AnnualCashFlow { // Base for simpler projection and DCF
  year: number;
  // Income components
  potentialBaseRent: number;
  scheduledEscalationsRevenue: number; 
  potentialMarketRentFromVacancy: number; 
  totalScheduledRentalRevenue: number; 
  tenantReimbursementsNNN: number;
  potentialGrossRevenue: number; 
  // Deductions from PGR
  generalVacancyLoss: number; 
  creditLoss: number;
  effectiveGrossIncome: number;
  // Expenses
  operatingExpenses: number; 
  // NOI
  netOperatingIncome: number;
  // Below NOI deductions
  tenantImprovementsAndLcs: number; 
  capitalExpenditures: number; 
  // Final Cash Flow
  netCashFlow: number; // NCF before terminal value and debt service
}

// For Full DCF
export interface AnnualCashFlowDCF extends AnnualCashFlow {
  presentValueFactor: number;
  presentValueOfNetCashFlow: number;
  netCashFlowWithTerminal: number; // NCF including terminal value in the last year
}

export interface DCFResults {
  projectedCashFlowsDCF: AnnualCashFlowDCF[];
  dcfValue: number;
  goingInCapRate: number; // Year 1 NOI / DCF Value
  internalRateOfReturn: number; // IRR
  netSaleProceedsTerminal: number; // Terminal value after sale costs
  terminalValueGross: number; // Terminal value before sale costs
  yearNPlusOneNOI: number; // NOI used for terminal value calc
}


export interface OpexBuckets {
  taxes: number;
  insurance: number;
  repairsMaintenance: number;
  managementPercentOfEGI: number; 
  reserves: number;
  // Add other common OpEx categories as needed e.g. utilities if not directly reimbursed
  // utilities: number; 
}

export interface SalesCompAdjustments {
  propertyRights: number; // Percentage
  financing: number; // Percentage
  conditionsOfSale: number; // Percentage
  marketTime: number; // Percentage
  location: number; // Percentage
  physicalSize: number; // Percentage (based on GBA differences)
  ageCondition: number; // Percentage
  site: number; // Percentage
}

export interface ComparableSale {
  id: string; // UUID for React key
  address: string;
  saleDate: string; // YYYY-MM-DD
  salePrice: number;
  gba: number; // Gross Building Area
  propertyRightsConveyed: PropertyRights; 
  financingTerms: FinancingTerms; 
  conditionOfSale: ConditionOfSale; 
  locationQuality: LocationQuality; 
  siteUtility: SiteUtility; 
  adjustments: SalesCompAdjustments;
}

export type SalesCompValueSelectionType = 'average' | 'median' | 'custom';

export interface AppraisalInputs {
  // Assignment Details
  effectiveDate: string;
  reportDate: string;
  intendedUse: string;
  intendedUsers: string;
  propertyRightsAppraised: PropertyRights;
  isExtraordinaryAssumption: boolean;
  extraordinaryAssumptionDetail: string;
  isHypotheticalCondition: boolean;
  hypotheticalConditionDetail: string;

  // Site Characteristics
  topography: TopographyOptions;
  landShapeDescription: string;
  accessFrontageFeet: number;
  accessCurbCuts: number;
  accessIngressEgressNotes: string;
  utilities: {
    water: boolean;
    sewer: boolean;
    gas: boolean;
    electric: boolean;
    telecom: boolean;
  };

  // Improvement Details
  gba: number; 
  rentableSF: number; 
  usableSF: number;
  actualAge: number;
  effectiveAge: number;
  quality: QualityOptions;
  condition: ConditionOptions;
  highestBestUse: {
    physicallyPossible: boolean;
    legallyPermissible: boolean;
    financiallyFeasible: boolean;
    maximallyProductive: boolean;
    narrative: string;
  };

  // Income Approach Inputs (Summary for Direct Cap, might be overridden by cash flow proj.)
  grossPotentialIncome: number; 
  vacancyLossPercent: number; 
  creditCollectionLossPercent: number; 
  operatingExpensesBuckets: OpexBuckets; 
  capRateIncome: number; 
  marketRentPerSF: number; 
  inPlaceRentPerSF: number; 

  // Cash Flow Projection / DCF Assumptions
  projectionYears: number; // analysisPeriod
  globalMarketRentGrowthPercent: number; 
  globalExpenseInflationPercent: number; 
  generalVacancyRatePercentForProjections: number; 
  discountRatePercent: number; 
  exitCapRate: number; 
  saleCostPercent: number; // Cost to sell the property at terminal value (%)

  // Rent Roll
  rentRoll: RentRollEntry[];

  // Capital Expenditures
  capitalExpenditures: CapitalExpenditureEntry[];
  
  // Operating-risk metrics
  opexVolatilityPercent: number; 
  propertyTaxAppealProbability: number;

  // Sales Comparison Inputs
  salesComparables: ComparableSale[];
  annualMarketConditionsAdjustmentPercent: number;
  salesCompValueSelection: SalesCompValueSelectionType; // New
  salesCompCustomValue: number; // New

  // Cost Approach Inputs
  landValue: number;
  costType: CostApproachCostType;
  improvementCostNew: number;
  economicLife: number;
  annualCostIndexEscalationPercent: number;

  // Reconciliation & Data Sources
  incomeApproachWeight: number;
  salesApproachWeight: number;
  costApproachWeight: number;
  dataSourceDisclosure: string;
  reconciliationNarrative: string;

  // ESG / Green-building metrics
  leedCertification: LEEDCertificationLevel;
  energyStarScore: number; 
  energyUseIntensity: number; 
  scope1CarbonEmissions: number; 
  esgRiskCategory: ESGRiskCategory;
  esgRiskDetail: string;

  // Climate-resilience variables
  femaFloodHazardClass: FemaFloodZone; 
  seaLevelRise2050ScenarioAffected: boolean; 
  wildFireRiskIndex: number; 
  hurricaneRiskIndex: number; 
  heatStressRiskIndex: number; 

  // Tenant / lease-risk detail (summary level, rent roll provides detail)
  weightedAverageLeaseTerm: number; 
  anchorTenantCreditRating: CreditRating;
  hasCoTenancyClause: boolean;
  annualRolloverSchedule: number[]; 

  // Lease-structure specifics (summary/general assumptions if not using detailed rent roll)
  expenseStopPerSF: number; 
  percentageRentBreakpoint: number; 
  percentageRentOveragePercent: number; 
  freeRentMonths: number; 
  tiAllowancePerSF: number; 
  lcAllowancePerSF: number; 

  // Rollover & re-letting assumptions (summary/general)
  downtimeBetweenLeasesMonths: number;
  relettingCostPercentOfRent: number; 

  // Market-derived capital variables
  // exitCapRate is now part of DCF assumptions
  targetUnleveredIRR: number; 
  dcrThreshold: number; 
}

export interface IncomeApproachResults {
  potentialGrossIncome: number; 
  vacancyLossAmount: number;
  creditCollectionLossAmount: number;
  effectiveGrossIncome: number;
  managementFeeAmount: number; 
  totalOperatingExpenses: number;
  netOperatingIncome: number; 
  incomeApproachValue: number; 
  isFromCashFlowProjection: boolean; 
}

export interface AdjustedComparableSale extends ComparableSale {
  pricePerSF: number;
  totalAdjustmentPercent: number;
  adjustedSalePrice: number;
  adjustedPricePerSF: number; // New
}

export interface SalesComparisonResults {
  comparablesDetail: AdjustedComparableSale[];
  averageAdjustedPrice: number;
  medianAdjustedPrice: number;
  salesComparisonValue: number;
}

export interface CostApproachResults {
  ageLifeDepreciationPercent: number;
  totalDepreciationAmount: number;
  depreciatedImprovementCost: number;
  costApproachValue: number;
}
