import mongoose from "mongoose";
import Notification from "../models/Notification.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class NotificationService {

    /**
     * Cursor-based fetch — zero skip, pure index scan.
     *
     * How it works:
     *  1. First page: no cursor → fetch first `limit` docs sorted newest first
     *  2. Next pages: cursor = _id of the last doc from previous response
     *     → query adds { _id: { $lt: cursor } } so MongoDB starts scanning from that point
     *
     * The compound index { email: 1, _id: -1 } covers the entire query and sort in one scan.
     * We fetch (limit + 1) docs and pop the extra one to know if a next page exists.
     *
     * @param {string} email
     * @param {{ cursor?: string, limit?: number }} options
     * @returns {{ notifications: object[], nextCursor: string|null, hasNextPage: boolean }}
     */
    static async getByEmail(email, { cursor, limit } = {}) {
        const safeLimit = Math.min(parseInt(limit) || DEFAULT_LIMIT, MAX_LIMIT);

        const query = { email };
        if (cursor) {
            // Only documents older than the cursor (strictly less than = next page)
            query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
        }

        // Fetch one extra doc to determine if another page exists — no countDocuments needed
        const docs = await Notification.find(query)
            .sort({ _id: -1 })           // newest first — ObjectId is time-ordered
            .limit(safeLimit + 1)
            .lean();

        const hasNextPage = docs.length > safeLimit;
        if (hasNextPage) docs.pop();     // discard the sentinel doc

        const nextCursor = hasNextPage
            ? docs[docs.length - 1]._id.toString()
            : null;

        return { notifications: docs, nextCursor, hasNextPage };
    }

    /**
     * Fetch a single notification by its MongoDB _id.
     * Returns null if not found.
     */
    static async getById(id) {
        return await Notification.findById(id).lean();
    }

    /**
     * Hard-delete a notification by _id.
     * Returns the deleted document or null if not found.
     */
    static async deleteById(id) {
        return await Notification.findByIdAndDelete(id).lean();
    }
}
