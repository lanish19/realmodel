
import { 
    AppraisalInputs, 
    RentRollEntry, 
    OpexBuckets, 
    AnnualCashFlowDCF, 
    DCFResults,
    EscalationType
} from './types';

const MAX_IRR_ITERATIONS = 100;
const IRR_PRECISION = 1e-7;

/**
 * Calculates the Internal Rate of Return (IRR) for a series of cash flows.
 * The first cash flow is typically the initial investment (negative).
 * Uses the Newton-Raphson method.
 */
export function solveIRR(cashFlows: number[], guess: number = 0.1): number {
    if (!cashFlows || cashFlows.length === 0) return 0;

    let rate = guess;
    for (let i = 0; i < MAX_IRR_ITERATIONS; i++) {
        let npv = 0;
        let dnpv_dr = 0; // Derivative of NPV with respect to rate

        for (let t = 0; t < cashFlows.length; t++) {
            npv += cashFlows[t] / Math.pow(1 + rate, t); // Year 0 is t=0
            if (t > 0) { // Derivative term only for t > 0
                dnpv_dr -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
            }
        }

        if (Math.abs(npv) < IRR_PRECISION) {
            return rate * 100; // Return as percentage
        }

        if (dnpv_dr === 0) { // Avoid division by zero
            return NaN; // Cannot solve
        }
        rate -= npv / dnpv_dr;
    }
    return NaN; // Failed to converge
}


interface ProjectedLeaseYearDetail {
    year: number;
    scheduledRent: number;
    reimbursements: number;
    tiCosts: number;
    lcCosts: number;
    isVacantAfterExpiry: boolean; // If lease expired and didn't renew, this period is vacant
}

/**
 * Projects cash flows for a single lease over the analysis period.
 */
function projectSingleLeaseCashFlows(
    lease: RentRollEntry,
    inputs: Pick<AppraisalInputs, 'projectionYears' | 'globalMarketRentGrowthPercent' | 'effectiveDate'>
): ProjectedLeaseYearDetail[] {
    const yearlyDetails: ProjectedLeaseYearDetail[] = [];
    const leaseStartDate = new Date(lease.leaseStartDate);
    const leaseEndDate = new Date(lease.leaseEndDate);
    const propertyEffectiveDate = new Date(inputs.effectiveDate);

    for (let projYearIdx = 0; projYearIdx < inputs.projectionYears; projYearIdx++) {
        const currentAnalysisYear = projYearIdx + 1;
        // Determine the start and end date of the current analysis year
        const analysisYearStartDate = new Date(propertyEffectiveDate);
        analysisYearStartDate.setFullYear(propertyEffectiveDate.getFullYear() + projYearIdx);
        
        const analysisYearEndDate = new Date(propertyEffectiveDate);
        analysisYearEndDate.setFullYear(propertyEffectiveDate.getFullYear() + projYearIdx + 1);
        analysisYearEndDate.setDate(analysisYearEndDate.getDate() -1); // End of the year

        let yearDetail: ProjectedLeaseYearDetail = { 
            year: currentAnalysisYear, 
            scheduledRent: 0, 
            reimbursements: 0, 
            tiCosts: 0, 
            lcCosts: 0,
            isVacantAfterExpiry: false
        };

        // Is the lease term overlapping with the current analysis year?
        if (leaseStartDate <= analysisYearEndDate && leaseEndDate >= analysisYearStartDate) {
            // Lease is active during some part of this analysis year
            let yearsIntoLeaseForEscalation = analysisYearStartDate.getFullYear() - leaseStartDate.getFullYear();
             if (analysisYearStartDate.getMonth() < leaseStartDate.getMonth() || 
                (analysisYearStartDate.getMonth() === leaseStartDate.getMonth() && analysisYearStartDate.getDate() < leaseStartDate.getDate())) {
                yearsIntoLeaseForEscalation--; 
            }
            yearsIntoLeaseForEscalation = Math.max(0, yearsIntoLeaseForEscalation);

            const baseAnnualRent = lease.squareFeet * lease.currentRentPerSF;
            let currentYearLeaseRent = baseAnnualRent;

            if (lease.escalationType === 'fixedPercent' && lease.escalationPercent > 0) {
                currentYearLeaseRent *= Math.pow(1 + lease.escalationPercent / 100, yearsIntoLeaseForEscalation);
            }
            // TODO: Add logic for 'stepUp' and 'cpi' escalationTypes if escalationDetail is used

            yearDetail.scheduledRent = currentYearLeaseRent;

            // Simplified NNN Reimbursement: Pro-rata share of *base year* expenses, inflated.
            // This is a simplification. True NNN would be based on actual current year expenses.
            // This part is better handled in the aggregate cash flow build.
            // Here, we just mark that reimbursements *could* occur. Actual calculation later.
        } else if (leaseEndDate < analysisYearStartDate) { // Lease has expired before this analysis year starts
            // Consider renewal if it's the year immediately after expiry
            const yearOfExpiry = leaseEndDate.getFullYear();
            const monthOfExpiry = leaseEndDate.getMonth();
            
            // If the lease expired in the previous analysis year, or early in this one before renewal term kicks in.
            if (analysisYearStartDate.getFullYear() === yearOfExpiry + 1 || 
                (analysisYearStartDate.getFullYear() === yearOfExpiry && analysisYearStartDate.getMonth() > monthOfExpiry) ) {

                if (Math.random() < lease.renewalProbabilityPercent / 100) { // Stochastic element for renewal
                    // Lease Renews
                    const downtimeFactor = Math.max(0, (12 - lease.renewalDowntimeMonths) / 12);
                    
                    // Determine rent for renewal term
                    let renewalBaseRentPerSF = lease.renewalMarketRentPerSF; // Default to specified renewal market rent
                    if (lease.renewRentBumpPercent !== 0) { // If a bump % is specified, it might be on last rent or market
                        // Assuming bump is on the last escalated rent of the prior term
                        let lastEscalatedRentSF = lease.currentRentPerSF;
                        const priorTermLength = leaseEndDate.getFullYear() - leaseStartDate.getFullYear(); // Simplified
                        if (lease.escalationType === 'fixedPercent' && lease.escalationPercent > 0) {
                            lastEscalatedRentSF *= Math.pow(1 + lease.escalationPercent / 100, Math.max(0,priorTermLength));
                        }
                         renewalBaseRentPerSF = lastEscalatedRentSF * (1 + lease.renewRentBumpPercent / 100);
                    }
                     // Inflate renewal market rent to the current analysis year if renewalMarketRentPerSF was as of T0
                    const yearsToInflateRenewalRent = analysisYearStartDate.getFullYear() - propertyEffectiveDate.getFullYear();
                    const inflatedRenewalMarketRentPerSF = renewalBaseRentPerSF * Math.pow(1 + inputs.globalMarketRentGrowthPercent / 100, Math.max(0, yearsToInflateRenewalRent));

                    yearDetail.scheduledRent = lease.squareFeet * inflatedRenewalMarketRentPerSF * downtimeFactor;
                    
                    // TI & LC costs occur in the year of renewal (typically beginning of renewal term)
                    yearDetail.tiCosts = lease.squareFeet * lease.renewalTiPerSF;
                    // LC is % of first year's *renewed* rent
                    const firstYearFullRenewedRent = lease.squareFeet * inflatedRenewalMarketRentPerSF;
                    yearDetail.lcCosts = firstYearFullRenewedRent * (lease.renewalLcPercentOfFirstYearRent / 100);
                } else {
                    // Lease did not renew - space is vacant until re-leased at market
                    yearDetail.isVacantAfterExpiry = true;
                }
            }
        }
        yearlyDetails.push(yearDetail);
    }
    return yearlyDetails;
}


