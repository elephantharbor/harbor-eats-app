/**
 * OpenAI Structured Outputs strict-mode checks for the schema sent with strict:true.
 * Local schemas may still carry maxLength/minimum/maxItems; toStrictSchema strips those
 * before this validator runs.
 */

const SUPPORTED_TYPES = new Set(["string", "number", "integer", "boolean", "object", "array", "null"]);
const SUPPORTED_FORMATS = new Set(["date-time", "time", "date", "duration", "email", "hostname", "ipv4", "ipv6", "uuid"]);
const UNSUPPORTED = new Set([
  "default",
  "patternProperties",
  "unevaluatedProperties",
  "unevaluatedItems",
  "propertyNames",
  "minProperties",
  "maxProperties",
  "uniqueItems",
  "contains",
  "minContains",
  "maxContains",
  "prefixItems",
  "additionalItems",
  "allOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
  "dependentRequired",
  "dependentSchemas",
  "dependencies",
  "examples",
  "contentMediaType",
  "contentEncoding",
  "contentSchema",
  "$anchor",
  "$dynamicAnchor",
  "$recursiveAnchor",
  "$recursiveRef",
  "$dynamicRef",
]);

export const STRICT_SCHEMA_NAME = /^[a-zA-Z0-9_-]+$/;
const MAX_DEPTH = 10;
const MAX_PROPERTIES = 5000;
const MAX_ENUMS = 1000;
const MAX_STRINGS = 120000;

/**
 * @param {object} schema wire schema (already strict-shaped)
 * @param {{ name?: string }} [opts] json_schema name sent beside the schema
 * @returns {string[]} problem messages; empty means the schema is acceptable
 */
export function validateStrictSchema(schema, { name } = {}) {
  const problems = [];
  if (name != null && (typeof name !== "string" || !STRICT_SCHEMA_NAME.test(name) || name.length > 64)) {
    problems.push("name: must match ^[a-zA-Z0-9_-]+$ and be at most 64 characters");
  }
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    problems.push("root: must be an object schema");
    return problems;
  }
  if (schema.anyOf) problems.push("root: anyOf is not allowed; root must be an object");
  if (schema.type !== "object") problems.push(`root: type must be object, got ${JSON.stringify(schema.type)}`);
  const stats = { properties: 0, enums: 0, strings: 0 };
  walk(schema, "$", 1, problems, stats);
  if (stats.properties > MAX_PROPERTIES) problems.push(`properties: ${stats.properties} exceeds ${MAX_PROPERTIES}`);
  if (stats.enums > MAX_ENUMS) problems.push(`enum values: ${stats.enums} exceeds ${MAX_ENUMS}`);
  if (stats.strings > MAX_STRINGS) problems.push(`string budget: ${stats.strings} exceeds ${MAX_STRINGS}`);
  return problems;
}

function walk(schema, path, depth, problems, stats) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    problems.push(`${path}: schema must be an object`);
    return;
  }
  if (depth > MAX_DEPTH) problems.push(`${path}: nesting depth ${depth} exceeds ${MAX_DEPTH}`);
  for (const key of Object.keys(schema)) {
    if (UNSUPPORTED.has(key)) problems.push(`${path}: unsupported keyword ${key}`);
  }
  if (schema.format != null && !SUPPORTED_FORMATS.has(schema.format)) {
    problems.push(`${path}: unsupported format ${schema.format}`);
  }

  const types = schema.type == null ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (Array.isArray(schema.type)) {
    const nonNull = types.filter((t) => t !== "null");
    const ok = types.length === 2 && types.includes("null") && nonNull.length === 1 && SUPPORTED_TYPES.has(nonNull[0]) && nonNull[0] !== "null";
    if (!ok) problems.push(`${path}: optional fields use a type union with null`);
  } else if (schema.type != null && !SUPPORTED_TYPES.has(schema.type)) {
    problems.push(`${path}: unsupported type ${schema.type}`);
  }

  if (schema.enum) {
    if (!Array.isArray(schema.enum) || schema.enum.length === 0) problems.push(`${path}: enum must be a non-empty array`);
    else {
      stats.enums += schema.enum.length;
      for (const value of schema.enum) {
        if (typeof value === "string") stats.strings += value.length;
        if (types.length && !enumValueMatches(value, types)) {
          problems.push(`${path}: enum value ${JSON.stringify(value)} does not match type ${JSON.stringify(schema.type)}`);
        }
      }
    }
  }
  if (typeof schema.const === "string") stats.strings += schema.const.length;

  const isObject = schema.type === "object" || (Array.isArray(schema.type) && schema.type.includes("object")) || schema.properties;
  if (isObject) {
    if (schema.additionalProperties !== false) problems.push(`${path}: additionalProperties must be false`);
    const props = schema.properties || {};
    const keys = Object.keys(props);
    stats.properties += keys.length;
    for (const key of keys) stats.strings += key.length;
    const required = schema.required;
    if (!Array.isArray(required)) problems.push(`${path}: required must list every property`);
    else {
      const missing = keys.filter((k) => !required.includes(k));
      const extra = required.filter((k) => !Object.prototype.hasOwnProperty.call(props, k));
      if (missing.length) problems.push(`${path}: required missing ${missing.join(",")}`);
      if (extra.length) problems.push(`${path}: required has unknown ${extra.join(",")}`);
    }
    for (const [key, child] of Object.entries(props)) walk(child, `${path}.${key}`, depth + 1, problems, stats);
  }
  if (schema.type === "array" || (Array.isArray(schema.type) && schema.type.includes("array"))) {
    if (!schema.items || typeof schema.items !== "object") problems.push(`${path}: array items required`);
    else walk(schema.items, `${path}[]`, depth + 1, problems, stats);
  }
  if (Array.isArray(schema.anyOf)) {
    schema.anyOf.forEach((branch, i) => walk(branch, `${path}.anyOf[${i}]`, depth + 1, problems, stats));
  }
}

function enumValueMatches(value, types) {
  const actual = jsonType(value);
  return types.some((t) => t === actual || (t === "number" && actual === "integer"));
}

function jsonType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}
