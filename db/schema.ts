import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(), value: text('value').notNull(), updatedAt: text('updated_at').notNull(),
});
export const productReviews = sqliteTable('product_reviews', {
  productId: text('product_id').primaryKey(), status: text('status').notNull(), note: text('note').notNull(), updatedAt: text('updated_at').notNull(),
});
export const quotations = sqliteTable('quotations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requestKey: text('request_key').notNull().unique(), ownerId: text('owner_id').notNull(),
  status: text('status').notNull(), snapshot: text('snapshot').notNull(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});
