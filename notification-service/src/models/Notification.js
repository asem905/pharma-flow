import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'ORDER_PLACED',
        'ORDER_CONFIRMED',
        'ORDER_SHIPPED',
        'ORDER_DELIVERED',
        'ORDER_CANCELLED',
        'ORDER_UPDATED',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
        'GENERAL',
      ],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true, // createdAt, updatedAt managed by Mongoose
  }
);

// Compound index: cursor pagination — find({ email, _id: { $lt: cursor } }).sort({ _id: -1 })
// ObjectId is time-ordered so _id:-1 = newest first. Zero skip, pure index scan.
notificationSchema.index({ email: 1, _id: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
