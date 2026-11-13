import type { PropsWithChildren } from 'react';
import QueryProvider from '@/services/query/query-provider';
import AppRuntimeProvider from '@/services/runtime/app-runtime-provider';

const AppProviders = (props: PropsWithChildren) => {
	return (
		<QueryProvider>
			<AppRuntimeProvider>{props.children}</AppRuntimeProvider>
		</QueryProvider>
	);
};

export default AppProviders;
