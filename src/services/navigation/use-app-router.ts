import { useRouter } from 'expo-router';

/**
 * The one way screens navigate. It is bound to the root that renders the
 * caller. expo-router's shared `router` is not: when Android recreates the
 * activity (the worker changes the font size), the old root unbinds it after
 * the new root bound it, and the next push throws.
 */
const useAppRouter = () => useRouter();

export type AppRouter = ReturnType<typeof useAppRouter>;

export default useAppRouter;
