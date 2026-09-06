import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRecipeFavorites } from '../../hooks/useRecipeFavorites';

// The project does not include renderer type declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

let favorites: ReturnType<typeof useRecipeFavorites>;
function Probe({ userId }: { userId: string }) {
  const value = useRecipeFavorites(userId);
  useEffect(() => { favorites = value; });
  return null;
}
let root: any;
beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

it('restores favorites after remount and persists removal', async () => {
  await act(async () => { root = create(<Probe userId="alice" />); });
  await act(async () => { await favorites.toggle('recipe-1'); });
  expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('recipe-favorites:v1:alice', '["recipe-1"]');
  await act(async () => root.unmount());
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('["recipe-1"]');
  await act(async () => { root = create(<Probe userId="alice" />); });
  expect(favorites.ids).toEqual(['recipe-1']);
  await act(async () => { await favorites.toggle('recipe-1'); });
  expect(favorites.ids).toEqual([]);
  expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('recipe-favorites:v1:alice', '[]');
});

it('keeps the previous selection when saving fails', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('["recipe-1"]');
  await act(async () => { root = create(<Probe userId="alice" />); });
  (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('disk full'));
  await act(async () => { await expect(favorites.toggle('recipe-1')).rejects.toThrow('disk full'); });
  expect(favorites.ids).toEqual(['recipe-1']);
  expect(favorites.busy).toBe(false);
});

it('does not leak a pending save into another account', async () => {
  await act(async () => { root = create(<Probe userId="alice" />); });
  let finish!: () => void;
  (AsyncStorage.setItem as jest.Mock).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = favorites.toggle('alice-recipe'); });
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('["bob-recipe"]');
  await act(async () => { root.update(<Probe userId="bob" />); });
  await act(async () => { finish(); await pending; });
  expect(favorites.ids).toEqual(['bob-recipe']);
});
