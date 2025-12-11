import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// Mock fetch globally
beforeAll(() => {
  global.fetch = jest.fn();
});
afterAll(() => {
  if (global.fetch && global.fetch.mockRestore) {
    global.fetch.mockRestore();
  }
});
beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
  if (global.fetch.mockReset) {
    global.fetch.mockReset();
  }
});

// Helper to render and set route
function renderWithRoute(ui, { route = '/groc/' } = {}) {
  window.history.pushState({}, 'Test page', route);
  return render(ui);
}

// --- LOGIN/SIGNUP FLOW ---
test('login success redirects to recipes', async () => {
  global.fetch.mockImplementation((url) => {
    if (url.endsWith('/api/token/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ access: 'jwt-token' })
      });
    }
    if (url.endsWith('/api/grocery-lists/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  renderWithRoute(<App />, { route: '/groc/login' });
  fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'user' } });
  fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'pass' } });
  fireEvent.click(screen.getByRole('button', { name: /login/i }));
  await screen.findByText(/current recipes/i);
});

test('login failure shows error', async () => {
  global.fetch.mockImplementation(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  }));
  renderWithRoute(<App />, { route: '/groc/login' });
  fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'bad' } });
  fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'bad' } });
  fireEvent.click(screen.getByRole('button', { name: /login/i }));
  await screen.findByText(/login failed/i);
});

test('signup failure shows error', async () => {
  global.fetch.mockImplementation((url) => {
    if (url.endsWith('/api/users/')) {
      return Promise.resolve({ ok: false });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
  renderWithRoute(<App />, { route: '/groc/login' });
  fireEvent.click(screen.getByRole('button', { name: /no account\? sign up/i }));
  fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'newuser' } });
  fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'pass' } });
  fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'test@test.com' } });
  fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
  await screen.findByText(/signup failed/i);
});

// --- PROTECTED ROUTES ---
test('redirects to login for protected route when not authenticated', async () => {
  renderWithRoute(<App />, { route: '/groc/recipes' });
  const loginElements = await screen.findAllByText(/login/i);
  expect(loginElements.length).toBeGreaterThan(0);
});

test('shows logout when authenticated', async () => {
  localStorage.setItem('jwt', 'token');
  global.fetch.mockImplementation(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  renderWithRoute(<App />, { route: '/groc/recipes' });
  await screen.findByText(/logout/i);
});

// --- RECIPES PAGE ---
test('recipes page loads and displays recipes', async () => {
  localStorage.setItem('jwt', 'token');
  global.fetch.mockImplementation((url) => {
    if (url.endsWith('/api/grocery-lists/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 1 }]) });
    }
    if (url.includes('/api/grocery-list-recipes/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { id: 10, recipe: 100, servings: 2, datetime_added: '2024-06-01T12:00:00Z' }
      ]) });
    }
    if (url.includes('/api/recipes/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { id: 100, title: 'Test Recipe' }
      ]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  renderWithRoute(<App />, { route: '/groc/recipes' });
  await screen.findByText(/test recipe/i);
  expect(screen.getByText(/servings: 2/i)).toBeInTheDocument();
  expect(screen.getByText(/added:/i)).toBeInTheDocument();
});

test('recipes page handles error', async () => {
  localStorage.setItem('jwt', 'token');
  global.fetch.mockImplementation(() => Promise.reject('API error'));
  renderWithRoute(<App />, { route: '/groc/recipes' });
  await screen.findByText(/failed to load grocery lists/i);
});

test('change servings and delete entry', async () => {
  localStorage.setItem('jwt', 'token');
  let patchCalled = false, deleteCalled = false;
  global.fetch.mockImplementation((url, opts) => {
    if (url.endsWith('/api/grocery-lists/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 1 }]) });
    }
    if (url.includes('/api/grocery-list-recipes/')) {
      if (opts && opts.method === 'PATCH') {
        patchCalled = true;
        return Promise.resolve({ ok: true });
      }
      if (opts && opts.method === 'DELETE') {
        deleteCalled = true;
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { id: 10, recipe: 100, servings: 2, datetime_added: '2024-06-01T12:00:00Z' }
      ]) });
    }
    if (url.includes('/api/recipes/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { id: 100, title: 'Test Recipe' }
      ]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  renderWithRoute(<App />, { route: '/groc/recipes' });
  await screen.findByText(/test recipe/i);
  fireEvent.click(screen.getByTitle(/decrease servings/i));
  expect(patchCalled).toBe(true);
  fireEvent.click(screen.getByTitle(/delete entry/i));
  expect(deleteCalled).toBe(true);
});

// --- INGREDIENTS PAGE ---
test('ingredients page loads and groups items', async () => {
  localStorage.setItem('jwt', 'token');
  global.fetch.mockImplementation((url) => {
    if (url.endsWith('/api/grocery-lists/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 1 }]) });
    }
    if (url.includes('/api/grocery_list_ingredients/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { ingredient_id: 1, ingredient_name: 'Milk', quantity: 2, unit: 'L', ingredient_category: 'dairy and eggs' },
        { ingredient_id: 2, ingredient_name: 'Apple', quantity: 3, unit: 'pcs', ingredient_category: 'produce' }
      ]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  renderWithRoute(<App />, { route: '/groc/ingredients' });
  await screen.findByText(/milk/i);
  expect(screen.getByText(/apple/i)).toBeInTheDocument();
  expect(screen.getByText(/dairy and eggs/i)).toBeInTheDocument();
  expect(screen.getByText(/produce/i)).toBeInTheDocument();
});

test('ingredients page checkboxes work', async () => {
  localStorage.setItem('jwt', 'token');
  global.fetch.mockImplementation((url) => {
    if (url.endsWith('/api/grocery-lists/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 1 }]) });
    }
    if (url.includes('/api/grocery_list_ingredients/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { ingredient_id: 1, ingredient_name: 'Milk', quantity: 2, unit: 'L', ingredient_category: 'dairy and eggs' }
      ]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  renderWithRoute(<App />, { route: '/groc/ingredients' });
  await screen.findByText(/milk/i);
  const checkbox = screen.getByRole('checkbox');
  expect(checkbox.checked).toBe(false);
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(true);
});

// --- QR TEST PAGE ---
test('qr test page renders qr codes', async () => {
  localStorage.setItem('jwt', 'token');
  global.fetch.mockImplementation((url) => {
    if (url.endsWith('/api/recipes/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([
        { id: 101, title: 'QR Recipe' }
      ]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
  renderWithRoute(<App />, { route: '/groc/qr-test' });
  await screen.findByText(/qr recipe/i);
  expect(screen.getByText(/qr code test page/i)).toBeInTheDocument();
});

// --- NAVBAR ---
test('navbar links present for unauthenticated', async () => {
  renderWithRoute(<App />, { route: '/groc/' });
  await screen.findByText(/recipes/i);
  await screen.findByText(/ingredients/i);
  await screen.findByText(/qr test/i);
  const loginElements = await screen.findAllByText(/login/i);
  expect(loginElements.length).toBeGreaterThan(0);
});

test('navbar logout for authenticated', async () => {
  localStorage.setItem('jwt', 'token');
  global.fetch.mockImplementation(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  renderWithRoute(<App />, { route: '/groc/recipes' });
  await screen.findByText(/logout/i);
  fireEvent.click(screen.getByText(/logout/i));
  await screen.findByText(/login/i);
});
