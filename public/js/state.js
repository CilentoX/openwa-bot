// === GLOBAL STATE MODULE ===

export const state = {
  conversations: {},
  currentChatId: '',
  unreadCounts: {},
  activeGroups: [],
  currentSessionId: '',
  allCommands: [],
  allQnas: [],
  allMenusList: [],
  contactsMap: {},      // Maps JID -> pushName / name from contacts list
  archivedJids: new Set()  // Set of JIDs archived locally
};
