import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearConversations, getConversationStorageEpoch, saveConversations } from '../askLotti/chatStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
 __esModule: true,
 default: { setItem: jest.fn(), removeItem: jest.fn(), getItem: jest.fn() },
}));
const conversation = [{ id: 'synthetic', title: 'Test', createdAt: '2026-09-11', updatedAt: '2026-09-11', messages: [{ id: 'message', role: 'user' as const, text: 'Synthetic test' }] }];
beforeEach(() => { jest.clearAllMocks(); });
it('waits for an in-flight write before removal and rejects a stale screen write', async () => {
 let finishWrite!: () => void;
 (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { finishWrite = resolve; }));
 const epoch = getConversationStorageEpoch();
 const save = saveConversations(conversation, epoch);
 await Promise.resolve();
 const clear = clearConversations();
 const staleSave = saveConversations(conversation, epoch);
 expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
 finishWrite();
 await Promise.all([save, clear, staleSave]);
 expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
 expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
 await saveConversations(conversation, getConversationStorageEpoch());
 expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
});
it('reports a failed deletion to the cleanup caller', async () => {
 (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('device unavailable'));
 await expect(clearConversations()).rejects.toThrow('device unavailable');
 // A failed attempt must not poison subsequent cleanup.
 await expect(clearConversations()).resolves.toBeUndefined();
});
