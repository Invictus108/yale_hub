/**
 * Jack owns Google Calendar access. Calendar tools should call these functions.
 * OAuth tokens belong in data/calendar/, which is Jack's state. Do not put tokens in the profile.
 */

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
}

export interface CalendarEventDraft {
  title: string;
  start: string;
  end: string;
  location?: string;
}

export interface CalendarEventPatch {
  title?: string;
  start?: string;
  end?: string;
  location?: string;
}

export async function listEvents(
  _netId: string,
  _range: { timeMin?: string; timeMax?: string },
): Promise<CalendarEvent[]> {
  throw new Error("TODO(jack): list Google Calendar events for this NetID.");
}

export async function createEvent(_netId: string, _draft: CalendarEventDraft): Promise<CalendarEvent> {
  throw new Error("TODO(jack): create a Google Calendar event.");
}

export async function updateEvent(
  _netId: string,
  _eventId: string,
  _patch: CalendarEventPatch,
): Promise<CalendarEvent> {
  throw new Error("TODO(jack): update a Google Calendar event.");
}

export async function deleteEvent(_netId: string, _eventId: string): Promise<void> {
  throw new Error("TODO(jack): delete a Google Calendar event.");
}
