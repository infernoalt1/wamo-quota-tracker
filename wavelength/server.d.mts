import type { Connect } from 'vite';

/** Express sub-application compatible with Vite's Connect middleware. */
export function wavelengthApi(): Connect.NextHandleFunction;
