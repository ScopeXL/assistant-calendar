import { createStore } from "../../lib/store";
import { ZOOM_STEP } from "./hours";

/**
 * How far the Hours grid can zoom in right now. It depends on the grid's height and the text
 * size, which only the grid can measure (HoursGrid sets it); the Zoom in button in the board's
 * toolbar reads it to know when to stop. Six steps until the grid has been measured.
 */
export const hoursMaxZoom = createStore<number>(ZOOM_STEP ** 6);
