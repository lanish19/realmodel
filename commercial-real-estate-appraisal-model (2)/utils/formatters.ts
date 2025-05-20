
export const formatCurrency = (value: number): string => {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export const formatYear = (value: number): string => {
  return `${value.toFixed(0)} yr${value !== 1 ? 's' : ''}`;
};

export const formatMonths = (value: number): string => {
  return `${value.toFixed(1)} mo`;
};

export const formatBasicNumber = (value: number, decimals: number = 0): string => {
  return value.toFixed(decimals);
};

export const formatAmountPerSF = (value: number): string => {
  return `$${value.toFixed(2)}/SF`;
};

export const formatNumberWithCommas = (value: number): string => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};
