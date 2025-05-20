
import { 
  AppraisalInputs, IncomeApproachResults, SalesComparisonResults, CostApproachResults, 
  OpexBuckets, ComparableSale, AdjustedComparableSale, RentRollEntry, CapitalExpenditureEntry, AnnualCashFlow,
  SalesCompValueSelectionType
} from '../types';

export const calcIncomeDirectCap = (
  inputs: Pick<AppraisalInputs, 'rentableSF' | 'marketRentPerSF' | 'grossPotentialIncome' | 'vacancyLossPercent' | 'creditCollectionLossPercent' | 'capRateIncome'>,
  opexBuckets: OpexBuckets,
  year1ProjectedNOI?: number, // Optional: Year 1 NOI from detailed cash flow
  year1ProjectedPGI?: number,
  year1ProjectedVacancyLoss?: number,
  year1ProjectedCreditLoss?: number,
  year1ProjectedEGI?: number,
  year1ProjectedOpex?: number,
  year1ProjectedMgmtFee?: number
): IncomeApproachResults => {
  let pgi: number;
  let vacancyLoss: number;
  let creditLoss: number;
  let effectiveGrossIncome: number;
  let managementFeeAmount: number;
  let totalOperatingExpensesCalculated: number;
  let netOperatingIncomeToCap: number;
  let isFromProjection = false;

  if (year1ProjectedNOI !== undefined && year1ProjectedNOI > 0) {
    netOperatingIncomeToCap = year1ProjectedNOI;
    isFromProjection = true;
    // Use detailed projection figures if available
    pgi = year1ProjectedPGI ?? inputs.grossPotentialIncome;
    vacancyLoss = year1ProjectedVacancyLoss ?? (pgi * (inputs.vacancyLossPercent / 100));
    creditLoss = year1ProjectedCreditLoss ?? (pgi * (inputs.creditCollectionLossPercent / 100));
    effectiveGrossIncome = year1ProjectedEGI ?? (pgi - vacancyLoss - creditLoss);
    managementFeeAmount = year1ProjectedMgmtFee ?? (effectiveGrossIncome * (opexBuckets.managementPercentOfEGI / 100));
    totalOperatingExpensesCalculated = year1ProjectedOpex ?? (opexBuckets.taxes + opexBuckets.insurance + opexBuckets.repairsMaintenance + managementFeeAmount + opexBuckets.reserves);

  } else {
    // Original calculation if no projected NOI
    pgi = inputs.rentableSF > 0 && inputs.marketRentPerSF > 0 
              ? inputs.rentableSF * inputs.marketRentPerSF 
              : inputs.grossPotentialIncome; 
    vacancyLoss = pgi * (inputs.vacancyLossPercent / 100);
    creditLoss = pgi * (inputs.creditCollectionLossPercent / 100);
    effectiveGrossIncome = pgi - vacancyLoss - creditLoss;
    managementFeeAmount = effectiveGrossIncome * (opexBuckets.managementPercentOfEGI / 100);
    totalOperatingExpensesCalculated = 
      opexBuckets.taxes +
      opexBuckets.insurance +
      opexBuckets.repairsMaintenance +
      managementFeeAmount +
      opexBuckets.reserves;
    netOperatingIncomeToCap = effectiveGrossIncome - totalOperatingExpensesCalculated;
  }
  
  const capRate = inputs.capRateIncome / 100;
  const incomeApproachValue = capRate > 0 ? netOperatingIncomeToCap / capRate : 0;
  
  return { 
    potentialGrossIncome: pgi,
    vacancyLossAmount: vacancyLoss,
    creditCollectionLossAmount: creditLoss,
    effectiveGrossIncome, 
    managementFeeAmount,
    totalOperatingExpenses: totalOperatingExpensesCalculated,
    netOperatingIncome: netOperatingIncomeToCap, 
    incomeApproachValue,
    isFromCashFlowProjection: isFromProjection
  };
};

