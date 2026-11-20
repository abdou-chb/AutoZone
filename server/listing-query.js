const config = require("../shared/categories.json");
const { parseSpecs } = require("./categories");

const categories = new Map(config.categories.map((category) => [category.key, category]));

function brandNames(db, category) {
  return db
    .prepare(`SELECT DISTINCT name FROM brands ${category ? "WHERE category = ?" : ""}`)
    .all(...(category ? [category] : []))
    .map((row) => row.name);
}

const PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;
const MAX_IDS = 100;

const SORTS = {
  newest: "cars.created_at DESC, cars.id DESC",
  "price-asc": "cars.price ASC, cars.id DESC",
  "price-desc": "cars.price DESC, cars.id DESC",
  mileage: "cars.mileage IS NULL, cars.mileage ASC, cars.id DESC",
  year: "cars.year DESC, cars.id DESC",
  featured: "cars.featured DESC, cars.created_at DESC, cars.id DESC",
};

const LIST_COLUMNS = `
  cars.id, cars.category, cars.name, cars.year, cars.price, cars.mileage, cars.condition,
  cars.fuel, cars.transmission, cars.specs, cars.location, cars.description,
  cars.issues, cars.featured, cars.created_at
`;

const fold = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const escapeLike = (value) => value.replace(/[\\%_]/g, (match) => `\\${match}`);

const valueExpression = (attribute) =>
  attribute.column ? `cars.${attribute.column}` : `json_extract(cars.specs, '$.${attribute.key}')`;

class QueryError extends Error {}

const readInteger = (raw, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const value = Number(raw);

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new QueryError(`${label} must be a whole number.`);
  }

  return value;
};

const present = (value) => value !== undefined && value !== null && String(value).trim() !== "";

function buildFilters(db, query, { status = "approved" } = {}) {
  const where = ["cars.status = @status"];
  const params = { status };
  const category = present(query.category) ? categories.get(query.category) : null;

  if (present(query.category) && !category) {
    throw new QueryError("Unknown category.");
  }

  if (category) {
    where.push("cars.category = @category");
    params.category = category.key;
  }

  if (present(query.q)) {
    fold(query.q)
      .split(/\s+/)
      .slice(0, 6)
      .forEach((word, index) => {
        where.push(`fold(cars.name) LIKE @q${index} ESCAPE '\\'`);
        params[`q${index}`] = `%${escapeLike(word)}%`;
      });
  }

  if (present(query.brand)) {
    if (!brandNames(db, category?.key).includes(query.brand)) {
      throw new QueryError("Unknown brand.");
    }

    where.push("(fold(cars.name) = @brand OR fold(cars.name) LIKE @brandPrefix ESCAPE '\\')");
    params.brand = fold(query.brand);
    params.brandPrefix = `${escapeLike(fold(query.brand))} %`;
  }

  if (present(query.wilaya)) {
    where.push("cars.location = @wilaya");
    params.wilaya = String(query.wilaya);
  }

  if (present(query.min)) {
    where.push("cars.price >= @min");
    params.min = readInteger(query.min, "Minimum price");
  }

  if (present(query.max)) {
    where.push("cars.price <= @max");
    params.max = readInteger(query.max, "Maximum price");
  }

  if (present(query.condition)) {
    if (!["New", "Used"].includes(query.condition)) {
      throw new QueryError("Condition must be New or Used.");
    }

    where.push("cars.condition = @condition");
    params.condition = query.condition;
  }

  if (present(query.featured)) {
    if (!["true", "false"].includes(query.featured)) {
      throw new QueryError("Featured must be true or false.");
    }

    where.push("cars.featured = @featured");
    params.featured = query.featured === "true" ? 1 : 0;
  }

  if (present(query.ids)) {
    const ids = String(query.ids)
      .split(",")
      .slice(0, MAX_IDS)
      .map((id) => readInteger(id, "Listing id", { min: 1 }));

    where.push(`cars.id IN (${ids.map((_, index) => `@id${index}`).join(", ")})`);
    ids.forEach((id, index) => {
      params[`id${index}`] = id;
    });
  }

  for (const attribute of category?.attributes || []) {
    const expression = valueExpression(attribute);
    const key = attribute.key;

    if (attribute.type === "select" && present(query[key])) {
      const values = String(query[key]).split(",");

      if (!values.every((value) => attribute.options.includes(value))) {
        throw new QueryError(`Choose a valid ${attribute.label.toLowerCase()}.`);
      }

      where.push(`${expression} IN (${values.map((_, index) => `@${key}${index}`).join(", ")})`);
      values.forEach((value, index) => {
        params[`${key}${index}`] = value;
      });
    }

    if (attribute.type === "boolean" && present(query[key])) {
      if (!["true", "false"].includes(query[key])) {
        throw new QueryError(`${attribute.label} must be true or false.`);
      }

      where.push(`coalesce(${expression}, 0) = @${key}`);
      params[key] = query[key] === "true" ? 1 : 0;
    }

    if (attribute.type === "number") {
      if (present(query[`${key}Min`])) {
        where.push(`${expression} >= @${key}Min`);
        params[`${key}Min`] = readInteger(query[`${key}Min`], attribute.label);
      }

      if (present(query[`${key}Max`])) {
        where.push(`${expression} <= @${key}Max`);
        params[`${key}Max`] = readInteger(query[`${key}Max`], attribute.label);
      }
    }
  }

  return { where: where.join(" AND "), params, category };
}

