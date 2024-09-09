import { parsePullRequestReleaseNotesBody } from './parsing/parsePullRequestReleaseNotesBody';
import { releaseNotesUpdater } from './parsing/releaseNotesUpdater';
import * as github from '@actions/github';
import { getRelease } from './getRelease';
import { calculateReleaseVersion } from './calculateReleaseVersion';
import { getPullRequestReleaseNotesBody } from './parsing/getPullRequestReleaseNotesBody';

const EMPTY_NOTES = '-';

const VKUI_AUTHORS = [
  'andrey-medvedev-vk',
  'BlackySoul',
  'EldarMuhamethanov',
  'inomdzhon',
  'SevereCloud',
];

export const updateReleaseNotes = async ({
  octokit,
  owner,
  repo,
  prNumber,
}: {
  octokit: ReturnType<typeof github.getOctokit>;
  owner: string;
  repo: string;
  prNumber: number;
}) => {
  let pullRequest;
  try {
    const { data: searchedPullRequest } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    pullRequest = searchedPullRequest;
  } catch (e) {}

  if (!pullRequest) {
    return;
  }
  const pullRequestBody = pullRequest.body;
  const pullRequestLabels = pullRequest.labels;
  const author = pullRequest.user.login;

  const pullRequestReleaseNotesBody =
    pullRequestBody && getPullRequestReleaseNotesBody(pullRequestBody);

  if (pullRequestReleaseNotesBody === EMPTY_NOTES) {
    return;
  }

  const pullRequestReleaseNotes =
    pullRequestReleaseNotesBody &&
    parsePullRequestReleaseNotesBody(pullRequestReleaseNotesBody, prNumber);

  const releaseVersion = await calculateReleaseVersion({
    octokit,
    repo,
    owner,
    labels: pullRequestLabels,
    milestone: pullRequest.milestone,
  });

  if (!releaseVersion) {
    return;
  }

  const release = await getRelease({
    owner,
    repo,
    octokit,
    releaseVersion,
  });

  if (!release || !release.draft) {
    return;
  }

  const releaseUpdater = releaseNotesUpdater(release.body || '');

  if (pullRequestReleaseNotes) {
    pullRequestReleaseNotes.forEach((note) => {
      releaseUpdater.addNotes({
        noteData: note,
        version: releaseVersion,
        author: VKUI_AUTHORS.includes(author) ? '' : author,
      });
    });
  } else {
    releaseUpdater.addUndescribedPRNumber(prNumber);
  }

  await octokit.rest.repos.updateRelease({
    owner,
    repo,
    release_id: release.id,
    body: releaseUpdater.getBody(),
  });
};