// This generateCashFlows is the simpler version. DCF will use buildFullDCFCashFlows from dcf.ts
export const generateCashFlows = (inputs: AppraisalInputs): AnnualCashFlow[] => {
  const annualCashFlows: AnnualCashFlow[] = [];
  const baseOpex = inputs.operatingExpensesBuckets;
  const totalRentRollSF = inputs.rentRoll.reduce((sum, entry) => sum + entry.squareFeet, 0);

  for (let year = 1; year <= inputs.projectionYears; year++) {
    let currentYearFlow: AnnualCashFlow = {
      year,
      potentialBaseRent: 0,
      scheduledEscalationsRevenue: 0,
      potentialMarketRentFromVacancy: 0,
      totalScheduledRentalRevenue: 0,
      tenantReimbursementsNNN: 0,
      potentialGrossRevenue: 0,
      generalVacancyLoss: 0,
      creditLoss: 0,
      effectiveGrossIncome: 0,
      operatingExpenses: 0,
      netOperatingIncome: 0,
      tenantImprovementsAndLcs: 0,
      capitalExpenditures: 0,
      netCashFlow: 0,
    };

    const expenseInflationFactor = Math.pow(1 + inputs.globalExpenseInflationPercent / 100, year - 1);
    const currentYearOpexUnmanaged = 
        (baseOpex.taxes + baseOpex.insurance + baseOpex.repairsMaintenance + baseOpex.reserves) * expenseInflationFactor;
    
    let sumOfRentsForMgtFeeCalc = 0;

    inputs.rentRoll.forEach(tenant => {
      const leaseStartDate = new Date(tenant.leaseStartDate);
      const leaseEndDate = new Date(tenant.leaseEndDate);
      const currentProjectionYearStartDate = new Date(inputs.effectiveDate);
      currentProjectionYearStartDate.setFullYear(currentProjectionYearStartDate.getFullYear() + year -1);
      const currentProjectionYearEndDate = new Date(inputs.effectiveDate);
      currentProjectionYearEndDate.setFullYear(currentProjectionYearEndDate.getFullYear() + year);

      if (leaseEndDate >= currentProjectionYearStartDate && leaseStartDate < currentProjectionYearEndDate) {
        let yearsIntoLease = currentProjectionYearStartDate.getFullYear() - leaseStartDate.getFullYear();
        if (currentProjectionYearStartDate.getMonth() < leaseStartDate.getMonth() || 
            (currentProjectionYearStartDate.getMonth() === leaseStartDate.getMonth() && currentProjectionYearStartDate.getDate() < leaseStartDate.getDate())) {
            yearsIntoLease--; 
        }
        yearsIntoLease = Math.max(0, yearsIntoLease);

        const annualBaseRent = tenant.squareFeet * tenant.currentRentPerSF;
        const currentYearScheduledRent = annualBaseRent * Math.pow(1 + tenant.escalationPercent / 100, yearsIntoLease);
        
        currentYearFlow.potentialBaseRent += annualBaseRent; 
        currentYearFlow.scheduledEscalationsRevenue += (currentYearScheduledRent - annualBaseRent); 
        currentYearFlow.totalScheduledRentalRevenue += currentYearScheduledRent;
        sumOfRentsForMgtFeeCalc += currentYearScheduledRent;

        if (tenant.reimbursementType === 'nnn' && totalRentRollSF > 0) {
          const tenantProRataShare = tenant.squareFeet / totalRentRollSF;
          currentYearFlow.tenantReimbursementsNNN += currentYearOpexUnmanaged * tenantProRataShare; // Simplified
        }
      }
      
      const previousProjectionYearEndDate = new Date(inputs.effectiveDate);
      previousProjectionYearEndDate.setFullYear(previousProjectionYearEndDate.getFullYear() + year - 1);
      const twoYearsPriorToCurrentProjectionStart = new Date(inputs.effectiveDate);
      twoYearsPriorToCurrentProjectionStart.setFullYear(new Date(inputs.effectiveDate).getFullYear() + year - 2);

      if (leaseEndDate < previousProjectionYearEndDate && leaseEndDate >= twoYearsPriorToCurrentProjectionStart) { 
         if (Math.random() < tenant.renewalProbabilityPercent / 100) { 
            const rentAfterDowntimeFactor = Math.max(0, 1 - tenant.renewalDowntimeMonths / 12);
            const renewalYearInflationFactor = Math.pow(1 + inputs.globalMarketRentGrowthPercent / 100, year -1);
            const inflatedRenewalRent = tenant.squareFeet * tenant.renewalMarketRentPerSF * renewalYearInflationFactor * rentAfterDowntimeFactor;

            currentYearFlow.potentialMarketRentFromVacancy += inflatedRenewalRent; 
            sumOfRentsForMgtFeeCalc += inflatedRenewalRent;
            
            currentYearFlow.tenantImprovementsAndLcs += tenant.squareFeet * tenant.renewalTiPerSF;
            currentYearFlow.tenantImprovementsAndLcs += inflatedRenewalRent * (tenant.renewalLcPercentOfFirstYearRent / 100);
         }
      }
    });
    
    const managementFeeForYear = sumOfRentsForMgtFeeCalc * (baseOpex.managementPercentOfEGI / 100) * expenseInflationFactor; 
    currentYearFlow.operatingExpenses = currentYearOpexUnmanaged + managementFeeForYear; // Note: currentYearOpexUnmanaged should already be inflated

    currentYearFlow.potentialGrossRevenue = currentYearFlow.totalScheduledRentalRevenue + 
                                           currentYearFlow.tenantReimbursementsNNN + 
                                           currentYearFlow.potentialMarketRentFromVacancy;

    currentYearFlow.generalVacancyLoss = currentYearFlow.potentialGrossRevenue * (inputs.generalVacancyRatePercentForProjections / 100);
    currentYearFlow.creditLoss = (currentYearFlow.potentialGrossRevenue - currentYearFlow.generalVacancyLoss) * (inputs.creditCollectionLossPercent / 100);
    currentYearFlow.effectiveGrossIncome = currentYearFlow.potentialGrossRevenue - currentYearFlow.generalVacancyLoss - currentYearFlow.creditLoss;

    currentYearFlow.netOperatingIncome = currentYearFlow.effectiveGrossIncome - currentYearFlow.operatingExpenses;

    inputs.capitalExpenditures.forEach(ce => {
      if (ce.year === year) {
        currentYearFlow.capitalExpenditures += ce.amount;
      }
    });

    currentYearFlow.netCashFlow = currentYearFlow.netOperatingIncome - currentYearFlow.tenantImprovementsAndLcs - currentYearFlow.capitalExpenditures;
    
    annualCashFlows.push(currentYearFlow);
  }
  return annualCashFlows;
};


