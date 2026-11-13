/**
 * A loading card and the ready card it turns into share this minimum, so data
 * arrival moves the page by little or nothing. Measured on a 360 dp phone at
 * the default font size: the home order card is about 290 dp and the terms
 * card about 318 dp, so this stays just under both and the ready card never
 * shows empty space at the bottom.
 */
export const skeletonMinHeight = 280;

/** The home timeline card measures about 235 dp at the default font size. */
export const timelineSkeletonMinHeight = 220;
