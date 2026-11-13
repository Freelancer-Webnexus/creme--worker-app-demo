import useDebugScreen from '@/features/debug/hooks/use-debug-screen';
import DebugScreenView from '@/features/debug/screens/debug-screen-view';

const DebugScreen = () => {
	const model = useDebugScreen();
	return <DebugScreenView {...model} />;
};

export default DebugScreen;