export const calcSalesComparison = (
  salesComparables: ComparableSale[],
  valueSelection: SalesCompValueSelectionType,
  customValue: number
): SalesComparisonResults => {
  const adjustedComps: AdjustedComparableSale[] = salesComparables.map(comp => {
    const pricePerSF = comp.gba > 0 ? comp.salePrice / comp.gba : 0;
    const totalAdjustmentPercent = Object.values(comp.adjustments).reduce((sum, adj) => sum + adj, 0);
    const adjustedSalePrice = comp.salePrice * (1 + totalAdjustmentPercent / 100);
    const adjustedPricePerSF = comp.gba > 0 ? adjustedSalePrice / comp.gba : 0;
    return { ...comp, pricePerSF, totalAdjustmentPercent, adjustedSalePrice, adjustedPricePerSF };
  });

  const adjustedPrices = adjustedComps.map(ac => ac.adjustedSalePrice).filter(p => p > 0);
  let averageAdjustedPrice = 0;
  let medianAdjustedPrice = 0;

  if (adjustedPrices.length > 0) {
    averageAdjustedPrice = adjustedPrices.reduce((sum, price) => sum + price, 0) / adjustedPrices.length;
    
    const sortedPrices = [...adjustedPrices].sort((a, b) => a - b);
    const mid = Math.floor(sortedPrices.length / 2);
    medianAdjustedPrice = sortedPrices.length % 2 !== 0 ? sortedPrices[mid] : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;
  }
  
  let salesComparisonValue = 0;
  switch (valueSelection) {
    case 'average':
      salesComparisonValue = averageAdjustedPrice;
      break;
    case 'median':
      salesComparisonValue = medianAdjustedPrice;
      break;
    case 'custom':
      salesComparisonValue = customValue > 0 ? customValue : 0; // Ensure custom value is positive or zero
      break;
    default:
      salesComparisonValue = averageAdjustedPrice; // Default to average
  }

  return { 
    comparablesDetail: adjustedComps,
    averageAdjustedPrice,
    medianAdjustedPrice,
    salesComparisonValue
  };
};

