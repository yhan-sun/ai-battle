import { groupSubmissionsByProvider } from './submissions.mjs';

const MODEL_INDEX_START = '<!-- BEGIN: AI_BATTLE_MODEL_INDEX -->';
const MODEL_INDEX_END = '<!-- END: AI_BATTLE_MODEL_INDEX -->';

function escapeMarkdown(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[\r\n]+/g, ' ');
}

function escapeLinkLabel(value) {
  return escapeMarkdown(value).replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function sourceLink(submission) {
  return `[${escapeLinkLabel(submission.path)}](./${submission.path})`;
}

function demoLink(submission) {
  return `[进入 Demo](https://yhan-sun.github.io/ai-battle/${submission.path}/)`;
}

export function createReadmeModelIndex(submissions) {
  const rows = groupSubmissionsByProvider(submissions).flatMap(({ canonical, submissions: group }) =>
    group.map(
      (submission) =>
        `| ${escapeMarkdown(canonical.providerName)} | **${escapeMarkdown(submission.modelName)}** | ${escapeMarkdown(submission.title)} | ${sourceLink(submission)} | ${demoLink(submission)} | v${submission.protocolVersion} |`,
    ),
  );

  return [
    MODEL_INDEX_START,
    '> 本区块由 `npm run sync:readme` 根据各参赛目录的 `submission.json` 自动生成，请勿手工编辑。',
    `> 当前自动收录 **${submissions.length}** 个模型；同一公司可以收录多个模型，合并 PR 后会自动追加。`,
    '',
    '| 公司 | 模型 | 作品 | 项目目录 | 在线体验 | 隔离协议 |',
    '| :--- | :--- | :--- | :--- | :--- | :--- |',
    ...rows,
    MODEL_INDEX_END,
  ].join('\n');
}

export function replaceReadmeModelIndex(readme, submissions) {
  const generated = createReadmeModelIndex(submissions);
  const start = readme.indexOf(MODEL_INDEX_START);
  const end = readme.indexOf(MODEL_INDEX_END);

  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `README.md must contain ${MODEL_INDEX_START} and ${MODEL_INDEX_END}`,
    );
  }

  return `${readme.slice(0, start)}${generated}${readme.slice(end + MODEL_INDEX_END.length)}`;
}

export { MODEL_INDEX_END, MODEL_INDEX_START };
