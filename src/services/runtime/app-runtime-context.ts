import { createContext } from 'react';
import type { AppRuntime } from '@/services/runtime/app-runtime';

export const AppRuntimeContext = createContext<AppRuntime | null>(null);
