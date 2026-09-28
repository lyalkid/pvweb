// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { I18nProvider } from './i18n/provider';
import { createProject } from './lib/api';
import { deleteDatabase } from './lib/storage/db';

/**
 * Дымовой тест: приложение монтируется, читает локальную базу и показывает
 * список проектов без сервера и без экрана входа.
 */

afterEach(() => {
  cleanup();
});

beforeEach(async () => {
  await deleteDatabase();
  window.location.hash = '';
  localStorage.clear();
});

function renderApp() {
  return render(
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}

describe('App', () => {
  it('открывается сразу на списке проектов, без входа', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByText('Проекты')).toBeTruthy();
    });

    // Экран входа удалён вместе с аутентификацией.
    expect(screen.queryByText('Войти')).toBeNull();
    expect(screen.queryByText('Регистрация')).toBeNull();
    expect(screen.getByText('Данные хранятся')).toBeTruthy();
  });

  it('показывает проекты из локальной базы', async () => {
    await createProject('Сравнение приматов', 'набор деревьев');
    renderApp();

    await waitFor(() => {
      expect(screen.getByText('Сравнение приматов')).toBeTruthy();
    });
    expect(screen.getByText('набор деревьев')).toBeTruthy();
  });

  it('предлагает выгрузить и загрузить резервную копию', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByText('Скачать копию')).toBeTruthy();
    });
    expect(screen.getByText('Загрузить копию')).toBeTruthy();
  });

  it('маршрут в хеше открывает страницу «О приложении»', async () => {
    window.location.hash = '#/about';
    renderApp();

    await waitFor(() => {
      expect(screen.getByText('Назад к проектам')).toBeTruthy();
    });
  });
});