/**
 * Calculates total operating expenses for a given year, inflated.
 */
function calculateAnnualOperatingExpenses(
    baseOpex: OpexBuckets,
    yearIndex: number, // 0-indexed (Year 1 is index 0)
    expenseInflationPercent: number,
    currentYearEGI: number // EGI for the current projection year
): number {
    const inflationFactor = Math.pow(1 + expenseInflationPercent / 100, yearIndex);
    
    const inflatedTaxes = baseOpex.taxes * inflationFactor;
    const inflatedInsurance = baseOpex.insurance * inflationFactor;
    const inflatedRM = baseOpex.repairsMaintenance * inflationFactor;
    const inflatedReserves = baseOpex.reserves * inflationFactor;
    // Utilities if they were part of baseOpex and not directly reimbursed
    // const inflatedUtilities = (baseOpex.utilities || 0) * inflationFactor;
    
    const managementFee = currentYearEGI * (baseOpex.managementPercentOfEGI / 100);
    // Note: Management fee itself is often subject to inflation if the % is on an inflating EGI.
    // If management % is fixed, then it's just on current EGI.

    return inflatedTaxes + inflatedInsurance + inflatedRM + managementFee + inflatedReserves; // + inflatedUtilities;
}

/**
 * Calculates terminal value of the property.
 */
function calculateTerminalValue(
    finalYearNOI: number,
    nextYearNOIGrowthRate: number, // e.g., globalMarketRentGrowthPercent
    exitCapRatePercent: number,
    saleCostPercent: number
): { grossSaleProceeds: number, netSaleProceeds: number, yearNPlusOneNOI: number } {
    if (exitCapRatePercent === 0) return { grossSaleProceeds: 0, netSaleProceeds: 0, yearNPlusOneNOI: 0 };
    
    const yearNPlusOneNOI = finalYearNOI * (1 + nextYearNOIGrowthRate / 100);
    const grossSaleProceeds = yearNPlusOneNOI / (exitCapRatePercent / 100);
    const saleCosts = grossSaleProceeds * (saleCostPercent / 100);
    const netSaleProceeds = grossSaleProceeds - saleCosts;
    
    return { grossSaleProceeds, netSaleProceeds, yearNPlusOneNOI };
}


