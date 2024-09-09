import { describe, expect, it, jest } from '@jest/globals';
import * as github from '@actions/github';
import { updateReleaseNotes } from './updateReleaseNotes';

type Octokit = ReturnType<typeof github.getOctokit>;
type ArrayElement<ArrayType extends any[] | undefined> =
  ArrayType extends Array<infer ElementType> ? ElementType : never;

const setupData = () => {
  const getPullRequest = jest.fn();
  const getReleaseRequest = jest.fn();
  const createReleaseRequest = jest.fn();
  const updateReleaseRequest = jest.fn();

  const pullRequestData: Partial<Awaited<ReturnType<Octokit['rest']['pulls']['get']>>['data']> = {
    body: '',
    labels: [],
    milestone: null,
  };

  let releaseData: Partial<
    Awaited<ReturnType<Octokit['rest']['repos']['getReleaseByTag']>>['data']
  > | null = null;

  let lastReleaseName = '';

  const octokit = {
    rest: {
      pulls: {
        get: (async (options) => {
          getPullRequest(options);
          return { data: pullRequestData };
        }) as Octokit['rest']['pulls']['get'],
      },
      repos: {
        listReleases: (async (options) => {
          getReleaseRequest(options);
          return {
            data: [releaseData],
          };
        }) as Octokit['rest']['repos']['listReleases'],
        getLatestRelease: (async () => {
          return {
            data: {
              name: lastReleaseName,
            },
          };
        }) as Octokit['rest']['repos']['getLatestRelease'],
        createRelease: (async (options) => {
          createReleaseRequest(options);
          releaseData = {
            id: 123456,
            body: '',
            draft: true,
          };
          return { data: releaseData };
        }) as Octokit['rest']['repos']['createRelease'],
        updateRelease: ((options) => {
          updateReleaseRequest(options);
        }) as Octokit['rest']['repos']['updateRelease'],
      },
    },
  };

  return {
    getPullRequest,
    getReleaseRequest,
    createReleaseRequest,
    updateReleaseRequest,
    octokit: octokit as unknown as Octokit,
    set lastReleaseName(name: string) {
      lastReleaseName = name;
    },
    set pullRequestData(
      data: Partial<Omit<typeof pullRequestData, 'user' | 'labels'>> & {
        user?: Partial<(typeof pullRequestData)['user']>;
        labels?: Array<Partial<ArrayElement<(typeof pullRequestData)['labels']>>>;
      },
    ) {
      if (data.milestone) {
        pullRequestData.milestone = data.milestone;
      }
      if (data.labels) {
        pullRequestData.labels = data.labels as (typeof pullRequestData)['labels'];
      }
      if (data.body) {
        pullRequestData.body = data.body;
      }
      if (data.user) {
        pullRequestData.user = data.user as (typeof pullRequestData)['user'];
      }
    },
    set releaseData(data: Partial<typeof releaseData>) {
      if (!data) {
        releaseData = data;
        return;
      } else {
        releaseData = {};
      }
      if (data.draft !== undefined) {
        releaseData.draft = data.draft;
      }
      if (data.body) {
        releaseData.body = data.body;
      }
      if (data.id) {
        releaseData.id = data.id;
      }
      if (data.name) {
        releaseData.name = data.name;
      }
    },
  };
};

