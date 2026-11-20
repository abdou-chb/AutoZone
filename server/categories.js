const config = require("../shared/categories.json");

const COLUMNS = ["mileage", "fuel", "transmission"];

const categories = new Map(config.categories.map((category) => [category.key, category]));

const isEmpty = (value) => value === undefined || value === null || String(value).trim() === "";

const readAttribute = (attribute, raw) => {
  if (attribute.type === "boolean") {
    if (raw === true || raw === "true" || raw === "Yes") return { value: true };
    if (raw === false || raw === "false" || raw === "No") return { value: false };

    return { error: `${attribute.label} must be yes or no.` };
  }

  if (attribute.type === "number") {
    const value = Number(raw);

    if (!Number.isInteger(value) || value < attribute.min || value > attribute.max) {
      return { error: `${attribute.label} must be a whole number between ${attribute.min} and ${attribute.max}.` };
    }

    return { value };
  }

  const value = String(raw).trim();

  if (!attribute.options.includes(value)) {
    return { error: `Choose a valid ${attribute.label.toLowerCase()}.` };
  }

  return { value };
};

const readAttributes = (categoryKey, input) => {
  const category = categories.get(categoryKey);

  if (!category) {
    return { error: "Choose a valid category." };
  }

  const columns = Object.fromEntries(COLUMNS.map((column) => [column, null]));
  const specs = {};

  for (const attribute of category.attributes) {
    const raw = input[attribute.key];

    if (isEmpty(raw)) {
      if (attribute.required) {
        return { error: `${attribute.label} is required.` };
      }

      continue;
    }

    const { value, error } = readAttribute(attribute, raw);

    if (error) {
      return { error };
    }

    if (attribute.column) {
      columns[attribute.column] = value;
    } else {
      specs[attribute.key] = value;
    }
  }

  return { columns, specs };
};

const parseSpecs = (specs) => {
  try {
    const value = JSON.parse(specs || "{}");

    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
};

module.exports = {
  CATEGORY_KEYS: [...categories.keys()],
  DEFAULT_CATEGORY: config.default,
  isCategory: (key) => categories.has(key),
  readAttributes,
  parseSpecs,
};
