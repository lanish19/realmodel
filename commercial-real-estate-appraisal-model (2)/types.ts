
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

// New interface for Lease Options
export interface LeaseOption {
  optionNumber: number;
  termLengthYears: number;
  rentTerms: string; // e.g., "FMV", "Fixed Increase of X%", "CPI Adjusted"
  noticePeriodMonths?: number;
}

// New interface for Step-Up Escalation Entries
export interface StepUpEscalationEntry {
  yearInLeaseTerm: number; // e.g., 1, 2, 3...
  rentPerSF: number; // The new rent per square foot for that year
}

// New interface for Reimbursement Structure Details
export interface ReimbursementStructureDetails {
  expenseStopAmountPerSF?: number;
  baseYearForCAM?: number;
  capsOnControllableOpExPercent?: number;
  adminFeeOnOpExPercent?: number;
}

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
  cpiEscalationRatePercent?: number; // Annual % for CPI, if not using a global rate
  cpiReviewFrequencyYears?: number; // How often CPI escalation is applied (e.g., 1 for annually)
  // Placeholder for future complex escalation structures, e.g., for 'stepUp' or 'cpi'. Currently unused by logic.
  escalationDetail: string;
  stepUpSchedule?: StepUpEscalationEntry[];
  
  reimbursementType: ReimbursementType;
  reimbursementDetails?: ReimbursementStructureDetails; // This line should now correctly reference the above interface
  
  // Renewal Assumptions for this specific lease
  renewalProbabilityPercent: number; // 0-100
  renewTermYears: number; // DCF: Expected renewal term length
  renewRentBumpPercent: number; // DCF: Percentage bump on last rent or to market
  renewalDowntimeMonths: number; // Months of vacancy before new lease starts
  renewalMarketRentPerSF: number; // Expected market rent $/SF for renewal term (can be same as current market)
  renewalTiPerSF: number; // TI $/SF for renewal
  renewalLcPercentOfFirstYearRent: number; // LC % of first year's renewed rent
  freeRentMonthsAtRenewal?: number;
  renewalOptions?: LeaseOption[];
}

export type CapexAmountType = 'fixed' | 'percentPGI' | 'percentEGI' | 'perSF' | '';
export type CapexCategory = 'structural' | 'recurringReserve' | '';

export interface CapitalExpenditureEntry {
  id: string; // UUID
  year: number; // Projection year (1, 2, 3...)
  description: string;
  amountType: CapexAmountType;
  // If 'fixed', amount is total $
  // If 'percentPGI' or 'percentEGI', amount is percentage (e.g., 0.02 for 2%)
  // If 'perSF', amount is $/SF (applied to inputs.rentableSF for now)
  amount: number; 
  category?: CapexCategory;
}

// New interface for Market Leasing Assumptions
export interface MarketLeasingAssumptions {
  marketRentNewLeasePerSF: number; // annual $/SF
  timeToLeaseVacantSFMonths: number;
  newLeaseTiPerSF: number; // TI $/SF for new leases
  newLeaseLcPercent: number; // Leasing Commission % of first year's rent
}

// New interface for Discount Rate Derivation details
export interface DiscountRateDerivation {
  riskFreeRate?: number;
  equityRiskPremium?: number;
  sizePremium?: number;
  specificRiskPremium?: number;
  narrative?: string;
}

