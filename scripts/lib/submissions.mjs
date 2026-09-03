import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSubmissionSlug, validateSubmissionMetadata } from './submission-metadata.mjs';

const ignoredDirectories = new Set([
  '.git',
  '.github',
  'node_modules',
  'output',
  'pages',
  'scripts',
  'site',
]);
const historicalProtocolZeroPaths = new Set([
  'openai/gpt-5.6-luna-max',
  'google/gemini-3.8-flash-high',
  'meta/muse-spark-1.3',
  'deepseek/deepseek-v4-flash-0731',
  'teleagent/pro',
]);

export function readSubmission(root, providerSlug, modelSlug) {
  if (!isSubmissionSlug(providerSlug) || !isSubmissionSlug(modelSlug)) {
    throw new Error(`Invalid submission path: ${providerSlug}/${modelSlug}`);
  }

  const relativePath = `${providerSlug}/${modelSlug}`;
  const projectRoot = join(root, relativePath);
  const metadataPath = join(projectRoot, 'submission.json');
  if (!existsSync(metadataPath)) {
    throw new Error(`Missing submission metadata: ${metadataPath}`);
  }

  let metadata;
  try {
    metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  } catch (error) {
    throw new Error(`${metadataPath}: invalid JSON (${error.message})`);
  }

  const submission = validateSubmissionMetadata(metadata, {
    metadataPath,
    providerSlug,
    modelSlug,
  });
  if (submission.protocolVersion === 0 && !historicalProtocolZeroPaths.has(relativePath)) {
    throw new Error(
      `${metadataPath}: protocolVersion 0 is reserved for recorded historical submissions`,
    );
  }

  return {
    ...submission,
    path: relativePath,
    root: projectRoot,
    screenshotSlug: `${providerSlug}-${modelSlug}`,
    metadataPath,
  };
}

export function discoverSubmissions(root) {
  const submissions = [];

  for (const provider of readdirSync(root, { withFileTypes: true })) {
    if (!provider.isDirectory() || ignoredDirectories.has(provider.name)) continue;
    const providerRoot = join(root, provider.name);

    for (const model of readdirSync(providerRoot, { withFileTypes: true })) {
      if (!model.isDirectory()) continue;
      if (!existsSync(join(providerRoot, model.name, 'submission.json'))) continue;
      submissions.push(readSubmission(root, provider.name, model.name));
    }
  }

  return submissions.sort(
    (a, b) =>
      a.providerOrder - b.providerOrder ||
      a.providerName.localeCompare(b.providerName) ||
      a.modelOrder - b.modelOrder ||
      a.modelName.localeCompare(b.modelName),
  );
}

function compareProviderCandidates(a, b) {
  const aIsHistorical = a.protocolVersion === 0 ? 0 : 1;
  const bIsHistorical = b.protocolVersion === 0 ? 0 : 1;
  return (
    aIsHistorical - bIsHistorical ||
    a.providerOrder - b.providerOrder ||
    a.providerName.localeCompare(b.providerName) ||
    a.path.localeCompare(b.path)
  );
}

function compareModels(a, b) {
  return (
    a.modelOrder - b.modelOrder ||
    a.modelName.localeCompare(b.modelName) ||
    a.path.localeCompare(b.path)
  );
}

export function groupSubmissionsByProvider(submissions) {
  const submissionsByProvider = new Map();

  for (const submission of submissions) {
    const group = submissionsByProvider.get(submission.provider) ?? [];
    group.push(submission);
    submissionsByProvider.set(submission.provider, group);
  }

  return [...submissionsByProvider.values()]
    .map((group) => {
      const canonical = [...group].sort(compareProviderCandidates)[0];
      return {
        canonical,
        submissions: group.sort(compareModels),
      };
    })
    .sort(
      (a, b) =>
        a.canonical.providerOrder - b.canonical.providerOrder ||
        a.canonical.providerName.localeCompare(b.canonical.providerName) ||
        a.canonical.provider.localeCompare(b.canonical.provider),
    );
}

export function createPublicManifest(submissions) {
  const providers = groupSubmissionsByProvider(submissions).map(({ canonical, submissions: group }) => {
    const provider = {
      slug: canonical.provider,
      name: canonical.providerName,
      code: canonical.provider.toUpperCase(),
      accent: canonical.providerAccent,
      order: canonical.providerOrder,
      models: group.map((submission) => ({
        slug: submission.model,
        name: submission.modelName,
        title: submission.title,
        tag: submission.tag,
        order: submission.modelOrder,
        protocolVersion: submission.protocolVersion,
        path: `./${submission.path}/`,
        image: submission.publicImage ?? `./output/covers/${submission.screenshotSlug}.svg`,
      })),
    };

    const metadataVariants = new Set(
      group.map((submission) =>
        [submission.providerName, submission.providerAccent, submission.providerOrder].join('|'),
      ),
    );
    if (metadataVariants.size > 1) {
      console.warn(
        `Provider metadata differs for ${canonical.provider}; using the established provider metadata from ${canonical.path}`,
      );
    }

    return {
      ...provider,
      mark: [...provider.name][0]?.toUpperCase() ?? '?',
      note: `${provider.name} 当前收录 ${provider.models.length} 个可试玩模型。点击任一封面直接进入。`,
    };
  });

  return { schemaVersion: 1, providers };
}
