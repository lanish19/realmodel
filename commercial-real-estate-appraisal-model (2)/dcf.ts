
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
            const currentLeaseYearNumber = yearsIntoLeaseForEscalation + 1; // 1-indexed year in lease term

            if (lease.escalationType === 'fixedPercent' && lease.escalationPercent > 0) {
                currentYearLeaseRent *= Math.pow(1 + lease.escalationPercent / 100, yearsIntoLeaseForEscalation);
            } else if (lease.escalationType === 'stepUp' && lease.stepUpSchedule && lease.stepUpSchedule.length > 0) {
                let effectiveStepRentPerSF = lease.currentRentPerSF; // Start with base SF rent
                const sortedSchedule = [...lease.stepUpSchedule].sort((a, b) => a.yearInLeaseTerm - b.yearInLeaseTerm);
                for (const step of sortedSchedule) {
                    if (currentLeaseYearNumber >= step.yearInLeaseTerm) {
                        effectiveStepRentPerSF = step.rentPerSF;
                    } else {
                        break; // Stop if current year is before this step's effective year
                    }
                }
                currentYearLeaseRent = lease.squareFeet * effectiveStepRentPerSF;
            } else if (lease.escalationType === 'cpi') {
                const escalationRateToApply = lease.cpiEscalationRatePercent ?? inputs.globalMarketRentGrowthPercent;
                const reviewFrequency = lease.cpiReviewFrequencyYears ?? 1; // Default to 1 year if not specified
                
                if (currentLeaseYearNumber > 0 && reviewFrequency > 0) {
                    // Calculate the number of full annual escalations that should have occurred by the start of the last review period.
                    // Rent stays flat between reviews. Escalation is applied based on compounded annual rate at review points.
                    const yearOfLastReviewApplication = Math.floor((currentLeaseYearNumber - 1) / reviewFrequency) * reviewFrequency;
                    currentYearLeaseRent = baseAnnualRent * Math.pow(1 + escalationRateToApply / 100, yearOfLastReviewApplication);
                } else {
                    currentYearLeaseRent = baseAnnualRent; // Base rent if review frequency is invalid or it's before the first potential review
                }
            } else if (lease.escalationType === 'stepUp' || lease.escalationType === 'cpi') {
                 // Handles cases where stepUpSchedule is missing/empty or cpi fields are such that no specific logic applied.
                 console.warn(`Escalation type '${lease.escalationType}' for lease '${lease.suite}' may not have sufficient data for full calculation (e.g. empty stepUpSchedule). Using base rent.`);
                 currentYearLeaseRent = baseAnnualRent;
            }
            // If no escalation type matches or specific conditions aren't met, currentYearLeaseRent remains baseAnnualRent.

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
    baseOpex: OpexBuckets, // Updated type
    yearIndex: number, // 0-indexed
    globalExpenseInflationPercent: number, // Fallback inflation
    currentYearEGIForMgmtFee: number
): { totalOpex: number, recoverableOpexTotal: number } {
    let totalOpexCalc = 0;
    let recoverableOpexTotalCalc = 0;

    const expenseKeys = Object.keys(baseOpex) as Array<keyof OpexBuckets>;

    for (const key of expenseKeys) {
        if (key === 'managementPercentOfEGI') continue; // Handle management fee separately

        const expenseItem = baseOpex[key];
        if (!expenseItem || typeof expenseItem.amount !== 'number') continue; // Skip if item is invalid

        const itemSpecificInflation = expenseItem.inflationRate ?? globalExpenseInflationPercent;
        const inflationFactor = Math.pow(1 + itemSpecificInflation / 100, yearIndex);
        const inflatedAmount = expenseItem.amount * inflationFactor;

        totalOpexCalc += inflatedAmount;

        // Determine recoverability
        const isTypicallyRecoverable = key === 'taxes' || key === 'insurance' || key === 'repairsMaintenance';
        if (expenseItem.isRecoverable === true || (expenseItem.isRecoverable === undefined && isTypicallyRecoverable)) {
            recoverableOpexTotalCalc += inflatedAmount;
        }
    }

    // Management Fee Calculation
    const mgmtFeeItem = baseOpex.managementPercentOfEGI;
    let mgmtFeePercentage = mgmtFeeItem.amount; // This is the percentage, e.g., 3 for 3%

    // Optional: Inflate the management fee percentage itself if inflationRate is provided on the mgmtFeeItem
    if (mgmtFeeItem.inflationRate !== undefined && mgmtFeeItem.inflationRate !== null) {
        const mgmtFeeInflationFactor = Math.pow(1 + mgmtFeeItem.inflationRate / 100, yearIndex);
        mgmtFeePercentage *= mgmtFeeInflationFactor; // Inflate the percentage
    }

    const managementFee = currentYearEGIForMgmtFee * (mgmtFeePercentage / 100);
    totalOpexCalc += managementFee;

    // Note: Management fee is typically not added to 'recoverableOpexTotalCalc' for NNN purposes.
    // If specific lease terms dictate it's recoverable, that would be a more complex adjustment.

    return { totalOpex: totalOpexCalc, recoverableOpexTotal: recoverableOpexTotalCalc };
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

    // Pre-computation for Market Leasing Assumptions
    const initialVacantSF = inputs.rentableSF - inputs.rentRoll.reduce((sum, lease) => sum + lease.squareFeet, 0);
    let cumulativeVacantSFFromPriorYearNonRenewals = 0;
    let sfLeasedInPriorYearsAndStillActive = 0;


    // Iterate through each projection year to build the aggregate property cash flow.
    for (let i = 0; i < inputs.projectionYears; i++) {
        const currentYear = i + 1;
        let yearCF: Partial<AnnualCashFlowDCF> = { year: currentYear };

        yearCF.potentialBaseRent = 0; 
        yearCF.scheduledEscalationsRevenue = 0; 
        yearCF.totalScheduledRentalRevenue = 0;
        yearCF.tenantImprovementsAndLcs = 0; // Initialize here

        // Accumulate scheduled rent and TIs/LCs from existing/renewing leases
        inputs.rentRoll.forEach((lease, leaseIdx) => {
            const leaseProjectionForThisYear = allLeaseProjections[leaseIdx]?.[i];
            if (leaseProjectionForThisYear) {
                yearCF.totalScheduledRentalRevenue! += leaseProjectionForThisYear.scheduledRent;
                yearCF.tenantImprovementsAndLcs! += leaseProjectionForThisYear.tiCosts + leaseProjectionForThisYear.lcCosts;
            }
        });
        
        // Market Leasing Assumptions Logic
        let sfNewlyVacantThisYearFromNonRenewals = 0;
        inputs.rentRoll.forEach((lease, leaseIdx) => {
            const leaseProjectionForThisYear = allLeaseProjections[leaseIdx]?.[i];
            if (leaseProjectionForThisYear?.isVacantAfterExpiry) {
                sfNewlyVacantThisYearFromNonRenewals += lease.squareFeet;
            }
        });

        const totalVacantSFAtStartOfYear = Math.max(0, (i === 0 ? initialVacantSF : 0) + cumulativeVacantSFFromPriorYearNonRenewals - sfLeasedInPriorYearsAndStillActive);
        
        yearCF.potentialMarketRentFromVacancy = 0;
        let newMarketLeaseTICostsThisYear = 0;
        let newMarketLeaseLCCostsThisYear = 0;

        if (inputs.marketLeasingAssumptions && totalVacantSFAtStartOfYear > 0) {
            const mla = inputs.marketLeasingAssumptions;
            const timeToLeaseMonths = mla.timeToLeaseVacantSFMonths;
            const sfToLeaseThisYear = totalVacantSFAtStartOfYear; // Attempt to lease all available in the pool

            const inflatedMarketRentPerSF = mla.marketRentNewLeasePerSF * Math.pow(1 + inputs.globalMarketRentGrowthPercent / 100, i);
            const downtimeFactor = Math.max(0, (12 - timeToLeaseMonths)) / 12; 
            
            const rentFromNewlyLeasedSF = sfToLeaseThisYear * inflatedMarketRentPerSF * downtimeFactor;
            yearCF.potentialMarketRentFromVacancy = rentFromNewlyLeasedSF;

            const tiForNewlyLeasedSF = sfToLeaseThisYear * mla.newLeaseTiPerSF;
            const firstYearFullRentForLC = sfToLeaseThisYear * inflatedMarketRentPerSF; // Non-downtime adjusted for LC base
            const lcForNewlyLeasedSF = firstYearFullRentForLC * (mla.newLeaseLcPercent / 100);
            
            newMarketLeaseTICostsThisYear = tiForNewlyLeasedSF;
            newMarketLeaseLCCostsThisYear = lcForNewlyLeasedSF;
            
            sfLeasedInPriorYearsAndStillActive += sfToLeaseThisYear; // Update SF leased tracker
        }
        
        yearCF.tenantImprovementsAndLcs! += newMarketLeaseTICostsThisYear + newMarketLeaseLCCostsThisYear;
        cumulativeVacantSFFromPriorYearNonRenewals += sfNewlyVacantThisYearFromNonRenewals;


        // Calculate total potential rental income before vacancy/credit loss
        const potentialRentalIncome = yearCF.totalScheduledRentalRevenue! + (yearCF.potentialMarketRentFromVacancy || 0);
        const vacancyLossOnRental = potentialRentalIncome * (inputs.generalVacancyRatePercentForProjections / 100);
        const creditLossOnRental = (potentialRentalIncome - vacancyLossOnRental) * (inputs.creditCollectionLossPercent / 100);
        const effectiveGrossRentalIncome = potentialRentalIncome - vacancyLossOnRental - creditLossOnRental;

        // Calculate Other Income for the current year
        let currentYearOtherIncome = 0;
        if (inputs.otherIncome && inputs.otherIncome.length > 0) {
            inputs.otherIncome.forEach(item => {
                const itemGrowthRate = item.growthRate ?? inputs.globalMarketRentGrowthPercent;
                const inflatedAmount = item.amount * Math.pow(1 + itemGrowthRate / 100, i); // i is 0-indexed year
                currentYearOtherIncome += inflatedAmount;
            });
        }

        // Calculate Operating Expenses. 
        // For the first pass of management fee calculation, use an EGI that does NOT include other income or reimbursements yet,
        // as these are often calculated *after* basic rental EGI. 
        // However, the prompt implies management fee is on final EGI. Let's use effectiveGrossRentalIncome for initial calculation.
        // This will be adjusted later if needed.
        const opexResults = calculateAnnualOperatingExpenses(
            inputs.operatingExpensesBuckets,
            i, // 0-indexed year for inflation
            inputs.globalExpenseInflationPercent,
            effectiveGrossRentalIncome // Initial EGI for management fee calculation
        );
        
        yearCF.operatingExpenses = opexResults.totalOpex;
        
        // Granular Tenant Reimbursement Calculation
        let totalTenantReimbursementsThisYear = 0;
        for (const lease of inputs.rentRoll) {
            // Check if lease is active in the current projection year 'i'
            // This check is simplified; a more robust check would compare lease start/end dates with current projection year dates
            // For now, we assume if it's in rentRoll, it's potentially active or relevant for pro-rata calculations.
            // A truly accurate check would involve looking at allLeaseProjections[leaseIndex][i].scheduledRent > 0 or similar
            // but that might be overly complex if a lease has $0 rent but still pays CAM.
            // The prompt implies looping through inputs.rentRoll directly for reimbursement calculation.

            const leaseProRataShare = (lease.squareFeet > 0 && inputs.rentableSF > 0) ? (lease.squareFeet / inputs.rentableSF) : 0;
            let leaseReimbursementAmount = 0;

            if (lease.reimbursementType === 'nnn') {
                let reimbursableForLease = opexResults.recoverableOpexTotal * leaseProRataShare;
                if (lease.reimbursementDetails?.adminFeeOnOpExPercent && lease.reimbursementDetails.adminFeeOnOpExPercent > 0) {
                    const adminFee = reimbursableForLease * (lease.reimbursementDetails.adminFeeOnOpExPercent / 100);
                    leaseReimbursementAmount = reimbursableForLease + adminFee;
                } else {
                    leaseReimbursementAmount = reimbursableForLease;
                }
            } else if (lease.reimbursementType === 'modifiedGross') {
                if (lease.reimbursementDetails?.expenseStopAmountPerSF && lease.reimbursementDetails.expenseStopAmountPerSF > 0) {
                    const expenseStopTotalForLease = lease.reimbursementDetails.expenseStopAmountPerSF * lease.squareFeet;
                    const recoverableOpexForLeaseShare = opexResults.recoverableOpexTotal * leaseProRataShare;
                    let reimbursableForLease = Math.max(0, recoverableOpexForLeaseShare - expenseStopTotalForLease);
                    
                    if (lease.reimbursementDetails?.adminFeeOnOpExPercent && lease.reimbursementDetails.adminFeeOnOpExPercent > 0) {
                        const adminFee = reimbursableForLease * (lease.reimbursementDetails.adminFeeOnOpExPercent / 100);
                        leaseReimbursementAmount = reimbursableForLease + adminFee;
                    } else {
                        leaseReimbursementAmount = reimbursableForLease;
                    }
                } else {
                    // Modified Gross without a specific stop amount defined, treat as Gross for reimbursement calculation.
                    leaseReimbursementAmount = 0;
                }
            } else { // 'gross' or any other type
                leaseReimbursementAmount = 0;
            }
            totalTenantReimbursementsThisYear += leaseReimbursementAmount;
        }
        yearCF.tenantReimbursementsNNN = totalTenantReimbursementsThisYear;

        // Recalculate Potential Gross Revenue (PGI) including rental income, reimbursements, and other income.
        yearCF.potentialGrossRevenue = yearCF.totalScheduledRentalRevenue! + 
                                       yearCF.tenantReimbursementsNNN! +  // Use the new detailed sum
                                       currentYearOtherIncome + // Added other income
                                       yearCF.potentialMarketRentFromVacancy!;
        
        // Vacancy and Credit Loss are typically applied only to rental income components.
        // Other income and reimbursements are usually not subject to these losses in the same way.
        yearCF.generalVacancyLoss = vacancyLossOnRental;
        yearCF.creditLoss = creditLossOnRental;
        
        // Final Effective Gross Income (EGI) for the year.
        yearCF.effectiveGrossIncome = yearCF.potentialGrossRevenue - yearCF.generalVacancyLoss - yearCF.creditLoss;
        
        // Adjust Management Fee if it's based on the final EGI (inclusive of reimbursements and other income).
        // The initial management fee calculation in opexResults used effectiveGrossRentalIncome.
        // If the final EGI is different, we need to adjust the fee and total operating expenses.
        if (yearCF.effectiveGrossIncome !== effectiveGrossRentalIncome) {
            let finalMgmtFeePercentage = inputs.operatingExpensesBuckets.managementPercentOfEGI.amount;
            // Optional: Inflate the management fee percentage itself if its inflationRate is provided
            if (inputs.operatingExpensesBuckets.managementPercentOfEGI.inflationRate !== undefined && inputs.operatingExpensesBuckets.managementPercentOfEGI.inflationRate !== null) {
                 const mgmtFeeInflationFactor = Math.pow(1 + inputs.operatingExpensesBuckets.managementPercentOfEGI.inflationRate / 100, i); // i is 0-indexed year
                 finalMgmtFeePercentage *= mgmtFeeInflationFactor;
            }
            const mgmtFeeFinal = yearCF.effectiveGrossIncome * (finalMgmtFeePercentage / 100);
            
            // The initial management fee was already included in opexResults.totalOpex.
            // We need to find the initial fee amount to correctly adjust.
            let initialMgmtFeePercentage = inputs.operatingExpensesBuckets.managementPercentOfEGI.amount;
             if (inputs.operatingExpensesBuckets.managementPercentOfEGI.inflationRate !== undefined && inputs.operatingExpensesBuckets.managementPercentOfEGI.inflationRate !== null) {
                 const mgmtFeeInflationFactor = Math.pow(1 + inputs.operatingExpensesBuckets.managementPercentOfEGI.inflationRate / 100, i);
                 initialMgmtFeePercentage *= mgmtFeeInflationFactor;
            }
            const mgmtFeeInitial = effectiveGrossRentalIncome * (initialMgmtFeePercentage / 100);
            
            yearCF.operatingExpenses = yearCF.operatingExpenses - mgmtFeeInitial + mgmtFeeFinal; 
        }

        yearCF.netOperatingIncome = yearCF.effectiveGrossIncome - yearCF.operatingExpenses;

        // Capital Expenditures Calculation (New Logic)
        yearCF.capitalExpenditures = 0;
        const currentYearCapexItems = inputs.capitalExpenditures.filter(ce => ce.year === currentYear);
        currentYearCapexItems.forEach(ce => {
            let actualAmount = 0;
            const amountVal = ce.amount; 
            switch (ce.amountType) {
                case 'percentPGI':
                    actualAmount = (yearCF.potentialGrossRevenue || 0) * amountVal;
                    break;
                case 'percentEGI':
                    actualAmount = (yearCF.effectiveGrossIncome || 0) * amountVal;
                    break;
                case 'perSF':
                    actualAmount = inputs.rentableSF * amountVal;
                    break;
                case 'fixed':
                default: // Also treats !ce.amountType or empty string as fixed
                    actualAmount = amountVal;
                    break;
            }
            yearCF.capitalExpenditures! += actualAmount;
        });

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