export const calcCostApproach = (
  inputs: Pick<AppraisalInputs, 'effectiveAge' | 'economicLife' | 'improvementCostNew' | 'landValue'>
): CostApproachResults => {
  const { effectiveAge, economicLife, improvementCostNew, landValue } = inputs;
  let ageLifeDepreciationPercent = 0;
  if (economicLife > 0 && effectiveAge > 0 && effectiveAge <= economicLife) {
    ageLifeDepreciationPercent = (effectiveAge / economicLife) * 100;
  } else if (effectiveAge > economicLife && economicLife > 0) {
      ageLifeDepreciationPercent = 100; 
  }
  
  const totalDepreciationAmount = improvementCostNew * (ageLifeDepreciationPercent / 100);
  const depreciatedImprovementCost = improvementCostNew - totalDepreciationAmount;
  const costApproachValue = depreciatedImprovementCost + landValue;

  return { 
    ageLifeDepreciationPercent, 
    totalDepreciationAmount, 
    depreciatedImprovementCost, 
    costApproachValue: Math.max(0, costApproachValue) 
  };
};

export const reconcileValues = (
  incomeValue: number, 
  salesValue: number, 
  costValue: number, 
  weights: Pick<AppraisalInputs, 'incomeApproachWeight' | 'salesApproachWeight' | 'costApproachWeight'>
): number => {
  let weightedSum = 0;

  if (incomeValue > 0 && weights.incomeApproachWeight > 0) {
      weightedSum += incomeValue * (weights.incomeApproachWeight / 100);
  }
  if (salesValue > 0 && weights.salesApproachWeight > 0) {
      weightedSum += salesValue * (weights.salesApproachWeight / 100);
  }
  if (costValue > 0 && weights.costApproachWeight > 0) {
      weightedSum += costValue * (weights.costApproachWeight / 100);
  }
        
  return isNaN(weightedSum) ? 0 : weightedSum;
};


