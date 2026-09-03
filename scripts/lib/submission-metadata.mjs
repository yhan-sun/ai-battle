const slugPattern = /^[a-z0-9][a-z0-9.-]*$/;
const accentPattern = /^#[0-9a-fA-F]{6}$/;

function fail(metadataPath, message) {
  throw new Error(`${metadataPath}: ${message}`);
}

function requireObject(value, metadataPath, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(metadataPath, `${field} must be an object`);
  }
}

function requireKnownKeys(value, allowedKeys, metadataPath, field) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) fail(metadataPath, `${field}.${key} is not allowed`);
  }
}

function requireText(value, metadataPath, field, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    fail(metadataPath, `${field} must be a non-empty string up to ${maxLength} characters`);
  }
}

function readOrder(value, metadataPath, field) {
  if (value === undefined) return 1000;
  if (!Number.isInteger(value) || value < 0 || value > 9999) {
    fail(metadataPath, `${field} must be an integer between 0 and 9999`);
  }
  return value;
}

export function isSubmissionSlug(value) {
  return typeof value === 'string' && slugPattern.test(value);
}

export function validateSubmissionMetadata(
  metadata,
  { metadataPath = 'submission.json', providerSlug, modelSlug } = {},
) {
  requireObject(metadata, metadataPath, 'root');
  requireKnownKeys(
    metadata,
    new Set(['schemaVersion', 'protocolVersion', 'provider', 'model', 'demo']),
    metadataPath,
    'root',
  );
  requireObject(metadata.provider, metadataPath, 'provider');
  requireObject(metadata.model, metadataPath, 'model');
  requireObject(metadata.demo, metadataPath, 'demo');
  requireKnownKeys(
    metadata.provider,
    new Set(['slug', 'name', 'accent', 'order']),
    metadataPath,
    'provider',
  );
  requireKnownKeys(
    metadata.model,
    new Set(['slug', 'name', 'order']),
    metadataPath,
    'model',
  );
  requireKnownKeys(metadata.demo, new Set(['title', 'tag']), metadataPath, 'demo');

  if (metadata.schemaVersion !== 1) fail(metadataPath, 'schemaVersion must be 1');
  if (![0, 1].includes(metadata.protocolVersion)) {
    fail(metadataPath, 'protocolVersion must be 0 or 1');
  }

  requireText(metadata.provider.slug, metadataPath, 'provider.slug', 80);
  requireText(metadata.provider.name, metadataPath, 'provider.name', 40);
  requireText(metadata.provider.accent, metadataPath, 'provider.accent', 7);
  requireText(metadata.model.slug, metadataPath, 'model.slug', 80);
  requireText(metadata.model.name, metadataPath, 'model.name', 80);
  requireText(metadata.demo.title, metadataPath, 'demo.title', 100);
  requireText(metadata.demo.tag, metadataPath, 'demo.tag', 16);

  if (!isSubmissionSlug(metadata.provider.slug)) {
    fail(metadataPath, 'provider.slug must be a lowercase path slug');
  }
  if (!isSubmissionSlug(metadata.model.slug)) {
    fail(metadataPath, 'model.slug must be a lowercase path slug');
  }
  if (providerSlug !== undefined && metadata.provider.slug !== providerSlug) {
    fail(metadataPath, `provider.slug must match directory "${providerSlug}"`);
  }
  if (modelSlug !== undefined && metadata.model.slug !== modelSlug) {
    fail(metadataPath, `model.slug must match directory "${modelSlug}"`);
  }
  if (!accentPattern.test(metadata.provider.accent)) {
    fail(metadataPath, 'provider.accent must be a six-digit hex color');
  }

  return {
    provider: metadata.provider.slug,
    providerName: metadata.provider.name.trim(),
    providerAccent: metadata.provider.accent,
    providerOrder: readOrder(metadata.provider.order, metadataPath, 'provider.order'),
    model: metadata.model.slug,
    modelName: metadata.model.name.trim(),
    modelOrder: readOrder(metadata.model.order, metadataPath, 'model.order'),
    title: metadata.demo.title.trim(),
    tag: metadata.demo.tag.trim(),
    protocolVersion: metadata.protocolVersion,
  };
}
