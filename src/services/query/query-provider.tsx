import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureQueryManagers } from '@/services/query/query-managers';

const QueryProvider = (props: PropsWithChildren) => {
	const [client] = useState(() => {
		configureQueryManagers();
		return new QueryClient();
	});

	return (
		<QueryClientProvider client={client}>{props.children}</QueryClientProvider>
	);
};

export default QueryProvider;
