let openRequested = false;
const subscribers = new Set<() => void>();

export function requestIdeaDialogOpen() {
  openRequested = true;
  subscribers.forEach((subscriber) => subscriber());
}

export function clearIdeaDialogOpenRequest() {
  openRequested = false;
  subscribers.forEach((subscriber) => subscriber());
}

export function getIdeaDialogOpenRequest() {
  return openRequested;
}

export function getServerIdeaDialogOpenRequest() {
  return false;
}

export function subscribeToIdeaDialogOpenRequest(subscriber: () => void) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
