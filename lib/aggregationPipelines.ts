/**
 * MongoDB Aggregation Pipeline Type Definitions
 * 
 * NOTE: These are TypeScript type definitions only. These pipelines are NOT used
 * to query MongoDB. All analytics are computed in-memory from Redis data.
 * 
 * MongoDB is used ONLY for user management (authentication).
 * All shipping data and analytics are stored in Redis.
 * 
 * This file exists for type reference only and can be removed if not needed.
 */

import { Document } from 'mongodb'

/**
 * Weekly NDR Analytics Pipeline
 * Aggregates NDR metrics by week
 */
export function getNDRWeeklyPipeline(): Document[] {
  return [
    {
      $match: {
        order_week: { $exists: true, $ne: null },
        ndr_flag: true,
      },
    },
    {
      $group: {
        _id: '$order_week',
        total_ndr: { $sum: 1 },
        ndr_delivered_after: {
          $sum: {
            $cond: [
              { $in: ['$delivery_status', ['DELIVERED', 'DEL']] },
              1,
              0,
            ],
          },
        },
        ndr_reasons: {
          $push: {
            $ifNull: ['$ndr_reason', 'Unspecified'],
          },
        },
        total_order_value: {
          $sum: { $ifNull: ['$order_value', 0] },
        },
      },
    },
    {
      $addFields: {
        ndr_conversion_percent: {
          $cond: [
            { $gt: ['$total_ndr', 0] },
            {
              $multiply: [
                {
                  $divide: ['$ndr_delivered_after', '$total_ndr'],
                },
                100,
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        order_week: '$_id',
        total_ndr: 1,
        ndr_delivered_after: 1,
        ndr_conversion_percent: 1,
        total_order_value: 1,
        ndr_reasons: 1,
      },
    },
    {
      $sort: { order_week: 1 },
    },
  ]
}

/**
 * NDR Reason Share Pipeline
 */
export function getNDRReasonSharePipeline(): Document[] {
  return [
    {
      $match: {
        ndr_flag: true,
        ndr_reason: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$ndr_reason',
        count: { $sum: 1 },
        delivered_after_ndr: {
          $sum: {
            $cond: [
              { $in: ['$delivery_status', ['DELIVERED', 'DEL']] },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $addFields: {
        share_percent: {
          $multiply: [
            {
              $divide: [
                '$count',
                {
                  $sum: '$count',
                },
              ],
            },
            100,
          ],
        },
        conversion_percent: {
          $cond: [
            { $gt: ['$count', 0] },
            {
              $multiply: [
                {
                  $divide: ['$delivered_after_ndr', '$count'],
                },
                100,
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        ndr_reason: '$_id',
        count: 1,
        share_percent: 1,
        delivered_after_ndr: 1,
        conversion_percent: 1,
      },
    },
    {
      $sort: { count: -1 },
    },
  ]
}

/**
 * State Performance Pipeline
 */
export function getStatePerformancePipeline(): Document[] {
  return [
    {
      $match: {
        state: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$state',
        total_orders: { $sum: 1 },
        delivered: {
          $sum: {
            $cond: [
              { $in: ['$delivery_status', ['DELIVERED', 'DEL']] },
              1,
              0,
            ],
          },
        },
        ndr: {
          $sum: {
            $cond: [{ $eq: ['$ndr_flag', true] }, 1, 0],
          },
        },
        rto: {
          $sum: {
            $cond: [{ $eq: ['$rto_flag', true] }, 1, 0],
          },
        },
        total_order_value: {
          $sum: { $ifNull: ['$order_value', 0] },
        },
        avg_order_value: {
          $avg: { $ifNull: ['$order_value', 0] },
        },
      },
    },
    {
      $addFields: {
        delivery_percent: {
          $cond: [
            { $gt: ['$total_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$delivered', '$total_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
        ndr_rate: {
          $cond: [
            { $gt: ['$total_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$ndr', '$total_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
        rto_rate: {
          $cond: [
            { $gt: ['$total_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$rto', '$total_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
        order_share: {
          $multiply: [
            {
              $divide: [
                '$total_orders',
                {
                  $sum: '$total_orders',
                },
              ],
            },
            100,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        state: '$_id',
        total_orders: 1,
        delivered: 1,
        delivery_percent: 1,
        ndr: 1,
        ndr_rate: 1,
        rto: 1,
        rto_rate: 1,
        total_order_value: 1,
        avg_order_value: 1,
        order_share: 1,
      },
    },
    {
      $sort: { total_orders: -1 },
    },
  ]
}

/**
 * Channel Share Pipeline
 */
export function getChannelSharePipeline(): Document[] {
  return [
    {
      $match: {
        channel: { $exists: true, $nin: [null, 'none'] },
      },
    },
    {
      $group: {
        _id: '$channel',
        total_orders: { $sum: 1 },
        total_order_value: {
          $sum: { $ifNull: ['$order_value', 0] },
        },
        avg_order_value: {
          $avg: { $ifNull: ['$order_value', 0] },
        },
        delivered: {
          $sum: {
            $cond: [
              { $in: ['$delivery_status', ['DELIVERED', 'DEL']] },
              1,
              0,
            ],
          },
        },
        ndr: {
          $sum: {
            $cond: [{ $eq: ['$ndr_flag', true] }, 1, 0],
          },
        },
        rto: {
          $sum: {
            $cond: [{ $eq: ['$rto_flag', true] }, 1, 0],
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        channels: { $push: '$$ROOT' },
        total_all_orders: { $sum: '$total_orders' },
        total_all_value: { $sum: '$total_order_value' },
      },
    },
    {
      $unwind: '$channels',
    },
    {
      $addFields: {
        share_percent: {
          $cond: [
            { $gt: ['$total_all_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$channels.total_orders', '$total_all_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
        value_share_percent: {
          $cond: [
            { $gt: ['$total_all_value', 0] },
            {
              $multiply: [
                {
                  $divide: ['$channels.total_order_value', '$total_all_value'],
                },
                100,
              ],
            },
            0,
          ],
        },
        delivery_percent: {
          $cond: [
            { $gt: ['$channels.total_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$channels.delivered', '$channels.total_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
        ndr_rate: {
          $cond: [
            { $gt: ['$channels.total_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$channels.ndr', '$channels.total_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
        rto_rate: {
          $cond: [
            { $gt: ['$channels.total_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$channels.rto', '$channels.total_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        channel: '$channels._id',
        total_orders: '$channels.total_orders',
        total_order_value: '$channels.total_order_value',
        avg_order_value: '$channels.avg_order_value',
        share_percent: 1,
        value_share_percent: 1,
        delivered: '$channels.delivered',
        delivery_percent: 1,
        ndr: '$channels.ndr',
        ndr_rate: 1,
        rto: '$channels.rto',
        rto_rate: 1,
      },
    },
    {
      $sort: { total_orders: -1 },
    },
  ]
}

/**
 * Category Share Pipeline
 */
export function getCategorySharePipeline(): Document[] {
  return [
    {
      $match: {
        category: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$category',
        total_orders: { $sum: 1 },
        total_order_value: {
          $sum: { $ifNull: ['$order_value', 0] },
        },
        avg_order_value: {
          $avg: { $ifNull: ['$order_value', 0] },
        },
        delivered: {
          $sum: {
            $cond: [
              { $in: ['$delivery_status', ['DELIVERED', 'DEL']] },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $addFields: {
        share_percent: {
          $multiply: [
            {
              $divide: [
                '$total_orders',
                {
                  $sum: '$total_orders',
                },
              ],
            },
            100,
          ],
        },
        value_share_percent: {
          $multiply: [
            {
              $divide: [
                '$total_order_value',
                {
                  $sum: '$total_order_value',
                },
              ],
            },
            100,
          ],
        },
        delivery_percent: {
          $cond: [
            { $gt: ['$total_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$delivered', '$total_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        total_orders: 1,
        total_order_value: 1,
        avg_order_value: 1,
        share_percent: 1,
        value_share_percent: 1,
        delivered: 1,
        delivery_percent: 1,
      },
    },
    {
      $sort: { total_orders: -1 },
    },
  ]
}

/**
 * Cancellation Tracker Pipeline
 */
export function getCancellationTrackerPipeline(): Document[] {
  return [
    {
      $match: {
        cancelled_flag: true,
      },
    },
    {
      $group: {
        _id: {
          week: '$order_week',
          reason: {
            $ifNull: ['$cancellation_reason', 'Unspecified'],
          },
        },
        count: { $sum: 1 },
        total_order_value: {
          $sum: { $ifNull: ['$order_value', 0] },
        },
      },
    },
    {
      $group: {
        _id: '$_id.week',
        cancellations: {
          $push: {
            reason: '$_id.reason',
            count: '$count',
            value: '$total_order_value',
          },
        },
        total_cancellations: { $sum: '$count' },
        total_cancelled_value: { $sum: '$total_order_value' },
      },
    },
    {
      $project: {
        _id: 0,
        order_week: '$_id',
        total_cancellations: 1,
        total_cancelled_value: 1,
        cancellations: 1,
      },
    },
    {
      $sort: { order_week: 1 },
    },
  ]
}

/**
 * TAT Metrics Pipeline
 */
export function getTATMetricsPipeline(): Document[] {
  return [
    {
      $match: {
        order_week: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$order_week',
        avg_order_to_pickup_tat: {
          $avg: { $ifNull: ['$order_to_pickup_tat', null] },
        },
        avg_pickup_to_ofd_tat: {
          $avg: { $ifNull: ['$pickup_to_ofd_tat', null] },
        },
        avg_ofd_to_delivery_tat: {
          $avg: { $ifNull: ['$ofd_to_delivery_tat', null] },
        },
        avg_total_tat: {
          $avg: { $ifNull: ['$total_tat', null] },
        },
        min_total_tat: {
          $min: { $ifNull: ['$total_tat', null] },
        },
        max_total_tat: {
          $max: { $ifNull: ['$total_tat', null] },
        },
        total_orders: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        order_week: '$_id',
        avg_order_to_pickup_tat: 1,
        avg_pickup_to_ofd_tat: 1,
        avg_ofd_to_delivery_tat: 1,
        avg_total_tat: 1,
        min_total_tat: 1,
        max_total_tat: 1,
        total_orders: 1,
      },
    },
    {
      $sort: { order_week: 1 },
    },
  ]
}

/**
 * Weekly Summary KPIs Pipeline
 */
export function getWeeklySummaryPipeline(): Document[] {
  return [
    {
      $match: {
        order_week: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$order_week',
        total_orders: { $sum: 1 },
        total_order_value: {
          $sum: { $ifNull: ['$order_value', 0] },
        },
        avg_order_value: {
          $avg: { $ifNull: ['$order_value', 0] },
        },
        fad_count: {
          $sum: {
            $cond: [
              { $eq: ['$delivery_status', 'FAD'] },
              1,
              0,
            ],
          },
        },
        ofd_count: {
          $sum: {
            $cond: [
              { $eq: ['$delivery_status', 'OFD'] },
              1,
              0,
            ],
          },
        },
        del_count: {
          $sum: {
            $cond: [
              { $in: ['$delivery_status', ['DELIVERED', 'DEL']] },
              1,
              0,
            ],
          },
        },
        ndr_count: {
          $sum: {
            $cond: [{ $eq: ['$ndr_flag', true] }, 1, 0],
          },
        },
        rto_count: {
          $sum: {
            $cond: [{ $eq: ['$rto_flag', true] }, 1, 0],
          },
        },
        avg_total_tat: {
          $avg: { $ifNull: ['$total_tat', null] },
        },
      },
    },
    {
      $addFields: {
        fad_percent: {
          $cond: [
            { $gt: ['$total_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$fad_count', '$total_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
        ofd_percent: {
          $cond: [
            { $gt: ['$total_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$ofd_count', '$total_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
        del_percent: {
          $cond: [
            { $gt: ['$total_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$del_count', '$total_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
        ndr_rate_percent: {
          $cond: [
            { $gt: ['$total_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$ndr_count', '$total_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
        rto_rate_percent: {
          $cond: [
            { $gt: ['$total_orders', 0] },
            {
              $multiply: [
                {
                  $divide: ['$rto_count', '$total_orders'],
                },
                100,
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        order_week: '$_id',
        total_orders: 1,
        total_order_value: 1,
        avg_order_value: 1,
        fad_count: 1,
        fad_percent: 1,
        ofd_count: 1,
        ofd_percent: 1,
        del_count: 1,
        del_percent: 1,
        ndr_count: 1,
        ndr_rate_percent: 1,
        rto_count: 1,
        rto_rate_percent: 1,
        avg_total_tat: 1,
      },
    },
    {
      $sort: { order_week: 1 },
    },
  ]
}

/**
 * Address Quality Share Pipeline
 */
export function getAddressQualityPipeline(): Document[] {
  return [
    {
      $match: {
        address_quality: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$address_quality',
        count: { $sum: 1 },
        delivered: {
          $sum: {
            $cond: [
              { $in: ['$delivery_status', ['DELIVERED', 'DEL']] },
              1,
              0,
            ],
          },
        },
        ndr: {
          $sum: {
            $cond: [{ $eq: ['$ndr_flag', true] }, 1, 0],
          },
        },
      },
    },
    {
      $addFields: {
        share_percent: {
          $multiply: [
            {
              $divide: [
                '$count',
                {
                  $sum: '$count',
                },
              ],
            },
            100,
          ],
        },
        delivery_percent: {
          $cond: [
            { $gt: ['$count', 0] },
            {
              $multiply: [
                {
                  $divide: ['$delivered', '$count'],
                },
                100,
              ],
            },
            0,
          ],
        },
        ndr_rate: {
          $cond: [
            { $gt: ['$count', 0] },
            {
              $multiply: [
                {
                  $divide: ['$ndr', '$count'],
                },
                100,
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        address_quality: '$_id',
        count: 1,
        share_percent: 1,
        delivered: 1,
        delivery_percent: 1,
        ndr: 1,
        ndr_rate: 1,
      },
    },
    {
      $sort: { count: -1 },
    },
  ]
}
