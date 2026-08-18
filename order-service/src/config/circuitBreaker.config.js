export const circuitBreakerOptions = {
    timeout: Number(process.env.CB_TIMEOUT),
    errorThresholdPercentage: Number(process.env.CB_ERROR_THRESHOLD),
    resetTimeout: Number(process.env.CB_RESET_TIMEOUT),
};