export function buildFullDCFCashFlows(inputs: AppraisalInputs): DCFResults | null {
    if (inputs.projectionYears <= 0) return null;

    const cashFlows: AnnualCashFlowDCF[] = [];
    const allLeaseProjections: ProjectedLeaseYearDetail[][] = inputs.rentRoll.map(lease => 
        projectSingleLeaseCashFlows(lease, inputs)
    );

    for (let i = 0; i < inputs.projectionYears; i++) {
        const currentYear = i + 1;
        let yearCF: Partial<AnnualCashFlowDCF> = { year: currentYear };

        yearCF.potentialBaseRent = 0; // This might be better named 'Scheduled Contract Rent'
        yearCF.scheduledEscalationsRevenue = 0; // This can be combined with above.
        yearCF.totalScheduledRentalRevenue = 0;
        yearCF.tenantImprovementsAndLcs = 0;
        yearCF.tenantReimbursementsNNN = 0; // Simplified NNN placeholder

        allLeaseProjections.forEach(leaseDetailArray => {
            const detailForThisYear = leaseDetailArray[i];
            if (detailForThisYear) {
                yearCF.totalScheduledRentalRevenue! += detailForThisYear.scheduledRent;
                yearCF.tenantImprovementsAndLcs! += detailForThisYear.tiCosts + detailForThisYear.lcCosts;
                // NNN Reimbursement logic:
                // This is a simplification. True NNN requires iterating on OpEx or a more complex setup.
                // Assuming NNN reimbursements are a % of the sum of non-management OpEx.
            }
        });
        
        // Potential Market Rent from general vacancy / unleased space (simplified)
        // This would be complex, involving market leasing assumptions for vacant SF.
        // For now, rely on generalVacancyRatePercentForProjections.
        yearCF.potentialMarketRentFromVacancy = 0; // Placeholder for speculative leasing income.

        yearCF.potentialGrossRevenue = yearCF.totalScheduledRentalRevenue! + 
                                       yearCF.tenantReimbursementsNNN! + 
                                       yearCF.potentialMarketRentFromVacancy!;

        yearCF.generalVacancyLoss = yearCF.potentialGrossRevenue * (inputs.generalVacancyRatePercentForProjections / 100);
        yearCF.creditLoss = (yearCF.potentialGrossRevenue - yearCF.generalVacancyLoss) * (inputs.creditCollectionLossPercent / 100);
        yearCF.effectiveGrossIncome = yearCF.potentialGrossRevenue - yearCF.generalVacancyLoss - yearCF.creditLoss;

        yearCF.operatingExpenses = calculateAnnualOperatingExpenses(
            inputs.operatingExpensesBuckets, 
            i, // 0-indexed year for inflation
            inputs.globalExpenseInflationPercent,
            yearCF.effectiveGrossIncome 
        );
        
        yearCF.netOperatingIncome = yearCF.effectiveGrossIncome - yearCF.operatingExpenses;

        yearCF.capitalExpenditures = inputs.capitalExpenditures
            .filter(ce => ce.year === currentYear)
            .reduce((sum, ce) => sum + ce.amount, 0);

        yearCF.netCashFlow = yearCF.netOperatingIncome - yearCF.tenantImprovementsAndLcs! - yearCF.capitalExpenditures;
        yearCF.netCashFlowWithTerminal = yearCF.netCashFlow; // Will be adjusted for last year

        cashFlows.push(yearCF as AnnualCashFlowDCF);
    }

    // Terminal Value Calculation
    const finalProjectionYearNOI = cashFlows[inputs.projectionYears - 1]?.netOperatingIncome || 0;
    const tv = calculateTerminalValue(
        finalProjectionYearNOI,
        inputs.globalMarketRentGrowthPercent, // Growth for NOI year N+1
        inputs.exitCapRate,
        inputs.saleCostPercent
    );

    if (cashFlows.length === inputs.projectionYears) {
        cashFlows[inputs.projectionYears - 1].netCashFlowWithTerminal! += tv.netSaleProceeds;
    }

    // PV Calculations
    let sumOfPVs = 0;
    cashFlows.forEach(cf => {
        cf.presentValueFactor = 1 / Math.pow(1 + inputs.discountRatePercent / 100, cf.year);
        cf.presentValueOfNetCashFlow = cf.netCashFlowWithTerminal! * cf.presentValueFactor;
        sumOfPVs += cf.presentValueOfNetCashFlow;
    });
    
    const dcfValue = sumOfPVs;
    const year1NOI = cashFlows[0]?.netOperatingIncome || 0;
    const goingInCapRate = dcfValue !== 0 ? (year1NOI / dcfValue) * 100 : 0;

    // IRR Calculation
    // Create cash flow series for IRR: initial investment (DCF value as negative) followed by NCFs
    const irrCashFlows: number[] = [-dcfValue]; // Year 0 is the "investment"
    cashFlows.forEach(cf => irrCashFlows.push(cf.netCashFlowWithTerminal!)); // Years 1 to N
    
    const internalRateOfReturn = solveIRR(irrCashFlows);

    return {
        projectedCashFlowsDCF: cashFlows,
        dcfValue,
        goingInCapRate,
        internalRateOfReturn,
        netSaleProceedsTerminal: tv.netSaleProceeds,
        terminalValueGross: tv.grossSaleProceeds,
        yearNPlusOneNOI: tv.yearNPlusOneNOI,
    };
}
