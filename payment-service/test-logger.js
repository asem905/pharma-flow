
import logger from './src/utils/logger.js';
setTimeout(() => {
    logger.info('Test log from payment-service logger!');
    setTimeout(() => process.exit(0), 1000);
}, 2000);

