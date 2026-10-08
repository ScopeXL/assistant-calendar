/** The calendar API's shapes, as the board and editors use them (backend calendar/schemas.py). */
import type { components } from "../../api/schema";

export type Occurrence = components["schemas"]["OccurrenceOut"];
export type CalendarEvent = components["schemas"]["EventOut"];
export type CalendarInfo = components["schemas"]["CalendarOut"];
export type Change = components["schemas"]["ChangeOut"];
/** What an add or a change sends; a change says which ones apart from these. */
export type EventFields = Omit<
  components["schemas"]["EventUpdate"],
  "scope" | "expected_version" | "clear_rrule" | "clear_color"
>;
export type Scope = "this" | "following" | "all";
export type PersonColor = components["schemas"]["MemberOut"]["color"];