export const validateInputs = (inputs: AppraisalInputs): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (inputs.effectiveDate > inputs.reportDate) {
    errors.effectiveDate = 'Effective Date cannot be after Report Date.';
    errors.reportDate = 'Report Date cannot be before Effective Date.';
  }

  const checkNonNegative = (field: keyof AppraisalInputs, label: string) => {
    if (typeof inputs[field] === 'number' && (inputs[field] as number) < 0) {
      errors[field] = `${label} cannot be negative.`;
    }
  };
  
  const checkPositive = (field: keyof AppraisalInputs, label: string) => {
    if (typeof inputs[field] === 'number' && (inputs[field] as number) <= 0) {
      errors[field] = `${label} must be positive.`;
    }
  };

  const checkPercentage = (field: keyof AppraisalInputs, label: string, allowNegative: boolean = false, max: number = 100, min: number = 0) => {
    const value = inputs[field] as number;
    if (typeof value === 'number') {
      if (!allowNegative && value < min) errors[field] = `${label} cannot be less than ${min}%.`;
      if (value > max ) errors[field] = `${label} should not exceed ${max}%.`;
      if (allowNegative && value < -100) errors[field] = `${label} generally not less than -100%.`; // Example specific negative min
    }
  };
  
  const checkRange = (field: keyof AppraisalInputs, label: string, min: number, max: number) => {
    const value = inputs[field] as number;
    if (typeof value === 'number' && (value < min || value > max)) {
      errors[field] = `${label} must be between ${min} and ${max}.`;
    }
  };

  // Assignment
  if (!inputs.intendedUse.trim()) errors.intendedUse = "Intended Use is required.";
  if (!inputs.intendedUsers.trim()) errors.intendedUsers = "Intended User(s) is required.";
  if (!inputs.propertyRightsAppraised) errors.propertyRightsAppraised = "Property Rights Appraised is required.";

  // Site
  checkNonNegative('accessFrontageFeet', 'Access Frontage');
  checkNonNegative('accessCurbCuts', 'Access Curb Cuts');

  // Improvements
  checkPositive('gba', 'GBA');
  checkNonNegative('rentableSF', 'Rentable SF');
  checkNonNegative('usableSF', 'Usable SF');
  checkNonNegative('actualAge', 'Actual Age');
  checkNonNegative('effectiveAge', 'Effective Age');
  if (inputs.effectiveAge > inputs.actualAge) {
    // errors.effectiveAge = 'Effective Age generally should not exceed Actual Age.';
  }
  if (inputs.rentableSF > inputs.gba && inputs.gba > 0) errors.rentableSF = "Rentable SF cannot exceed GBA.";
  if (inputs.usableSF > inputs.rentableSF && inputs.rentableSF > 0) errors.usableSF = "Usable SF cannot exceed Rentable SF.";


  // Income Approach (Summary)
  checkNonNegative('grossPotentialIncome', 'Gross Potential Income (Summary)');
  checkPercentage('vacancyLossPercent', 'Vacancy Loss % (Summary)');
  checkPercentage('creditCollectionLossPercent', 'Credit/Collection Loss % (Summary)');
  Object.entries(inputs.operatingExpensesBuckets).forEach(([key, value]) => {
    if (key === 'managementPercentOfEGI') {
      if (value < 0 || value > 100) errors[`opex-${key}`] = 'Management Fee % must be between 0 and 100.';
    } else if (value < 0) {
      errors[`opex-${key}`] = `${key.replace(/([A-Z])/g, ' $1')} cannot be negative.`;
    }
  });
  checkPercentage('capRateIncome', 'Cap Rate (Direct)', false, 25, 1); // Cap rate usually positive and not excessively high
  checkNonNegative('marketRentPerSF', 'Market Rent/SF (Summary)');
  
  // Cash Flow Projection / DCF Assumptions
  checkRange('projectionYears', 'Projection Years', 1, 30);
  checkPercentage('globalMarketRentGrowthPercent', 'Global Market Rent Growth %', true, 20, -20); // Allow negative growth
  checkPercentage('globalExpenseInflationPercent', 'Global Expense Inflation %', true, 20, -20); // Allow negative inflation
  checkPercentage('generalVacancyRatePercentForProjections', 'General Vacancy % (Projections)');
  checkPercentage('discountRatePercent', 'Discount Rate %', false, 30, 1); // Discount rate usually positive
  checkPercentage('exitCapRate', 'Exit Cap Rate', false, 25, 1); // Exit cap usually positive
  checkPercentage('saleCostPercent', 'Sale Cost %', false, 20, 0); // Sale cost 0 to 20%


  // Rent Roll
  inputs.rentRoll.forEach((entry, idx) => {
    const suiteName = entry.suite || `Entry ${idx+1}`;
    if (!entry.suite.trim()) errors[`rentroll-${entry.id}-suite`] = `Suite name for entry ${idx+1} is required.`;
    if (entry.squareFeet <= 0) errors[`rentroll-${entry.id}-squareFeet`] = `SF for ${suiteName} must be positive.`;
    if (entry.currentRentPerSF < 0) errors[`rentroll-${entry.id}-currentRentPerSF`] = `Rent/SF for ${suiteName} cannot be negative.`;
    if (entry.leaseStartDate && entry.leaseEndDate && entry.leaseStartDate > entry.leaseEndDate) {
        errors[`rentroll-${entry.id}-leaseEndDate`] = `End date for ${suiteName} must be after start date.`;
    }
    checkPercentage(entry.escalationPercent as any, `Escalation % for ${suiteName}`, true, 20, -10); // Cast to any for direct value check
    checkPercentage(entry.renewalProbabilityPercent as any, `Renewal Prob. % for ${suiteName}`);
    if(entry.renewalDowntimeMonths < 0) errors[`rentroll-${entry.id}-renewalDowntimeMonths`] = `Renewal Downtime for ${suiteName} cannot be negative.`;
    if(entry.renewalMarketRentPerSF < 0) errors[`rentroll-${entry.id}-renewalMarketRentPerSF`] = `Renewal Market Rent for ${suiteName} cannot be negative.`;
    if(entry.renewalTiPerSF < 0) errors[`rentroll-${entry.id}-renewalTiPerSF`] = `Renewal TI for ${suiteName} cannot be negative.`;
    checkPercentage(entry.renewalLcPercentOfFirstYearRent as any, `Renewal LC % for ${suiteName}`);
    if(entry.renewTermYears < 0) errors[`rentroll-${entry.id}-renewTermYears`] = `Renew Term for ${suiteName} cannot be negative.`;
    if(entry.renewRentBumpPercent < -100 || entry.renewRentBumpPercent > 100) errors[`rentroll-${entry.id}-renewRentBumpPercent`] = `Renew Rent Bump % for ${suiteName} is out of typical range.`;

  });
  const totalRentRollSF = inputs.rentRoll.reduce((sum, entry) => sum + entry.squareFeet, 0);
  if (totalRentRollSF > inputs.rentableSF && inputs.rentableSF > 0) {
      errors.rentRoll = `Total SF in Rent Roll (${totalRentRollSF.toLocaleString()} SF) exceeds property's Rentable SF (${inputs.rentableSF.toLocaleString()} SF).`;
  }


  // Capital Expenditures
  inputs.capitalExpenditures.forEach((entry, idx) => {
    if (entry.year <=0) errors[`capex-${entry.id}-year`] = `Year for CapEx item "${entry.description || `item ${idx+1}`}" must be positive.`;
    if (entry.year > inputs.projectionYears && inputs.projectionYears > 0) errors[`capex-${entry.id}-year`] = `CapEx year for "${entry.description}" exceeds projection period.`;
    if (!entry.description.trim()) errors[`capex-${entry.id}-description`] = `Description for CapEx item in year ${entry.year} is required.`;
  });


  // Sales Comps
  checkPercentage('annualMarketConditionsAdjustmentPercent', 'Annual Market Conditions Adj. %', true, 50, -50);
  inputs.salesComparables.forEach((comp, index) => {
    if (comp.salePrice <= 0) errors[`comp-${index}-salePrice`] = `Comp ${index+1} Sale Price must be positive.`;
    if (comp.gba <= 0) errors[`comp-${index}-gba`] = `Comp ${index+1} GBA must be positive.`;
    Object.entries(comp.adjustments).forEach(([adjKey, adjValue]) => {
      if (typeof adjValue === 'number' && (adjValue < -100 || adjValue > 100 )) {
         errors[`comp-${index}-adj-${adjKey}`] = `Comp ${index+1} ${adjKey.replace(/([A-Z0-9])/g, ' $1')} adjustment should be reasonable (-100% to 100%).`;
      }
    });
  });
  if (inputs.salesCompValueSelection === 'custom' && inputs.salesCompCustomValue <= 0) {
    errors.salesCompCustomValue = 'Custom Sales Comparison Value must be positive if selected.';
  }


  // Cost Approach
  checkNonNegative('landValue', 'Land Value');
  checkPositive('improvementCostNew', 'Improvement Cost New');
  checkPositive('economicLife', 'Economic Life');
  checkPercentage('annualCostIndexEscalationPercent', 'Annual Cost Index Escalation %', true, 20, -20);

  // Reconciliation
  checkPercentage('incomeApproachWeight', 'Income Approach Weight');
  checkPercentage('salesApproachWeight', 'Sales Approach Weight');
  checkPercentage('costApproachWeight', 'Cost Approach Weight');

  // ESG
  checkRange('energyStarScore', 'ENERGY STAR Score', 0, 100);
  checkNonNegative('energyUseIntensity', 'Energy Use Intensity');
  checkNonNegative('scope1CarbonEmissions', 'Scope 1 Carbon Emissions');

  // Climate
  checkRange('wildFireRiskIndex', 'Wildfire Risk Index', 1, 5);
  checkRange('hurricaneRiskIndex', 'Hurricane Risk Index', 1, 5);
  checkRange('heatStressRiskIndex', 'Heat Stress Index', 1, 5);

  // Lease Details (Summary)
  checkNonNegative('weightedAverageLeaseTerm', 'WALT (Summary)');
  inputs.annualRolloverSchedule.forEach((val, idx) => {
    if (val < 0 || val > 100) errors[`rollover-year-${idx+1}`] = `Rollover for Year ${idx+1} must be between 0% and 100%.`;
  });
  checkNonNegative('expenseStopPerSF', 'Expense Stop/SF (Summary)');
  checkNonNegative('percentageRentBreakpoint', 'Percentage Rent Breakpoint (Summary)');
  checkPercentage('percentageRentOveragePercent', 'Percentage Rent Overage % (Summary)');
  checkNonNegative('freeRentMonths', 'Free Rent Months (Summary)');
  checkNonNegative('tiAllowancePerSF', 'TI Allowance/SF (Summary)');
  checkNonNegative('lcAllowancePerSF', 'LC Allowance/SF (Summary)');
  checkNonNegative('downtimeBetweenLeasesMonths', 'Downtime Months (Summary)');
  checkPercentage('relettingCostPercentOfRent', 'Re-letting Cost % (Summary)');

  // Market Capital
  checkPercentage('targetUnleveredIRR', 'Target Unlevered IRR %', false, 50);
  checkNonNegative('dcrThreshold', 'DCR Threshold');

  return errors;
};
