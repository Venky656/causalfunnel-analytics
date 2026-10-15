import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, trim: true, maxlength: 128 },
    event_type: { type: String, required: true, enum: ['page_view', 'click', 'purchase'] },
    page_url: { type: String, required: true, trim: true, maxlength: 2048 },
    timestamp: { type: Date, required: true, default: Date.now },
    // click coordinates (null for page_view)
    x: { type: Number, default: null },
    y: { type: Number, default: null },
    viewport_width: { type: Number, default: null },
    viewport_height: { type: Number, default: null },
    page_width: { type: Number, default: null },
    page_height: { type: Number, default: null },
    // element identity for clicks (which text / image / card / button
    // was clicked). Form values are never collected — see tracker.
    element_tag: { type: String, default: null, trim: true, maxlength: 20 },
    element_id: { type: String, default: null, trim: true, maxlength: 120 },
    element_classes: { type: String, default: null, trim: true, maxlength: 200 },
    element_text: { type: String, default: null, trim: true, maxlength: 120 },
    element_href: { type: String, default: null, trim: true, maxlength: 500 },
    element_section: { type: String, default: null, trim: true, maxlength: 120 },
    // Stable, app-owned identity for the clicked element. Preferred source is
    // an explicit data-analytics-id (e.g. "product:aero-headphones"); the
    // tracker falls back to label -> id -> tag/classes/text hash. This is what
    // lets heatmaps anchor to a real DOM element instead of a pixel region.
    element_key: { type: String, default: null, trim: true, maxlength: 160 },
    // The element's box at click time, in document pixels. Lets the overlay
    // scale a stored blob onto the element's current position/layout.
    element_rect: {
      x: { type: Number, default: null },
      y: { type: Number, default: null },
      w: { type: Number, default: null },
      h: { type: Number, default: null },
    },
    // ---- purchase fields (event_type === 'purchase') ----
    order_id: { type: String, default: null, trim: true, maxlength: 64 },
    revenue: { type: Number, default: null },
    currency: { type: String, default: null, trim: true, maxlength: 8 },
    // items: [{ product_id, name, qty, unit_price }] — the clicked element_key
    // of the primary item is stored above so purchases attribute to an element.
    items: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    // 'live' = captured by tracker, 'demo' = seeded sample data
    data_source: { type: String, required: true, enum: ['live', 'demo'], default: 'live' },
  },
  { versionKey: false }
);

EventSchema.index({ session_id: 1, timestamp: 1 });
EventSchema.index({ event_type: 1 });
EventSchema.index({ page_url: 1, event_type: 1 });
EventSchema.index({ data_source: 1 });
EventSchema.index({ timestamp: -1 });
// Per-element aggregation for element-anchored heatmaps and rank.
EventSchema.index({ page_url: 1, element_key: 1, event_type: 1 });
EventSchema.index({ event_type: 1, timestamp: -1 });

export const Event = mongoose.model('Event', EventSchema);
