import type { FulfillmentStatus, Order, PaymentStatus } from '@/types';

export function canRefundOrder(order: Order): boolean {
  return order.paymentStatus === 'Paid' && order.fulfillmentStatus !== 'Canceled' &&
    order.refundedAmount === 0 && order.totalAmount > 0;
}

export function getOrderTransitionError(
  order: Order,
  paymentStatus: PaymentStatus,
  fulfillmentStatus: FulfillmentStatus
): string | null {
  if (paymentStatus === order.paymentStatus && fulfillmentStatus === order.fulfillmentStatus) return null;
  if (order.fulfillmentStatus === 'Canceled') return 'Canceled orders cannot be reopened.';
  if (fulfillmentStatus === 'Canceled' && paymentStatus !== order.paymentStatus) {
    return 'Cancel the order without changing its payment status.';
  }

  if (paymentStatus !== order.paymentStatus &&
      (order.paymentStatus !== 'Pending' || (paymentStatus !== 'Paid' && paymentStatus !== 'Failed'))) {
    return 'Only a pending payment can become Paid or Failed. Record refunds using the refund action.';
  }
  if (fulfillmentStatus !== order.fulfillmentStatus && fulfillmentStatus !== 'Canceled') {
    if (order.fulfillmentStatus === 'Fulfilled') return 'Fulfilled orders cannot return to processing or scheduling.';
    if (paymentStatus === 'Failed') return 'Fulfillment cannot advance for a failed payment.';
  }
  return null;
}
