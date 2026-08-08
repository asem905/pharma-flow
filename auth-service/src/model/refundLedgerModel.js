import { prisma } from "../config/db.js";

class RefundLedgerModel {
    findByKey(refund_key) {
        return prisma.refund_ledger.findUnique({ where: { refund_key } });
    }

    create({ refund_key, user_id, amount }) {
        return prisma.refund_ledger.create({
            data: { refund_key, user_id, amount },
        });
    }
}

export default new RefundLedgerModel();