describe('run updateReleaseNotes', () => {
  it('add notes to existed sections', async () => {
    const mockedData = setupData();

    mockedData.releaseData = {
      draft: true,
      id: 123,
      name: 'v6.6.0',
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Улучшения
- [ChipsSelect](https://vkcom.github.io/VKUI/6.3.0/#/ChipsSelect): Улучшение компонента ChipsSelect (#7023)

## Исправления
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List (#7094)

## Зависимости
- Обновлена какая-то зависимость 1

## Документация
- CustomScrollView: Обновлена документация CustomScrollView`,
    };

    mockedData.pullRequestData = {
      body: `
## Описание
Какое-то описание Pull Request

## Изменения
Какие-то изменения Pull Request

## Release notes
## Новые компоненты
- Новый компонент с название COMPONENT2
Картинка с новым компонентом
Какая-то доп информация
- Новый компонент с название COMPONENT3

## Улучшения
- [ChipsSelect](https://vkcom.github.io/VKUI/6.3.0/#/ChipsSelect): Улучшение компонента ChipsSelect 2
Немного подробнее об этом. Можно приложить картинку
- ChipsInput: Улучшение компонента ChipsInput

## Исправления
- [Flex](https://vkcom.github.io/VKUI/6.3.0/#/Flex): Исправление компонента Flex
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List 2

## Зависимости
- Обновлена какая-то зависимость 2

## Документация
- Поправлены баги в документации
`,
      user: {
        login: 'other',
      },
    };

    mockedData.lastReleaseName = 'v6.5.1';

    await updateReleaseNotes({
      octokit: mockedData.octokit,
      owner: 'owner',
      repo: 'repo',
      prNumber: 1234,
    });
    expect(mockedData.createReleaseRequest).toHaveBeenCalledTimes(0);
    expect(mockedData.getReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      per_page: 10,
    });

    expect(mockedData.updateReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      release_id: 123,
      body: `
## Новые компоненты\r
- Новый компонент с название COMPONENT\r
- Новый компонент с название COMPONENT2 (#1234, спасибо @other)\r
Картинка с новым компонентом\r
Какая-то доп информация\r
- Новый компонент с название COMPONENT3 (#1234, спасибо @other)\r
\r
## Улучшения\r
- [ChipsSelect](https://vkcom.github.io/VKUI/6.6.0/#/ChipsSelect):\r
  - Улучшение компонента ChipsSelect (#7023)\r
  - Улучшение компонента ChipsSelect 2 (#1234, спасибо @other)\r
Немного подробнее об этом. Можно приложить картинку\r
- [ChipsInput](https://vkcom.github.io/VKUI/6.6.0/#/ChipsInput): Улучшение компонента ChipsInput (#1234, спасибо @other)\r
\r
## Исправления\r
- [List](https://vkcom.github.io/VKUI/6.6.0/#/List):\r
  - Исправление компонента List (#7094)\r
  - Исправление компонента List 2 (#1234, спасибо @other)\r
- [Flex](https://vkcom.github.io/VKUI/6.6.0/#/Flex): Исправление компонента Flex (#1234, спасибо @other)\r
\r
## Зависимости\r
- Обновлена какая-то зависимость 1\r
- Обновлена какая-то зависимость 2 (#1234, спасибо @other)\r
\r
## Документация\r
- [CustomScrollView](https://vkcom.github.io/VKUI/6.6.0/#/CustomScrollView): Обновлена документация CustomScrollView\r
- Поправлены баги в документации (#1234, спасибо @other)\r
\r
`,
    });
  });

  it('add notes to not existed section', async () => {
    const mockedData = setupData();

    mockedData.releaseData = {
      draft: true,
      id: 123,
      name: 'v6.6.0',
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Исправления
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List (#7094)

## Документация
- [CustomScrollView](https://vkcom.github.io/VKUI/6.5.0/#/CustomScrollView): Обновлена документация CustomScrollView`,
    };

    mockedData.pullRequestData = {
      body: `
## Описание
Какое-то описание Pull Request

## Изменения
Какие-то изменения Pull Request

## Release notes
## Новые компоненты
- Новый компонент с название COMPONENT2
- Новый компонент с название COMPONENT3

## Улучшения
- [ChipsSelect](https://vkcom.github.io/VKUI/6.3.0/#/ChipsSelect): Улучшение компонента ChipsSelect 2
- [ChipsInput](https://vkcom.github.io/VKUI/6.3.0/#/ChipsInput): Улучшение компонента ChipsInput

## Исправления
- [Flex](https://vkcom.github.io/VKUI/6.3.0/#/Flex): Исправление компонента Flex
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List 2

## Зависимости
- Обновлена какая-то зависимость 2

## Документация
- Поправлены баги в документации
`,
      user: {
        login: 'EldarMuhamethanov',
      },
    };

    mockedData.lastReleaseName = 'v6.5.1';

    await updateReleaseNotes({
      octokit: mockedData.octokit,
      owner: 'owner',
      repo: 'repo',
      prNumber: 1234,
    });
    expect(mockedData.createReleaseRequest).toHaveBeenCalledTimes(0);
    expect(mockedData.getReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      per_page: 10,
    });

    expect(mockedData.updateReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      release_id: 123,
      body: `
## Новые компоненты\r
- Новый компонент с название COMPONENT\r
- Новый компонент с название COMPONENT2 (#1234)\r
- Новый компонент с название COMPONENT3 (#1234)\r
\r
## Исправления\r
- [List](https://vkcom.github.io/VKUI/6.6.0/#/List):\r
  - Исправление компонента List (#7094)\r
  - Исправление компонента List 2 (#1234)\r
- [Flex](https://vkcom.github.io/VKUI/6.6.0/#/Flex): Исправление компонента Flex (#1234)\r
\r
## Документация\r
- [CustomScrollView](https://vkcom.github.io/VKUI/6.6.0/#/CustomScrollView): Обновлена документация CustomScrollView\r
- Поправлены баги в документации (#1234)\r
\r
## Улучшения\r
- [ChipsSelect](https://vkcom.github.io/VKUI/6.6.0/#/ChipsSelect): Улучшение компонента ChipsSelect 2 (#1234)\r
- [ChipsInput](https://vkcom.github.io/VKUI/6.6.0/#/ChipsInput): Улучшение компонента ChipsInput (#1234)\r
\r
## Зависимости\r
- Обновлена какая-то зависимость 2 (#1234)\r
`,
    });
  });

  it('update release notes with pull request without release notes', async () => {
    const mockedData = setupData();

    mockedData.releaseData = {
      draft: true,
      id: 123,
      name: 'v6.6.0',
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Исправления
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List (#7094)

## Документация
- [CustomScrollView](https://vkcom.github.io/VKUI/6.5.0/#/CustomScrollView): Обновлена документация CustomScrollView
`,
    };

    mockedData.pullRequestData = {
      body: `
## Описание
Какое-то описание Pull Request

## Изменения
Какие-то изменения Pull Request
`,
      user: {
        login: 'EldarMuhamethanov',
      },
    };
    mockedData.lastReleaseName = 'v6.5.1';

    await updateReleaseNotes({
      octokit: mockedData.octokit,
      owner: 'owner',
      repo: 'repo',
      prNumber: 1234,
    });
    expect(mockedData.createReleaseRequest).toHaveBeenCalledTimes(0);
    expect(mockedData.getReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      per_page: 10,
    });

    expect(mockedData.updateReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      release_id: 123,
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT

## Исправления
- [List](https://vkcom.github.io/VKUI/6.3.0/#/List): Исправление компонента List (#7094)

## Документация
- [CustomScrollView](https://vkcom.github.io/VKUI/6.5.0/#/CustomScrollView): Обновлена документация CustomScrollView
\r
## Нужно описать\r
#1234`,
    });
  });

  it('check update next patch version release notes', async () => {
    const mockedData = setupData();

    mockedData.releaseData = {
      draft: true,
      id: 123,
      name: 'v6.5.2',
      body: `
## Новые компоненты
- Новый компонент с название COMPONENT
`,
    };

    mockedData.pullRequestData = {
      body: `
## Release notes
## Новые компоненты
- Новый компонент с название COMPONENT2
- Новый компонент с название COMPONENT3
`,
      user: {
        login: 'eldar',
      },
      labels: [
        {
          name: 'patch',
        },
      ],
    };

    mockedData.lastReleaseName = 'v6.5.1';

    await updateReleaseNotes({
      octokit: mockedData.octokit,
      owner: 'owner',
      repo: 'repo',
      prNumber: 1234,
    });
    expect(mockedData.createReleaseRequest).toHaveBeenCalledTimes(0);
    expect(mockedData.getReleaseRequest).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      per_page: 10,
    });
  });
});
