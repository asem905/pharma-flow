import bloomFiltersLib from 'bloom-filters';
const { BloomFilter } = bloomFiltersLib;

class BloomFilterService {
    constructor() {
        this.filter = null;
        this.itemCount = 0;
        this.initialized = false;
    }

    /**
     * Initialize the Bloom Filter by seeding all existing emails from DB.
     * Called once on server startup. Handles server restarts correctly.
     *
     * @param {string[]} emails   - Array of existing emails fetched from DB
     * @param {number}   capacity - Expected max number of users (default: 10,000)
     */
    initialize(emails = [], capacity = 1000) {
        try {
            // Use whichever is larger: actual DB count or the reserved capacity
            const count = Math.max(emails.length, capacity);

            const errorRate = 0.001; // 0.1% false positive rate
            const bitsPerItem = Math.ceil((count * Math.abs(Math.log(errorRate))) / Math.pow(Math.log(2), 2));
            const hashFunctions = Math.ceil((bitsPerItem / count) * Math.log(2));

            this.filter = new BloomFilter(bitsPerItem, hashFunctions);
            this.itemCount = 0;

            // Seed the filter with every existing email from DB
            if (emails?.length > 0) {
                emails.forEach(email => {
                    if (email) {
                        this.filter.add(email.toLowerCase());
                        this.itemCount++;
                    }
                });
            } else {
                console.log("no emails to seed");
            }

            this.initialized = true;

            console.log('✅ Bloom Filter initialized:');
            console.log(`   - Emails seeded from DB: ${this.itemCount}`);
            console.log(`   - Reserved capacity: ${count}`);
            console.log(`   - Bit array size: ${bitsPerItem} bits (${Math.ceil(bitsPerItem / 8)} bytes)`);
            console.log(`   - Hash functions: ${hashFunctions}`);
            console.log(`   - False positive rate: 0.1%`);

            return { success: true, itemsLoaded: this.itemCount };
        } catch (error) {
            console.error('❌ Bloom Filter initialization failed:', error);
            throw error;
        }
    }

    /**
     * Check if an email MIGHT exist.
     * - false → email definitely does NOT exist → skip DB query entirely
     * - true  → email might exist → must verify against DB
     *
     * @param {string} email
     * @returns {boolean}
     */
    mightExistEmail(email) {
        if (!this.initialized || !email) {
            return true; // Filter not ready → fall back to DB check
        }
        return this.filter.has(email.toLowerCase());
    }

    /**
     * Add a newly registered email to the filter.
     * Call this after a successful DB insert in register().
     *
     * @param {string} email
     */
    addEmail(email) {
        if (this.initialized && email) {
            this.filter.add(email.toLowerCase());
            this.itemCount++;
        }
    }

    getStorageEstimate() {
        if (!this.filter) return 0;
        const bitsPerItem = 9.6;
        const totalBits = this.itemCount * bitsPerItem;
        return Math.ceil(totalBits / 8);
    }

    getStats() {
        return {
            initialized: this.initialized,
            emailCount: this.itemCount,
            storageBytes: this.getStorageEstimate(),
            bitsPerEmail: '~10 bits',
            estimatedFalsePositiveRate: '0.1%',
            note: 'Only bit positions stored, NOT actual email strings'
        };
    }

    reset() {
        this.filter = null;
        this.itemCount = 0;
        this.initialized = false;
    }
}

export default new BloomFilterService();