import { index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

export const cities = pgTable(
  "cities",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [uniqueIndex("cities_code_unique").on(table.code)],
);

export const flights = pgTable(
  "flights",
  {
    id: serial("id").primaryKey(),
    originSlug: text("origin_slug")
      .notNull()
      .references(() => cities.slug, { onDelete: "cascade" }),
    destinationSlug: text("destination_slug")
      .notNull()
      .references(() => cities.slug, { onDelete: "cascade" }),
    cost: integer("cost").notNull(),
    distance: integer("distance").notNull(),
  },
  (table) => [
    uniqueIndex("flights_route_unique").on(table.originSlug, table.destinationSlug),
    index("flights_origin_index").on(table.originSlug),
  ],
);
