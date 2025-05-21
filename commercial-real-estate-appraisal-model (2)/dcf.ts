
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
 * IRR is the discount rate at which the Net Present Value (NPV) of all cash flows equals zero.
 * The first cash flow (index 0) is typically the initial investment (negative value).
 * Subsequent cash flows are positive inflows or negative outflows.
 * Uses the Newton-Raphson method, an iterative root-finding algorithm, to find the rate.
 */
export function solveIRR(cashFlows: number[], guess: number = 0.1): number {
    if (!cashFlows || cashFlows.length === 0) return 0; // No cash flows, IRR is undefined or 0.

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
 * Projects the key financial details (scheduled rent, TIs, LCs) for a single lease 
 * across each year of the projection period defined in `inputs`. 
 * This function focuses on individual lease terms and renewal assumptions.
 * Note: Reimbursements (e.g., NNN) are intended to be handled at the aggregate 
 * cash flow level in `buildFullDCFCashFlows` and are not calculated per lease here.
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
            // Lease is active during some part of this analysis year.
            // Calculate how many full years into the lease the current analysis year's start is.
            // This determines the number of escalations to apply.
            let yearsIntoLeaseForEscalation = analysisYearStartDate.getFullYear() - leaseStartDate.getFullYear();
            // If the analysis year starts before the anniversary month/day of the lease start,
            // then one less escalation has occurred.
             if (analysisYearStartDate.getMonth() < leaseStartDate.getMonth() || 
                (analysisYearStartDate.getMonth() === leaseStartDate.getMonth() && analysisYearStartDate.getDate() < leaseStartDate.getDate())) {
                yearsIntoLeaseForEscalation--; 
            }
            yearsIntoLeaseForEscalation = Math.max(0, yearsIntoLeaseForEscalation); // Ensure non-negative

            const baseAnnualRent = lease.squareFeet * lease.currentRentPerSF;
            let currentYearLeaseRent = baseAnnualRent;

            if (lease.escalationType === 'fixedPercent' && lease.escalationPercent > 0) {
                currentYearLeaseRent *= Math.pow(1 + lease.escalationPercent / 100, yearsIntoLeaseForEscalation);
            } else if (lease.escalationType === 'stepUp' || lease.escalationType === 'cpi') {
                // TODO: Implement 'stepUp' and 'cpi' escalations.
                // For now, they will default to no escalation beyond base rent for this lease.
                console.warn(`Escalation type '${lease.escalationType}' for lease '${lease.suite}' is not yet fully implemented and will use base rent without further escalation in projectSingleLeaseCashFlows.`);
            }

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

                // Deterministic renewal: lease renews if its renewal probability is 50% or higher.
                // For more advanced scenarios, specific user overrides or sensitivity analysis on renewal would be needed.
                if (lease.renewalProbabilityPercent >= 50) { 
                    // Lease Renews
                    const downtimeFactor = Math.max(0, (12 - lease.renewalDowntimeMonths) / 12);
                    
                    // Determine rent for renewal term:
                    // Start with the specified renewal market rent per SF.
                    // If a 'renewRentBumpPercent' is provided, it's assumed to be a bump on the *last escalated rent* of the prior term.
                    // The higher of this bumped rent or the renewalMarketRentPerSF could be used, or logic as defined (bump overrides).
                    // Finally, the chosen renewal rent is inflated from the property's effective date to the current analysis year.
                    let renewalBaseRentPerSF = lease.renewalMarketRentPerSF; 
                    if (lease.renewRentBumpPercent !== 0) { 
                        let lastEscalatedRentSF = lease.currentRentPerSF;
                        // Note: priorTermLength calculation is simplified. A more precise calculation 
                        // would involve iterating through the prior lease term year by year or using
                        // more detailed date/month arithmetic to count actual escalation applications.
                        const priorTermLength = leaseEndDate.getFullYear() - leaseStartDate.getFullYear(); 
                        if (lease.escalationType === 'fixedPercent' && lease.escalationPercent > 0) {
                            lastEscalatedRentSF *= Math.pow(1 + lease.escalationPercent / 100, Math.max(0,priorTermLength));
                        }
                         renewalBaseRentPerSF = lastEscalatedRentSF * (1 + lease.renewRentBumpPercent / 100);
                    }
                    // Inflate the determined renewal rent from the property's effective date to the current analysis year.
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
    yearIndex: number, // 0-indexed (e.g., Year 1 of projection is index 0)
    expenseInflationPercent: number,
    currentYearEGIForMgmtFee: number // EGI used specifically for management fee calculation for the current year.
): { totalOpex: number, recoverableOpexTotal: number } {
    const inflationFactor = Math.pow(1 + expenseInflationPercent / 100, yearIndex);
    
    const inflatedTaxes = baseOpex.taxes * inflationFactor;
    const inflatedInsurance = baseOpex.insurance * inflationFactor;
    const inflatedRM = baseOpex.repairsMaintenance * inflationFactor;
    const inflatedReserves = baseOpex.reserves * inflationFactor;
    
    // recoverableOpexTotal typically includes taxes, insurance, and CAM (Repairs & Maintenance).
    // Utilities might also be included if applicable and structured that way.
    const recoverableOpexTotal = inflatedTaxes + inflatedInsurance + inflatedRM;
    
    // Management fee is calculated based on the EGI passed to this function.
    // This EGI should ideally be the one that includes any applicable reimbursements.
    const managementFee = currentYearEGIForMgmtFee * (baseOpex.managementPercentOfEGI / 100);

    const totalOpex = recoverableOpexTotal + managementFee + inflatedReserves;
    
    return { totalOpex, recoverableOpexTotal };
}

/**
 * Calculates terminal value (reversionary value) of the property at the end of the projection period.
 * Formula: (Year N+1 Net Operating Income) / Exit Capitalization Rate.
 * Year N+1 NOI is typically the NOI of the last projected year, grown by a long-term growth rate.
 */
function calculateTerminalValue(
    finalYearNOI: number, // NOI of the last year in the projection period (Year N)
    nextYearNOIGrowthRate: number, // Assumed growth rate for NOI from Year N to Year N+1 (e.g., globalMarketRentGrowthPercent)
    exitCapRatePercent: number, // Assumed exit capitalization rate (%)
    saleCostPercent: number // Assumed costs of sale as a percentage of gross sale proceeds (%)
): { grossSaleProceeds: number, netSaleProceeds: number, yearNPlusOneNOI: number } {
    if (exitCapRatePercent === 0) return { grossSaleProceeds: 0, netSaleProceeds: 0, yearNPlusOneNOI: 0 }; // Avoid division by zero
    
    // Calculate NOI for the year immediately following the projection period (Year N+1)
    const yearNPlusOneNOI = finalYearNOI * (1 + nextYearNOIGrowthRate / 100);
    // Calculate gross sale proceeds (Terminal Value)
    const grossSaleProceeds = yearNPlusOneNOI / (exitCapRatePercent / 100);
    const saleCosts = grossSaleProceeds * (saleCostPercent / 100);
    const netSaleProceeds = grossSaleProceeds - saleCosts;
    
    return { grossSaleProceeds, netSaleProceeds, yearNPlusOneNOI };
}


export function buildFullDCFCashFlows(inputs: AppraisalInputs): DCFResults | null {
    if (inputs.projectionYears <= 0) return null;

    const cashFlows: AnnualCashFlowDCF[] = [];
    // Project cash flow details for each lease individually.
    const allLeaseProjections: ProjectedLeaseYearDetail[][] = inputs.rentRoll.map(lease => 
        projectSingleLeaseCashFlows(lease, inputs)
    );

    // Iterate through each projection year to build the aggregate property cash flow.
    for (let i = 0; i < inputs.projectionYears; i++) {
        const currentYear = i + 1;
        let yearCF: Partial<AnnualCashFlowDCF> = { year: currentYear };

        yearCF.potentialBaseRent = 0; 
        yearCF.scheduledEscalationsRevenue = 0; 
        yearCF.totalScheduledRentalRevenue = 0;
        yearCF.tenantImprovementsAndLcs = 0;
        
        allLeaseProjections.forEach(leaseDetailArray => {
            const detailForThisYear = leaseDetailArray[i];
            if (detailForThisYear) {
                yearCF.totalScheduledRentalRevenue! += detailForThisYear.scheduledRent;
                yearCF.tenantImprovementsAndLcs! += detailForThisYear.tiCosts + detailForThisYear.lcCosts;
            }
        });

        // Step 1: Calculate Potential Rental Income and associated vacancy/credit loss
        // Note: This model currently does not include speculative income from leasing up vacant space 
        // beyond existing lease renewals. The generalVacancyLossPercentForProjections accounts for 
        // vacancy on scheduled and renewal income, but not for new income from currently unleased space.
        yearCF.potentialMarketRentFromVacancy = 0; 

        const potentialRentalIncome = yearCF.totalScheduledRentalRevenue! + yearCF.potentialMarketRentFromVacancy!;
        const vacancyLossOnRental = potentialRentalIncome * (inputs.generalVacancyRatePercentForProjections / 100);
        const creditLossOnRental = (potentialRentalIncome - vacancyLossOnRental) * (inputs.creditCollectionLossPercent / 100);
        const effectiveGrossRentalIncome = potentialRentalIncome - vacancyLossOnRental - creditLossOnRental;

        // Step 2: Calculate Operating Expenses and NNN Reimbursements
        // Temporarily use effectiveGrossRentalIncome for management fee calculation.
        // This will be refined if EGI for mgmt fee needs to include reimbursements definitively.
        const opexResults = calculateAnnualOperatingExpenses(
            inputs.operatingExpensesBuckets,
            i, // 0-indexed year for inflation
            inputs.globalExpenseInflationPercent,
            effectiveGrossRentalIncome // EGI used for management fee calculation
        );
        
        yearCF.operatingExpenses = opexResults.totalOpex;
        // Assume 100% of recoverable expenses (current year's inflated taxes, insurance, R&M) 
        // are reimbursed if there's at least one NNN lease in the rent roll.
        // A more granular model could check the reimbursement type of each active lease 
        // and sum reimbursements accordingly, or apply a property-level reimbursement percentage.
        yearCF.tenantReimbursementsNNN = inputs.rentRoll.some(l => l.reimbursementType === 'nnn') 
            ? opexResults.recoverableOpexTotal 
            : 0;

        // Step 3: Recalculate Potential Gross Income (PGI) and Effective Gross Income (EGI)
        // PGI now includes scheduled rent, market rent (if any), and NNN reimbursements.
        yearCF.potentialGrossRevenue = yearCF.totalScheduledRentalRevenue! + 
                                       yearCF.tenantReimbursementsNNN! + 
                                       yearCF.potentialMarketRentFromVacancy!;
        
        // Vacancy and Credit Loss are typically applied only to rental income components 
        // (scheduled rent, market rent from vacancy), not to NNN reimbursements (which are actual expense recoveries)
        // or other income like parking, etc. (if modeled separately).
        // Thus, vacancyLossOnRental and creditLossOnRental calculated in Step 1 are used here.
        yearCF.generalVacancyLoss = vacancyLossOnRental;
        yearCF.creditLoss = creditLossOnRental;
        
        // Final EGI for the year.
        yearCF.effectiveGrossIncome = yearCF.potentialGrossRevenue - yearCF.generalVacancyLoss - yearCF.creditLoss;
        
        // Step 4: Adjust Management Fee if it's based on EGI inclusive of reimbursements.
        // The initial management fee in `opexResults.totalOpex` was based on `effectiveGrossRentalIncome`.
        // If the final EGI (including reimbursements) is different, the management fee needs adjustment.
        // This ensures the management fee is calculated on the correct EGI base as per typical industry practice.
        if (yearCF.effectiveGrossIncome !== effectiveGrossRentalIncome) {
             const mgmtFeeFinal = yearCF.effectiveGrossIncome * (inputs.operatingExpensesBuckets.managementPercentOfEGI / 100);
             const mgmtFeeInitial = effectiveGrossRentalIncome * (inputs.operatingExpensesBuckets.managementPercentOfEGI / 100);
             // Adjust total operating expenses by the difference in calculated management fee.
             yearCF.operatingExpenses = yearCF.operatingExpenses - mgmtFeeInitial + mgmtFeeFinal; 
        }

        yearCF.netOperatingIncome = yearCF.effectiveGrossIncome - yearCF.operatingExpenses;

        yearCF.capitalExpenditures = inputs.capitalExpenditures
            .filter(ce => ce.year === currentYear)
            .reduce((sum, ce) => sum + ce.amount, 0);

        yearCF.netCashFlow = yearCF.netOperatingIncome - yearCF.tenantImprovementsAndLcs! - yearCF.capitalExpenditures;
        yearCF.netCashFlowWithTerminal = yearCF.netCashFlow; // Will be adjusted for last year

        cashFlows.push(yearCF as AnnualCashFlowDCF);
    }

    // Terminal Value Calculation at the end of the projection period.
    const finalProjectionYearNOI = cashFlows[inputs.projectionYears - 1]?.netOperatingIncome || 0;
    const tv = calculateTerminalValue(
        finalProjectionYearNOI,
        inputs.globalMarketRentGrowthPercent, // Assumed growth for NOI from Year N to Year N+1
        inputs.exitCapRate,
        inputs.saleCostPercent
    );

    // Add net sale proceeds from terminal value to the cash flow of the final projection year.
    if (cashFlows.length === inputs.projectionYears) {
        cashFlows[inputs.projectionYears - 1].netCashFlowWithTerminal! += tv.netSaleProceeds;
    }

    // Calculate Present Value (PV) for each year's cash flow and sum them for DCF value.
    let sumOfPVs = 0;
    cashFlows.forEach(cf => {
        cf.presentValueFactor = 1 / Math.pow(1 + inputs.discountRatePercent / 100, cf.year);
        cf.presentValueOfNetCashFlow = cf.netCashFlowWithTerminal! * cf.presentValueFactor;
        sumOfPVs += cf.presentValueOfNetCashFlow;
    });
    
    const dcfValue = sumOfPVs; // Total Present Value of future cash flows.
    const year1NOI = cashFlows[0]?.netOperatingIncome || 0;
    const goingInCapRate = dcfValue !== 0 ? (year1NOI / dcfValue) * 100 : 0; // Year 1 NOI / DCF Value

    // Calculate Internal Rate of Return (IRR).
    // The cash flow series for IRR includes the initial investment (DCF value as negative at Year 0)
    // followed by the annual net cash flows (including terminal value in the last year).
    const irrCashFlows: number[] = [-dcfValue]; 
    cashFlows.forEach(cf => irrCashFlows.push(cf.netCashFlowWithTerminal!)); 
    
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