// New interface for Exit Cap Rate Derivation details
export interface ExitCapRateDerivation {
  bandOfInvestmentNarrative?: string;
  marketSurveyNarrative?: string;
  terminalYearDebtEquityAssumptions?: string;
  spreadOverDiscountRate?: number;
  narrative?: string;
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

// New interface for Expense Items
export interface ExpenseItem {
  amount: number;
  inflationRate?: number; // percentage
  category?: 'Fixed' | 'Variable' | 'Undistributed' | '';
  isRecoverable?: boolean; // defaults to true for items like taxes, insurance, CAM
}

export interface OpexBuckets {
  taxes: ExpenseItem;
  insurance: ExpenseItem;
  repairsMaintenance: ExpenseItem;
  managementPercentOfEGI: ExpenseItem; // amount is percentage, inflationRate for fee % growth
  reserves: ExpenseItem;
  // utilities: ExpenseItem; // Consider adding later if needed
}

// New interface for Other Income Items
export interface OtherIncomeItem {
  description: string;
  amount: number;
  growthRate?: number; // percentage
}

// New interface for Adjustment Items
export interface AdjustmentItem {
  value: number;
  type: 'percentage' | 'fixed' | 'perSF' | ''; // Empty string or undefined could default to 'percentage'
}

export interface SalesCompAdjustments {
  propertyRights: AdjustmentItem;
  financing: AdjustmentItem;
  conditionsOfSale: AdjustmentItem;
  marketTime: AdjustmentItem; // This will now use the new fields in AppraisalInputs for calculation
  location: AdjustmentItem;
  physicalSize: AdjustmentItem; // e.g., based on GBA or other unit differences
  ageCondition: AdjustmentItem;
  site: AdjustmentItem;
  otherAdjustments?: { [key: string]: AdjustmentItem }; // For any ad-hoc adjustments
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
  conditionsOfSaleDetails?: string;
  locationQuality: LocationQuality; 
  siteUtility: SiteUtility; 
  adjustments: SalesCompAdjustments;
  leaseholdAdjustments?: AdjustmentItem;
  specialAssessments?: string;
  pendingLitigation?: string;
  dataSource?: string;
  verificationSource?: string;
  verificationDate?: string; // YYYY-MM-DD
  qualitativeRatings?: { [key: string]: 'Superior' | 'Similar' | 'Inferior' | '' };
  numberOfUnits?: number;
  numberOfRooms?: number;
  netOperatingIncome?: number;
  grossRentMultiplier?: number;
  capRate?: number; // as percentage e.g. 7.5
}

export type SalesCompValueSelectionType = 'average' | 'median' | 'custom';
export type MarketConditionsAdjustmentType = 'annualPercent' | 'monthlyRate' | 'directAmount' | '';

// New interface for Subject Sale History
export interface SubjectSaleHistoryEntry {
  date: string; // YYYY-MM-DD
  price: number;
  parties: string;
  natureOfTransaction: string;
}

// New interface for Market Demographics
export interface MarketDemographics {
  regionalPopulation: number;
  regionalPopulationGrowthRate: number; // percentage
  localUnemploymentRate: number; // percentage
  majorEmployersNarrative: string;
}

// New interface for Submarket Analysis
export interface SubmarketAnalysis {
  submarketVacancyRate: number; // percentage
  submarketRentalRateOffice?: number; // per SF or relevant unit
  submarketRentalRateRetail?: number; // per SF or relevant unit
  submarketRentalRateIndustrial?: number; // per SF or relevant unit
  newConstructionPipelineSF: number;
  marketTrendsNarrative: string;
}

// New interface for Easements
export interface Easement {
  description: string;
  type: string;
  impact: string;
}

// New interface for Condominium Details
export interface CondominiumDetails {
  projectName: string;
  unitNumber: string;
  percentCommonInterest: number;
}

// New interface for Assessment Details
export interface AssessmentDetails {
  assessmentYear: number;
  assessedValueLand: number;
  assessedValueImprovements: number;
  propertyTaxRate: string; // e.g., "per $1000" or a numeric rate
  totalAnnualTaxes?: number; // optional, as it can be calculated
}

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
  exposureTimeMonths: number;
  marketingTimeMonths: number;
  inspectionDate: string; // YYYY-MM-DD
  inspectedBy: string;
  subjectSaleHistory: SubjectSaleHistoryEntry[];
  formOfOwnership: string;
  condominiumDetails?: CondominiumDetails;
  assessmentDetails: AssessmentDetails;

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
    fireSprinkler?: boolean; // Added optional fireSprinkler to utilities
  };
  parkingSpacesTotal: number;
  parkingRatioPer1000SF?: number;
  parkingAdequacy: 'Adequate' | 'Surplus' | 'Deficient' | '';
  easements: Easement[];
  encroachmentsNarrative: string;

  // Improvement Details
  // Construction Details
  foundationType: string;
  frameType: string;
  exteriorWallMaterial: string;
  roofCoverType: string;
  roofAge: number;
  // Interior Finish Details
  interiorWallFinish: string;
  ceilingType: string;
  lightingType: string;
  floorCoveringTypes: string;
  // Mechanical System Details
  hvacSystemType: string;
  hvacAgeCondition: string;
  electricalService: string;
  plumbingSystem: string;
  fireSprinklerSystemDetailed: string;
  functionalUtilityNarrative: string;

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
  otherIncome?: OtherIncomeItem[];
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
  marketConditionsAdjustmentType: MarketConditionsAdjustmentType;
  marketConditionsAdjustmentValue: number; // Value depends on type
  salesCompValueSelection: SalesCompValueSelectionType; 
  salesCompCustomValue: number; 

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

  // Market Analysis Inputs
  marketDemographics: MarketDemographics;
  submarketAnalysis: SubmarketAnalysis;
  marketLeasingAssumptions?: MarketLeasingAssumptions;

  // Derivation Details (Informational)
  discountRateDerivation?: DiscountRateDerivation;
  exitCapRateDerivation?: ExitCapRateDerivation;

  // Cost Approach Inputs - Detailed
  costDataSource: string;
  improvementCostNewBreakdown: ImprovementCostNewBreakdown;
  physicalDeteriorationCurableAmount?: number;
  physicalDeteriorationIncurableAmount?: number;
  functionalObsolescenceCurableAmount?: number;
  functionalObsolescenceIncurableAmount?: number;
  functionalObsolescenceNarrative?: string;
  externalObsolescenceAmount?: number;
  externalObsolescencePercent?: number; // applied to improvement cost
  externalObsolescenceNarrative?: string;
  landSaleComparables?: ComparableSale[];
}

// New interface for Improvement Cost New Breakdown
export interface ImprovementCostNewBreakdown {
  hardCosts?: number;
  softCosts?: number;
  developerProfit?: number; // Or Entrepreneurial Incentive
  total?: number; // This would be the sum or the figure used if breakdown isn't provided
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
  pricePerSF: number; // This is typically unadjusted price per SF.
  totalAdjustmentAmount: number;
  totalAdjustmentPercent: number;
  adjustedSalePrice: number;
  adjustedPricePerSF: number; 
  pricePerUnit?: number;
  pricePerRoom?: number;
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