function readPaging(query) {
  const pageSize = present(query.pageSize)
    ? readInteger(query.pageSize, "Page size", { min: 1, max: MAX_PAGE_SIZE })
    : PAGE_SIZE;
  const page = present(query.page) ? readInteger(query.page, "Page", { min: 1 }) : 1;
  const sort = present(query.sort) ? query.sort : "newest";

  if (!SORTS[sort]) {
    throw new QueryError("Unknown sort order.");
  }

  return { page, pageSize, sort };
}

function attachImages(db, rows) {
  if (!rows.length) {
    return [];
  }

  const images = db
    .prepare(
      `SELECT id, car_id, image_path, is_main, sort_order
       FROM car_images
       WHERE car_id IN (${rows.map(() => "?").join(", ")})
       ORDER BY is_main DESC, sort_order ASC, id ASC`
    )
    .all(rows.map((row) => row.id));

  const byListing = new Map(rows.map((row) => [row.id, []]));
  images.forEach(({ car_id: carId, ...image }) => byListing.get(carId).push(image));

  return rows.map((row) => {
    const own = byListing.get(row.id);

    return {
      ...row,
      specs: parseSpecs(row.specs),
      mainImage: own.find((image) => image.is_main === 1)?.image_path || own[0]?.image_path || null,
      images: own,
    };
  });
}

function findListings(db, query, { status = "approved", columns = LIST_COLUMNS } = {}) {
  const { where, params } = buildFilters(db, query, { status });
  const { page: requested, pageSize, sort } = readPaging(query);

  const total = db.prepare(`SELECT COUNT(*) AS total FROM cars WHERE ${where}`).get(params).total;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requested, pages);

  const rows = db
    .prepare(`SELECT ${columns} FROM cars WHERE ${where} ORDER BY ${SORTS[sort]} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

  return { cars: attachImages(db, rows), total, page, pageSize, pages };
}

function countBy(db, where, params, expression) {
  return Object.fromEntries(
    db
      .prepare(
        `SELECT ${expression} AS value, COUNT(*) AS count FROM cars WHERE ${where} AND ${expression} IS NOT NULL GROUP BY value`
      )
      .all(params)
      .map((row) => [String(row.value), row.count])
  );
}

function listingOverview(db, query) {
  const { where, params, category } = buildFilters(db, { category: query.category });

  if (!category) {
    throw new QueryError("Choose a category.");
  }

  const total = db.prepare(`SELECT COUNT(*) AS total FROM cars WHERE ${where}`).get(params).total;
  const week = db
    .prepare(`SELECT COUNT(*) AS count FROM cars WHERE ${where} AND cars.created_at >= datetime('now', '-7 days')`)
    .get(params).count;

  const facets = {};

  for (const attribute of category.attributes) {
    if (attribute.type === "select" || attribute.type === "boolean") {
      const counts = countBy(db, where, params, valueExpression(attribute));

      facets[attribute.key] =
        attribute.type === "boolean"
          ? { true: counts["1"] || 0, false: total - (counts["1"] || 0) }
          : counts;
    }
  }

  const ranges = Object.fromEntries(
    (category.ranges || []).map(({ attribute: key, bounds }) => {
      const expression = valueExpression(category.attributes.find((attribute) => attribute.key === key));
      const edges = [null, ...bounds, null];
      const counts = edges.slice(0, -1).map((low, index) => {
        const high = edges[index + 1];
        const conditions = [`${expression} IS NOT NULL`];

        if (low !== null) conditions.push(`${expression} > ${Number(low)}`);
        if (high !== null) conditions.push(`${expression} <= ${Number(high)}`);

        return db.prepare(`SELECT COUNT(*) AS count FROM cars WHERE ${where} AND ${conditions.join(" AND ")}`).get(params)
          .count;
      });

      return [key, counts];
    })
  );

  const names = db
    .prepare(`SELECT fold(name) AS folded, name FROM cars WHERE ${where}`)
    .all(params);

  const brands = db
    .prepare("SELECT name, logo FROM brands WHERE category = ? AND visible = 1 ORDER BY sort_order, name")
    .all(category.key)
    .map((brand) => {
      const folded = fold(brand.name);
      const count = names.filter((row) => row.folded === folded || row.folded.startsWith(`${folded} `)).length;

      return { name: brand.name, logo: brand.logo, count };
    })
    .filter((brand) => brand.count > 0);

  const wilayas = db
    .prepare(`SELECT DISTINCT location FROM cars WHERE ${where} ORDER BY location`)
    .all(params)
    .map((row) => row.location);

  const models = db
    .prepare(`SELECT name, COUNT(*) AS count FROM cars WHERE ${where} GROUP BY name ORDER BY count DESC, name LIMIT 200`)
    .all(params)
    .map((row) => row.name);

  const price = db.prepare(`SELECT MIN(price) AS min, MAX(price) AS max FROM cars WHERE ${where}`).get(params);

  return { total, newThisWeek: week, facets, ranges, brands, wilayas, models, price };
}

function registerFunctions(db) {
  db.function("fold", { deterministic: true }, (value) => fold(value));
}

module.exports = {
  LIST_COLUMNS,
  buildFilters,
  fold,
  QueryError,
  attachImages,
  findListings,
  listingOverview,
  registerFunctions,
};
